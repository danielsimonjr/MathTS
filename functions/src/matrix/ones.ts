import { factory } from '../utils/factory.js';
import { createZerosAndOnes, Dependencies } from './utils/zerosAndOnes.js';

const name = 'ones';
const dependencies = ['typed', 'config', 'matrix', 'BigNumber'];

export const createOnes = /* #__PURE__ */ factory(
  name,
  dependencies,
  (deps: Dependencies) => {
    /**
     * Create a matrix filled with ones. The created matrix can have one or
     * multiple dimensions.
     *
     * Syntax:
     *
     *    math.ones(m)
     *    math.ones(m, format)
     *    math.ones(m, n)
     *    math.ones(m, n, format)
     *    math.ones([m, n])
     *    math.ones([m, n], format)
     *    math.ones([m, n, p, ...])
     *    math.ones([m, n, p, ...], format)
     *
     * Examples:
     *
     *    math.ones()                    // returns []
     *    math.ones(3)                   // returns [1, 1, 1]
     *    math.ones(3, 2)                // returns [[1, 1], [1, 1], [1, 1]]
     *    math.ones(3, 2, 'dense')       // returns Dense Matrix [[1, 1], [1, 1], [1, 1]]
     *
     *    const A = [[1, 2, 3], [4, 5, 6]]
     *    math.ones(math.size(A))       // returns [[1, 1, 1], [1, 1, 1]]
     *
     * See also:
     *
     *    zeros, identity, size, range
     *
     * @param {...(number|BigNumber) | Array} size    The size of each dimension of the matrix
     * @param {string} [format]           The Matrix storage format
     *
     * @return {Array | Matrix | number}  A matrix filled with ones
     */
    return createZerosAndOnes(name, 1, deps);
  }
);
