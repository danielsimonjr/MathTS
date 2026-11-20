import { describe, it, expect } from 'vitest';
import { simplify, replacer } from '../src/index.js';
import { createGcd } from '../src/arithmetic/gcd.js';
import { createLcm } from '../src/arithmetic/lcm.js';
import { factoryScope } from '../src/factories/scope.js';
import { Fraction } from '@danielsimonjr/mathts-core';

// #1321: simplify folds constants as Fractions. The Fraction signature of gcd called
// Fraction.gcd(), which takes no argument and returns 1n, so gcd(4,6) became 1, and the 1n
// constant made the rule matcher throw in JSON.stringify. The Fraction signature of lcm called
// a method that Fraction does not have. The expected texts are the mathjs 15.2.0 results.

function text(input: string): string {
  return String(simplify(input));
}

describe('#1321 simplify folds gcd and lcm of constants', () => {
  it('gcd of two integers', () => {
    expect(text('gcd(4,6)')).toBe('2');
    expect(text('gcd(4,6)*x')).toBe('2 * x');
    expect(text('gcd(12,18)+x')).toBe('x + 6');
    expect(text('gcd(4,6,8)')).toBe('2');
  });

  it('gcd and lcm of two fractions', () => {
    expect(text('gcd(1/2,1/3)+x')).toBe('x + 1 / 6');
    expect(text('lcm(1/2,1/3)*x')).toBe('x');
    expect(text('lcm(4,6)+x')).toBe('x + 12');
  });
});

describe('#1321 gcd and lcm factories on Fraction operands', () => {
  const deps = factoryScope as unknown as Record<string, unknown>;
  const gcd = createGcd(deps as never) as unknown as (a: unknown, b: unknown) => Fraction;
  const lcm = createLcm(deps as never) as unknown as (a: unknown, b: unknown) => Fraction;
  const f = (n: bigint, d = 1n): Fraction => new Fraction(n, d);

  it('returns a Fraction with the mathjs value', () => {
    expect(gcd(f(4n), f(6n)).toString()).toBe(f(2n).toString());
    expect(gcd(f(-4n), f(6n)).toString()).toBe(f(2n).toString());
    expect(gcd(f(1n, 2n), f(1n, 3n)).toString()).toBe(f(1n, 6n).toString());
    expect(gcd(f(0n), f(3n)).toString()).toBe(f(3n).toString());
    expect(lcm(f(-4n), f(6n)).toString()).toBe(f(12n).toString());
    expect(lcm(f(1n, 2n), f(1n, 3n)).toString()).toBe(f(1n).toString());
    expect(lcm(f(0n), f(3n)).toString()).toBe(f(0n).toString());
    expect(gcd(f(4n), f(6n))).toBeInstanceOf(Fraction);
  });
});

describe('#1321 a bigint constant in simplify and in replacer', () => {
  it('replacer tags a bigint as mathjs does', () => {
    expect(JSON.stringify({ a: 5n }, replacer)).toBe('{"a":{"mathjs":"bigint","value":"5"}}');
  });

  it('the factory scope uses the same replacer', () => {
    const scoped = (factoryScope as unknown as { replacer: typeof replacer }).replacer;
    expect(JSON.stringify([5n], scoped)).toBe('[{"mathjs":"bigint","value":"5"}]');
  });
});
