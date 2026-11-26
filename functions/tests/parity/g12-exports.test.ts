import { describe, it, expect } from 'vitest';
import * as functions from '../../src/index.js';
import * as core from '@danielsimonjr/mathts-core';
import * as mathjs from 'mathjs';
import {
  factory_abs,
  factory_cube,
  factory_xgcd,
  factory_std,
  factory_createUnit,
} from '../../src/factories/index.js';

/**
 * G12 typed-package surface decisions (#1567, #1568, #1570).
 *
 * #1567: `ArgumentsError`, `FibonacciHeap`, `ImmutableDenseMatrix` and `Spa` are
 * exported from `@danielsimonjr/mathts-functions` (the error/matrix classes mathjs
 * exports; `DimensionError`/`IndexError` are canonical on core).
 *
 * #1568: events are per-instance (compat), not module exports — `on`, `off`, `once`,
 * `emit` must stay ABSENT from the functions namespace.
 *
 * #1570: decision (b) plus aliases — the 63 factories that exist as `factory_<name>`
 * are also exported under their mathjs `create<Name>` names, and `createAdd` (an
 * A1 name whose factory does not exist) stays absent.
 */

const CLASSES = ['ArgumentsError', 'FibonacciHeap', 'ImmutableDenseMatrix', 'Spa'] as const;

/** The 63 A2 names from #1570: mathjs `create<Name>` ↔ the existing `factory_<name>`. */
const A2_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['createAbs', 'factory_abs'],
  ['createAcos', 'factory_acos'],
  ['createAcosh', 'factory_acosh'],
  ['createAcot', 'factory_acot'],
  ['createAcsc', 'factory_acsc'],
  ['createAsec', 'factory_asec'],
  ['createAsin', 'factory_asin'],
  ['createAsinh', 'factory_asinh'],
  ['createAtan', 'factory_atan'],
  ['createAtan2', 'factory_atan2'],
  ['createAtanh', 'factory_atanh'],
  ['createCbrt', 'factory_cbrt'],
  ['createCeil', 'factory_ceil'],
  ['createCompare', 'factory_compare'],
  ['createCos', 'factory_cos'],
  ['createCosh', 'factory_cosh'],
  ['createCot', 'factory_cot'],
  ['createCreateUnit', 'factory_createUnit'],
  ['createCsc', 'factory_csc'],
  ['createCtranspose', 'factory_ctranspose'],
  ['createCube', 'factory_cube'],
  ['createDivide', 'factory_divide'],
  ['createDot', 'factory_dot'],
  ['createEqual', 'factory_equal'],
  ['createExp', 'factory_exp'],
  ['createExpm1', 'factory_expm1'],
  ['createFix', 'factory_fix'],
  ['createFloor', 'factory_floor'],
  ['createGcd', 'factory_gcd'],
  ['createHypot', 'factory_hypot'],
  ['createLarger', 'factory_larger'],
  ['createLargerEq', 'factory_largerEq'],
  ['createLcm', 'factory_lcm'],
  ['createLog', 'factory_log'],
  ['createLog10', 'factory_log10'],
  ['createLog1p', 'factory_log1p'],
  ['createLog2', 'factory_log2'],
  ['createMax', 'factory_max'],
  ['createMean', 'factory_mean'],
  ['createMin', 'factory_min'],
  ['createMod', 'factory_mod'],
  ['createNorm', 'factory_norm'],
  ['createNthRoot', 'factory_nthRoot'],
  ['createPow', 'factory_pow'],
  ['createRound', 'factory_round'],
  ['createSec', 'factory_sec'],
  ['createSign', 'factory_sign'],
  ['createSin', 'factory_sin'],
  ['createSinh', 'factory_sinh'],
  ['createSmaller', 'factory_smaller'],
  ['createSmallerEq', 'factory_smallerEq'],
  ['createSqrt', 'factory_sqrt'],
  ['createSquare', 'factory_square'],
  ['createStd', 'factory_std'],
  ['createSubtract', 'factory_subtract'],
  ['createSum', 'factory_sum'],
  ['createTan', 'factory_tan'],
  ['createTanh', 'factory_tanh'],
  ['createTranspose', 'factory_transpose'],
  ['createUnaryMinus', 'factory_unaryMinus'],
  ['createUnaryPlus', 'factory_unaryPlus'],
  ['createVariance', 'factory_variance'],
  ['createXgcd', 'factory_xgcd'],
];

describe('G12 functions export surface (#1567, #1568, #1570)', () => {
  it('exports the canonical error and matrix-helper classes (#1567)', () => {
    for (const name of CLASSES) {
      const value = (functions as unknown as Record<string, unknown>)[name];
      expect(value, `${name} must be exported from @danielsimonjr/mathts-functions`).toBeDefined();
      expect(typeof value, `${name} must be a class`).toBe('function');
    }
  });

  it('does not export the event API (#1568 — compat-only)', () => {
    for (const name of ['on', 'off', 'once', 'emit']) {
      expect(name in functions, `${name} must stay off the typed package`).toBe(false);
    }
  });

  it('exports the 63 mathjs create* aliases (#1570)', () => {
    const fns = functions as unknown as Record<string, unknown>;
    for (const [alias] of A2_ALIASES) {
      expect(typeof fns[alias], `${alias} must be exported`).toBe('function');
    }
  });

  it('the create* aliases are the same factory creators as the factory_* exports', () => {
    const fns = functions as unknown as Record<string, unknown>;
    expect(fns.createAbs).toBe(factory_abs);
    expect(fns.createCube).toBe(factory_cube);
    expect(fns.createXgcd).toBe(factory_xgcd);
    expect(fns.createStd).toBe(factory_std);
    expect(fns.createCreateUnit).toBe(factory_createUnit);
  });

  it('createAdd (an A1 factory) stays absent from functions (#1570 decision b)', () => {
    expect('createAdd' in functions).toBe(false);
  });

  it('the aliased names exist on the mathjs oracle', () => {
    const oracle = new Set(Object.keys(mathjs));
    for (const [alias] of A2_ALIASES) expect(oracle.has(alias), alias).toBe(true);
  });

  it('the core canonical classes are the same identities functions throws', () => {
    expect(core.DimensionError).toBeTypeOf('function');
  });
});
