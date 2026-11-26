/**
 * Signal factories built with mathjs complex.js multiply/add/divide (#1589, compat-only).
 */
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { Complex, mathTyped } from '@danielsimonjr/mathts-core';
import { createFreqz, createZpk2tf } from './all-factories.js';
import { withMathjsComplexBinary, wrapZpk2tfGainTypes } from './mathjs-complex.js';

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

/** `freqz` factory wired with complex.js add/multiply/divide. */
export const compatFreqz = createFreqz(
  signalScope as Parameters<typeof createFreqz>[0]
) as typeof mathFunctions.freqz;

/** `zpk2tf` factory wired with complex.js add/multiply; gain types match mathjs. */
export const compatZpk2tf = wrapZpk2tfGainTypes(
  createZpk2tf(
    signalScope as Parameters<typeof createZpk2tf>[0]
  ) as unknown as typeof mathFunctions.zpk2tf
) as unknown as typeof mathFunctions.zpk2tf;
