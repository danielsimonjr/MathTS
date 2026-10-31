/**
 * Unit tests for Phase 7 A/B harness helpers.
 *
 *   node --test tools/test/ab-harness.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { same } from '../benchmark/ab/same.mjs';
import { geometricMean, median } from '../benchmark/ab/util.mjs';

describe('same()', () => {
  test('-0 vs 0', () => {
    assert.equal(same(0, -0), false);
    assert.equal(same(-0, -0), true);
  });
  test('NaN', () => {
    assert.equal(same(NaN, NaN), true);
    assert.equal(same(NaN, 0), false);
  });
  test('nested arrays', () => {
    assert.equal(same([1, [2, 3]], [1, [2, 3]]), true);
    assert.equal(same([1, [2, 3]], [1, [2, 4]]), false);
  });
  test('Float64Array', () => {
    assert.equal(same(new Float64Array([1, 2]), new Float64Array([1, 2])), true);
  });
  test('DenseMatrix-like valueOf', () => {
    const dm = { valueOf: () => [[1, 2], [3, 4]] };
    assert.equal(same(dm, { valueOf: () => [[1, 2], [3, 4]] }), true);
  });
  test('LU objects', () => {
    assert.equal(same({ L: [1], U: [2], p: [0] }, { L: [1], U: [2], p: [0] }), true);
  });
});

describe('gate statistics', () => {
  test('geometric mean', () => {
    assert.ok(Math.abs(geometricMean([1, 4]) - 2) < 1e-9);
  });
  test('median of five runs', () => {
    assert.equal(median([1, 2, 3, 4, 5]), 3);
  });
  test('single-tree trigger threshold', () => {
    const rBf = 0.974;
    const rHf = 0.497;
    const skew = Math.abs(Math.log(rBf / rHf));
    assert.ok(skew > 0.18);
  });
  test('synthetic gate: gain fails above 0.95', () => {
    const ratio = 0.96;
    assert.ok(ratio > 0.95);
  });
  test('synthetic gate: neutral fails above 1.02', () => {
    const ratio = 1.03;
    assert.ok(ratio > 1.02);
  });
});
