import { factory } from '../utils/factory.js';
import { createZerosAndOnes, Dependencies } from './utils/zerosAndOnes.js';

const name = 'zeros';
const dependencies = ['typed', 'config', 'matrix', 'BigNumber'];

export const createZeros = /* #__PURE__ */ factory(
  name,
  dependencies,
  (deps: Dependencies) => {
    /**
     * Create a matrix filled with zeros. The created matrix can have one or
     * multiple dimensions.
     *
     * Syntax:
     *
     *    math.zeros(m)
     *    math.zeros(m, format)
     *    math.zeros(m, n)
     *    math.zeros(m, n, format)
     *    math.zeros([m, n])
     *    math.zeros([m, n], format)
     *
     * Examples:
     *
     *    math.zeros()                   // returns []
     *    math.zeros(3)                  // returns [0, 0, 0]
     *    math.zeros(3, 2)               // returns [[0, 0], [0, 0], [0, 0]]
     *    math.zeros(3, 'dense')         // returns [0, 0, 0]
     *
     *    const A = [[1, 2, 3], [4, 5, 6]]
     *    math.zeros(math.size(A))       // returns [[0, 0, 0], [0, 0, 0]]
     *
     * See also:
     *
     *    ones, identity, size, range
     *
     * @param {...(number|BigNumber) | Array} size    The size of each dimension of the matrix
     * @param {string} [format]           The Matrix storage format
     *
     * @return {Array | Matrix}           A matrix filled with zeros
     */
    return createZerosAndOnes(name, 0, deps);
  }
);
