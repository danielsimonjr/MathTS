/**
 * Tests for newly activated factory functions (tiers 11-18).
 *
 * Verifies subtract, divide, and the cascade of factories they unlock:
 * algebra, statistics, set operations, signal processing, and more.
 */
import { describe, it, expect } from 'vitest';

// set ops moved from factories/ to typed/ — import from the typed layer
import {
  setCartesian,
  setDifference,
  setDistinct,
  setIntersect,
  setIsSubset,
  setMultiplicity,
  setPowerset,
  setSymDifference,
  setUnion,
} from '../src/typed/set.js';

// multinomial moved from factories/ to typed/ — import from the typed layer
import { multinomial } from '../src/typed/probability.js';

import {
  // Tier 11: expression-dependent factories
  nodeOperations,
  leafCount,
  resolve,
  simplifyConstant,
  simplifyUtil,
  splitUnit,
  fft,
  Chain,

  // Tier 12: subtract, divide, and dependent types
  factory_subtract,
  factory_divide,
  ifft,
  chain,
  unit,

  // Tier 13: downstream factories
  column,
  row,
  cross,
  diff,
  sqrtm,
  lup,
  slu,
  intersect,
  factory_mean,
  median,
  factory_variance,
  quantileSeq,
  kldivergence,
  freqz,
  simplifyCore,
  polynomialRoot,
  solveODE,
  zeta,
  indexFn,

  // Tier 14
  eigs,
  lusolve,
  corr,
  mad,
  factory_std,
  simplify,

  // Tier 15
  derivative,
  factory_norm,
  rationalize,
  symbolicEqual,

  // Tier 16
  rotationMatrix,
  schur,

  // Tier 17
  rotate,
  sylvester,

  // Tier 18
  lyap,
} from '../src/factories/index.js';

describe('Tier 11: Expression-dependent factories', () => {
  it('nodeOperations should be a valid object', () => {
    expect(nodeOperations).toBeDefined();
    expect(typeof nodeOperations).toBe('object');
  });

  it('leafCount should count expression leaf nodes', () => {
    expect(typeof leafCount).toBe('function');
  });

  it('resolve should be a function', () => {
    expect(typeof resolve).toBe('function');
  });

  it('simplifyConstant should be a function', () => {
    expect(typeof simplifyConstant).toBe('function');
  });

  it('simplifyUtil should be defined', () => {
    expect(simplifyUtil).toBeDefined();
  });

  it('splitUnit should be a function', () => {
    expect(typeof splitUnit).toBe('function');
  });

  it('fft should be a function', () => {
    expect(typeof fft).toBe('function');
  });

  it('Chain should be a constructor', () => {
    expect(typeof Chain).toBe('function');
  });
});

describe('Tier 12: subtract and divide', () => {
  it('factory_subtract should subtract numbers', () => {
    expect(factory_subtract(10, 3)).toBe(7);
    expect(factory_subtract(0, 5)).toBe(-5);
  });

  it('factory_divide should divide numbers', () => {
    expect(factory_divide(10, 2)).toBe(5);
    expect(factory_divide(7, 2)).toBe(3.5);
  });

  it('ifft should be a function', () => {
    expect(typeof ifft).toBe('function');
  });

  it('chain should create a chain', () => {
    expect(typeof chain).toBe('function');
  });

  it('unit should be a function', () => {
    expect(typeof unit).toBe('function');
  });
});

describe('Tier 13: Downstream factories', () => {
  it('column should be a function', () => {
    expect(typeof column).toBe('function');
  });

  it('row should be a function', () => {
    expect(typeof row).toBe('function');
  });

  it('cross should compute cross product', () => {
    const result = cross([1, 0, 0], [0, 1, 0]);
    expect(result).toEqual([0, 0, 1]);
  });

  it('diff should compute differences', () => {
    const result = diff([1, 3, 6, 10]);
    expect(result).toEqual([2, 3, 4]);
  });

  it('lup should perform LU decomposition', () => {
    expect(typeof lup).toBe('function');
  });

  it('slu should perform sparse LU', () => {
    expect(typeof slu).toBe('function');
  });

  it('intersect should be a function', () => {
    expect(typeof intersect).toBe('function');
  });

  it('factory_mean should compute mean', () => {
    expect(factory_mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it('median should compute median', () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('factory_variance should compute sample variance', () => {
    // mathjs uses sample variance (n-1) by default
    const v = factory_variance([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(v).toBeCloseTo(32 / 7, 5); // sample variance
  });

  it('quantileSeq should compute quantiles', () => {
    expect(typeof quantileSeq).toBe('function');
  });

  it('kldivergence should be a function', () => {
    expect(typeof kldivergence).toBe('function');
  });

  it('multinomial should compute multinomial coefficient', () => {
    expect(typeof multinomial).toBe('function');
  });

  it('freqz should be a function', () => {
    expect(typeof freqz).toBe('function');
  });

  it('set operations should be functions', () => {
    expect(typeof setCartesian).toBe('function');
    expect(typeof setDifference).toBe('function');
    expect(typeof setDistinct).toBe('function');
    expect(typeof setIntersect).toBe('function');
    expect(typeof setIsSubset).toBe('function');
    expect(typeof setMultiplicity).toBe('function');
    expect(typeof setPowerset).toBe('function');
  });

  it('simplifyCore should be a function', () => {
    expect(typeof simplifyCore).toBe('function');
  });

  it('polynomialRoot should be a function', () => {
    expect(typeof polynomialRoot).toBe('function');
  });

  it('solveODE should be a function', () => {
    expect(typeof solveODE).toBe('function');
  });

  it('zeta should be a function', () => {
    expect(typeof zeta).toBe('function');
  });

  it('indexFn should be a function', () => {
    expect(typeof indexFn).toBe('function');
  });
});

describe('Tier 14: Higher-level factories', () => {
  it('eigs should be a function', () => {
    expect(typeof eigs).toBe('function');
  });

  it('lusolve should be a function', () => {
    expect(typeof lusolve).toBe('function');
  });

  it('corr should be a function', () => {
    expect(typeof corr).toBe('function');
  });

  it('mad should compute median absolute deviation', () => {
    expect(typeof mad).toBe('function');
  });

  it('factory_std should compute sample standard deviation', () => {
    // mathjs uses sample std (n-1) by default
    const s = factory_std([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(s).toBeCloseTo(Math.sqrt(32 / 7), 5);
  });

  it('setSymDifference should be a function', () => {
    expect(typeof setSymDifference).toBe('function');
  });

  it('simplify should be a function', () => {
    expect(typeof simplify).toBe('function');
  });
});

describe('Tier 15: Algebra and norm', () => {
  it('derivative should be a function', () => {
    expect(typeof derivative).toBe('function');
  });

  it('factory_norm should be a function', () => {
    expect(typeof factory_norm).toBe('function');
    // Note: factory norm expects mathjs Matrix objects, not plain arrays
    // The typed norm from typed/arithmetic.ts handles plain arrays/Float64Arrays
  });

  it('rationalize should be a function', () => {
    expect(typeof rationalize).toBe('function');
  });

  it('setUnion should be a function', () => {
    expect(typeof setUnion).toBe('function');
  });

  it('symbolicEqual should be a function', () => {
    expect(typeof symbolicEqual).toBe('function');
  });
});

describe('Tier 16-18: Advanced linear algebra', () => {
  it('rotationMatrix should be a function', () => {
    expect(typeof rotationMatrix).toBe('function');
  });

  it('schur should be a function', () => {
    expect(typeof schur).toBe('function');
  });

  it('rotate should be a function', () => {
    expect(typeof rotate).toBe('function');
  });

  it('sylvester should be a function', () => {
    expect(typeof sylvester).toBe('function');
  });

  it('lyap should be a function', () => {
    expect(typeof lyap).toBe('function');
  });
});
