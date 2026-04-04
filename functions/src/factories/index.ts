/**
 * Activated mathjs leaf factory functions.
 *
 * Each factory is imported, called with the shared scope, and the resulting
 * typed function is re-exported for direct use.
 *
 * Functions that already exist in typed/ are not re-exported here to avoid
 * conflicts with the active typed implementations.
 *
 * Auto-generated — do not edit by hand.
 */

import { factoryScope } from './scope.js';

// arithmetic
import { createAbs } from '../arithmetic/abs.js';
import { createAddScalar } from '../arithmetic/addScalar.js';
import { createCube } from '../arithmetic/cube.js';
import { createExp } from '../arithmetic/exp.js';
import { createExpm1 } from '../arithmetic/expm1.js';
import { createLog10 } from '../arithmetic/log10.js';
import { createLog2 } from '../arithmetic/log2.js';
import { createMultiplyScalar } from '../arithmetic/multiplyScalar.js';
import { createSign } from '../arithmetic/sign.js';
import { createSqrt } from '../arithmetic/sqrt.js';
import { createSquare } from '../arithmetic/square.js';
import { createSubtractScalar } from '../arithmetic/subtractScalar.js';
import { createUnaryMinus } from '../arithmetic/unaryMinus.js';

// bitwise
import { createBitNot } from '../bitwise/bitNot.js';

// complex
import { createArg } from '../complex/arg.js';
import { createConj } from '../complex/conj.js';
import { createIm } from '../complex/im.js';
import { createRe } from '../complex/re.js';

// logical
import { createNot } from '../logical/not.js';

// matrix
import { createFilter } from '../matrix/filter.js';
import { createFlatten } from '../matrix/flatten.js';
import { createForEach } from '../matrix/forEach.js';
import { createGetMatrixDataType } from '../matrix/getMatrixDataType.js';
import { createMap } from '../matrix/map.js';
import { createSize } from '../matrix/size.js';
import { createSqueeze } from '../matrix/squeeze.js';

// probability
import { createCombinations } from '../probability/combinations.js';
import { createCombinationsWithRep } from '../probability/combinationsWithRep.js';
import { createLgamma } from '../probability/lgamma.js';
import { createPickRandom } from '../probability/pickRandom.js';
import { createRandom } from '../probability/random.js';

// relational
import { createEqualScalar } from '../relational/equalScalar.js';

// special
import { createErf } from '../special/erf.js';

// string
import { createFormat } from '../string/format.js';
import { createPrint } from '../string/print.js';

// trigonometry
import { createAcos } from '../trigonometry/acos.js';
import { createAcosh } from '../trigonometry/acosh.js';
import { createAcot } from '../trigonometry/acot.js';
import { createAcoth } from '../trigonometry/acoth.js';
import { createAcsc } from '../trigonometry/acsc.js';
import { createAcsch } from '../trigonometry/acsch.js';
import { createAsec } from '../trigonometry/asec.js';
import { createAsech } from '../trigonometry/asech.js';
import { createAsin } from '../trigonometry/asin.js';
import { createAsinh } from '../trigonometry/asinh.js';
import { createAtan } from '../trigonometry/atan.js';
import { createAtanh } from '../trigonometry/atanh.js';
import { createCos } from '../trigonometry/cos.js';
import { createCosh } from '../trigonometry/cosh.js';
import { createCot } from '../trigonometry/cot.js';
import { createCoth } from '../trigonometry/coth.js';
import { createCsc } from '../trigonometry/csc.js';
import { createCsch } from '../trigonometry/csch.js';
import { createSec } from '../trigonometry/sec.js';
import { createSech } from '../trigonometry/sech.js';
import { createSin } from '../trigonometry/sin.js';
import { createSinh } from '../trigonometry/sinh.js';
import { createTan } from '../trigonometry/tan.js';
import { createTanh } from '../trigonometry/tanh.js';

// unit
import { createToBest } from '../unit/toBest.js';

// utils
import { createClone } from '../utils/clone.js';
import { createIsBounded } from '../utils/isBounded.js';
import { createIsNaN } from '../utils/isNaN.js';
import { createIsNegative } from '../utils/isNegative.js';
import { createIsNumeric } from '../utils/isNumeric.js';
import { createIsPositive } from '../utils/isPositive.js';
import { createIsPrime } from '../utils/isPrime.js';
import { createNumeric } from '../utils/numeric.js';
import { createTypeOf } from '../utils/typeOf.js';

// ---------------------------------------------------------------------------
// Activate factories with shared scope
// ---------------------------------------------------------------------------

// arithmetic
// abs: skipped (already exported by typed/)
export const addScalar = createAddScalar(factoryScope as any);
// cube: skipped (already exported by typed/)
// exp: skipped (already exported by typed/)
// expm1: skipped (already exported by typed/)
// log10: skipped (already exported by typed/)
// log2: skipped (already exported by typed/)
export const multiplyScalar = createMultiplyScalar(factoryScope as any);
// sign: skipped (already exported by typed/)
// sqrt: skipped (already exported by typed/)
// square: skipped (already exported by typed/)
export const subtractScalar = createSubtractScalar(factoryScope as any);
// unaryMinus: skipped (already exported by typed/)

// bitwise
export const bitNot = createBitNot(factoryScope as any);

// complex
export const arg = createArg(factoryScope as any);
export const conj = createConj(factoryScope as any);
export const im = createIm(factoryScope as any);
export const re = createRe(factoryScope as any);

// logical
export const not = createNot(factoryScope as any);

// matrix
export const filter = createFilter(factoryScope as any);
export const flatten = createFlatten(factoryScope as any);
export const forEach = createForEach(factoryScope as any);
export const getMatrixDataType = createGetMatrixDataType(factoryScope as any);
export const map = createMap(factoryScope as any);
export const size = createSize(factoryScope as any);
export const squeeze = createSqueeze(factoryScope as any);

// probability
export const combinations = createCombinations(factoryScope as any);
export const combinationsWithRep = createCombinationsWithRep(factoryScope as any);
export const lgamma = createLgamma(factoryScope as any);
export const pickRandom = createPickRandom(factoryScope as any);
export const random = createRandom(factoryScope as any);

// relational
export const equalScalar = createEqualScalar(factoryScope as any);

// special
export const erf = createErf(factoryScope as any);

// string
export const format = createFormat(factoryScope as any);
export const print = createPrint(factoryScope as any);

// trigonometry
// acos: skipped (already exported by typed/)
// acosh: skipped (already exported by typed/)
// acot: skipped (already exported by typed/)
export const acoth = createAcoth(factoryScope as any);
// acsc: skipped (already exported by typed/)
export const acsch = createAcsch(factoryScope as any);
// asec: skipped (already exported by typed/)
export const asech = createAsech(factoryScope as any);
// asin: skipped (already exported by typed/)
// asinh: skipped (already exported by typed/)
// atan: skipped (already exported by typed/)
// atanh: skipped (already exported by typed/)
// cos: skipped (already exported by typed/)
// cosh: skipped (already exported by typed/)
// cot: skipped (already exported by typed/)
export const coth = createCoth(factoryScope as any);
// csc: skipped (already exported by typed/)
export const csch = createCsch(factoryScope as any);
// sec: skipped (already exported by typed/)
export const sech = createSech(factoryScope as any);
// sin: skipped (already exported by typed/)
// sinh: skipped (already exported by typed/)
// tan: skipped (already exported by typed/)
// tanh: skipped (already exported by typed/)

// unit
export const toBest = createToBest(factoryScope as any);

// utils
export const clone = createClone(factoryScope as any);
export const isBounded = createIsBounded(factoryScope as any);
export const isNaN = createIsNaN(factoryScope as any);
export const isNegative = createIsNegative(factoryScope as any);
export const isNumeric = createIsNumeric(factoryScope as any);
export const isPositive = createIsPositive(factoryScope as any);
export const isPrime = createIsPrime(factoryScope as any);
export const numeric = createNumeric(factoryScope as any);
export const typeOf = createTypeOf(factoryScope as any);

// ---------------------------------------------------------------------------
// Factory versions of functions that conflict with typed/ exports.
// Available under factory_ prefix for internal use or merging.
// ---------------------------------------------------------------------------

export const factory_abs = createAbs(factoryScope as any);
export const factory_cube = createCube(factoryScope as any);
export const factory_exp = createExp(factoryScope as any);
export const factory_expm1 = createExpm1(factoryScope as any);
export const factory_log10 = createLog10(factoryScope as any);
export const factory_log2 = createLog2(factoryScope as any);
export const factory_sign = createSign(factoryScope as any);
export const factory_sqrt = createSqrt(factoryScope as any);
export const factory_square = createSquare(factoryScope as any);
export const factory_unaryMinus = createUnaryMinus(factoryScope as any);
export const factory_acos = createAcos(factoryScope as any);
export const factory_acosh = createAcosh(factoryScope as any);
export const factory_acot = createAcot(factoryScope as any);
export const factory_acsc = createAcsc(factoryScope as any);
export const factory_asec = createAsec(factoryScope as any);
export const factory_asin = createAsin(factoryScope as any);
export const factory_asinh = createAsinh(factoryScope as any);
export const factory_atan = createAtan(factoryScope as any);
export const factory_atanh = createAtanh(factoryScope as any);
export const factory_cos = createCos(factoryScope as any);
export const factory_cosh = createCosh(factoryScope as any);
export const factory_cot = createCot(factoryScope as any);
export const factory_csc = createCsc(factoryScope as any);
export const factory_sec = createSec(factoryScope as any);
export const factory_sin = createSin(factoryScope as any);
export const factory_sinh = createSinh(factoryScope as any);
export const factory_tan = createTan(factoryScope as any);
export const factory_tanh = createTanh(factoryScope as any);
