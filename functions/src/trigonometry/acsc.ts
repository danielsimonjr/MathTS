import { factory } from '../utils/factory.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { ConfigOptions } from '../core/config.js';
import type { Complex } from '../type/complex/Complex.js';
import type { BigNumber } from '../type/bignumber/BigNumber.js';
import { acscNumber } from '../plain/number/index.js';

// Type definitions for acsc
interface ComplexConstructor {
  new (re: number, im: number): Complex;
}

interface BigNumberConstructor {
  new (value: number): BigNumber;
}

interface AcscDependencies {
  typed: TypedFunction;
  config: ConfigOptions;
  Complex: ComplexConstructor;
  BigNumber: BigNumberConstructor;
}

const name = 'acsc';
const dependencies = ['typed', 'config', 'Complex', 'BigNumber'];

export const createAcsc = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, config, Complex, BigNumber }: AcscDependencies) => {
    /**
     * Calculate the inverse cosecant of a value, defined as `acsc(x) = asin(1/x)`.
     *
     * To avoid confusion with the matrix arccosecant, this function does not
     * apply to matrices.
     *
     * Syntax:
     *
     *    math.acsc(x)
     *
     * Examples:
     *
     *    math.acsc(2)             // returns 0.5235987755982989
     *    math.acsc(0.5)           // returns Complex 1.5707963267948966 -1.3169578969248166i
     *    math.acsc(math.csc(1.5)) // returns number 1.5
     *
     * See also:
     *
     *    csc, asin, asec
     *
     * @param {number | BigNumber | Complex} x   Function input
     * @return {number | BigNumber | Complex} The arc cosecant of x
     */
    return typed(name, {
      number: function (x: number) {
        if (x <= -1 || x >= 1 || config.predictable) {
          return acscNumber(x);
        }
        return new Complex(x, 0).acsc();
      },

      Complex: function (x: Complex) {
        return x.acsc();
      },

      BigNumber: function (x: BigNumber): BigNumber {
        return new BigNumber(1).div(x as any).asin() as unknown as BigNumber;
      },
    }) as TypedFunction;
  }
);
