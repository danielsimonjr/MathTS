/**
 * The dependency object injected into the relocated mathjs `Unit` factory
 * (`Unit.ts`), assembled ENTIRELY from core's own primitives — this is the
 * "deep integration" half of the Unit merge (Phase 1.2). Where the functions
 * package used typed-function dispatch and its own util layer to satisfy the
 * factory's 19 dependencies, core wires them from:
 *
 *   - `core/src/arithmetic/scalar.ts` — the polymorphic scalar ops
 *   - core `Complex` / `BigNumber` / `Fraction` (+ small constructor adapters so
 *     the factory's `new BigNumber(...)` / `Complex.I` call sites keep working
 *     against core's private-ctor BigNumber and module-level imaginary unit)
 *   - core `format` (number-only) wrapped to also render boxed numeric values
 *   - core `DEFAULT_CONFIG` for the `{ number, predictable }` surface
 *
 * The one genuinely polymorphic dependency is `subtractScalar`: the Unit's
 * `splitUnit` subtracts two Units, so the injected op is Unit-aware (same-base
 * subtraction of SI-normalized values) and otherwise delegates to the scalar op.
 */
import {
  addScalar as scalarAdd,
  subtractScalar as scalarSubtract,
  multiplyScalar as scalarMultiply,
  divideScalar as scalarDivide,
  pow as scalarPow,
  abs as scalarAbs,
  fix as scalarFix,
  round as scalarRound,
  equal as scalarEqual,
  isNumeric as scalarIsNumeric,
  number as scalarNumber,
} from '../../arithmetic/scalar.js';
import { DEFAULT_CONFIG } from '../../config.js';
import { isUnit } from '../../is.js';
import { format, type FormatOptions } from '../../number.js';
import { BigNumber } from '../bignumber.js';
import { Complex, I as ComplexI } from '../complex.js';
import { Fraction } from '../fraction.js';
import type {
  BigNumberConstructor,
  ComplexConstructor,
  FractionConstructor,
  Numeric,
  ScalarBinaryOp,
  ScalarUnaryOp,
  SubtractScalar,
  UnitConfig,
  UnitDependencies,
  UnitInstance,
} from './unit-types.js';

/**
 * Core scalar values ARE the runtime `Numeric` values the Unit stores (number,
 * bigint, boolean, or a core Complex/Fraction/BigNumber instance). The unit-types
 * `Numeric` is a structural view of those, so the crossing is a safe cast.
 */
const asBinary = (op: (a: never, b: never) => unknown): ScalarBinaryOp =>
  ((a: Numeric, b: Numeric) => op(a as never, b as never) as Numeric) as ScalarBinaryOp;
const asUnary = (op: (x: never) => unknown): ScalarUnaryOp =>
  ((x: Numeric) => op(x as never) as Numeric) as ScalarUnaryOp;

/** `subtractScalar`, made Unit-aware for `splitUnit`. */
const subtractScalar: SubtractScalar = ((a: unknown, b: unknown) => {
  if (isUnit(a) && isUnit(b)) {
    const ua = a as unknown as UnitInstance;
    const ub = b as unknown as UnitInstance;
    if (!ua.equalBase(ub)) {
      throw new Error('Units do not match');
    }
    const res = ua.clone();
    res.value = scalarSubtract(ua.value as never, ub.value as never) as Numeric;
    res.fixPrefix = false;
    return res;
  }
  return scalarSubtract(a as never, b as never) as Numeric;
}) as SubtractScalar;

/**
 * The Unit renders its (SI-denormalized) value through this. Core `format` is
 * number-only, so boxed numeric values fall back to their own `toString`.
 */
function formatValue(value: unknown, options?: unknown): string {
  if (typeof value === 'number') {
    return format(value, options as FormatOptions);
  }
  if (value instanceof BigNumber || value instanceof Fraction || value instanceof Complex) {
    return value.toString();
  }
  return String(value);
}

/** `new BigNumber(x)` adapter — core's BigNumber ctor is private + type-specific. */
const BigNumberCtor = function (value: number | string | bigint): BigNumber {
  if (typeof value === 'string') return BigNumber.parse(value);
  if (typeof value === 'bigint') return BigNumber.fromBigInt(value);
  return BigNumber.fromNumber(value);
} as unknown as BigNumberConstructor;

/** `Complex` adapter carrying the static `.I` the factory reads. */
const ComplexCtor = Object.assign(
  function (re: number, im?: number): Complex {
    return new Complex(re, im ?? 0);
  },
  { I: ComplexI as unknown }
) as unknown as ComplexConstructor;

const config: UnitConfig = {
  number: DEFAULT_CONFIG.number,
  predictable: false,
};

/** The full dependency bundle for `createUnitClass`. */
export const unitDependencies: UnitDependencies = {
  on: undefined,
  config,
  addScalar: asBinary(scalarAdd as (a: never, b: never) => unknown),
  subtractScalar,
  multiplyScalar: asBinary(scalarMultiply as (a: never, b: never) => unknown),
  divideScalar: asBinary(scalarDivide as (a: never, b: never) => unknown),
  pow: asBinary(scalarPow as (a: never, b: never) => unknown),
  abs: asUnary(scalarAbs as (x: never) => unknown),
  fix: asUnary(scalarFix as (x: never) => unknown),
  round: asUnary(scalarRound as (x: never) => unknown),
  equal: (a: unknown, b: unknown) => scalarEqual(a as never, b as never),
  isNumeric: (x: unknown) => scalarIsNumeric(x),
  format: formatValue,
  number: (x: unknown) => scalarNumber(x as never),
  Complex: ComplexCtor,
  BigNumber: BigNumberCtor,
  Fraction: Fraction as unknown as FractionConstructor,
};
