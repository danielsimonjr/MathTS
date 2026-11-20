import { bigintGcd } from '../typed/factorization/integer-poly.js';

/** A reduced Fraction, as core makes it: bigint parts and a positive denominator. */
export interface FractionParts {
  numerator: bigint;
  denominator: bigint;
}

type FractionConstructor<F> = new (numerator: bigint, denominator: bigint) => F;

function bigintLcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  const product = (a / bigintGcd(a, b)) * b;
  return product < 0n ? -product : product;
}

/**
 * The gcd of two fractions, as fraction.js defines it: gcd(a/b, c/d) = gcd(a, c) / lcm(b, d).
 * The result has the class of `x`, so a Fraction of a second copy of core keeps its class.
 */
export function fractionGcd<F extends FractionParts>(x: F, y: F): F {
  const Ctor = x.constructor as FractionConstructor<F>;
  return new Ctor(bigintGcd(x.numerator, y.numerator), bigintLcm(x.denominator, y.denominator));
}

/** The lcm of two fractions, as fraction.js defines it: lcm(a/b, c/d) = lcm(a, c) / gcd(b, d). */
export function fractionLcm<F extends FractionParts>(x: F, y: F): F {
  const Ctor = x.constructor as FractionConstructor<F>;
  return new Ctor(bigintLcm(x.numerator, y.numerator), bigintGcd(x.denominator, y.denominator));
}
