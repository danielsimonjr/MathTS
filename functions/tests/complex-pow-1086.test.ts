/**
 * #1086 (follow-up M8): `pow`, `cbrt` and `^` of a Complex equal mathjs 15.2.0 bit for bit on
 * the typed functions, the functions evaluator and the expression default scope. Core
 * `Complex.pow` is the complex.js algorithm and `Complex.cbrt` is the mathjs cube root.
 *
 * Before, `evaluate('sqrt(-4)^2')` was -4 + 4.898587196589413e-16i and `pow(-8, 1/3)` was
 * 1.0000000000000002 + 1.7320508075688772i; mathjs gives -4 and 1 + 1.732050807568877i.
 * The oracle is mathjs in the same process, compared with `Object.is`.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { Complex } from '@danielsimonjr/mathts-core';
import * as F from '../src/index.js';
import { evaluate as defaultEvaluate } from '@danielsimonjr/mathts-expression';

type Fn = (...a: unknown[]) => unknown;
interface Parts {
  re: number;
  im: number;
}

function parts(v: unknown): Parts {
  return typeof v === 'number' ? { re: v, im: 0 } : (v as Parts);
}

function same(got: unknown, want: unknown, label: string): void {
  const g = parts(got);
  const w = parts(want);
  const ok = Object.is(g.re, w.re) && Object.is(g.im, w.im);
  expect(ok, `${label}: got (${g.re}, ${g.im}) want (${w.re}, ${w.im})`).toBe(true);
}

const expressions = [
  'sqrt(-4)^2',
  '(-8)^(1/3)',
  'pow(-8, 1/3)',
  'i^2',
  'i^3',
  '(2i)^4',
  '(1+i)^2',
  '(1+i)^0.5',
  '2^i',
  'i^i',
  '(-1)^0.5',
  '(3-4i)^(-1.5)',
  'cbrt(-5.224383203312755 + 8.269865293987095i)',
  'cbrt(8i)',
];

describe('pow and cbrt of a Complex equal mathjs (#1086, M8)', () => {
  it.each(expressions)('functions evaluate(%s)', (expr) => {
    same((F.evaluate as unknown as Fn)(expr), mathjs.evaluate(expr), expr);
  });

  it.each(expressions)('default scope evaluate(%s)', (expr) => {
    same(defaultEvaluate(expr), mathjs.evaluate(expr), expr);
  });

  it('typed pow and cbrt', () => {
    const pow = F.pow as unknown as Fn;
    const cbrt = F.cbrt as unknown as Fn;
    same(pow(-8, 1 / 3), mathjs.pow(-8, 1 / 3), 'pow(-8, 1/3)');
    same(pow(new Complex(1, 1), 2), mathjs.pow(mathjs.complex(1, 1), 2), 'pow(1+i, 2)');
    same(
      pow(new Complex(0.5, -2), new Complex(1.5, 0.25)),
      mathjs.pow(mathjs.complex(0.5, -2), mathjs.complex(1.5, 0.25)),
      'pow(Complex, Complex)'
    );
    same(cbrt(new Complex(-5, 8)), mathjs.cbrt(mathjs.complex(-5, 8)), 'cbrt(-5+8i)');
    same(
      (F.factory_cbrt as unknown as Fn)(new Complex(-5, 8)),
      mathjs.cbrt(mathjs.complex(-5, 8)),
      'factory cbrt(-5+8i)'
    );
    const roots = cbrt(new Complex(-5, 8), true) as Parts[];
    const want = (
      mathjs.cbrt(mathjs.complex(-5, 8), true) as unknown as { toArray(): Parts[] }
    ).toArray();
    want.forEach((w, k) => same(roots[k], w, `cbrt(-5+8i, true)[${k}]`));
  });
});
