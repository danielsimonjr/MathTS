/**
 * #1086 (follow-up M8): `Complex.pow` is the complex.js 2.4.3 algorithm, so every value equals
 * mathjs 15.2.0 bit for bit. `Complex.cbrt` and `Complex.cbrtRoots` are the mathjs cube root.
 *
 * Before, a number exponent took `fromPolar(|z|^n, n * arg z)` and a Complex exponent took
 * `exp(w * log z)`. Both round differently from complex.js (`(-8)^(1/3)` was
 * 1.0000000000000002 + 1.7320508075688772i; mathjs gives 1 + 1.732050807568877i).
 *
 * The oracle is mathjs in the same process, compared with `Object.is`. A zero base follows the
 * IEEE 754 pow rules (lead ruling): `0^y` is 0 for y > 0 and +Infinity for y < 0, and `z^0` is 1.
 * mathjs gives -0 + 0i for `0^2` and 0 - Infinity i for `0^(-1)`: its imaginary-base branch reads
 * a zero base as a pure imaginary number.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { Complex } from '../src/types/complex.js';

interface Parts {
  re: number;
  im: number;
}

interface MathjsComplex extends Parts {
  pow(w: number | MathjsComplex): Parts;
}

/** A mathjs (complex.js) Complex; its published type has no `pow`. */
const mc = (a: number, b: number): MathjsComplex =>
  mathjs.complex(a, b) as unknown as MathjsComplex;

function same(got: Parts, want: Parts, label: string): void {
  const ok = Object.is(got.re, want.re) && Object.is(got.im, want.im);
  if (!ok) {
    throw new Error(`${label}: got (${got.re}, ${got.im}) want (${want.re}, ${want.im})`);
  }
}

/** A seeded LCG, so the corpus is the same in every run. */
function lcg(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

function corpus(seed: number, n: number): number[][] {
  const rnd = lcg(seed);
  const pick = (): number => {
    const k = Math.floor(rnd() * 6);
    if (k === 0) return 0;
    if (k === 1) return Math.round(rnd() * 20 - 10);
    if (k === 2) return rnd() * 20 - 10;
    if (k === 3) return 1 / Math.round(1 + rnd() * 6);
    if (k === 4) return Math.round(rnd() * 8 - 4) / 2;
    return rnd() * 2 - 1;
  };
  const out: number[][] = [];
  for (let i = 0; i < n; i++) out.push([pick(), pick(), pick(), pick()]);
  return out;
}

const cases = corpus(20261121, 20000);

describe('Complex.pow equals complex.js (#1086, M8)', () => {
  it('a number exponent: 20 000 seeded pairs (a zero base excluded, see below)', () => {
    for (const [a, b, c] of cases) {
      if (a === 0 && b === 0) continue;
      same(new Complex(a, b).pow(c), mc(a, b).pow(c), `(${a}, ${b})^${c}`);
    }
  });

  it('a Complex exponent: 20 000 seeded pairs (a zero base excluded, see below)', () => {
    for (const [a, b, c, d] of cases) {
      if (a === 0 && b === 0) continue;
      const want = mc(a, b).pow(mc(c, d));
      same(new Complex(a, b).pow(new Complex(c, d)), want, `(${a}, ${b})^(${c}, ${d})`);
    }
  });

  it.each([
    [-8, 0, 1 / 3],
    [0, 1, 2],
    [0, 1, 3],
    [0, 2, 4],
    [1, 1, 2],
    [-4, 0, 0.5],
    [0.7415292263031006, -1.4268898963928223, -1.5],
    [2, 0, 0.5],
  ])('(%s + %s i)^%s', (a, b, c) => {
    same(new Complex(a, b).pow(c), mc(a, b).pow(c), `(${a}, ${b})^${c}`);
  });

  it('named values', () => {
    same(new Complex(-8, 0).pow(1 / 3), { re: 1, im: 1.732050807568877 }, '(-8)^(1/3)');
    same(new Complex(0, 1).pow(2), { re: -1, im: 0 }, 'i^2');
    same(new Complex(0, 2).pow(4), { re: 16, im: 0 }, '(2i)^4');
  });
});

describe('where complex.js computes Infinity * 0 = NaN, pow keeps the IEEE value', () => {
  // complex.js (mathjs) gives NaN + NaN i for each row. The value before the port is kept.
  it.each([
    [1e300, 1e300, 2, Infinity, Infinity],
    [-Infinity, 0, 2, Infinity, -Infinity],
    [Infinity, 1, 2, Infinity, 0],
  ])('(%s + %s i)^%s is %s + %s i', (a, b, c, re, im) => {
    expect(Number.isNaN(mc(a, b).pow(c).re)).toBe(true);
    same(new Complex(a, b).pow(c), { re, im }, `(${a}, ${b})^${c}`);
  });

  it('a finite base above 2.7e154 has a finite power (the squares of logHypot overflowed)', () => {
    for (const [a, b, c] of [
      [1e300, 1e300, 0.5],
      [1e300, -1e300, -1],
      [-3e200, 1e154, 1 / 3],
    ]) {
      expect(Number.isNaN(mc(a, b).pow(c).re)).toBe(true);
      const z = new Complex(a, b).pow(c);
      expect(Number.isFinite(z.re) && Number.isFinite(z.im), `(${a}, ${b})^${c}`).toBe(true);
    }
  });
});

describe('a zero base follows the IEEE 754 pow rules (lead ruling)', () => {
  it.each([
    [2, 0, 0],
    [0.5, 0, 0],
    [-1, Infinity, 0],
    [-2.5, Infinity, 0],
    [0, 1, 0],
  ])('0^%s is %s + %s i', (y, re, im) => {
    same(new Complex(0, 0).pow(y), { re, im }, `0^${y}`);
    same(new Complex(0, 0).pow(new Complex(y, 0)), { re, im }, `0^(${y} + 0i)`);
  });

  it('a Complex exponent with a non-zero imaginary part takes complex.js', () => {
    for (const w of [new Complex(0, 1), new Complex(1, 1), new Complex(-1, 2)]) {
      same(new Complex(0, 0).pow(w), mc(0, 0).pow(mc(w.re, w.im)), `0^${w}`);
    }
  });

  it('z^0 is 1 for every base', () => {
    same(new Complex(0, 0).pow(0), { re: 1, im: 0 }, '0^0');
    same(new Complex(NaN, 1).pow(0), { re: 1, im: 0 }, 'NaN^0');
  });
});

describe('Complex.cbrt and Complex.cbrtRoots equal mathjs cbrt (#1086, M8)', () => {
  it('20 000 seeded values', () => {
    for (const [a, b] of cases) {
      same(
        new Complex(a, b).cbrt(),
        mathjs.cbrt(mathjs.complex(a, b)) as Parts,
        `cbrt(${a}, ${b})`
      );
    }
  });

  it('all three roots, principal first', () => {
    for (const [a, b] of cases.slice(0, 2000)) {
      const want = mathjs.cbrt(mathjs.complex(a, b), true) as unknown as { toArray(): Parts[] };
      const got = new Complex(a, b).cbrtRoots();
      want.toArray().forEach((w, k) => same(got[k], w, `cbrtRoots(${a}, ${b})[${k}]`));
    }
  });

  it('cbrt(-5.224383203312755 + 8.269865293987095i) (review row)', () => {
    const [a, b] = [-5.224383203312755, 8.269865293987095];
    same(new Complex(a, b).cbrt(), mathjs.cbrt(mathjs.complex(a, b)) as Parts, 'cbrt');
  });
});
