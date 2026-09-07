import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startupDocument } from '../lib/document-session.ts';

const sample = { id: 'sample', name: 'Sample.pdf', updatedAt: '' };
const first = {
  id: 'first',
  name: 'Same name.pdf',
  updatedAt: '2026-09-07T00:00:00Z',
  lastOpenedAt: '2026-09-07T02:00:00Z',
};
const second = {
  id: 'second',
  name: 'Same name.pdf',
  updatedAt: '2026-09-07T01:00:00Z',
  lastOpenedAt: '2026-09-07T01:00:00Z',
};
test('reload reopens the exact PDF ID, even when names match or another file was opened more recently', () => {
  assert.equal(startupDocument([first, second], 'second', sample), second);
});
test('the root URL resumes the last opened file rather than resetting to the sample', () => {
  assert.equal(startupDocument([second, first], null, sample), first);
  assert.equal(startupDocument([], null, sample), sample);
});
test('sample links remain usable and missing IDs never silently open a different PDF', () => {
  assert.equal(startupDocument([first], 'sample', sample), sample);
  assert.throws(
    () => startupDocument([first], 'missing', sample),
    /Không tìm thấy PDF/,
  );
});
