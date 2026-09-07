import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WheelPager } from '../lib/wheel-pager.ts';

test('scrolls within the page and changes pages only at the appropriate edge', () => {
  const pager = new WheelPager();
  assert.equal(pager.step(100, 200, 500, 2, 4, 1000), null);
  assert.equal(pager.step(-100, 500, 500, 2, 4, 1100), null);
  assert.equal(pager.step(100, 500, 500, 2, 4, 1200), 1);
  assert.equal(pager.step(-100, 0, 500, 3, 4, 2000), -1);
});

test('does not wrap past the first or last page, including a single-page PDF', () => {
  const pager = new WheelPager();
  assert.equal(pager.step(-100, 0, 500, 1, 4, 1000), null);
  assert.equal(pager.step(100, 500, 500, 4, 4, 1100), null);
  assert.equal(pager.step(100, 0, 0, 1, 1, 1200), null);
});

test('accumulates small trackpad movements and suppresses momentum after switching', () => {
  const pager = new WheelPager();
  assert.equal(pager.step(15, 0, 0, 1, 4, 1000), 0);
  assert.equal(pager.step(15, 0, 0, 1, 4, 1050), 0);
  assert.equal(pager.step(15, 0, 0, 1, 4, 1100), 1);
  assert.equal(pager.step(100, 0, 0, 2, 4, 1200), 0);
  assert.equal(pager.step(100, 0, 0, 2, 4, 1800), 1);
});

test('resets accumulated movement on direction changes and pauses', () => {
  const pager = new WheelPager();
  assert.equal(pager.step(30, 0, 0, 2, 4, 1000), 0);
  assert.equal(pager.step(-20, 0, 0, 2, 4, 1050), 0);
  assert.equal(pager.step(-20, 0, 0, 2, 4, 1400), 0);
  assert.equal(pager.step(-20, 0, 0, 2, 4, 1450), -1);
});
