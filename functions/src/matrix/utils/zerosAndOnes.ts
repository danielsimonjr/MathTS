import { isBigNumber } from '../../utils/is.js';
import { isInteger } from '../../utils/number.js';
import { resize } from '../../utils/array.js';

// Type definitions
export interface TypedFunction<T = any> {
  (...args: any[]): T;
}

export interface BigNumberConstructor {
  new (value: number | string): BigNumber;
  (value: number | string): BigNumber;
}

export interface BigNumber {
  isBigNumber: boolean;
  toNumber(): number;
}

export interface MatrixConstructor {
  (data?: any[] | any[][], storage?: 'dense' | 'sparse'): Matrix;
  (storage?: 'dense' | 'sparse'): Matrix;
}

export interface Matrix {
  _size: number[];
  storage(): 'dense' | 'sparse';
  valueOf(): any[] | any[][];
  resize(size: number[], defaultValue: any): Matrix;
}

export interface Config {
  matrix: 'Array' | 'Matrix';
}

export interface Dependencies {
  typed: TypedFunction;
  config: Config;
  matrix: MatrixConstructor;
  BigNumber: BigNumberConstructor;
}

export function createZerosAndOnes(
  name: string,
  defaultValue: 0 | 1,
  { typed, config, matrix, BigNumber }: Dependencies
) {
  return typed(name, {
    '': function (): any[] | Matrix {
      return config.matrix === 'Array' ? _zerosAndOnes([]) : _zerosAndOnes([], 'default');
    },

    // math.zeros/ones(m, n, p, ..., format)
    // TODO: more accurate signature '...number | BigNumber, string' as soon as typed-function supports this
    '...number | BigNumber | string': function (
      size: (number | BigNumber | string)[]
    ): any[] | Matrix {
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

    'Array | Matrix, string': function (size: any[] | Matrix, format: string): Matrix {
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
  function _zerosAndOnes(size: any[] | (number | BigNumber)[], format?: string): any[] | Matrix {
    const hasBigNumbers = _normalize(size as number[]);
    const dflt = hasBigNumbers ? new BigNumber(defaultValue) : defaultValue;
    _validate(size as number[]);

    if (format) {
      // return a matrix
      const m = (matrix as any)(format);
      if ((size as number[]).length > 0) {
        return m.resize(size as number[], dflt);
      }
      return m;
    } else {
      // return an Array
      const arr: any[] = [];
      if ((size as number[]).length > 0) {
        return resize(arr, size as number[], dflt);
      }
      return arr;
    }
  }

  // replace BigNumbers with numbers, returns true if size contained BigNumbers
  function _normalize(size: number[]): boolean {
    let hasBigNumbers = false;
    size.forEach(function (value: any, index: number, arr: any[]) {
      if (isBigNumber(value)) {
        hasBigNumbers = true;
        arr[index] = (value as any).toNumber();
      }
    });
    return hasBigNumbers;
  }

  // validate arguments
  function _validate(size: number[]): void {
    size.forEach(function (value: any) {
      if (typeof value !== 'number' || !isInteger(value) || value < 0) {
        throw new Error(`Parameters in function ${name} must be positive integers`);
      }
    });
  }
}
