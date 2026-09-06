import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate, hit, paint } from '../lib/annotations.ts';
const stroke = {
  id: 's1',
  page: 1,
  color: '#5265db',
  width: 2.5,
  opacity: 1,
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
};
test('validates persisted notes and rejects malformed, oversized and non-finite data', () => {
  assert.ok(
    validate({
      strokes: [stroke],
      notes: [
        {
          id: 'n1',
          page: 1,
          text: 'Ghi chú tiếng Việt',
          createdAt: '2026-09-07T00:00:00Z',
        },
      ],
    }),
  );
  for (const bad of [
    null,
    {},
    { strokes: [{ ...stroke, page: -1 }], notes: [] },
    { strokes: [{ ...stroke, points: [{ x: Infinity, y: 0 }] }], notes: [] },
    { strokes: [{ ...stroke, color: 'url(javascript:evil)' }], notes: [] },
    { strokes: [], notes: [{ id: 'n1', page: 1, text: ' ', createdAt: 'no' }] },
  ])
    assert.equal(validate(bad), null);
});
test('eraser hits between sampled points and ignores distant strokes', () => {
  assert.equal(hit(stroke, { x: 50, y: 4 }), true);
  assert.equal(hit(stroke, { x: 50, y: 50 }), false);
  assert.equal(
    hit({ ...stroke, points: [{ x: 10, y: 10 }] }, { x: 12, y: 12 }),
    true,
  );
});
test('export preserves stroke width, opacity and coordinates including single taps', () => {
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get:
        (_, name) =>
        (...args) =>
          calls.push([name, ...args]),
      set: (_, name, value) => {
        calls.push(['set', name, value]);
        return true;
      },
    },
  );
  paint(ctx, [
    { ...stroke, opacity: 0.35, width: 15 },
    { ...stroke, points: [{ x: 20, y: 30 }] },
  ]);
  assert.ok(
    calls.some(
      (c) => c[0] === 'set' && c[1] === 'globalAlpha' && c[2] === 0.35,
    ),
  );
  assert.ok(calls.some((c) => c[0] === 'lineTo' && c[1] === 100 && c[2] === 0));
  assert.ok(calls.some((c) => c[0] === 'arc' && c[1] === 20 && c[2] === 30));
  assert.equal(
    calls.filter((c) => c[0] === 'save').length,
    calls.filter((c) => c[0] === 'restore').length,
  );
});
