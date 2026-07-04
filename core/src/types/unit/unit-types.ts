/**
 * Shared TypeScript interfaces for the Unit factory (`Unit.ts`).
 *
 * The Unit type is a "function-as-class" (a constructor function whose
 * prototype is built up imperatively) ported from mathjs. These interfaces
 * describe the runtime shapes precisely so `Unit.ts` can be fully type-checked
 * under strict mode without suppression directives or escape-hatch typing.
 *
 * @module @danielsimonjr/mathts-core/types/unit/unit-types
 */
import type { Complex } from '../../is.js';

/** A complex number value (re/im pair), as produced by the `Complex` type. */
export type ComplexValue = Complex;

/**
 * Minimal structural view of a BigNumber value: only the instance methods that
 * the Unit factory actually calls when computing angle constants.
 */
export interface BigNumberValue {
  div(other: BigNumberValue | number | string): BigNumberValue;
  times(other: BigNumberValue | number | string): BigNumberValue;
}

/** Structural view of a Fraction value (numerator/denominator/sign). */
export interface FractionValue {
  n: number;
  d: number;
  s: number;
  isFraction?: boolean;
}

/**
 * Any numeric value a Unit can carry. Mirrors what `isNumeric`/`isComplex`
 * accept at the constructor boundary (number, bigint, boolean, BigNumber,
 * Fraction, Complex). Boolean/bigint flow through unchanged for valueless
 * units and are coerced by the scalar operations otherwise.
 */
export type Numeric = number | bigint | boolean | BigNumberValue | FractionValue | ComplexValue;

/** A prefix definition such as `{ name: 'k', value: 1e3, scientific: true }`. */
export interface PrefixDef {
  name: string;
  value: number;
  scientific: boolean;
}

/** A named table of prefixes (e.g. PREFIXES.SHORT), keyed by prefix name. */
export type PrefixTable = Record<string, PrefixDef>;

/** A base dimension definition (the 9-element exponent vector + its key). */
export interface BaseUnitDef {
  dimensions: number[];
  key?: string;
}

/**
 * A unit definition entry in the UNITS table. `dimensions` and `base.key` are
 * populated after the literal is created (see the module-init loops), hence
 * optional; `value` is `null` for angle units until `calculateAngleValues`
 * runs at module init, before any unit is parsed.
 */
export interface UnitDef {
  name: string;
  base?: BaseUnitDef;
  prefixes?: PrefixTable;
  value: Numeric | null;
  offset: number;
  dimensions?: number[];
  reciprocal?: boolean;
}

/** A single component of a Unit's unit list (e.g. the `m` in `m/s^2`). */
export interface UnitComponent {
  unit: UnitDef;
  prefix: PrefixDef;
  power: number;
}

/** An entry in a unit system, pairing a unit with a default prefix. */
export interface UnitSystemEntry {
  unit: UnitDef;
  prefix: PrefixDef;
}

/** A unit system (e.g. `si`, `cgs`, `us`, `auto`), keyed by base-dimension. */
export type UnitSystem = Record<string, UnitSystemEntry>;

/** JSON serialization shape produced by `Unit#toJSON`. */
export interface UnitJSON {
  mathjs: 'Unit';
  value: Numeric | null;
  unit: string | null;
  fixPrefix: boolean;
  skipSimp: boolean;
}

/** A numeric-type converter (number → BigNumber/Fraction/Complex/number). */
export type ConverterFn = (x: Numeric) => Numeric;

/** The table of numeric-type converters exposed on `Unit.typeConverters`. */
export interface TypeConverters {
  BigNumber: ConverterFn;
  Fraction: ConverterFn;
  Complex: ConverterFn;
  number: ConverterFn;
  [key: string]: ConverterFn;
}

/** Options accepted by `Unit.parse`. */
export interface ParseOptions {
  allowNoUnits?: boolean;
}

/** Formatting options accepted by `Unit#format` / `Unit#toBest`. */
export interface UnitFormatOptions {
  offset?: number;
  [key: string]: unknown;
}

/** Options accepted by `Unit.createUnit`. */
export interface CreateUnitOptions {
  override?: boolean;
}

/** Object form of a `createUnit` / `createUnitSingle` definition. */
export interface CreateUnitDefObject {
  definition?: string | UnitInstance;
  prefixes?: string;
  offset?: number;
  baseName?: string;
  aliases?: string[];
}

/** Config object the Unit factory reads (`config` dep + `on('config')`). */
export interface UnitConfig {
  number: string;
  predictable?: boolean;
}

/** Constructor (with static `.I`) for Complex values. */
export interface ComplexConstructor {
  readonly I: ComplexValue;
}

/** Constructor for BigNumber values. */
export interface BigNumberConstructor {
  new (value: number | string): BigNumberValue;
}

/** Constructor for Fraction values. */
export interface FractionConstructor {
  new (value: Numeric | string, denominator?: number): FractionValue;
}

/** `subtractScalar` is polymorphic: it also subtracts two Units (in splitUnit). */
export interface SubtractScalar {
  (a: UnitInstance, b: UnitInstance): UnitInstance;
  (a: Numeric, b: Numeric): Numeric;
}

/** A binary scalar operation (add/multiply/divide/pow). */
export type ScalarBinaryOp = (a: Numeric, b: Numeric) => Numeric;

/** A unary scalar operation (abs/fix/round). */
export type ScalarUnaryOp = (x: Numeric) => Numeric;

/**
 * The dependency object injected into the Unit factory by the factory system.
 * `on` is optional (`?on` in the dependency list). The index signature reflects that
 * this is a factory *scope* (a string-keyed dependency record that may also carry
 * deps beyond the ones the Unit itself reads), and lets it satisfy the `factory`
 * helper's `Record<string, unknown>` constraint.
 */
export interface UnitDependencies {
  [key: string]: unknown;
  on?: (event: string, callback: (curr: UnitConfig, prev: UnitConfig) => void) => void;
  config: UnitConfig;
  addScalar: ScalarBinaryOp;
  subtractScalar: SubtractScalar;
  multiplyScalar: ScalarBinaryOp;
  divideScalar: ScalarBinaryOp;
  pow: ScalarBinaryOp;
  abs: ScalarUnaryOp;
  fix: ScalarUnaryOp;
  round: ScalarUnaryOp;
  equal: (a: unknown, b: unknown) => boolean;
  isNumeric: (x: unknown) => boolean;
  format: (value: unknown, options?: unknown) => string;
  number: (x: unknown) => number;
  Complex: ComplexConstructor;
  BigNumber: BigNumberConstructor;
  Fraction: FractionConstructor;
}

/** An instance of Unit (the prototype methods + per-instance fields). */
export interface UnitInstance {
  value: Numeric | null;
  units: UnitComponent[];
  dimensions: number[];
  fixPrefix: boolean;
  skipAutomaticSimplification: boolean;
  type: 'Unit';
  isUnit: boolean;
  constructor: UnitConstructor;

  clone(): UnitInstance;
  valueType(): string;
  _isDerived(): boolean;
  _normalize(value: Numeric | null | undefined): Numeric | null;
  _denormalize(value: Numeric | null, prefixValue?: Numeric): Numeric | null;
  hasBase(base: BaseUnitDef | string | undefined): boolean;
  equalBase(other: { dimensions: number[] }): boolean;
  equals(other: UnitInstance): boolean;
  multiply(other: UnitInstance | Numeric): UnitInstance | Numeric;
  divideInto(numerator: Numeric): UnitInstance | Numeric;
  divide(other: UnitInstance | Numeric): UnitInstance | Numeric;
  pow(p: number): UnitInstance | Numeric;
  abs(): UnitInstance;
  to(valuelessUnit: string | UnitInstance): UnitInstance;
  toNumber(valuelessUnit?: string | UnitInstance): number;
  toNumeric(valuelessUnit?: string | UnitInstance): Numeric | null;
  toString(): string;
  toJSON(): UnitJSON;
  valueOf(): string;
  simplify(): UnitInstance;
  toSI(): UnitInstance;
  formatUnits(): string;
  toBest(unitList?: Array<string | UnitInstance>, options?: UnitFormatOptions): UnitInstance;
  format(options?: UnitFormatOptions): string;
  _bestPrefix(offset?: number): PrefixDef;
  splitUnit(parts: Array<string | UnitInstance>): UnitInstance[];
  _numberConverter(): ConverterFn;
}

/** The Unit constructor function together with its static members. */
export interface UnitConstructor {
  new (value?: Numeric | null, valuelessUnit?: string | UnitInstance): UnitInstance;
  prototype: UnitInstance;
  name: string;

  parse(str: string, options?: ParseOptions): UnitInstance;
  isValuelessUnit(name: string): boolean;
  isValidAlpha(c: string): boolean;
  fromJSON(json: UnitJSON): UnitInstance;
  setUnitSystem(name: string): void;
  getUnitSystem(): string | undefined;
  createUnit(obj: Record<string, unknown>, options?: CreateUnitOptions): UnitInstance | undefined;
  createUnitSingle(name: string, obj?: unknown): UnitInstance;
  deleteUnit(name: string): void;
  _getNumberConverter(type: string): ConverterFn;

  typeConverters: TypeConverters;
  PREFIXES: Record<string, PrefixTable>;
  BASE_DIMENSIONS: string[];
  BASE_UNITS: Record<string, BaseUnitDef>;
  UNIT_SYSTEMS: Record<string, UnitSystem>;
  UNITS: Record<string, UnitDef>;
}
