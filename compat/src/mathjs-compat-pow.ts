/**
 * Delegate Complex^Complex `pow` to the mathjs 15.3.0 oracle (compat-only, quirks included).
 */
import { create, all } from 'mathjs';
import { Complex } from '@danielsimonjr/mathts-core';

const oracle = create(all, {});

export function compatComplexPow(base: Complex, exponent: Complex): Complex {
  const out = oracle.pow(
    oracle.complex(base.re, base.im),
    oracle.complex(exponent.re, exponent.im)
  ) as { re: number; im: number };
  return new Complex(out.re, out.im);
}