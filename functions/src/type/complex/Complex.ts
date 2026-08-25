import { Complex as ComplexClass } from 'complex.js';

/**
 * JSON representation of a Complex number
 */
export interface ComplexJSON {
  mathjs: 'Complex';
  re: number;
  im: number;
}

/**
 * Polar representation of a Complex number
 */
export interface PolarCoordinates {
  r: number;
  phi: number;
}

/**
 * Formatting options for Complex numbers
 */
export interface ComplexFormatOptions {
  precision?: number;
  notation?: 'auto' | 'fixed' | 'exponential' | 'engineering';
  lowerExp?: number;
  upperExp?: number;
  wordSize?: number;
}

/**
 * Extended Complex type with mathjs additions
 */
export interface Complex extends ComplexClass {
  type: 'Complex';
  isComplex: true;
  toJSON(): ComplexJSON;
  toPolar(): PolarCoordinates;
  format(options?: number | ComplexFormatOptions | ((value: number) => string)): string;
}

/**
 * Input for creating a Complex from polar coordinates
 */
export interface PolarInput {
  r: number;
  phi: number;
}

/**
 * Input for creating a Complex from absolute value and argument
 */
export interface AbsArgInput {
  abs: number;
  arg: number;
}

/**
 * Complex constructor interface with static methods
 */
export interface ComplexConstructor {
  new (a?: number | string | ComplexJSON | PolarInput | AbsArgInput, b?: number): Complex;
  (a?: number | string | ComplexJSON | PolarInput | AbsArgInput, b?: number): Complex;
  prototype: Complex;
  fromPolar: {
    (polar: PolarInput): Complex;
    (r: number, phi: number): Complex;
  };
  fromJSON: (json: ComplexJSON) => Complex;
  compare: (a: Complex, b: Complex) => number;
  ZERO: Complex;
  ONE: Complex;
  I: Complex;
  PI: Complex;
  E: Complex;
  INFINITY: Complex;
  NAN: Complex;
  EPSILON: number;
}

// Cast to allow prototype access and static method additions
