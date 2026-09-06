import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from '../lib/annotations.ts';
import { wrapText, fitObject, paintObjects } from '../lib/page-objects.ts';
const image = {
  id: 'image-1',
  page: 1,
  kind: 'image',
  src: '/api/documents/sample/images/11111111-1111-4111-8111-111111111111',
  alt: 'Ảnh',
  x: 500,
  y: 800,
  width: 200,
  height: 100,
};
const text = {
  id: 'text-1',
  page: 1,
  kind: 'text',
  text: 'Tiếng Việt\nDòng hai',
  x: 12,
  y: 30,
  width: 180,
  height: 58,
  fontSize: 20,
  color: '#5265db',
};
test('old notes migrate without loss and text/image objects round-trip', () => {
  assert.deepEqual(validate({ strokes: [], notes: [] }), {
    strokes: [],
    notes: [],
    objects: [],
  });
  const state = { strokes: [], notes: [], objects: [image, text] };
  assert.deepEqual(validate(JSON.parse(JSON.stringify(state))), state);
  for (const object of [
    { ...image, src: 'https://outside.example/image.png' },
    { ...image, src: 'data:image/svg+xml,<svg/>' },
    { ...text, fontSize: NaN },
    { ...text, text: ' ' },
    { ...image, width: -2 },
  ])
    assert.equal(validate({ ...state, objects: [object] }), null);
});
test('wrapping preserves Unicode, explicit line breaks and long strings', () => {
  assert.deepEqual(
    wrapText('Tiếng Việt\nabc', 100, (s) => s.length * 5),
    ['Tiếng Việt', 'abc'],
  );
  assert.deepEqual(
    wrapText('abcdef', 15, (s) => s.length * 5),
    ['abc', 'def'],
  );
});
test('image movement clamps to page and resizing preserves aspect ratio', () => {
  const fitted = fitObject(image, { width: 595, height: 842 });
  assert.equal(fitted.x, 395);
  assert.equal(fitted.y, 742);
  assert.equal(fitted.width / fitted.height, 2);
  const tall = fitObject(
    { ...image, width: 100, height: 2000 },
    { width: 595, height: 842 },
  );
  assert.equal(tall.height, 842);
  assert.equal(tall.width / tall.height, 0.05);
});
test('export paints inserted images and multiline text at PDF coordinates', async () => {
  const calls = [];
  globalThis.Image = class {
    async decode() {
      calls.push(['decode', this.src]);
    }
  };
  const ctx = {
    save() {},
    restore() {},
    measureText: (s) => ({ width: s.length * 5 }),
    fillText: (...args) => calls.push(['text', ...args]),
    drawImage: (...args) => calls.push(['image', ...args.slice(1)]),
  };
  await paintObjects(ctx, [image, text]);
  assert.ok(calls.some((c) => c[0] === 'decode' && c[1] === image.src));
  assert.ok(
    calls.some((c) => c[0] === 'image' && c[1] === 500 && c[3] === 200),
  );
  assert.ok(
    calls.some(
      (c) =>
        c[0] === 'text' && c[1] === 'Tiếng Việt' && c[2] === 12 && c[3] === 50,
    ),
  );
  assert.ok(
    calls.some((c) => c[0] === 'text' && c[1] === 'Dòng hai' && c[3] === 76),
  );
});

test('text formatting survives serialization while unsafe or malformed formatting is rejected', () => {
  const styled = {
    ...text,
    fontFamily: 'Liberation Serif',
    bold: true,
    italic: true,
    underline: true,
    strikethrough: true,
    align: 'center',
    lineHeight: 1.5,
  };
  const state = { strokes: [], notes: [], objects: [styled] };
  assert.deepEqual(validate(JSON.parse(JSON.stringify(state))), state);
  for (const patch of [
    { fontFamily: 'url(https://outside.example/font)' },
    { bold: 'true' },
    { underline: 1 },
    { align: 'diagonal' },
    { lineHeight: Infinity },
    { lineHeight: 0 },
  ])
    assert.equal(
      validate({ ...state, objects: [{ ...styled, ...patch }] }),
      null,
    );
});

test('export uses font, weight, italic, line spacing, alignment and decorations', async () => {
  const calls = [];
  const ctx = {
    save() {},
    restore() {},
    measureText: (s) => ({ width: s.length * 10 }),
    fillText: (...args) => calls.push(['text', ...args]),
    beginPath() {},
    moveTo: (...args) => calls.push(['move', ...args]),
    lineTo: (...args) => calls.push(['line', ...args]),
    stroke: () => calls.push(['stroke']),
  };
  await paintObjects(ctx, [
    {
      ...text,
      text: 'AB\nCD',
      width: 100,
      fontFamily: 'Liberation Serif',
      bold: true,
      italic: true,
      underline: true,
      strikethrough: true,
      align: 'center',
      lineHeight: 2,
    },
  ]);
  assert.equal(ctx.font, 'italic 700 20px "Liberation Serif"');
  assert.deepEqual(
    calls.filter((c) => c[0] === 'text'),
    [
      ['text', 'AB', 52, 50],
      ['text', 'CD', 52, 90],
    ],
  );
  assert.ok(calls.some((c) => c[0] === 'move' && c[1] === 52 && c[2] === 52.4));
  assert.ok(calls.some((c) => c[0] === 'move' && c[1] === 52 && c[2] === 44));
  assert.equal(calls.filter((c) => c[0] === 'stroke').length, 2);
});
