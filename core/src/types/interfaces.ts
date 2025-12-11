/**
 * Base interfaces for MathTS types
 * @module @mathts/core/types/interfaces
 */

/**
 * Base interface for all MathTS numeric types
 */
export interface MathTSValue {
  readonly type: string;
  valueOf(): number | bigint;
  toString(): string;
  toJSON(): unknown;
}

/**
 * Scalar types that support arithmetic
 */
export interface Scalar extends MathTSValue {
  add(other: Scalar): Scalar;
  subtract(other: Scalar): Scalar;
  multiply(other: Scalar): Scalar;
  divide(other: Scalar): Scalar;
  negate(): Scalar;
  abs(): Scalar;
}

/**
 * Available computation backends
 */
export type BackendType = 'js' | 'wasm' | 'gpu';

/**
 * Supported numeric types
 */
export type NumericType = 'float32' | 'float64' | 'int32' | 'int64' | 'complex64' | 'complex128';

/**
 * Matrix backend interface
 */
export interface MatrixBackend {
  readonly name: BackendType;
  readonly isAvailable: boolean;

  // Core operations
  matmul(a: Float64Array, b: Float64Array, m: number, n: number, k: number): Float64Array;
  transpose(data: Float64Array, rows: number, cols: number): Float64Array;
  add(a: Float64Array, b: Float64Array): Float64Array;
  subtract(a: Float64Array, b: Float64Array): Float64Array;
  scale(data: Float64Array, scalar: number): Float64Array;

  // Advanced operations
  lu(data: Float64Array, n: number): { L: Float64Array; U: Float64Array; P: Int32Array };
  qr(data: Float64Array, m: number, n: number): { Q: Float64Array; R: Float64Array };
  svd(data: Float64Array, m: number, n: number): { U: Float64Array; S: Float64Array; V: Float64Array };
  eig(data: Float64Array, n: number): { values: Float64Array; vectors: Float64Array };
}

/**
 * Matrix interface with backend abstraction
 */
export interface IMatrix<T = number> extends MathTSValue {
  readonly rows: number;
  readonly cols: number;
  readonly size: readonly [number, number];
  readonly length: number;
  readonly backend: MatrixBackend;

  // Element access
  get(row: number, col: number): T;
  set(row: number, col: number, value: T): void;

  // Views (no copy)
  row(index: number): IMatrix<T>;
  column(index: number): IMatrix<T>;
  slice(rowStart: number, rowEnd: number, colStart: number, colEnd: number): IMatrix<T>;

  // Transformations
  transpose(): IMatrix<T>;
  reshape(rows: number, cols: number): IMatrix<T>;
  flatten(): T[];

  // Arithmetic (dispatches to backend)
  add(other: IMatrix<T> | T): IMatrix<T>;
  subtract(other: IMatrix<T> | T): IMatrix<T>;
  multiply(other: IMatrix<T> | T): IMatrix<T>;

  // Data access
  toArray(): T[][];
  toBuffer(): ArrayBuffer;
  clone(): IMatrix<T>;
}

/**
 * Complex number interface
 */
export interface IComplex extends Scalar {
  readonly re: number;
  readonly im: number;

  conjugate(): IComplex;
  arg(): number;
  sqrt(): IComplex;
  exp(): IComplex;
  log(): IComplex;
}

/**
 * Fraction interface for exact rational arithmetic
 */
export interface IFraction extends Scalar {
  readonly numerator: bigint;
  readonly denominator: bigint;

  simplify(): IFraction;
  toNumber(): number;
}

/**
 * BigNumber interface for arbitrary precision decimals
 */
export interface IBigNumber extends MathTSValue {
  add(other: IBigNumber | number | string): IBigNumber;
  subtract(other: IBigNumber | number | string): IBigNumber;
  multiply(other: IBigNumber | number | string): IBigNumber;
  divide(other: IBigNumber | number | string): IBigNumber;
  negate(): IBigNumber;
  abs(): IBigNumber;
  pow(n: number | bigint): IBigNumber;
  sqrt(): IBigNumber;

  isNaN(): boolean;
  isFinite(): boolean;
  isInfinite(): boolean;
  isZero(): boolean;
  isPositive(): boolean;
  isNegative(): boolean;
  isInteger(): boolean;

  equals(other: IBigNumber): boolean;
  lessThan(other: IBigNumber): boolean;
  greaterThan(other: IBigNumber): boolean;
  compareTo(other: IBigNumber): number;

  toFixed(decimalPlaces?: number): string;
  toExponential(decimalPlaces?: number): string;
  toPrecision(significantDigits?: number): string;
  toBigInt(): bigint;
}

/**
 * Matrix dimensions
 */
export interface MatrixDimensions {
  rows: number;
  cols: number;
}
