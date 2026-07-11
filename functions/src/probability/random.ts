import { factory } from '../utils/factory.js';
import { isMatrix } from '../utils/is.js';
import { createRng } from './util/seededRNG.js';
import { randomMatrix } from './util/randomMatrix.js';
import type { TypedFunction } from '../core/function/typed.js';
import type { ConfigOptions } from '../core/config.js';

// Type definitions for random
interface MatrixType {
  create(data: unknown[], datatype?: string): MatrixType;
  valueOf(): unknown[];
}

interface RandomDependencies {
  typed: TypedFunction;
  config: ConfigOptions;
  on?: (event: string, callback: (curr: ConfigOptions, prev: ConfigOptions) => void) => void;
}

const name = 'random';
const dependencies = ['typed', 'config', '?on'];

function _createRandomFunction(config: ConfigOptions, on?: RandomDependencies['on']) {
  // seeded pseudo random number generator
  let rng = createRng(config.randomSeed);

  if (on) {
    on('config', function (curr: ConfigOptions, prev: ConfigOptions) {
      if (curr.randomSeed !== prev.randomSeed) {
        rng = createRng(curr.randomSeed);
      }
    });
  }

  return function _random(min: number, max: number): number {
    return min + rng() * (max - min);
  };
}

export const createRandom = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, config, on }: RandomDependencies) => {
    const _random = _createRandomFunction(config, on);

    /**
     * Return a random number larger or equal to `min` and smaller than `max`
     * using a uniform distribution.
     *
     * Syntax:
     *
     *     math.random()                // generate a random number between 0 and 1
     *     math.random(max)             // generate a random number between 0 and max
     *     math.random(min, max)        // generate a random number between min and max
     *     math.random(size)            // generate a matrix with random numbers between 0 and 1
     *     math.random(size, max)       // generate a matrix with random numbers between 0 and max
     *     math.random(size, min, max)  // generate a matrix with random numbers between min and max
     *
     * Examples:
     *
     *     math.random()       // returns a random number between 0 and 1
     *     math.random(100)    // returns a random number between 0 and 100
     *     math.random(30, 40) // returns a random number between 30 and 40
     *     math.random([2, 3]) // returns a 2x3 matrix with random numbers between 0 and 1
     *
     * See also:
     *
     *     randomInt, pickRandom
     *
     * @param {Array | Matrix} [size] If provided, an array or matrix with given
     *                                size and filled with random values is returned
     * @param {number} [min]  Minimum boundary for the random value, included
     * @param {number} [max]  Maximum boundary for the random value, excluded
     * @return {number | Array | Matrix} A random number
     */
    return typed(name, {
      '': () => _random(0, 1),
      number: (max: number) => _random(0, max),
      'number, number': (min: number, max: number) => _random(min, max),
      'Array | Matrix': (size: unknown[] | MatrixType) => _randomMatrix(size, 0, 1),
      'Array | Matrix, number': (size: unknown[] | MatrixType, max: number) =>
        _randomMatrix(size, 0, max),
      'Array | Matrix, number, number': (size: unknown[] | MatrixType, min: number, max: number) =>
        _randomMatrix(size, min, max),
    });

    function _randomMatrix(
      size: unknown[] | MatrixType,
      min: number,
      max: number
    ): unknown[] | MatrixType {
      const res = randomMatrix((size as { valueOf(): number[] }).valueOf(), () =>
        _random(min, max)
      );
      return isMatrix(size) ? (size as MatrixType).create(res as unknown[], 'number') : res;
    }
  }
);

// number only implementation of random, no matrix support
export const createRandomNumber = /* #__PURE__ */ factory(
  name,
  ['typed', 'config', '?on'],
  ({ typed, config, on }: RandomDependencies) => {
    const _random = _createRandomFunction(config, on);

    return typed(name, {
      '': () => _random(0, 1),
      number: (max: number) => _random(0, max),
      'number, number': (min: number, max: number) => _random(min, max),
    });
  }
);
