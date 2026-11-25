import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { ConfigOptions } from '../core/config.js';
import type { BigNumber, Complex } from '@danielsimonjr/mathts-core';
import { sqrtBigNumberWith, sqrtNumberWith } from '../typed/complex-promotion.js';

interface UnitType {
  pow(value: number): UnitType;
}

interface SqrtDependencies {
  Complex: typeof Complex;
  config: ConfigOptions;
  typed: TypedFunction;
}

const name = 'sqrt';
const dependencies = ['Complex', 'config', 'typed'];

function sqrtFactory(normalizeImaginaryZero: boolean) {
  return factory(
    name,
    dependencies,
    ({ Complex: ComplexClass, config, typed }: SqrtDependencies) => {
      /**
       * Calculate the square root of a value.
       *
       * For matrices, if you want the matrix square root of a square matrix,
       * use the `sqrtm` function. If you wish to apply `sqrt` elementwise to
       * a matrix M, use `math.map(M, math.sqrt)`.
       *
       * Syntax:
       *
       *    math.sqrt(x)
       *
       * Examples:
       *
       *    math.sqrt(25)                // returns 5
       *    math.square(5)               // returns 25
       *    math.sqrt(-4)                // returns Complex 2i
       *
       * See also:
       *
       *    square, multiply, cube, cbrt, sqrtm
       *
       * @param {number | BigNumber | Fraction | Complex | Unit} x
       *            Value for which to calculate the square root.
       * @return {number | BigNumber | Complex | Unit}
       *            Returns the square root of `x`
       */
      return typed('sqrt', {
        number: (x: number): number | Complex =>
          sqrtNumberWith(x, config.predictable, ComplexClass),

        Complex: (x: Complex): Complex =>
          normalizeImaginaryZero && Object.is(x.im, -0)
            ? new ComplexClass(x.re, 0).sqrt()
            : x.sqrt(),

        BigNumber: (x: BigNumber): BigNumber | Complex =>
          sqrtBigNumberWith(x, config.predictable, ComplexClass),

        // A Fraction has no exact square root in general. Use the number path. The result is a
        // number for x >= 0 and a Complex for x < 0 (#1044).
        Fraction: (x: { valueOf(): number }): number | Complex =>
          sqrtNumberWith(x.valueOf(), config.predictable, ComplexClass),

        Unit: function (x: UnitType): UnitType {
          // Someday will work for complex units when they are implemented
          return x.pow(0.5);
        },
      });
    }
  );
}

/** Square root with the native complex branch convention. */
export const createSqrt = /* #__PURE__ */ sqrtFactory(false);

/** Square root with the mathjs complex branch convention on the real axis. */
export const createMathjsSqrt = /* #__PURE__ */ sqrtFactory(true);
