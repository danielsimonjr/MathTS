/**
 * #1582: Unit-valued CSC sparse matrices must use factory matAlgo paths for add/multiply.
 * `toArray()` fills implicit zeros with the number `0`, so the typed `elementwiseMatrixNumber`
 * walk cannot pair `Unit` with `0` without a signature error.
 */
import { describe, it, expect } from 'vitest';
import { add, multiply, sparse, unit, matrix } from '../src/index.js';

describe('#1582 Unit CSC sparse add/multiply', () => {
  it('add of two sparse Unit matrices does not pair Unit with numeric implicit zeros', () => {
    const a = sparse([[unit('1 cm'), unit('0 cm')]]);
    const b = sparse([[unit('0 cm'), unit('1 cm')]]);
    const s = add(a, b) as unknown as { density(): number; storage(): string };
    expect(s.storage()).toBe('sparse');
    expect(s.density()).toBe(1);
  });

  it('multiply sparse Unit row by a dense column', () => {
    const row = sparse([[unit('1 cm'), unit('0 cm')]]);
    const col = matrix([unit('1 cm'), unit('2 cm')]);
    expect(() => multiply(row, col)).not.toThrow();
  });
});
