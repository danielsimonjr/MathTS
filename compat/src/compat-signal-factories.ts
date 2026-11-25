/**
 * Signal factories built with mathjs complex.js multiply/add/divide (#1589, compat-only).
 */
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { Complex, mathTyped } from '@danielsimonjr/mathts-core';
import { createFreqz } from './all-factories.js';
import { withMathjsComplexBinary } from './mathjs-complex.js';

const compatAdd = withMathjsComplexBinary(
  mathFunctions.add as (a: unknown, b: unknown) => unknown,
  'add'
);
const compatMultiply = withMathjsComplexBinary(
  mathFunctions.multiply as (a: unknown, b: unknown) => unknown,
  'mul'
);
const compatDivide = withMathjsComplexBinary(
  mathFunctions.divide as (a: unknown, b: unknown) => unknown,
  'div'
);

const signalScope = {
  typed: mathTyped,
  Complex,
  number: mathFunctions.number,
  matrix: mathFunctions.matrix,
  add: compatAdd,
  multiply: compatMultiply,
  divide: compatDivide,
};

export const compatFreqz = createFreqz(
  signalScope as Parameters<typeof createFreqz>[0]
) as typeof mathFunctions.freqz;