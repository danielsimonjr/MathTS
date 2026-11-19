/**
 * Dogfood #1257 - the matrix 2-norm, qr, std, corr and the general eigs square values without
 * scaling. A square leaves the range of the type when the result is in range, so the result is
 * Infinity, 0 or NaN. Each function now scales by an exact power (2 for numbers, 10 for
 * BigNumbers) when the plain result is degenerate (or, for qr and eigs, when the squares leave the
 * configured exponent bounds).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BigNumber } from '@danielsimonjr/mathts-core';
import * as f from '../src/index.js';

type AnyFn = (...args: unknown[]) => unknown;
const fn = (name: string): AnyFn => (f as unknown as Record<string, AnyFn>)[name];
const b = (v: string | number): BigNumber => new BigNumber(String(v));
const big = (x: unknown): BigNumber => {
  expect(x).toBeInstanceOf(BigNumber);
  return x as BigNumber;
};
/** Relative error of a BigNumber against an exact decimal string. */
const rel = (x: unknown, exact: string): number => {
  const e = b(exact);
  return big(x).subtract(e).abs().divide(e.abs()).toNumber();
};

beforeEach(() => {
  BigNumber.config({ precision: 20, minExponent: -300, maxExponent: 300 });
});
afterEach(() => {
  BigNumber.resetConfig();
});

describe.each(['norm', 'factory_norm'])('#1257 matrix 2-norm of %s', (name) => {
  const norm = (...a: unknown[]) => fn(name)(...a);
  it('BigNumber, large entries', () => {
    const r = norm(
      [
        [b('3e200'), b(0)],
        [b(0), b('4e200')],
      ],
      2
    );
    expect(rel(r, '4e200')).toBeLessThan(1e-18);
  });
  it('BigNumber, small entries', () => {
    const r = norm(
      [
        [b('3e-200'), b(0)],
        [b(0), b('4e-200')],
      ],
      2
    );
    expect(rel(r, '4e-200')).toBeLessThan(1e-18);
  });
  it('number, large and small entries', () => {
    expect(
      norm(
        [
          [3e200, 0],
          [0, 4e200],
        ],
        2
      ) as number
    ).toBeCloseTo(4e200, -185);
    expect(
      (norm(
        [
          [3e-200, 0],
          [0, 4e-200],
        ],
        2
      ) as number) / 4e-200
    ).toBeCloseTo(1, 12);
  });
  it('a matrix that is not diagonal', () => {
    const exact = '4.6180339887498948482e200';
    expect(
      rel(
        norm(
          [
            [b('3e200'), b('1e200')],
            [b('1e200'), b('4e200')],
          ],
          2
        ),
        exact
      )
    ).toBeLessThan(1e-18);
    expect(
      (norm(
        [
          [3e200, 1e200],
          [1e200, 4e200],
        ],
        2
      ) as number) / 4.618033988749895e200
    ).toBeCloseTo(1, 12);
  });
  it('a result in range is unchanged', () => {
    expect(
      norm(
        [
          [3, 0],
          [0, 4],
        ],
        2
      )
    ).toBeCloseTo(4, 12);
  });
});

describe('#1257 qr of a BigNumber matrix', () => {
  const qr = (m: unknown) => fn('qr')(m) as { Q: unknown[][]; R: unknown[][] };
  it('large entries: R[0][0] has the size of the first column', () => {
    const { R } = qr([
      [b('3e200'), b(1)],
      [b('4e200'), b(1)],
    ]);
    expect(rel(big(R[0][0]).abs(), '5e200')).toBeLessThan(1e-18);
    expect(R[1][0]).toBeInstanceOf(BigNumber);
    expect(big(R[1][0]).isZero()).toBe(true);
    expect(big(R[1][1]).isNaN()).toBe(false);
  });
  it('large entries: Q R = A', () => {
    const { Q, R } = qr([
      [b('3e200'), b('1e200')],
      [b('4e200'), b('2e200')],
    ]);
    const prod = (i: number, j: number) =>
      big(Q[i][0])
        .multiply(big(R[0][j]).divide('1e100'))
        .add(big(Q[i][1]).multiply(big(R[1][j]).divide('1e100')));
    expect(rel(prod(0, 0).multiply('1e100'), '3e200')).toBeLessThan(1e-17);
    expect(rel(prod(1, 1).multiply('1e100'), '2e200')).toBeLessThan(1e-17);
  });
  it('mixed column sizes: Q R = A', () => {
    const A = [
      [b('3e200'), b(1), b(2)],
      [b('4e200'), b(1), b(5)],
      [b('1e200'), b(7), b(1)],
    ];
    const { Q, R } = qr(A);
    const P = fn('multiply')(Q, R) as unknown[][];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++)
        expect(rel(P[i][j], (A[i][j] as BigNumber).toString())).toBeLessThan(1e-17);
    }
  });
  it('a small first column beside a unit column', () => {
    const { R } = qr([
      [b('3e-200'), b(1)],
      [b('4e-200'), b(1)],
    ]);
    expect(rel(big(R[0][0]).abs(), '5e-200')).toBeLessThan(1e-18);
    expect(rel(R[0][1], '1.4')).toBeLessThan(1e-18);
  });
  it('small entries', () => {
    const { R } = qr([
      [b('3e-200'), b('1e-200')],
      [b('4e-200'), b('1e-200')],
    ]);
    expect(rel(big(R[0][0]).abs(), '5e-200')).toBeLessThan(1e-18);
  });
});

describe.each(['std', 'factory_std'])('#1257 %s', (name) => {
  const std = (...a: unknown[]) => fn(name)(...a);
  it('BigNumber, large values', () => {
    expect(rel(std([b('1e200'), b('3e200')]), '1.4142135623730950488e200')).toBeLessThan(1e-18);
  });
  it('BigNumber, small values', () => {
    expect(rel(std([b('1e-200'), b('3e-200')]), '1.4142135623730950488e-200')).toBeLessThan(1e-18);
  });
  it('BigNumber with a normalization', () => {
    expect(rel(std([b('1e200'), b('3e200')], 'uncorrected'), '1e200')).toBeLessThan(1e-18);
  });
  it('BigNumber along a dimension', () => {
    const r = std(
      [
        [b('1e200'), b('3e200')],
        [b('1e-200'), b('3e-200')],
      ],
      1
    ) as unknown[];
    expect(rel(r[0], '1.4142135623730950488e200')).toBeLessThan(1e-18);
    expect(rel(r[1], '1.4142135623730950488e-200')).toBeLessThan(1e-18);
  });
  it('numbers, large and small values', () => {
    expect((std([1e200, 3e200]) as number) / (Math.SQRT2 * 1e200)).toBeCloseTo(1, 14);
    expect((std([1e-200, 3e-200]) as number) / (Math.SQRT2 * 1e-200)).toBeCloseTo(1, 14);
  });
  it('a constant list is 0', () => {
    expect(Number(big(std([b('1e200'), b('1e200')])).toString())).toBe(0);
  });
});

describe('#1257 std with a normalization string and an options object', () => {
  it('keeps the string normalization', () => {
    const r = fn('std')([b('1e200'), b('3e200')], 'uncorrected', { skipNaN: false });
    expect(rel(r, '1e200')).toBeLessThan(1e-18);
  });
});

describe('#1257 corr', () => {
  const corr = (...a: unknown[]) => fn('corr')(...a);
  const exact = '0.98198050606196571569';
  it('BigNumber, large and small values', () => {
    for (const e of ['e200', 'e-200']) {
      const r = corr(
        ['1', '2', '4'].map((v) => b(v + e)),
        ['1', '3', '5'].map((v) => b(v + e))
      );
      expect(rel(r, exact)).toBeLessThan(1e-17);
    }
  });
  it('numbers, large values', () => {
    expect(corr([1e200, 2e200, 4e200], [1e200, 3e200, 5e200]) as number).toBeCloseTo(
      0.9819805060619659,
      14
    );
  });
});

describe('#1257 eigs of a general BigNumber matrix', () => {
  it('a complex pair is scaled back', () => {
    const r = fn('eigs')([
      [b(0), b('1e200')],
      [b('-1e200'), b(0)],
    ]) as { values: { re: number; im: number }[] };
    expect(Math.abs(r.values[0].re)).toBeLessThan(1e181);
    expect(Math.abs(r.values[0].im) / 1e200).toBeCloseTo(1, 12);
    expect(Math.abs(r.values[1].im) / 1e200).toBeCloseTo(1, 12);
  });
  it('the eigenvalues of [[3, 1], [2, 4]] * 1e200', () => {
    const r = fn('eigs')([
      [b('3e200'), b('1e200')],
      [b('2e200'), b('4e200')],
    ]) as { values: unknown[] };
    expect(rel(r.values[0], '2e200')).toBeLessThan(1e-17);
    expect(rel(r.values[1], '5e200')).toBeLessThan(1e-17);
  });
});
