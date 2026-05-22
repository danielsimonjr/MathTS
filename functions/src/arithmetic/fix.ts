import { factory } from '../utils/factory.js'
import { deepMap } from '../utils/collection.js'
import { createMatAlgo12xSfs } from '../type/matrix/utils/matAlgo12xSfs.js'
import { createMatAlgo14xDs } from '../type/matrix/utils/matAlgo14xDs.js'
import type { TypedFunction } from '../core/function/typed.js'

// Type definitions for dependency injection
interface Matrix {
  size(): number[]
  storage(): string
  valueOf(): unknown[] | unknown[][]
}

interface BigNumberType {
  isNegative(): boolean
  toNumber(): number
}

interface ComplexType {
  re: number
  im: number
}

interface FractionType {
  s: bigint
  ceil(n?: number): FractionType
  floor(n?: number): FractionType
}

interface UnitType {
  toNumeric(unit: UnitType): number | BigNumberType
  multiply(value: number | BigNumberType): UnitType
}

interface ComplexConstructor {
  new (re: number, im: number): ComplexType
  (re: number, im: number): ComplexType
}

interface FixNumberDependencies {
  typed: TypedFunction
  ceil: TypedFunction
  floor: TypedFunction
}

interface FixDependencies extends FixNumberDependencies {
  Complex: ComplexConstructor
  matrix: (data: unknown[]) => Matrix
  equalScalar: TypedFunction
  zeros: (size: number[], storage?: string) => Matrix
  DenseMatrix: new (data: unknown) => Matrix
}

const name = 'fix'
const dependencies = [
  'typed',
  'Complex',
  'matrix',
  'ceil',
  'floor',
  'equalScalar',
  'zeros',
  'DenseMatrix'
]

export const createFixNumber = /* #__PURE__ */ factory(
  name,
  ['typed', 'ceil', 'floor'] as const,
  ({ typed, ceil, floor }: FixNumberDependencies) => {
    return typed(name, {
      number: function (x: number): number {
        return x > 0 ? (floor(x) as number) : (ceil(x) as number)
      },

      'number, number': function (x: number, n: number): number {
        return x > 0 ? (floor(x, n) as number) : (ceil(x, n) as number)
      }
    })
  }
)

export const createFix = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({
    typed,
    Complex,
    matrix,
    ceil,
    floor,
    equalScalar,
    zeros,
    DenseMatrix
  }: FixDependencies) => {
    const matAlgo12xSfs = createMatAlgo12xSfs({ typed, DenseMatrix })
    const matAlgo14xDs = createMatAlgo14xDs({ typed })

    const fixNumber = createFixNumber({ typed, ceil, floor }) as TypedFunction
    /**
     * Round a value towards zero.
     * For matrices, the function is evaluated element wise.
     *
     * Syntax:
     *
     *    math.fix(x)
     *    math.fix(x,n)
     *    math.fix(unit, valuelessUnit)
     *    math.fix(unit, n, valuelessUnit)
     *
     * Examples:
     *
     *    math.fix(3.2)                // returns number 3
     *    math.fix(3.8)                // returns number 3
     *    math.fix(-4.2)               // returns number -4
     *    math.fix(-4.7)               // returns number -4
     *
     *    math.fix(3.12, 1)                // returns number 3.1
     *    math.fix(3.18, 1)                // returns number 3.1
     *    math.fix(-4.12, 1)               // returns number -4.1
     *    math.fix(-4.17, 1)               // returns number -4.1
     *
     *    const c = math.complex(3.22, -2.78)
     *    math.fix(c)                  // returns Complex 3 - 2i
     *    math.fix(c, 1)               // returns Complex 3.2 -2.7i
     *
     *    const unit = math.unit('3.241 cm')
     *    const cm = math.unit('cm')
     *    const mm = math.unit('mm')
     *    math.fix(unit, 1, cm)      // returns Unit 3.2 cm
     *    math.fix(unit, 1, mm)      // returns Unit 32.4 mm
     *
     *    math.fix([3.2, 3.8, -4.7])      // returns Array [3, 3, -4]
     *    math.fix([3.2, 3.8, -4.7], 1)   // returns Array [3.2, 3.8, -4.7]
     *
     * See also:
     *
     *    ceil, floor, round
     *
     * @param  {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} x  Value to be rounded
     * @param  {number | BigNumber | Array} [n=0]                            Number of decimals
     * @param  {Unit} [valuelessUnit]                                        A valueless unit
     * @return {number | BigNumber | Fraction | Complex | Unit | Array | Matrix} Rounded value
     */
    return typed('fix', {
      number: fixNumber.signatures.number,
      'number, number | BigNumber': fixNumber.signatures['number,number'],

      Complex: function (x: ComplexType): ComplexType {
        return new Complex(
          x.re > 0 ? Math.floor(x.re) : Math.ceil(x.re),
          x.im > 0 ? Math.floor(x.im) : Math.ceil(x.im)
        )
      },

      'Complex, number': function (x: ComplexType, n: number): ComplexType {
        return new Complex(
          x.re > 0 ? (floor(x.re, n) as number) : (ceil(x.re, n) as number),
          x.im > 0 ? (floor(x.im, n) as number) : (ceil(x.im, n) as number)
        )
      },

      'Complex, BigNumber': function (
        x: ComplexType,
        bn: BigNumberType
      ): ComplexType {
        const n = bn.toNumber()
        return new Complex(
          x.re > 0 ? (floor(x.re, n) as number) : (ceil(x.re, n) as number),
          x.im > 0 ? (floor(x.im, n) as number) : (ceil(x.im, n) as number)
        )
      },

      BigNumber: function (x: BigNumberType): BigNumberType {
        return (x.isNegative() ? ceil(x) : floor(x)) as BigNumberType
      },

      'BigNumber, number | BigNumber': function (
        x: BigNumberType,
        n: number | BigNumberType
      ): BigNumberType {
        return (x.isNegative() ? ceil(x, n) : floor(x, n)) as BigNumberType
      },

      bigint: (b: bigint): bigint => b,
      'bigint, number': (b: bigint, _dummy: number): bigint => b,
      'bigint, BigNumber': (b: bigint, _dummy: BigNumberType): bigint => b,

      Fraction: function (x: FractionType): FractionType {
        return x.s < 0n ? x.ceil() : x.floor()
      },

      'Fraction, number | BigNumber': function (
        x: FractionType,
        n: number | BigNumberType
      ): FractionType {
        return (x.s < 0n ? ceil(x, n) : floor(x, n)) as FractionType
      },

      'Unit, number, Unit': typed.referToSelf(
        (self: TypedFunction) =>
          function (x: UnitType, n: number, unit: UnitType): UnitType {
            const valueless = x.toNumeric(unit)
            return unit.multiply(self(valueless, n) as number | BigNumberType)
          }
      ),

      'Unit, BigNumber, Unit': typed.referToSelf(
        (self: TypedFunction) =>
          (x: UnitType, n: BigNumberType, unit: UnitType): UnitType =>
            self(x, n.toNumber(), unit) as UnitType
      ),

      'Array | Matrix, number | BigNumber, Unit': typed.referToSelf(
        (self: TypedFunction) =>
          (
            x: unknown[] | Matrix,
            n: number | BigNumberType,
            unit: UnitType
          ): unknown[] | Matrix => {
            // deep map collection, skip zeros since fix(0) = 0
            return deepMap(x as unknown[], (value) => self(value, n, unit), true) as unknown[] | Matrix
          }
      ),

      'Array | Matrix | Unit, Unit': typed.referToSelf(
        (self: TypedFunction) =>
          (
            x: unknown[] | Matrix | UnitType,
            unit: UnitType
          ): unknown[] | Matrix | UnitType =>
            self(x, 0, unit) as unknown[] | Matrix | UnitType
      ),

      'Array | Matrix': typed.referToSelf(
        (self: TypedFunction) =>
          (x: unknown[] | Matrix): unknown[] | Matrix => {
            // deep map collection, skip zeros since fix(0) = 0
            return deepMap(x as unknown[], self, true) as unknown[] | Matrix
          }
      ),

      'Array | Matrix, number | BigNumber': typed.referToSelf(
        (self: TypedFunction) =>
          (
            x: unknown[] | Matrix,
            n: number | BigNumberType
          ): unknown[] | Matrix => {
            // deep map collection, skip zeros since fix(0) = 0
            return deepMap(x as unknown[], (i) => self(i, n), true) as unknown[] | Matrix
          }
      ),

      'number | Complex | Fraction | BigNumber, Array': typed.referToSelf(
        (self: TypedFunction) =>
          (
            x: number | ComplexType | FractionType | BigNumberType,
            y: unknown[]
          ): unknown[] => {
            // use matrix implementation
            return (matAlgo14xDs(matrix(y) as any, x, self, true) as any).valueOf() as unknown[]
          }
      ),

      'number | Complex | Fraction | BigNumber, Matrix': typed.referToSelf(
        (self: TypedFunction) =>
          (
            x: number | ComplexType | FractionType | BigNumberType,
            y: Matrix
          ): Matrix => {
            if (equalScalar(x, 0)) return zeros(y.size(), y.storage())
            if (y.storage() === 'dense') {
              return matAlgo14xDs(y as any, x, self, true) as any as Matrix
            }
            return matAlgo12xSfs(y as any, x, self, true) as any as Matrix
          }
      )
    })
  }
)
