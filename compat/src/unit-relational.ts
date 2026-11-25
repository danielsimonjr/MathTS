/**
 * mathjs 15.3.0 unit comparison parity (#1552 / G04) — compat-only adapters.
 *
 * Native `functions` typed relational paths compare Unit values with `===` or coercions
 * that diverge from mathjs. These wrappers intercept Unit–Unit (and mathjs `deepEqual`)
 * cases on the compat instance and delegate through the activated factories, which
 * already implement mathjs `compareUnits`, plus explicit guards for known native gaps.
 */
import { isUnit } from '@danielsimonjr/mathts-core';
import {
  factory_compare,
  factory_equal,
  factory_larger,
  factory_largerEq,
  factory_smaller,
  factory_smallerEq,
} from '@danielsimonjr/mathts-functions';

const BASE_MISMATCH = 'Cannot compare units with different base';

const IMPLICIT_BN_FRAC =
  'Cannot implicitly convert a Fraction to BigNumber or vice versa. ' +
  'Use function bignumber(x) to convert to BigNumber or fraction(x) to convert to Fraction.';

type UnitLike = {
  equalBase(other: unknown): boolean;
  value: unknown;
  valueType(): string;
  valueOf(): unknown;
};

function asUnit(x: unknown): UnitLike {
  return x as UnitLike;
}

function assertSameBase(ux: UnitLike, uy: UnitLike): void {
  if (!ux.equalBase(uy)) {
    throw new Error(BASE_MISMATCH);
  }
}

function assertValueTypesComparable(ux: UnitLike, uy: UnitLike): void {
  const tx = ux.valueType();
  const ty = uy.valueType();
  if ((tx === 'BigNumber' && ty === 'Fraction') || (tx === 'Fraction' && ty === 'BigNumber')) {
    throw new TypeError(IMPLICIT_BN_FRAC);
  }
}

/** Relational helpers on a compat instance before {@link applyUnitRelationalParity} runs. */
export type UnitRelationalOps = {
  equal: (...args: unknown[]) => unknown;
  unequal: (...args: unknown[]) => unknown;
  equalScalar: (...args: unknown[]) => unknown;
  deepEqual: (...args: unknown[]) => unknown;
  compare: (...args: unknown[]) => unknown;
  larger: (...args: unknown[]) => unknown;
  smaller: (...args: unknown[]) => unknown;
  largerEq: (...args: unknown[]) => unknown;
  smallerEq: (...args: unknown[]) => unknown;
};

type UnitFactoryOp = (x: unknown, y: unknown) => unknown;

/**
 * Unit–Unit path: same base check, optional mixed-type guard, then the factory op.
 */
function withUnits(
  native: UnitFactoryOp,
  factoryOp: UnitFactoryOp,
  guardMixedTypes: boolean
): UnitFactoryOp {
  return (x: unknown, y: unknown) => {
    if (!isUnit(x) || !isUnit(y)) {
      return native(x, y);
    }
    const ux = asUnit(x);
    const uy = asUnit(y);
    assertSameBase(ux, uy);
    if (guardMixedTypes) {
      assertValueTypesComparable(ux, uy);
    }
    return factoryOp(x, y);
  };
}

function wrapUnequal(native: UnitFactoryOp, factoryEqual: UnitFactoryOp): UnitFactoryOp {
  return (x: unknown, y: unknown) => {
    if (!isUnit(x) || !isUnit(y)) {
      return native(x, y);
    }
    const ux = asUnit(x);
    const uy = asUnit(y);
    assertSameBase(ux, uy);
    assertValueTypesComparable(ux, uy);
    return !factoryEqual(x, y);
  };
}

/**
 * mathjs `deepEqual` calls `valueOf` before recursing; leaf scalars use `equal`, not
 * `equalScalar` (#1552 adversarial F3).
 */
function wrapDeepEqual(_native: UnitFactoryOp, factoryEqual: UnitFactoryOp): UnitFactoryOp {
  function deepEqualInner(x: unknown, y: unknown): boolean {
    if (Array.isArray(x)) {
      if (!Array.isArray(y) || x.length !== y.length) {
        return false;
      }
      for (let i = 0; i < x.length; i++) {
        if (!deepEqualInner(x[i], y[i])) {
          return false;
        }
      }
      return true;
    }
    if (Array.isArray(y)) {
      return false;
    }
    return factoryEqual(x, y) as boolean;
  }

  return (x: unknown, y: unknown) => {
    const xv =
      x !== null &&
      typeof x === 'object' &&
      typeof (x as { valueOf?: unknown }).valueOf === 'function'
        ? (x as { valueOf: () => unknown }).valueOf()
        : x;
    const yv =
      y !== null &&
      typeof y === 'object' &&
      typeof (y as { valueOf?: unknown }).valueOf === 'function'
        ? (y as { valueOf: () => unknown }).valueOf()
        : y;
    return deepEqualInner(xv, yv);
  };
}

function copyName(from: UnitFactoryOp, to: UnitFactoryOp): void {
  try {
    Object.defineProperty(to, 'name', { value: from.name, configurable: true });
  } catch {
    /* ignore */
  }
}

/**
 * Replace typed relational exports with compat adapters that route Unit pairs through
 * factories (mathjs-shaped) while leaving every other signature on the native function.
 */
export function applyUnitRelationalParity(ops: UnitRelationalOps): UnitRelationalOps {
  const factoryEqual = factory_equal as UnitFactoryOp;

  const equal = withUnits(ops.equal, factoryEqual, true);
  const unequal = wrapUnequal(ops.unequal, factoryEqual);
  const equalScalar = withUnits(ops.equalScalar, factoryEqual, true);
  const compare = withUnits(ops.compare, factory_compare as UnitFactoryOp, false);
  const larger = withUnits(ops.larger, factory_larger as UnitFactoryOp, false);
  const smaller = withUnits(ops.smaller, factory_smaller as UnitFactoryOp, false);
  const largerEq = withUnits(ops.largerEq, factory_largerEq as UnitFactoryOp, false);
  const smallerEq = withUnits(ops.smallerEq, factory_smallerEq as UnitFactoryOp, false);
  const deepEqual = wrapDeepEqual(ops.deepEqual, factoryEqual);

  copyName(ops.equal, equal);
  copyName(ops.unequal, unequal);
  copyName(ops.equalScalar, equalScalar);
  copyName(ops.deepEqual, deepEqual);
  copyName(ops.compare, compare);
  copyName(ops.larger, larger);
  copyName(ops.smaller, smaller);
  copyName(ops.largerEq, largerEq);
  copyName(ops.smallerEq, smallerEq);

  return {
    equal,
    unequal,
    equalScalar,
    deepEqual,
    compare,
    larger,
    smaller,
    largerEq,
    smallerEq,
  };
}
