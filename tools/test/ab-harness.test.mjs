/**
 * Unit tests for the Phase 7 A/B harness: result equality and the gate decisions.
 *
 *   node --test tools/test/ab-harness.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CONTROL_BAND,
  GAIN_LIMIT,
  PROCESSES_PER_RUN,
  SLOW_LIMIT,
  estimate,
  failureOf,
  needsRerun,
  twoTreeRatio,
} from '../benchmark/ab/gate.mjs';
import { checkResults, same } from '../benchmark/ab/same.mjs';
import { geometricMean, median, nodeBinary } from '../benchmark/ab/util.mjs';

describe('same()', () => {
  test('-0 and 0 differ, -0 equals -0', () => {
    assert.equal(same(0, -0), false);
    assert.equal(same(-0, -0), true);
    assert.equal(same([0], [-0]), false);
  });

  test('NaN equals NaN and differs from 0', () => {
    assert.equal(same(NaN, NaN), true);
    assert.equal(same(NaN, 0), false);
    assert.equal(same([NaN, 1], [NaN, 1]), true);
  });

  test('nested arrays', () => {
    assert.equal(same([1, [2, 3]], [1, [2, 3]]), true);
    assert.equal(same([1, [2, 3]], [1, [2, 4]]), false);
    assert.equal(same([1, 2], [1, 2, 3]), false);
  });

  test('a hole is not undefined', () => {
    // eslint-disable-next-line no-sparse-arrays -- the hole is the point of the test
    assert.equal(same([1, , 3], [1, undefined, 3]), false);
  });

  test('Float64Array compares with Object.is', () => {
    assert.equal(same(new Float64Array([1, 2]), new Float64Array([1, 2])), true);
    assert.equal(same(new Float64Array([1, 2]), new Float64Array([1, 3])), false);
    assert.equal(same(new Float64Array([0]), new Float64Array([-0])), false);
    assert.equal(same(new Float64Array([1]), new Float32Array([1])), false);
    assert.equal(same(new Float64Array([1]), [1]), false);
  });

  test('DenseMatrix-like valueOf', () => {
    const a = {
      _datatype: undefined,
      valueOf: () => [
        [1, 2],
        [3, 4],
      ],
    };
    const b = {
      _datatype: undefined,
      valueOf: () => [
        [1, 2],
        [3, 4],
      ],
    };
    const c = {
      _datatype: undefined,
      valueOf: () => [
        [1, 2],
        [3, 5],
      ],
    };
    assert.equal(same(a, b), true);
    assert.equal(same(a, c), false);
  });

  test('objects that unwrap to different primitives differ', () => {
    assert.equal(same(new Number(1), new Number(2)), false);
    assert.equal(same(new Number(1), new Number(1)), true);
    assert.equal(same(new Number(-0), new Number(0)), false);
  });

  test('own properties are compared even when valueOf agrees', () => {
    const a = { _datatype: 'number', valueOf: () => [1] };
    const b = { _datatype: undefined, valueOf: () => [1] };
    assert.equal(same(a, b), false);
  });

  test('{ L, U, p } objects', () => {
    assert.equal(same({ L: [1], U: [2], p: [0] }, { L: [1], U: [2], p: [0] }), true);
    assert.equal(same({ L: [1], U: [2], p: [0] }, { L: [1], U: [2], p: [1] }), false);
    assert.equal(same({ L: [1], U: [2], p: [0] }, { L: [1], U: [2] }), false);
  });

  test('classes from two trees match by constructor name', () => {
    const makeClass = () =>
      class Complex {
        constructor(re, im) {
          this.re = re;
          this.im = im;
        }
      };
    const A = makeClass();
    const B = makeClass();
    assert.equal(same(new A(1, 2), new B(1, 2)), true);
    assert.equal(same(new A(1, 2), new B(1, 3)), false);
    assert.equal(same(new A(1, 2), { re: 1, im: 2 }), false);
  });

  test('an array is not an object with the same keys', () => {
    assert.equal(same([1], { 0: 1, length: 1 }), false);
  });

  test('Map and Set', () => {
    assert.equal(same(new Map([[1, NaN]]), new Map([[1, NaN]])), true);
    assert.equal(same(new Map([[1, 2]]), new Map([[1, 3]])), false);
    assert.equal(same(new Set([1, 2]), new Set([1, 2])), true);
    assert.equal(same(new Set([1, 2]), new Set([1, 3])), false);
  });

  test('cycles terminate', () => {
    const a = { x: 1 };
    a.self = a;
    const b = { x: 1 };
    b.self = b;
    assert.equal(same(a, b), true);
  });
});

describe('checkResults()', () => {
  test('a null or undefined result fails the case', () => {
    assert.equal(checkResults(null, null).ok, false);
    assert.equal(checkResults(undefined, undefined).ok, false);
    assert.equal(checkResults(1, null).ok, false);
    assert.equal(checkResults(null, 1).ok, false);
    assert.match(checkResults(1, undefined).reason, /head returned undefined/);
  });

  test('a difference fails and an equal pair passes', () => {
    assert.deepEqual(checkResults([1], [1]), { ok: true });
    assert.equal(checkResults([1], [2]).ok, false);
  });

  test("a case's own compare replaces the default equality", () => {
    assert.equal(checkResults(1, 1.0000001, (a, b) => Math.abs(a - b) < 1e-3).ok, true);
    assert.equal(checkResults(1, 2, () => false).ok, false);
  });
});

describe('statistics', () => {
  test('geometric mean', () => {
    assert.ok(Math.abs(geometricMean([1, 4]) - 2) < 1e-12);
    assert.ok(Number.isNaN(geometricMean([])));
  });

  test('median of five runs and of an even count', () => {
    assert.equal(median([5, 1, 3, 2, 4]), 3);
    assert.equal(median([4, 1, 3, 2]), 2.5);
  });

  test('estimate: ratio of the medians, spread of the per-run ratios', () => {
    const e = estimate([10, 10, 10, 10, 10, 10], [5, 5, 5, 5, 9, 9]);
    assert.equal(e.ratio, 0.5);
    assert.equal(PROCESSES_PER_RUN, 2);
    assert.deepEqual(e.runRatios, [0.5, 0.5, 0.9]);
    assert.equal(e.min, 0.5);
    assert.equal(e.max, 0.9);
  });

  test('estimate: one slow process on either side does not move the median', () => {
    const e = estimate(
      [10, 10, 10, 10, 30, 10, 10, 10, 10, 10],
      [10, 10, 10, 10, 10, 10, 10, 10, 10, 60]
    );
    assert.equal(e.ratio, 1);
  });

  test('estimate: no samples, or unequal counts, give null', () => {
    assert.equal(estimate([], [5]), null);
    assert.equal(estimate([5], []), null);
    assert.equal(estimate([5, 5], [5]), null);
  });

  test('two-tree cross-check: geometric mean of the two import orders', () => {
    assert.ok(Math.abs(twoTreeRatio(1.25, 0.8) - 1) < 1e-12);
    assert.ok(Math.abs(twoTreeRatio(0.974, 0.497) - Math.sqrt(0.974 * 0.497)) < 1e-12);
  });
});

describe('gate decisions', () => {
  const gain = (ratio) => ({ kind: 'gain', ratio });
  const neutral = (ratio) => ({ kind: 'neutral', ratio });

  test('a gain case passes at 0.95 and fails above it', () => {
    assert.equal(failureOf(gain(GAIN_LIMIT), false), null);
    assert.equal(failureOf(gain(0.951), false), 'gain');
  });

  test('a neutral case passes at 1.02 and fails above it', () => {
    assert.equal(failureOf(neutral(SLOW_LIMIT), false), null);
    assert.equal(failureOf(neutral(1.021), false), 'slow');
  });

  test('a neutral case below 0.95 passes: neutral is a ceiling only', () => {
    assert.equal(failureOf(neutral(0.5), false), null);
  });

  test('a gain case above 1.02 is slow, not just a missed gain', () => {
    assert.equal(failureOf(gain(1.03), false), 'slow');
  });

  test('a reading that would fail is rerun; a passing one is not', () => {
    assert.equal(needsRerun(neutral(1.021), false), true);
    assert.equal(needsRerun(neutral(1.02), false), false);
    assert.equal(needsRerun(neutral(0.96), false), false);
    assert.equal(needsRerun(gain(0.951), false), true);
    assert.equal(needsRerun(gain(0.95), false), false);
    assert.equal(needsRerun(gain(1.5), false), true);
  });

  test('in a control session a reading outside the band is rerun', () => {
    assert.equal(needsRerun(neutral(1.021), true), true);
    assert.equal(needsRerun(neutral(0.979), true), true);
    assert.equal(needsRerun(neutral(1.019), true), false);
    assert.equal(needsRerun(neutral(0.981), true), false);
  });

  test('control session: the A/A\u2032 median must be within 2%', () => {
    assert.equal(failureOf(neutral(1 + CONTROL_BAND - 1e-9), true), null);
    assert.equal(failureOf(neutral(1 - CONTROL_BAND + 1e-9), true), null);
    assert.equal(failureOf(neutral(1.03), true), 'control');
    assert.equal(failureOf(neutral(0.97), true), 'control');
    assert.equal(failureOf(gain(0.5), true), 'control');
  });

  test('a scratch head that does about 5% extra work fails; an unchanged head passes', () => {
    const noise = [1.0, 1.03, 0.97, 1.02, 0.99, 1.01, 0.98, 1.0, 1.02, 0.98];
    const base = noise.map((n) => 100 * n);
    const unchanged = estimate(
      base,
      noise
        .slice()
        .reverse()
        .map((n) => 100 * n)
    );
    assert.equal(failureOf(neutral(unchanged.ratio), false), null);
    const fivePercentSlower = estimate(
      base,
      noise
        .slice()
        .reverse()
        .map((n) => 105 * n)
    );
    assert.equal(failureOf(neutral(fivePercentSlower.ratio), false), 'slow');
  });
});

describe('nodeBinary()', () => {
  test('is the running Node.js when the harness runs on Node', () => {
    assert.equal(nodeBinary(), process.execPath);
  });

  test('PERF_NODE overrides it', () => {
    const saved = process.env.PERF_NODE;
    process.env.PERF_NODE = '/opt/custom/node';
    try {
      assert.equal(nodeBinary(), '/opt/custom/node');
    } finally {
      if (saved === undefined) delete process.env.PERF_NODE;
      else process.env.PERF_NODE = saved;
    }
  });
});
