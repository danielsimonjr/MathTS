/**
 * The working-precision loop of the BigNumber combinatorics gives the exact value rounded one time
 * (#1164). `roundedWorkLoop` computes the loop at a working precision, bounds the error of its
 * roundings, and accepts the result only when both ends of the error interval round to the same
 * value; else it tries again with more guard digits, and at last it uses the exact bigint loop.
 *
 * At the public API a small input takes the exact loop (the cost model), so these rows call the
 * working loop directly, with few guard digits, at a low precision, where an exact value is often
 * near a rounding boundary. Every rounding mode is checked.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import type { RoundingMode } from '@danielsimonjr/mathts-core';
import { bellLoop, catalanLoop, roundedWorkLoop } from '../src/probability/rounded-loop.js';
import { bellNumbers, catalan } from '../src/index.js';
import { binomialBigInt, rangeProductBigInt } from '../src/probability/bigint-binomial.js';

/** C(total, steps) by the multiplicative loop at the current precision (the loop of the source). */
function binomialLoop(total: bigint, steps: bigint): BigNumber {
  let result = BigNumber.fromNumber(1);
  for (let i = 1n; i <= steps; i++) {
    result = result.times(BigNumber.fromBigInt(total - steps + i)).div(BigNumber.fromBigInt(i));
  }
  return result;
}

const rounded = (v: bigint): string =>
  BigNumber.fromBigInt(v).toSignificantDigits(BigNumber.precision).toString();

/** The working loop of C(n, s) with `guard` start guard digits, and a count of exact fallbacks. */
function binomial(n: bigint, s: bigint, guard: number): { value: string; fallbacks: number } {
  let fallbacks = 0;
  const value = roundedWorkLoop(
    { steps: s, top: n, divides: true, operations: 2 * Number(s) },
    () => binomialLoop(n, s),
    () => {
      fallbacks++;
      return binomialBigInt(n, s);
    },
    guard
  );
  return { value: value.toString(), fallbacks };
}

const MODES: RoundingMode[] = ['halfUp', 'halfEven', 'halfDown', 'up', 'down', 'ceil', 'floor'];

describe('#1164 the working-precision loop is correctly rounded', () => {
  afterEach(() => BigNumber.resetConfig());

  for (const rounding of MODES) {
    it(`C(n, k) for n <= 90 at precision 3, one guard digit, rounding ${rounding}`, () => {
      BigNumber.config({ precision: 3, rounding });
      let rows = 0;
      for (let n = 2n; n <= 90n; n++) {
        for (let k = 1n; k <= n / 2n; k++) {
          rows++;
          expect(binomial(n, k, 1).value, `C(${n}, ${k})`).toBe(rounded(binomialBigInt(n, k)));
        }
      }
      expect(rows).toBe(2025);
    });
  }

  it('a range product with the working loop equals the exact product rounded', () => {
    BigNumber.config({ precision: 4 });
    for (let lo = 1n; lo <= 40n; lo++) {
      for (let hi = lo; hi <= lo + 30n; hi++) {
        const s = hi - lo + 1n;
        const got = roundedWorkLoop(
          { steps: s, top: hi, divides: false, operations: Number(s) },
          () => {
            let r = BigNumber.fromNumber(1);
            for (let i = lo; i <= hi; i++) r = r.times(BigNumber.fromBigInt(i));
            return r;
          },
          () => rangeProductBigInt(lo, hi),
          1
        );
        expect(got.toString(), `${lo}..${hi}`).toBe(rounded(rangeProductBigInt(lo, hi)));
      }
    }
  });

  it('a tie at the precision of the call falls back to the exact loop', () => {
    // C(6, 2) = 15 is a tie at one digit. With no guard digits the error interval of every try
    // holds 15, so its ends round to 1e1 and 2e1, and the exact loop decides.
    BigNumber.config({ precision: 1, rounding: 'halfUp' });
    expect(binomial(6n, 2n, 0)).toEqual({ value: '20', fallbacks: 1 });
    BigNumber.config({ precision: 1, rounding: 'halfEven' });
    expect(binomial(6n, 2n, 0)).toEqual({ value: '20', fallbacks: 1 });
    BigNumber.config({ precision: 1, rounding: 'halfDown' });
    expect(binomial(6n, 2n, 0)).toEqual({ value: '10', fallbacks: 1 });
  });

  it('a working precision that holds every partial value returns the exact value with no check', () => {
    BigNumber.config({ precision: 64 });
    expect(binomial(200n, 100n, 200)).toEqual({
      value: rounded(binomialBigInt(200n, 100n)),
      fallbacks: 0,
    });
  });

  it('the default guard gives the exact value rounded for large loops', () => {
    BigNumber.config({ precision: 20 });
    for (const [n, k] of [
      [1000n, 500n],
      [100000n, 3000n],
      [10n ** 20n, 2000n],
    ] as const) {
      expect(binomial(n, k, 10)).toEqual({ value: rounded(binomialBigInt(n, k)), fallbacks: 0 });
    }
  });

  /** The working loop of `parts` with `guard` start guard digits. */
  const viaWorkLoop = (parts: ReturnType<typeof bellLoop>, guard: number): string =>
    roundedWorkLoop(parts.shape, parts.work, parts.exact, guard).toString();

  for (const rounding of MODES) {
    it(`catalan(n) for n <= 300 at precision 3, one guard digit, rounding ${rounding}`, () => {
      BigNumber.config({ precision: 3, rounding });
      for (let n = 0n; n <= 300n; n++) {
        const parts = catalanLoop(n);
        expect(viaWorkLoop(parts, 1), `catalan(${n})`).toBe(rounded(parts.exact()));
      }
    });

    it(`bellNumbers(n) for n <= 120 at precision 3, one guard digit, rounding ${rounding}`, () => {
      BigNumber.config({ precision: 3, rounding });
      for (let n = 0; n <= 120; n++) {
        const parts = bellLoop(n);
        expect(viaWorkLoop(parts, 1), `bellNumbers(${n})`).toBe(rounded(parts.exact()));
      }
    });
  }

  it('catalan and bellNumbers of BigNumbers equal the exact value rounded at precision 20', () => {
    BigNumber.config({ precision: 20 });
    type BnFn = (x: BigNumber) => BigNumber;
    for (const n of [0, 1, 5, 30, 200, 3000]) {
      const want = rounded(catalanLoop(BigInt(n)).exact());
      expect(
        (catalan as unknown as BnFn)(BigNumber.fromNumber(n)).toString(),
        `catalan(${n})`
      ).toBe(want);
    }
    for (const n of [0, 1, 5, 30, 200, 600]) {
      const want = rounded(bellLoop(n).exact());
      expect(
        (bellNumbers as unknown as BnFn)(BigNumber.fromNumber(n)).toString(),
        `bellNumbers(${n})`
      ).toBe(want);
    }
  });
});
