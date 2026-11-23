/**
 * `floor`, `ceil` and `fix` of a BigNumber snap to the nearest integer within the live tolerance.
 * An integer BigNumber is its own floor and ceiling, so it takes no rounding and no config read.
 * The test counts the calls of `toDecimalPlaces` (the rounding of the snap) and does not time the
 * calls, so it cannot flake.
 */
import { describe, it, expect } from 'vitest';
import * as math from '../src/index.js';

type Fn = (...a: unknown[]) => unknown;
const mt = math as unknown as Record<string, Fn>;
const big = (s: string): unknown => mt.bignumber(s);

/** Counts the calls of `toDecimalPlaces` on the BigNumber class while `run` executes. */
function countRounding(run: () => void): number {
  const proto = Object.getPrototypeOf(big('1')) as {
    toDecimalPlaces: (...a: unknown[]) => unknown;
  };
  const original = proto.toDecimalPlaces;
  let calls = 0;
  proto.toDecimalPlaces = function (this: unknown, ...a: unknown[]): unknown {
    calls++;
    return original.apply(this, a);
  };
  try {
    run();
  } finally {
    proto.toDecimalPlaces = original;
  }
  return calls;
}

const INTEGERS = ['0', '7', '-12', '1e30', '-1e400', '123456789012345678901234567890'];

describe('floor, ceil and fix of an integer BigNumber', () => {
  it('give the integer, with no rounding of the snap', () => {
    const results: string[] = [];
    const calls = countRounding(() => {
      for (const name of ['floor', 'ceil', 'fix']) {
        for (const s of INTEGERS) results.push(String(mt[name](big(s))));
      }
    });
    expect(calls).toBe(0);
    const expected = ['floor', 'ceil', 'fix'].flatMap(() => INTEGERS.map((s) => String(big(s))));
    expect(results).toEqual(expected);
  });

  it('a value near an integer still snaps, and the probe sees the rounding', () => {
    let result = '';
    const calls = countRounding(() => {
      result = String(mt.floor(big('2.9999999999999999999999')));
    });
    expect(result).toBe('3');
    expect(calls).toBeGreaterThan(0);
  });
});
