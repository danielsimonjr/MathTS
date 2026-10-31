import { describe, it, expect } from 'vitest';
import { Fraction } from '@danielsimonjr/mathts-core';
import { qr } from '../src/factories/index.js';

describe('qr Fraction input', () => {
  it('throws a clear TypeError instead of BigInt conversion failure', () => {
    expect(() =>
      qr([
        [new Fraction(1, 2), new Fraction(1, 3)],
        [new Fraction(1, 4), new Fraction(1, 5)],
      ])
    ).toThrow(/does not support Fraction entries/);
  });
});
