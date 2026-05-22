/**
 * Tests for functions/src/factories/scope.ts
 *
 * Validates the shape, keys, and runtime behaviour of `factoryScope` —
 * the dependency-injection object that seeds every synced mathjs factory.
 */

import { describe, it, expect } from 'vitest';
import { Complex, Fraction, BigNumber, mathTyped } from '@danielsimonjr/mathts-core';
import { factoryScope } from '../src/factories/scope.js';

// ---------------------------------------------------------------------------
// Key / shape assertions
// ---------------------------------------------------------------------------

describe('factoryScope — required keys', () => {
  it('exports an object', () => {
    expect(typeof factoryScope).toBe('object');
    expect(factoryScope).not.toBeNull();
  });

  it('contains "typed" (the mathTyped instance)', () => {
    expect('typed' in factoryScope).toBe(true);
  });

  it('contains "config"', () => {
    expect('config' in factoryScope).toBe(true);
  });

  it('contains class constructors: Complex, BigNumber, Fraction', () => {
    expect('Complex' in factoryScope).toBe(true);
    expect('BigNumber' in factoryScope).toBe(true);
    expect('Fraction' in factoryScope).toBe(true);
  });

  it('contains matrix bridge constructors: DenseMatrix, SparseMatrix', () => {
    expect('DenseMatrix' in factoryScope).toBe(true);
    expect('SparseMatrix' in factoryScope).toBe(true);
  });

  it('contains the matrix factory function', () => {
    expect('matrix' in factoryScope).toBe(true);
    expect(typeof factoryScope.matrix).toBe('function');
  });

  it('contains lowercase helper factories: complex, bignumber, fraction, number', () => {
    expect('complex' in factoryScope).toBe(true);
    expect('bignumber' in factoryScope).toBe(true);
    expect('fraction' in factoryScope).toBe(true);
    expect('number' in factoryScope).toBe(true);
  });

  it('contains createDenseMatrix and createSparseMatrix helpers', () => {
    expect('createDenseMatrix' in factoryScope).toBe(true);
    expect('createSparseMatrix' in factoryScope).toBe(true);
    expect(typeof factoryScope.createDenseMatrix).toBe('function');
    expect(typeof factoryScope.createSparseMatrix).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// typed — mathTyped instance
// ---------------------------------------------------------------------------

describe('factoryScope.typed', () => {
  it('is the same mathTyped instance exported from @danielsimonjr/mathts-core', () => {
    expect(factoryScope.typed).toBe(mathTyped);
  });

  it('is callable (typed-function instance is a function)', () => {
    expect(typeof factoryScope.typed).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// config — DEFAULT_CONFIG shape
// ---------------------------------------------------------------------------

describe('factoryScope.config', () => {
  const config = factoryScope.config as Record<string, unknown>;

  it('has relTol', () => {
    expect(typeof config.relTol).toBe('number');
    expect((config.relTol as number)).toBeGreaterThan(0);
  });

  it('has absTol', () => {
    expect(typeof config.absTol).toBe('number');
    expect((config.absTol as number)).toBeGreaterThan(0);
  });

  it('has matrix type set to "Matrix"', () => {
    expect(config.matrix).toBe('Matrix');
  });

  it('has number type set to "number"', () => {
    expect(config.number).toBe('number');
  });

  it('has precision (BigNumber digits)', () => {
    expect(typeof config.precision).toBe('number');
    expect((config.precision as number)).toBeGreaterThan(0);
  });

  it('has predictable flag', () => {
    expect(typeof config.predictable).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// Class constructors — must be the actual MathTS classes
// ---------------------------------------------------------------------------

describe('factoryScope — class constructor identity', () => {
  it('Complex is the real Complex constructor', () => {
    expect(factoryScope.Complex).toBe(Complex);
  });

  it('BigNumber is the real BigNumber constructor', () => {
    expect(factoryScope.BigNumber).toBe(BigNumber);
  });

  it('Fraction is the real Fraction constructor', () => {
    expect(factoryScope.Fraction).toBe(Fraction);
  });

  it('DenseMatrix and SparseMatrix are functions (constructors)', () => {
    expect(typeof factoryScope.DenseMatrix).toBe('function');
    expect(typeof factoryScope.SparseMatrix).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Lowercase helper factories — runtime behaviour
// ---------------------------------------------------------------------------

describe('factoryScope.complex helper', () => {
  const complex = factoryScope.complex as (re: number, im: number) => unknown;

  it('creates a Complex instance', () => {
    const z = complex(3, 4);
    expect(z).toBeInstanceOf(Complex);
  });

  it('sets real and imaginary parts correctly', () => {
    const z = complex(2, -5) as Complex;
    expect(z.re).toBe(2);
    expect(z.im).toBe(-5);
  });

  it('creates 0+0j for complex(0, 0)', () => {
    const z = complex(0, 0) as Complex;
    expect(z.re).toBe(0);
    expect(z.im).toBe(0);
  });
});

describe('factoryScope.bignumber helper', () => {
  const bignumber = factoryScope.bignumber as (x: number | string) => unknown;

  it('creates a BigNumber from a number', () => {
    const b = bignumber(42);
    expect(b).toBeInstanceOf(BigNumber);
  });

  it('creates a BigNumber from a string', () => {
    const b = bignumber('3.14');
    expect(b).toBeInstanceOf(BigNumber);
  });

  it('numeric value is preserved', () => {
    const b = bignumber(7) as BigNumber;
    expect(Number(b)).toBe(7);
  });
});

describe('factoryScope.fraction helper', () => {
  const fraction = factoryScope.fraction as (n: number, d?: number) => unknown;

  it('creates a Fraction instance', () => {
    const f = fraction(1, 3);
    expect(f).toBeInstanceOf(Fraction);
  });

  it('uses denominator 1 when only numerator given', () => {
    const f = fraction(5) as Fraction;
    // Fraction uses .numerator and .denominator (bigint)
    expect(f.numerator).toBe(5n);
    expect(f.denominator).toBe(1n);
  });

  it('sets numerator and denominator correctly', () => {
    const f = fraction(3, 4) as Fraction;
    expect(f.numerator).toBe(3n);
    expect(f.denominator).toBe(4n);
  });
});

describe('factoryScope.number helper', () => {
  it('is the global Number function', () => {
    expect(factoryScope.number).toBe(Number);
  });

  it('converts strings to numbers', () => {
    const num = factoryScope.number as (x: unknown) => number;
    expect(num('42')).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// createDenseMatrix / createSparseMatrix helpers
// ---------------------------------------------------------------------------

describe('factoryScope.createDenseMatrix helper', () => {
  const create = factoryScope.createDenseMatrix as (data: unknown) => unknown;

  it('constructs a DenseMatrix-like object from a 2-D array', () => {
    const m = create([[1, 2], [3, 4]]) as any;
    expect(typeof m).toBe('object');
    expect(m).not.toBeNull();
  });

  it('result has _data property', () => {
    const m = create([[1, 2], [3, 4]]) as any;
    expect(Array.isArray(m._data)).toBe(true);
  });
});

describe('factoryScope.createSparseMatrix helper', () => {
  const create = factoryScope.createSparseMatrix as (data: unknown) => unknown;

  it('constructs a SparseMatrix-like object from a 2-D array', () => {
    const m = create([[1, 0], [0, 2]]) as any;
    expect(typeof m).toBe('object');
    expect(m).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// matrix factory function
// ---------------------------------------------------------------------------

describe('factoryScope.matrix factory', () => {
  const matrixFn = factoryScope.matrix as (...args: unknown[]) => unknown;

  it('is callable', () => {
    expect(typeof matrixFn).toBe('function');
  });

  it('creates a matrix object when called with a 2-D array', () => {
    const m = matrixFn([[1, 2], [3, 4]]) as any;
    expect(typeof m).toBe('object');
    expect(m).not.toBeNull();
  });
});
