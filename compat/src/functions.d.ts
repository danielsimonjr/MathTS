/**
 * Type declarations for @danielsimonjr/mathts-functions
 *
 * These declarations provide type safety for the compat layer
 * until the functions package has proper .d.ts files.
 */

declare module '@danielsimonjr/mathts-functions' {
  import type { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';

  // Arithmetic
  export function add(a: number, b: number): number;
  export function add(a: Complex, b: Complex): Complex;
  export function add(a: Fraction, b: Fraction): Fraction;
  export function add(a: BigNumber, b: BigNumber): BigNumber;
  export function add(
    a: number | Complex | Fraction | BigNumber,
    b: number | Complex | Fraction | BigNumber
  ): number | Complex | Fraction | BigNumber;

  export function subtract(a: number, b: number): number;
  export function subtract(a: Complex, b: Complex): Complex;
  export function subtract(a: Fraction, b: Fraction): Fraction;
  export function subtract(a: BigNumber, b: BigNumber): BigNumber;
  export function subtract(
    a: number | Complex | Fraction | BigNumber,
    b: number | Complex | Fraction | BigNumber
  ): number | Complex | Fraction | BigNumber;

  export function multiply(a: number, b: number): number;
  export function multiply(a: Complex, b: Complex): Complex;
  export function multiply(a: Fraction, b: Fraction): Fraction;
  export function multiply(a: BigNumber, b: BigNumber): BigNumber;
  export function multiply(
    a: number | Complex | Fraction | BigNumber,
    b: number | Complex | Fraction | BigNumber
  ): number | Complex | Fraction | BigNumber;

  export function divide(a: number, b: number): number;
  export function divide(a: Complex, b: Complex): Complex;
  export function divide(a: Fraction, b: Fraction): Fraction;
  export function divide(a: BigNumber, b: BigNumber): BigNumber;
  export function divide(
    a: number | Complex | Fraction | BigNumber,
    b: number | Complex | Fraction | BigNumber
  ): number | Complex | Fraction | BigNumber;

  export function pow(base: number, exponent: number): number;
  export function pow(base: Complex, exponent: number): Complex;
  export function pow(base: Complex, exponent: Complex): Complex;
  export function pow(base: number | Complex, exponent: number | Complex): number | Complex;

  export function sqrt(x: number): number;
  export function sqrt(x: Complex): Complex;
  export function sqrt(x: number | Complex): number | Complex;

  export function abs(x: number): number;
  export function abs(x: Complex): number;
  export function abs(x: number | Complex): number;

  export function exp(x: number): number;
  export function exp(x: Complex): Complex;
  export function exp(x: number | Complex): number | Complex;

  export function log(x: number): number;
  export function log(x: Complex): Complex;
  export function log(x: number | Complex): number | Complex;

  // Trigonometry
  export function sin(x: number): number;
  export function sin(x: Complex): Complex;
  export function sin(x: number | Complex): number | Complex;

  export function cos(x: number): number;
  export function cos(x: Complex): Complex;
  export function cos(x: number | Complex): number | Complex;

  export function tan(x: number): number;
  export function tan(x: Complex): Complex;
  export function tan(x: number | Complex): number | Complex;

  // Statistics
  export function sum(arr: number[]): number;
  export function mean(arr: number[]): number;
  export function min(arr: number[]): number;
  export function max(arr: number[]): number;

  // Number theory
  export function gcd(a: number, b: number): number;
  export function lcm(a: number, b: number): number;

  // Rounding
  export function round(x: number, decimals?: number): number;
  export function floor(x: number): number;
  export function ceil(x: number): number;
}
