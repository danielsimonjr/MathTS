import { isBigNumber } from '../../utils/is.js';
import { isInteger } from '../../utils/number.js';
import { resize } from '../../utils/array.js';
import type { TypedFunction } from '../../core/function/typed.js';

// Type definitions
export type { TypedFunction };

/** Structural type of the BigNumber constructor that `createZerosAndOnes` needs. */
export interface BigNumberConstructor {
  new (value: number | string): BigNumber;
  (value: number | string): BigNumber;
}

/** Structural type of a BigNumber value, as `createZerosAndOnes` uses it. */
export interface BigNumber {
  isBigNumber: boolean;
  toNumber(): number;
}

/** Structural type of the `matrix` function that `createZerosAndOnes` needs. */
export interface MatrixConstructor {
  (data?: unknown, storage?: string): Matrix;
}

/** Structural type of a Matrix value, as `createZerosAndOnes` uses it. */
export interface Matrix {
  _size: number[];
  storage(): 'dense' | 'sparse';
  valueOf(): unknown[] | unknown[][];
  resize(size: number[], defaultValue: unknown): Matrix;
}

/** The part of the configuration that `createZerosAndOnes` reads. */
export interface Config {
  matrix: 'Array' | 'Matrix';
}

/** Dependencies of `createZerosAndOnes`. */
export interface Dependencies {
  typed: TypedFunction;
  config: Config;
  matrix: MatrixConstructor;
  BigNumber: BigNumberConstructor;
}

/**
 * Create the typed function `name` that returns an array or matrix filled with
 * `defaultValue`.
 *
 * The `zeros` and `ones` functions use this factory. With no arguments, the result is an
 * empty Array or Matrix, as the `matrix` configuration option sets.
 */
export function createZerosAndOnes(
  name: string,
  defaultValue: 0 | 1,
  { typed, config, matrix, BigNumber }: Dependencies
) {
  return typed(name, {
    '': function (): unknown[] | Matrix {
      return config.matrix === 'Array' ? _zerosAndOnes([]) : _zerosAndOnes([], 'default');
    },

    // math.zeros/ones(m, n, p, ..., format)
    // TODO: more accurate signature '...number | BigNumber, string' as soon as typed-function supports this
    '...number | BigNumber | string': function (
      size: (number | BigNumber | string)[]
    ): unknown[] | Matrix {
      const last = size[size.length - 1];
      if (typeof last === 'string') {
        const format = size.pop() as string;
        return _zerosAndOnes(size as (number | BigNumber)[], format);
      } else if (config.matrix === 'Array') {
        return _zerosAndOnes(size as (number | BigNumber)[]);
      } else {
        return _zerosAndOnes(size as (number | BigNumber)[], 'default');
      }
    },

    Array: _zerosAndOnes,

    Matrix: function (size: Matrix): Matrix {
      const format = size.storage();
      return _zerosAndOnes(size.valueOf() as number[], format) as Matrix;
    },

    'Array | Matrix, string': function (size: unknown[] | Matrix, format: string): Matrix {
      const sizeArray = Array.isArray(size) ? size : (size as Matrix).valueOf();
      return _zerosAndOnes(sizeArray as number[], format) as Matrix;
    },
  });

  /**
   * Create an Array or Matrix with zeros or ones
   * @param {Array} size
   * @param {string} [format='default']
   * @return {Array | Matrix}
   * @private
   */
  function _zerosAndOnes(
    size: unknown[] | (number | BigNumber)[],
    format?: string
  ): unknown[] | Matrix {
    const hasBigNumbers = _normalize(size as number[]);
    const dflt = hasBigNumbers ? new BigNumber(defaultValue) : defaultValue;
    _validate(size as number[]);

    if (format) {
      // return a matrix
      const m = matrix(format);
      if ((size as number[]).length > 0) {
        return m.resize(size as number[], dflt);
      }
      return m;
    } else {
      // return an Array
      const arr: unknown[] = [];
      if ((size as number[]).length > 0) {
        return resize(arr, size as number[], dflt) as unknown[];
      }
      return arr;
    }
  }

  // replace BigNumbers with numbers, returns true if size contained BigNumbers
  function _normalize(size: number[]): boolean {
    let hasBigNumbers = false;
    size.forEach(function (value: unknown, index: number, arr: unknown[]) {
      if (isBigNumber(value)) {
        hasBigNumbers = true;
        arr[index] = (value as BigNumber).toNumber();
      }
    });
    return hasBigNumbers;
  }

  // validate arguments
  function _validate(size: number[]): void {
    size.forEach(function (value: unknown) {
      if (typeof value !== 'number' || !isInteger(value) || value < 0) {
        throw new Error(`Parameters in function ${name} must be positive integers`);
      }
    });
  }
}
