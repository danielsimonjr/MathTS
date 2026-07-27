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

function _createRng(config: ConfigOptions, on?: RandomDependencies['on']) {
  let rng = createRng(config.randomSeed);

  if (on) {
    on('config', function (curr: ConfigOptions, prev: ConfigOptions) {
      if (curr.randomSeed !== prev.randomSeed) {
        rng = createRng(curr.randomSeed);
      }
    });
  }

  return () => rng();
}

function _createRandomSignatures(rng: () => number) {
  function _random(min: number, max: number): number {
    return min + rng() * (max - min);
  }

  return {
    _random,
    signatures: {
      '': () => _random(0, 1),
      number: (max: number) => _random(0, max),
      'number, number': (min: number, max: number) => _random(min, max),
    }
  };
}

export const createRandom = /* #__PURE__ */ factory(
  name,
  dependencies,
  ({ typed, config, on }: RandomDependencies) => {
    const rng = _createRng(config, on);
    const { _random, signatures } = _createRandomSignatures(rng);

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

    return typed(name, {
      ...signatures,
      'Array | Matrix': (size: unknown[] | MatrixType) => _randomMatrix(size, 0, 1),
      'Array | Matrix, number': (size: unknown[] | MatrixType, max: number) =>
        _randomMatrix(size, 0, max),
      'Array | Matrix, number, number': (size: unknown[] | MatrixType, min: number, max: number) =>
        _randomMatrix(size, min, max),
    });
  }
);

// number only implementation of random, no matrix support
export const createRandomNumber = /* #__PURE__ */ factory(
  name,
  ['typed', 'config', '?on'],
  ({ typed, config, on }: RandomDependencies) => {
    const rng = _createRng(config, on);
    const { signatures } = _createRandomSignatures(rng);

    return typed(name, signatures);
  }
);
