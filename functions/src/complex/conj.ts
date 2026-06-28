import { factory } from '../utils/factory.js';
import { deepMap } from '../utils/collection.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { Matrix, BigNumber, Fraction, Unit } from '../types.js';

interface ComplexType {
  conjugate(): ComplexType;
}

interface ConjDependencies {
  typed: TypedFunction;
}

const name = 'conj';
const dependencies = ['typed'];

export const createConj = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed }: ConjDependencies) => {
    /**
     * Compute the complex conjugate of a complex value.
     * If `x = a+bi`, the complex conjugate of `x` is `a - bi`.
     *
     * For matrices, the function is evaluated element wise.
     *
     * Syntax:
     *
     *    math.conj(x)
     *
     * Examples:
     *
     *    math.conj(math.complex('2 + 3i'))  // returns Complex 2 - 3i
     *    math.conj(math.complex('2 - 3i'))  // returns Complex 2 + 3i
     *    math.conj(math.complex('-5.2i'))  // returns Complex 5.2i
     *
     * See also:
     *
     *    re, im, arg, abs
     *
     * @param {number | BigNumber | Complex | Array | Matrix | Unit} x
     *            A complex number or array with complex numbers
     * @return {number | BigNumber | Complex | Array | Matrix | Unit}
     *            The complex conjugate of x
     */
    return typed(name, {
      'number | BigNumber | Fraction': (x: number | BigNumber | Fraction): number | BigNumber | Fraction =>
        x,
      Complex: (x: ComplexType): ComplexType => x.conjugate(),
      Unit: typed.referToSelf(
        (self: TypedFunction) =>
          (x: Unit): Unit => {
            const ctor = (x as unknown as { constructor: new (value: unknown, units: unknown) => Unit })
              .constructor;
            return new ctor(self(x.toNumeric()), x.formatUnits());
          }
      ),
      'Array | Matrix': typed.referToSelf(
        (self: TypedFunction) =>
          (x: unknown[] | Matrix): unknown[] | Matrix =>
            deepMap(x as unknown[], self) as unknown[] | Matrix
      ),
    });
  }
);
