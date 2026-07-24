/**
 * Quadratic-surd arithmetic (`a + b*sqrt(Delta)`) — see
 * docs/superpowers/specs/2026-07-21-risch-layer2-quadratic-surd-design.md
 * (Architecture §1). Exact `Rat` arithmetic inside; `Delta` is a fixed
 * positive non-square bigint radicand supplied per-operation, not stored on
 * the `Surd` value itself.
 */
import { describe, it, expect } from 'vitest';
import {
  surdFromRat,
  surdAdd,
  surdMul,
  surdDiv,
  type Surd,
} from '../src/cas/rational-integrate.js';

const R = (n: number, d = 1) => ({ num: BigInt(n), den: BigInt(d) });
const val = (s: Surd, delta: number) =>
  Number(s.a.num) / Number(s.a.den) + (Number(s.b.num) / Number(s.b.den)) * Math.sqrt(delta);

describe('quadratic surd arithmetic', () => {
  const D = 2n;
  it('mul: (1+√2)(1+√2) = 3 + 2√2', () => {
    const x: Surd = { a: R(1), b: R(1) };
    const p = surdMul(x, x, D);
    expect(val(p, 2)).toBeCloseTo((1 + Math.SQRT2) ** 2, 10);
  });
  it('div: 1/(1+√2) = -1 + √2 (rationalized)', () => {
    const one = surdFromRat(R(1));
    const q = surdDiv(one, { a: R(1), b: R(1) }, D);
    expect(val(q, 2)).toBeCloseTo(1 / (1 + Math.SQRT2), 10);
  });
  it('add is componentwise', () => {
    const s = surdAdd({ a: R(1), b: R(2) }, { a: R(3), b: R(-1) });
    expect(val(s, 5)).toBeCloseTo(4 + 1 * Math.sqrt(5), 10);
  });
  it('mul with delta=5: (2+√5)(2-√5) = -1', () => {
    const p = surdMul({ a: R(2), b: R(1) }, { a: R(2), b: R(-1) }, 5n);
    expect(val(p, 5)).toBeCloseTo(-1, 10);
  });
});
