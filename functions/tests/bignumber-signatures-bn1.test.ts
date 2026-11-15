/**
 * The typed functions give a BigNumber result for a BigNumber input, as mathjs does. Before the
 * fix, a BigNumber went through the implicit BigNumber-to-number conversion of core, so `arg`,
 * `expm1`, `log1p`, `nthRoot(b)`, `round(b, n)` and `log(b, base)` gave a double. A negative
 * BigNumber in `log`, `log10` and `log2` gave NaN, where mathjs gives a Complex. The expected
 * values are mathjs results at a precision of 64 digits.
 */
import { describe, it, expect } from 'vitest';
import { BigNumber, Complex } from '@danielsimonjr/mathts-core';
import {
  arg,
  expm1,
  log,
  log10,
  log1p,
  log2,
  nthRoot,
  round,
  runWithConfig,
} from '../src/index.js';

const B = (x: string): BigNumber => BigNumber.parse(x);

/** Expect a BigNumber whose decimal text starts with `prefix`. */
function expectBig(value: unknown, prefix: string): void {
  expect(value).toBeInstanceOf(BigNumber);
  expect(String(value).startsWith(prefix), `${String(value)} starts with ${prefix}`).toBe(true);
}

describe('BigNumber signatures of the typed layer (BN-1)', () => {
  it('arg of a BigNumber is a BigNumber', () => {
    expectBig(arg(B('2')), '0');
    expectBig(arg(B('-2')), '3.14159265358979323846264338');
  });

  it('expm1 of a BigNumber is a BigNumber', () => {
    expectBig(expm1(B('0.5')), '0.6487212707001281468486');
  });

  it('log1p of a BigNumber is a BigNumber, and a Complex below -1', () => {
    expectBig(log1p(B('0.5')), '0.4054651081081643819780');
    const c = log1p(B('-3'));
    expect(c).toBeInstanceOf(Complex);
    expect((c as Complex).im).toBeCloseTo(Math.PI, 12);
  });

  it('nthRoot of a BigNumber is a BigNumber', () => {
    expectBig(nthRoot(B('8')), '2.8284271247461900976033');
    expectBig(nthRoot(B('27'), B('3')), '3');
  });

  it('round of a BigNumber to n decimals is a BigNumber', () => {
    expectBig(round(B('2.345'), 2), '2.35');
    expectBig(round(B('2.345'), B('2')), '2.35');
  });

  it('log of a BigNumber to a BigNumber base is a BigNumber', () => {
    expectBig(log(B('8'), B('2')), '2.99999999999999999999');
  });

  it('log, log10 and log2 of a negative BigNumber are Complex, as in mathjs', () => {
    for (const [f, re] of [
      [log, Math.LN2],
      [log10, Math.log10(2)],
      [log2, 1],
    ] as const) {
      const c = f(B('-2'));
      expect(c).toBeInstanceOf(Complex);
      expect((c as Complex).re).toBeCloseTo(re, 12);
    }
  });

  it('with predictable, log of a negative BigNumber stays a BigNumber (NaN)', () => {
    runWithConfig({ predictable: true }, () => {
      const v = log(B('-2'));
      expect(v).toBeInstanceOf(BigNumber);
      expect((v as BigNumber).isNaN()).toBe(true);
    });
  });
});
