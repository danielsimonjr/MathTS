/**
 * Activated mathjs leaf factory functions.
 *
 * Each factory is imported, called with the shared scope, and the resulting
 * typed function is re-exported for direct use.
 *
 * Functions that already exist in typed/ are not re-exported here to avoid
 * conflicts with the active typed implementations.
 */

import { factoryScope } from './scope.js';
import { add, multiply } from '../typed/arithmetic.js';

// ---------------------------------------------------------------------------
// Tier 1: all imports
// ---------------------------------------------------------------------------

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
// Tier 2: all imports
// ---------------------------------------------------------------------------

// arithmetic
import { createDivideScalar } from '../arithmetic/divideScalar.js';
import { createUnaryPlus } from '../arithmetic/unaryPlus.js';

// matrix (dot only — transpose/ctranspose/csCounts deferred: need mathjs-internal matrix type)
import { createDot } from '../matrix/dot.js';

// probability
import { createRandomInt } from '../probability/randomInt.js';

// statistics
import { createMode } from '../statistics/mode.js';
import { createProd } from '../statistics/prod.js';

// string
import { createBin } from '../string/bin.js';
import { createHex } from '../string/hex.js';
import { createOct } from '../string/oct.js';

// utils
import { createHasNumericValue } from '../utils/hasNumericValue.js';
import { createIsFinite } from '../utils/isFinite.js';
import { createIsZero } from '../utils/isZero.js';
import { createParseNumberWithConfig } from '../utils/parseNumber.js';

// ---------------------------------------------------------------------------
// Tier 1: activate factories
// ---------------------------------------------------------------------------

// arithmetic (non-conflicting)
export const addScalar = createAddScalar(factoryScope as Parameters<typeof createAddScalar>[0]);
export const multiplyScalar = createMultiplyScalar(factoryScope as Parameters<typeof createMultiplyScalar>[0]);
export const subtractScalar = createSubtractScalar(factoryScope as Parameters<typeof createSubtractScalar>[0]);

// bitwise (synced factory — superseded by typed/bitwise; kept internal for factoryScope wiring)
const bitNot = createBitNot(factoryScope as Parameters<typeof createBitNot>[0]);

// complex (synced factories — superseded by typed/complex; kept internal for factoryScope wiring)
const arg = createArg(factoryScope as Parameters<typeof createArg>[0]);
const conj = createConj(factoryScope as Parameters<typeof createConj>[0]);
const im = createIm(factoryScope as Parameters<typeof createIm>[0]);
const re = createRe(factoryScope as Parameters<typeof createRe>[0]);

// logical (synced factory — superseded by typed/logical; kept internal for factoryScope wiring)
const not = createNot(factoryScope as Parameters<typeof createNot>[0]);

// matrix
export const filter = createFilter(factoryScope as Parameters<typeof createFilter>[0]);
export const flatten = createFlatten(factoryScope as Parameters<typeof createFlatten>[0]);
export const forEach = createForEach(factoryScope as Parameters<typeof createForEach>[0]);
export const getMatrixDataType = createGetMatrixDataType(factoryScope as Parameters<typeof createGetMatrixDataType>[0]);
export const map = createMap(factoryScope as Parameters<typeof createMap>[0]);
export const size = createSize(factoryScope as Parameters<typeof createSize>[0]);
export const squeeze = createSqueeze(factoryScope as Parameters<typeof createSqueeze>[0]);

// probability (synced factories — superseded by typed/probability; kept internal for factoryScope wiring)
const combinations = createCombinations(factoryScope as Parameters<typeof createCombinations>[0]);
const combinationsWithRep = createCombinationsWithRep(factoryScope as Parameters<typeof createCombinationsWithRep>[0]);
// lgamma superseded by typed/special.ts (WASM-backed); kept internal for factoryScope wiring
const lgamma = createLgamma(factoryScope as Parameters<typeof createLgamma>[0]);
const pickRandom = createPickRandom(factoryScope as Parameters<typeof createPickRandom>[0]);
const random = createRandom(factoryScope as Parameters<typeof createRandom>[0]);

// relational (synced factory — superseded by typed/relational; kept internal for factoryScope wiring)
const equalScalar = createEqualScalar(factoryScope as Parameters<typeof createEqualScalar>[0]);

// special
export const erf = createErf(factoryScope as Parameters<typeof createErf>[0]);

// string (synced factories — superseded by typed/string; kept internal for factoryScope wiring)
const format = createFormat(factoryScope as Parameters<typeof createFormat>[0]);
const print = createPrint(factoryScope as Parameters<typeof createPrint>[0]);

// trigonometry (non-conflicting)
export const acoth = createAcoth(factoryScope as Parameters<typeof createAcoth>[0]);
export const acsch = createAcsch(factoryScope as Parameters<typeof createAcsch>[0]);
export const asech = createAsech(factoryScope as Parameters<typeof createAsech>[0]);
export const coth = createCoth(factoryScope as Parameters<typeof createCoth>[0]);
export const csch = createCsch(factoryScope as Parameters<typeof createCsch>[0]);
export const sech = createSech(factoryScope as Parameters<typeof createSech>[0]);

// unit
export const toBest = createToBest(factoryScope as Parameters<typeof createToBest>[0]);

// utils
export const clone = createClone(factoryScope as Parameters<typeof createClone>[0]);
export const isBounded = createIsBounded(factoryScope as Parameters<typeof createIsBounded>[0]);
export const isNaN = createIsNaN(factoryScope as Parameters<typeof createIsNaN>[0]);
export const isNegative = createIsNegative(factoryScope as Parameters<typeof createIsNegative>[0]);
export const isNumeric = createIsNumeric(factoryScope as Parameters<typeof createIsNumeric>[0]);
export const isPositive = createIsPositive(factoryScope as Parameters<typeof createIsPositive>[0]);
export const isPrime = createIsPrime(factoryScope as Parameters<typeof createIsPrime>[0]);
export const numeric = createNumeric(factoryScope as Parameters<typeof createNumeric>[0]);
export const typeOf = createTypeOf(factoryScope as Parameters<typeof createTypeOf>[0]);

// ---------------------------------------------------------------------------
// Tier 1: factory_ versions of conflicting names
// ---------------------------------------------------------------------------

export const factory_abs = createAbs(factoryScope as Parameters<typeof createAbs>[0]);
export const factory_cube = createCube(factoryScope as Parameters<typeof createCube>[0]);
export const factory_exp = createExp(factoryScope as Parameters<typeof createExp>[0]);
export const factory_expm1 = createExpm1(factoryScope as Parameters<typeof createExpm1>[0]);
export const factory_log10 = createLog10(factoryScope as Parameters<typeof createLog10>[0]);
export const factory_log2 = createLog2(factoryScope as Parameters<typeof createLog2>[0]);
export const factory_sign = createSign(factoryScope as Parameters<typeof createSign>[0]);
export const factory_sqrt = createSqrt(factoryScope as Parameters<typeof createSqrt>[0]);
export const factory_square = createSquare(factoryScope as Parameters<typeof createSquare>[0]);
export const factory_unaryMinus = createUnaryMinus(factoryScope as Parameters<typeof createUnaryMinus>[0]);
export const factory_acos = createAcos(factoryScope as Parameters<typeof createAcos>[0]);
export const factory_acosh = createAcosh(factoryScope as Parameters<typeof createAcosh>[0]);
export const factory_acot = createAcot(factoryScope as Parameters<typeof createAcot>[0]);
export const factory_acsc = createAcsc(factoryScope as Parameters<typeof createAcsc>[0]);
export const factory_asec = createAsec(factoryScope as Parameters<typeof createAsec>[0]);
export const factory_asin = createAsin(factoryScope as Parameters<typeof createAsin>[0]);
export const factory_asinh = createAsinh(factoryScope as Parameters<typeof createAsinh>[0]);
export const factory_atan = createAtan(factoryScope as Parameters<typeof createAtan>[0]);
export const factory_atanh = createAtanh(factoryScope as Parameters<typeof createAtanh>[0]);
export const factory_cos = createCos(factoryScope as Parameters<typeof createCos>[0]);
export const factory_cosh = createCosh(factoryScope as Parameters<typeof createCosh>[0]);
export const factory_cot = createCot(factoryScope as Parameters<typeof createCot>[0]);
export const factory_csc = createCsc(factoryScope as Parameters<typeof createCsc>[0]);
export const factory_sec = createSec(factoryScope as Parameters<typeof createSec>[0]);
export const factory_sin = createSin(factoryScope as Parameters<typeof createSin>[0]);
export const factory_sinh = createSinh(factoryScope as Parameters<typeof createSinh>[0]);
export const factory_tan = createTan(factoryScope as Parameters<typeof createTan>[0]);
export const factory_tanh = createTanh(factoryScope as Parameters<typeof createTanh>[0]);

// ---------------------------------------------------------------------------
// Inject tier 1 results into scope so tier 2 factories can resolve their deps
// ---------------------------------------------------------------------------

factoryScope.abs = factory_abs;
factoryScope.acos = factory_acos;
factoryScope.acosh = factory_acosh;
factoryScope.acot = factory_acot;
factoryScope.acsc = factory_acsc;
factoryScope.addScalar = addScalar;
factoryScope.arg = arg;
factoryScope.asec = factory_asec;
factoryScope.asin = factory_asin;
factoryScope.asinh = factory_asinh;
factoryScope.atan = factory_atan;
factoryScope.atanh = factory_atanh;
factoryScope.bitNot = bitNot;
factoryScope.clone = clone;
factoryScope.combinations = combinations;
factoryScope.combinationsWithRep = combinationsWithRep;
factoryScope.conj = conj;
factoryScope.cos = factory_cos;
factoryScope.cosh = factory_cosh;
factoryScope.cot = factory_cot;
factoryScope.csc = factory_csc;
factoryScope.cube = factory_cube;
factoryScope.equalScalar = equalScalar;
factoryScope.erf = erf;
factoryScope.exp = factory_exp;
factoryScope.expm1 = factory_expm1;
factoryScope.format = format;
factoryScope.im = im;
factoryScope.isBounded = isBounded;
factoryScope.isNaN = isNaN;
factoryScope.isNegative = isNegative;
factoryScope.isNumeric = isNumeric;
factoryScope.isPositive = isPositive;
factoryScope.isPrime = isPrime;
factoryScope.lgamma = lgamma;
factoryScope.log2 = factory_log2;
factoryScope.log10 = factory_log10;
factoryScope.map = map;
factoryScope.multiplyScalar = multiplyScalar;
factoryScope.not = not;
factoryScope.numeric = numeric;
factoryScope.print = print;
factoryScope.re = re;
factoryScope.sec = factory_sec;
factoryScope.sign = factory_sign;
factoryScope.sin = factory_sin;
factoryScope.sinh = factory_sinh;
factoryScope.size = size;
factoryScope.sqrt = factory_sqrt;
factoryScope.square = factory_square;
factoryScope.tan = factory_tan;
factoryScope.tanh = factory_tanh;
factoryScope.typeOf = typeOf;
factoryScope.getMatrixDataType = getMatrixDataType;
factoryScope.random = random;
factoryScope.pickRandom = pickRandom;
factoryScope.toBest = toBest;
factoryScope.acoth = acoth;
factoryScope.acsch = acsch;
factoryScope.asech = asech;
factoryScope.coth = coth;
factoryScope.csch = csch;
factoryScope.sech = sech;

// ---------------------------------------------------------------------------
// Tier 2: activate factories
// ---------------------------------------------------------------------------

// Prerequisite: parseNumberWithConfig (needed by prod)
export const parseNumberWithConfig = createParseNumberWithConfig(factoryScope as Parameters<typeof createParseNumberWithConfig>[0]);
factoryScope.parseNumberWithConfig = parseNumberWithConfig;

// arithmetic
export const divideScalar = createDivideScalar(factoryScope as Parameters<typeof createDivideScalar>[0]);

// probability (synced factory — superseded by typed/probability; kept internal for factoryScope wiring)
createRandomInt(factoryScope as Parameters<typeof createRandomInt>[0]);

// statistics
export const mode = createMode(factoryScope as Parameters<typeof createMode>[0]);
export const prod = createProd(factoryScope as Parameters<typeof createProd>[0]);

// string (synced factories — superseded by typed/string; kept internal for factoryScope wiring)
createBin(factoryScope as Parameters<typeof createBin>[0]);
createHex(factoryScope as Parameters<typeof createHex>[0]);
createOct(factoryScope as Parameters<typeof createOct>[0]);

// utils
export const hasNumericValue = createHasNumericValue(factoryScope as Parameters<typeof createHasNumericValue>[0]);
export const isFinite = createIsFinite(factoryScope as Parameters<typeof createIsFinite>[0]);
export const isZero = createIsZero(factoryScope as Parameters<typeof createIsZero>[0]);

// Tier 2 conflicting names — use factory_ prefix
export const factory_unaryPlus = createUnaryPlus(factoryScope as Parameters<typeof createUnaryPlus>[0]);
export const factory_dot = createDot(factoryScope as Parameters<typeof createDot>[0]);

// ---------------------------------------------------------------------------
// Inject tier 2 results into scope so tier 3 factories can resolve their deps
// ---------------------------------------------------------------------------

factoryScope.subtractScalar = subtractScalar;
factoryScope.divideScalar = divideScalar;
factoryScope.unaryMinus = factory_unaryMinus;
factoryScope.unaryPlus = factory_unaryPlus;
factoryScope.flatten = flatten;
factoryScope.hasNumericValue = hasNumericValue;
factoryScope.isFinite = isFinite;
factoryScope.isZero = isZero;
factoryScope.prod = prod;
factoryScope.dot = factory_dot;
factoryScope.squeeze = squeeze;
factoryScope.forEach = forEach;
factoryScope.filter = filter;

// ---------------------------------------------------------------------------
// Tier 3: matrix-dependent factories (enabled by matrix bridge)
// ---------------------------------------------------------------------------

import { createTranspose } from '../matrix/transpose.js';
import { createCtranspose } from '../matrix/ctranspose.js';
import { createIdentity } from '../matrix/identity.js';
import { createZeros } from '../matrix/zeros.js';
import { createOnes } from '../matrix/ones.js';
import { createDiag } from '../matrix/diag.js';
import { createKron } from '../matrix/kron.js';
import { createMatrixFromFunction } from '../matrix/matrixFromFunction.js';
import { createMatrixFromColumns } from '../matrix/matrixFromColumns.js';
import { createMatrixFromRows } from '../matrix/matrixFromRows.js';
import { createCount } from '../matrix/count.js';
import { createTrace } from '../matrix/trace.js';
import { createDet } from '../matrix/det.js';
import { createReshape } from '../matrix/reshape.js';

// Simple matrix factories (no deep dependency chains)
export const factory_transpose = createTranspose(factoryScope as Parameters<typeof createTranspose>[0]);
factoryScope.transpose = factory_transpose;

export const factory_ctranspose = createCtranspose(factoryScope as Parameters<typeof createCtranspose>[0]);
factoryScope.ctranspose = factory_ctranspose;

export const identity = createIdentity(factoryScope as Parameters<typeof createIdentity>[0]);
factoryScope.identity = identity;

export const zeros = createZeros(factoryScope as Parameters<typeof createZeros>[0]);
factoryScope.zeros = zeros;

export const ones = createOnes(factoryScope as Parameters<typeof createOnes>[0]);
factoryScope.ones = ones;

export const diag = createDiag(factoryScope as Parameters<typeof createDiag>[0]);
factoryScope.diag = diag;

export const kron = createKron(factoryScope as Parameters<typeof createKron>[0]);
factoryScope.kron = kron;

export const matrixFromFunction = createMatrixFromFunction(factoryScope as Parameters<typeof createMatrixFromFunction>[0]);
factoryScope.matrixFromFunction = matrixFromFunction;

export const matrixFromColumns = createMatrixFromColumns(factoryScope as Parameters<typeof createMatrixFromColumns>[0]);
factoryScope.matrixFromColumns = matrixFromColumns;

export const matrixFromRows = createMatrixFromRows(factoryScope as Parameters<typeof createMatrixFromRows>[0]);
factoryScope.matrixFromRows = matrixFromRows;

export const count = createCount(factoryScope as Parameters<typeof createCount>[0]);
factoryScope.count = count;

// Factories that need tier 3 deps (add needs concat which needs isInteger which
// needs equal — too deep for now). Use try/catch for safety.

// trace needs 'add' — provide addScalar as fallback
factoryScope.add = factoryScope.addScalar;
export const trace = createTrace(factoryScope as Parameters<typeof createTrace>[0]);
factoryScope.trace = trace;

// det is created here (tier 3) because `inv` (tier 4) depends on it. det's
// internal use of `multiply` is scalar-only (Bareiss/LU over scalar elements),
// so binding `multiply` to `multiplyScalar` is correct for scalar-element
// matrices — full `multiply` would only add block-matrix support.
factoryScope.multiply = factoryScope.multiplyScalar;
export const det = createDet(factoryScope as Parameters<typeof createDet>[0]);
factoryScope.det = det;

// reshape needs isInteger — provide a simple stub
factoryScope.isInteger = (x: unknown) => typeof x === 'number' && Number.isInteger(x);
export const reshape = createReshape(factoryScope as Parameters<typeof createReshape>[0]);
factoryScope.reshape = reshape;

// ---------------------------------------------------------------------------
// Tier 4: factories unlocked by tiers 1-3
// ---------------------------------------------------------------------------

// algebra/sparse
import { createCsAmd } from '../algebra/sparse/csAmd.js';
import { createCsCounts } from '../algebra/sparse/csCounts.js';
import { createCsSqr } from '../algebra/sparse/csSqr.js';
import { createCsSymperm } from '../algebra/sparse/csSymperm.js';

// algebra/solver
import { createLsolve } from '../algebra/solver/lsolve.js';
import { createLsolveAll } from '../algebra/solver/lsolveAll.js';
import { createUsolve } from '../algebra/solver/usolve.js';
import { createUsolveAll } from '../algebra/solver/usolveAll.js';

// arithmetic
import { createCbrt } from '../arithmetic/cbrt.js';
import { createNthRoots } from '../arithmetic/nthRoots.js';
import { createRound } from '../arithmetic/round.js';
import { createXgcd } from '../arithmetic/xgcd.js';
import { createLog } from '../arithmetic/log.js';

// combinatorics
import { createCatalan } from '../combinatorics/catalan.js';

// matrix
import { createConcat } from '../matrix/concat.js';
import { createInv } from '../matrix/inv.js';
import { createMapSlices } from '../matrix/mapSlices.js';
import { createResize } from '../matrix/resize.js';
import { createSubset } from '../matrix/subset.js';

// probability
import { createBernoulli } from '../probability/bernoulli.js';

// relational
import { createEqual } from '../relational/equal.js';

// utils
import { createIsInteger } from '../utils/isInteger.js';

// signal
import { createZpk2tf } from '../signal/zpk2tf.js';

// statistics
import { createCumSum } from '../statistics/cumsum.js';
import { createSum } from '../statistics/sum.js';

// --- Activate tier 4 ---

// relational (needed by others)
export const factory_equal = createEqual(factoryScope as Parameters<typeof createEqual>[0]);
factoryScope.equal = factory_equal;

// isInteger needs `equal` — the real factory replaces the tier-3 inline stub
export const isInteger = createIsInteger(factoryScope as Parameters<typeof createIsInteger>[0]);
factoryScope.isInteger = isInteger;

// matrix
export const concat = createConcat(factoryScope as Parameters<typeof createConcat>[0]);
factoryScope.concat = concat;

export const mapSlices = createMapSlices(factoryScope as Parameters<typeof createMapSlices>[0]);
factoryScope.mapSlices = mapSlices;

export const resize = createResize(factoryScope as Parameters<typeof createResize>[0]);
factoryScope.resize = resize;

export const subset = createSubset(factoryScope as Parameters<typeof createSubset>[0]);
factoryScope.subset = subset;

export const inv = createInv(factoryScope as Parameters<typeof createInv>[0]);
factoryScope.inv = inv;

// arithmetic (conflicting names use factory_ prefix)
export const factory_cbrt = createCbrt(factoryScope as Parameters<typeof createCbrt>[0]);
factoryScope.cbrt = factory_cbrt;

export const nthRoots = createNthRoots(factoryScope as Parameters<typeof createNthRoots>[0]);
factoryScope.nthRoots = nthRoots;

export const factory_round = createRound(factoryScope as Parameters<typeof createRound>[0]);
factoryScope.round = factory_round;

export const factory_xgcd = createXgcd(factoryScope as Parameters<typeof createXgcd>[0]);
factoryScope.xgcd = factory_xgcd;

export const factory_log = createLog(factoryScope as Parameters<typeof createLog>[0]);
factoryScope.log = factory_log;

// combinatorics
export const catalan = createCatalan(factoryScope as Parameters<typeof createCatalan>[0]);
factoryScope.catalan = catalan;

// probability (synced factory — superseded by typed/probability; kept internal for factoryScope wiring)
const bernoulli_factory = createBernoulli(factoryScope as Parameters<typeof createBernoulli>[0]);
factoryScope.bernoulli = bernoulli_factory;

// signal
export const zpk2tf = createZpk2tf(factoryScope as Parameters<typeof createZpk2tf>[0]);
factoryScope.zpk2tf = zpk2tf;

// statistics (conflicting names use factory_ prefix)
export const factory_cumsum = createCumSum(factoryScope as Parameters<typeof createCumSum>[0]);
factoryScope.cumsum = factory_cumsum;

export const factory_sum = createSum(factoryScope as Parameters<typeof createSum>[0]);
factoryScope.sum = factory_sum;

// algebra/sparse
export const csCounts = createCsCounts(factoryScope as Parameters<typeof createCsCounts>[0]);
factoryScope.csCounts = csCounts;

export const csSymperm = createCsSymperm(factoryScope as Parameters<typeof createCsSymperm>[0]);
factoryScope.csSymperm = csSymperm;

export const csAmd = createCsAmd(factoryScope as Parameters<typeof createCsAmd>[0]);
factoryScope.csAmd = csAmd;

export const csSqr = createCsSqr(factoryScope as Parameters<typeof createCsSqr>[0]);
factoryScope.csSqr = csSqr;

// algebra/solver
export const lsolve = createLsolve(factoryScope as Parameters<typeof createLsolve>[0]);
factoryScope.lsolve = lsolve;

export const lsolveAll = createLsolveAll(factoryScope as Parameters<typeof createLsolveAll>[0]);
factoryScope.lsolveAll = lsolveAll;

export const usolve = createUsolve(factoryScope as Parameters<typeof createUsolve>[0]);
factoryScope.usolve = usolve;

export const usolveAll = createUsolveAll(factoryScope as Parameters<typeof createUsolveAll>[0]);
factoryScope.usolveAll = usolveAll;

// ---------------------------------------------------------------------------
// Tier 5: factories unlocked by tier 4
// ---------------------------------------------------------------------------

// arithmetic
import { createDotDivide } from '../arithmetic/dotDivide.js';
import { createDotMultiply } from '../arithmetic/dotMultiply.js';
import { createGcd } from '../arithmetic/gcd.js';
import { createLcm } from '../arithmetic/lcm.js';
import { createLog1p } from '../arithmetic/log1p.js';
import { createMod } from '../arithmetic/mod.js';
import { createNthRoot } from '../arithmetic/nthRoot.js';
import { createPow } from '../arithmetic/pow.js';
import { createCeil } from '../arithmetic/ceil.js';
import { createFloor } from '../arithmetic/floor.js';

// bitwise
import { createBitAnd } from '../bitwise/bitAnd.js';
import { createBitOr } from '../bitwise/bitOr.js';
import { createBitXor } from '../bitwise/bitXor.js';
import { createLeftShift } from '../bitwise/leftShift.js';
import { createRightArithShift } from '../bitwise/rightArithShift.js';
import { createRightLogShift } from '../bitwise/rightLogShift.js';

// logical
import { createOr } from '../logical/or.js';
import { createXor } from '../logical/xor.js';

// matrix
import { createExpm } from '../matrix/expm.js';

// relational
import { createCompare } from '../relational/compare.js';
import { createCompareText } from '../relational/compareText.js';
import { createDeepEqual } from '../relational/deepEqual.js';
import { createLarger } from '../relational/larger.js';
import { createLargerEq } from '../relational/largerEq.js';
import { createSmaller } from '../relational/smaller.js';
import { createSmallerEq } from '../relational/smallerEq.js';
import { createUnequal } from '../relational/unequal.js';

// trigonometry
import { createAtan2 } from '../trigonometry/atan2.js';

// unit
import { createTo } from '../unit/to.js';

// --- Activate tier 5 ---

// relational (needed by later tiers)
export const factory_compare = createCompare(factoryScope as Parameters<typeof createCompare>[0]);
factoryScope.compare = factory_compare;

// compareText (synced factory — superseded by typed/relational; kept internal for factoryScope wiring)
const compareText = createCompareText(factoryScope as Parameters<typeof createCompareText>[0]);
factoryScope.compareText = compareText;

// deepEqual (synced factory — superseded by typed/relational; kept internal for factoryScope wiring)
const deepEqual = createDeepEqual(factoryScope as Parameters<typeof createDeepEqual>[0]);
factoryScope.deepEqual = deepEqual;

export const factory_larger = createLarger(factoryScope as Parameters<typeof createLarger>[0]);
factoryScope.larger = factory_larger;

export const factory_largerEq = createLargerEq(factoryScope as Parameters<typeof createLargerEq>[0]);
factoryScope.largerEq = factory_largerEq;

export const factory_smaller = createSmaller(factoryScope as Parameters<typeof createSmaller>[0]);
factoryScope.smaller = factory_smaller;

export const factory_smallerEq = createSmallerEq(factoryScope as Parameters<typeof createSmallerEq>[0]);
factoryScope.smallerEq = factory_smallerEq;

// unequal (synced factory — superseded by typed/relational; kept internal for factoryScope wiring)
const unequal = createUnequal(factoryScope as Parameters<typeof createUnequal>[0]);
factoryScope.unequal = unequal;

// arithmetic
export const dotDivide = createDotDivide(factoryScope as Parameters<typeof createDotDivide>[0]);
factoryScope.dotDivide = dotDivide;

export const dotMultiply = createDotMultiply(factoryScope as Parameters<typeof createDotMultiply>[0]);
factoryScope.dotMultiply = dotMultiply;

export const factory_gcd = createGcd(factoryScope as Parameters<typeof createGcd>[0]);
factoryScope.gcd = factory_gcd;

export const factory_lcm = createLcm(factoryScope as Parameters<typeof createLcm>[0]);
factoryScope.lcm = factory_lcm;

export const factory_log1p = createLog1p(factoryScope as Parameters<typeof createLog1p>[0]);
factoryScope.log1p = factory_log1p;

export const factory_mod = createMod(factoryScope as Parameters<typeof createMod>[0]);
factoryScope.mod = factory_mod;

export const factory_nthRoot = createNthRoot(factoryScope as Parameters<typeof createNthRoot>[0]);
factoryScope.nthRoot = factory_nthRoot;

export const factory_pow = createPow(factoryScope as Parameters<typeof createPow>[0]);
factoryScope.pow = factory_pow;

export const factory_ceil = createCeil(factoryScope as Parameters<typeof createCeil>[0]);
factoryScope.ceil = factory_ceil;

export const factory_floor = createFloor(factoryScope as Parameters<typeof createFloor>[0]);
factoryScope.floor = factory_floor;

// bitwise (synced factories — superseded by typed/bitwise; kept internal for factoryScope wiring)
const bitAnd = createBitAnd(factoryScope as Parameters<typeof createBitAnd>[0]);
factoryScope.bitAnd = bitAnd;

const bitOr = createBitOr(factoryScope as Parameters<typeof createBitOr>[0]);
factoryScope.bitOr = bitOr;

const bitXor = createBitXor(factoryScope as Parameters<typeof createBitXor>[0]);
factoryScope.bitXor = bitXor;

const leftShift = createLeftShift(factoryScope as Parameters<typeof createLeftShift>[0]);
factoryScope.leftShift = leftShift;

const rightArithShift = createRightArithShift(factoryScope as Parameters<typeof createRightArithShift>[0]);
factoryScope.rightArithShift = rightArithShift;

const rightLogShift = createRightLogShift(factoryScope as Parameters<typeof createRightLogShift>[0]);
factoryScope.rightLogShift = rightLogShift;

// logical (synced factories — superseded by typed/logical; kept internal for factoryScope wiring)
const or = createOr(factoryScope as Parameters<typeof createOr>[0]);
factoryScope.or = or;

const xor = createXor(factoryScope as Parameters<typeof createXor>[0]);
factoryScope.xor = xor;

// matrix
export const expm = createExpm(factoryScope as Parameters<typeof createExpm>[0]);
factoryScope.expm = expm;

// trigonometry
export const factory_atan2 = createAtan2(factoryScope as Parameters<typeof createAtan2>[0]);
factoryScope.atan2 = factory_atan2;

// unit
export const to = createTo(factoryScope as Parameters<typeof createTo>[0]);
factoryScope.to = to;

// ---------------------------------------------------------------------------
// Tier 6: factories unlocked by tier 5 + full scope injections
// ---------------------------------------------------------------------------

// arithmetic
import { createDotPow } from '../arithmetic/dotPow.js';
import { createFix } from '../arithmetic/fix.js';
import { createInvmod } from '../arithmetic/invmod.js';

// bitwise/logical
import { createAnd } from '../logical/and.js';

// combinatorics
import { createComposition } from '../combinatorics/composition.js';

// matrix
import { createPartitionSelect } from '../matrix/partitionSelect.js';
import { createPinv } from '../matrix/pinv.js';
import { createQr } from '../algebra/decomposition/qr.js';
import { createRange } from '../matrix/range.js';

// probability
import { createGamma } from '../probability/gamma.js';

// relational
import { createCompareNatural } from '../relational/compareNatural.js';
import { createEqualText } from '../relational/equalText.js';

// statistics
import { createMax } from '../statistics/max.js';
import { createMin } from '../statistics/min.js';

// logical
import { createNullish } from '../logical/nullish.js';

// special
import { createHypot } from '../arithmetic/hypot.js';
import { createDistance } from '../geometry/distance.js';

// --- Activate tier 6 ---

// relational (synced factories — superseded by typed/relational; kept internal for factoryScope wiring)
const compareNatural = createCompareNatural(factoryScope as Parameters<typeof createCompareNatural>[0]);
factoryScope.compareNatural = compareNatural;

const equalText = createEqualText(factoryScope as Parameters<typeof createEqualText>[0]);
factoryScope.equalText = equalText;

// arithmetic
export const dotPow = createDotPow(factoryScope as Parameters<typeof createDotPow>[0]);
factoryScope.dotPow = dotPow;

export const factory_fix = createFix(factoryScope as Parameters<typeof createFix>[0]);
factoryScope.fix = factory_fix;

export const invmod = createInvmod(factoryScope as Parameters<typeof createInvmod>[0]);
factoryScope.invmod = invmod;

// logical (synced factories — superseded by typed/logical; kept internal for factoryScope wiring)
const and = createAnd(factoryScope as Parameters<typeof createAnd>[0]);
factoryScope.and = and;

const nullish = createNullish(factoryScope as Parameters<typeof createNullish>[0]);
factoryScope.nullish = nullish;

// combinatorics
export const composition = createComposition(factoryScope as Parameters<typeof createComposition>[0]);
factoryScope.composition = composition;

// matrix
export const partitionSelect = createPartitionSelect(factoryScope as Parameters<typeof createPartitionSelect>[0]);
factoryScope.partitionSelect = partitionSelect;

// pinv: the typed/ layer owns the public `pinv` export (Slice 5.2).
// Keep the factory internal so the factoryScope wiring still works.
const pinv_factory = createPinv(factoryScope as Parameters<typeof createPinv>[0]);
factoryScope.pinv = pinv_factory;

export const qr = createQr(factoryScope as Parameters<typeof createQr>[0]);
factoryScope.qr = qr;

export const range = createRange(factoryScope as Parameters<typeof createRange>[0]);
factoryScope.range = range;

export const distance = createDistance(factoryScope as Parameters<typeof createDistance>[0]);
factoryScope.distance = distance;

// probability
export const gamma = createGamma(factoryScope as Parameters<typeof createGamma>[0]);
factoryScope.gamma = gamma;

// statistics
export const factory_max = createMax(factoryScope as Parameters<typeof createMax>[0]);
factoryScope.max = factory_max;

export const factory_min = createMin(factoryScope as Parameters<typeof createMin>[0]);
factoryScope.min = factory_min;

// trigonometry
export const factory_hypot = createHypot(factoryScope as Parameters<typeof createHypot>[0]);
factoryScope.hypot = factory_hypot;

// ---------------------------------------------------------------------------
// Tier 7: factories unlocked by tier 6
// ---------------------------------------------------------------------------

import { createFactorial } from '../probability/factorial.js';
import { createSetSize } from '../set/setSize.js';
import { createSort } from '../matrix/sort.js';

export const factorial = createFactorial(factoryScope as Parameters<typeof createFactorial>[0]);
factoryScope.factorial = factorial;

// setSize (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setSize = createSetSize(factoryScope as Parameters<typeof createSetSize>[0]);
factoryScope.setSize = setSize;

export const sort = createSort(factoryScope as Parameters<typeof createSort>[0]);
factoryScope.sort = sort;

// ---------------------------------------------------------------------------
// Tier 8: factories unlocked by tier 7
// ---------------------------------------------------------------------------

import { createStirlingS2 } from '../combinatorics/stirlingS2.js';
import { createPermutations } from '../probability/permutations.js';

export const stirlingS2 = createStirlingS2(factoryScope as Parameters<typeof createStirlingS2>[0]);
factoryScope.stirlingS2 = stirlingS2;

// probability (synced factory — superseded by typed/probability; kept internal for factoryScope wiring)
const permutations_factory = createPermutations(factoryScope as Parameters<typeof createPermutations>[0]);
factoryScope.permutations = permutations_factory;

// ---------------------------------------------------------------------------
// Tier 9: bellNumbers (unlocked by stirlingS2)
// ---------------------------------------------------------------------------

import { createBellNumbers } from '../combinatorics/bellNumbers.js';

export const bellNumbers = createBellNumbers(factoryScope as Parameters<typeof createBellNumbers>[0]);
factoryScope.bellNumbers = bellNumbers;

// ---------------------------------------------------------------------------
// Expression node injection: build node constructors and inject into scope
// so that nodeOperations, subtract, divide, simplify, etc. can find them.
// ---------------------------------------------------------------------------

import {
  createNode,
  createAccessorNode,
  createArrayNode,
  createAssignmentNode,
  createBlockNode,
  createConditionalNode,
  createConstantNode,
  createFunctionAssignmentNode,
  createFunctionNode,
  createIndexNode,
  createObjectNode,
  createOperatorNode,
  createParenthesisNode,
  createRangeNode,
  createRelationalNode,
  createSymbolNode,
  createParse,
} from '@danielsimonjr/mathts-expression';

import { createResultSet } from '../type/resultset/ResultSet.js';

// Build a mathWithTransform proxy (full math scope used as a proxy for now)
const _mathWithTransform: Record<string, unknown> = { ...factoryScope };
factoryScope.mathWithTransform = _mathWithTransform;

// ResultSet class (needed by BlockNode)
const _ResultSet = createResultSet({});
factoryScope.ResultSet = _ResultSet;

// Base Node class
const _Node = createNode({ mathWithTransform: _mathWithTransform });
factoryScope.Node = _Node;

// Simple nodes
const _ArrayNode = createArrayNode({ Node: _Node });
factoryScope.ArrayNode = _ArrayNode;

const _ObjectNode = createObjectNode({ Node: _Node });
factoryScope.ObjectNode = _ObjectNode;

const _OperatorNode = createOperatorNode({ Node: _Node });
factoryScope.OperatorNode = _OperatorNode;

const _ParenthesisNode = createParenthesisNode({ Node: _Node });
factoryScope.ParenthesisNode = _ParenthesisNode;

const _RangeNode = createRangeNode({ Node: _Node });
factoryScope.RangeNode = _RangeNode;

const _RelationalNode = createRelationalNode({ Node: _Node });
factoryScope.RelationalNode = _RelationalNode;

const _ConditionalNode = createConditionalNode({ Node: _Node });
factoryScope.ConditionalNode = _ConditionalNode;

const _BlockNode = createBlockNode({ ResultSet: _ResultSet, Node: _Node });
factoryScope.BlockNode = _BlockNode;

const _ConstantNode = createConstantNode({
  Node: _Node,
  isBounded: isBounded,
});
factoryScope.ConstantNode = _ConstantNode;

const _FunctionAssignmentNode = createFunctionAssignmentNode({
  typed: factoryScope.typed,
  Node: _Node,
});
factoryScope.FunctionAssignmentNode = _FunctionAssignmentNode;

const _AccessorNode = createAccessorNode({
  subset: subset,
  Node: _Node,
});
factoryScope.AccessorNode = _AccessorNode;

const _AssignmentNode = createAssignmentNode({
  subset: subset,
  matrix: factoryScope.matrix,
  Node: _Node,
});
factoryScope.AssignmentNode = _AssignmentNode;

const _IndexNode = createIndexNode({
  Node: _Node,
  size: size,
});
factoryScope.IndexNode = _IndexNode;

const _SymbolNode = createSymbolNode({
  math: factoryScope,
  Node: _Node,
});
factoryScope.SymbolNode = _SymbolNode;

const _FunctionNode = createFunctionNode({
  math: factoryScope,
  Node: _Node,
  SymbolNode: _SymbolNode,
});
factoryScope.FunctionNode = _FunctionNode;

// Build the parse function
const _parseScope: Record<string, unknown> = {
  typed: factoryScope.typed,
  numeric: numeric,
  config: factoryScope.config,
  AccessorNode: _AccessorNode,
  ArrayNode: _ArrayNode,
  AssignmentNode: _AssignmentNode,
  BlockNode: _BlockNode,
  ConditionalNode: _ConditionalNode,
  ConstantNode: _ConstantNode,
  FunctionAssignmentNode: _FunctionAssignmentNode,
  FunctionNode: _FunctionNode,
  IndexNode: _IndexNode,
  ObjectNode: _ObjectNode,
  OperatorNode: _OperatorNode,
  ParenthesisNode: _ParenthesisNode,
  RangeNode: _RangeNode,
  RelationalNode: _RelationalNode,
  SymbolNode: _SymbolNode,
};
const _parse = createParse(_parseScope as Parameters<typeof createParse>[0]);
factoryScope.parse = _parse;

// Math constants needed by some factories
factoryScope.pi = Math.PI;
factoryScope.tau = 2 * Math.PI;
factoryScope.i = new (factoryScope.Complex as new (re: number, im: number) => unknown)(0, 1);
factoryScope.e = Math.E;

// 'replacer' is a JSON serialization utility — provide a simple identity stub
factoryScope.replacer = (_key: string, value: unknown) => value;

// 'math' for Chain — provide factoryScope itself as the math namespace
factoryScope.math = factoryScope;

// ---------------------------------------------------------------------------
// Tier 11: expression-dependent factories (nodeOperations, simplify utils, etc.)
// ---------------------------------------------------------------------------

import { createNodeOperations } from '../arithmetic/utils/nodeOperations.js';
import { createLeafCount } from '../algebra/leafCount.js';
import { createResolve } from '../algebra/resolve.js';
import { createSimplifyConstant } from '../algebra/simplifyConstant.js';
import { createUtil as createSimplifyUtil } from '../algebra/simplify/util.js';
import { createSplitUnit } from '../type/unit/function/splitUnit.js';
import { createFft } from '../matrix/fft.js';
import { createChainClass } from '../type/chain/Chain.js';

export const nodeOperations = createNodeOperations(factoryScope as Parameters<typeof createNodeOperations>[0]);
factoryScope.nodeOperations = nodeOperations;

export const leafCount = createLeafCount(factoryScope as Parameters<typeof createLeafCount>[0]);
factoryScope.leafCount = leafCount;

export const resolve = createResolve(factoryScope as Parameters<typeof createResolve>[0]);
factoryScope.resolve = resolve;

export const simplifyConstant = createSimplifyConstant(factoryScope as Parameters<typeof createSimplifyConstant>[0]);
factoryScope.simplifyConstant = simplifyConstant;

export const simplifyUtil = createSimplifyUtil(factoryScope as Parameters<typeof createSimplifyUtil>[0]);
factoryScope.simplifyUtil = simplifyUtil;

export const splitUnit = createSplitUnit(factoryScope as Parameters<typeof createSplitUnit>[0]);
factoryScope.splitUnit = splitUnit;

export const fft = createFft(factoryScope as Parameters<typeof createFft>[0]);
factoryScope.fft = fft;

export const Chain = createChainClass(factoryScope as Parameters<typeof createChainClass>[0]);
factoryScope.Chain = Chain;

// ---------------------------------------------------------------------------
// Tier 12: subtract, divide, and dependent types
// ---------------------------------------------------------------------------

import { createSubtract } from '../arithmetic/subtract.js';
import { createDivide } from '../arithmetic/divide.js';
import { createIfft } from '../matrix/ifft.js';
import { createIndexClass } from '../type/matrix/MatrixIndex.js';
import { createChain } from '../type/chain/function/chain.js';
import { createCreateUnit } from '../type/unit/function/createUnit.js';
import { createUnitFunction } from '../type/unit/function/unit.js';
import { createUnitClass } from '../type/unit/Unit.js';
import { createFibonacciHeapClass } from '../type/matrix/FibonacciHeap.js';
import { createImmutableDenseMatrixClass } from '../type/matrix/ImmutableDenseMatrix.js';

// Need type constructors for downstream factories
const _Unit = createUnitClass(factoryScope as Parameters<typeof createUnitClass>[0]);
factoryScope.Unit = _Unit;

const _FibonacciHeap = createFibonacciHeapClass(factoryScope as Parameters<typeof createFibonacciHeapClass>[0]);
factoryScope.FibonacciHeap = _FibonacciHeap;

const _ImmutableDenseMatrix = createImmutableDenseMatrixClass(factoryScope as Parameters<typeof createImmutableDenseMatrixClass>[0]);
factoryScope.ImmutableDenseMatrix = _ImmutableDenseMatrix;

export const factory_subtract = createSubtract(factoryScope as Parameters<typeof createSubtract>[0]);
factoryScope.subtract = factory_subtract;

export const factory_divide = createDivide(factoryScope as Parameters<typeof createDivide>[0]);
factoryScope.divide = factory_divide;

// Upgrade add/multiply from scalar stubs to full typed implementations
factoryScope.add = add;
factoryScope.multiply = multiply;

export const ifft = createIfft(factoryScope as Parameters<typeof createIfft>[0]);
factoryScope.ifft = ifft;

const _Index = createIndexClass(factoryScope as Parameters<typeof createIndexClass>[0]);
factoryScope.Index = _Index;

export const chain = createChain(factoryScope as Parameters<typeof createChain>[0]);
factoryScope.chain = chain;

export const factory_createUnit = createCreateUnit(factoryScope as Parameters<typeof createCreateUnit>[0]);
factoryScope.createUnit = factory_createUnit;

export const unit = createUnitFunction(factoryScope as Parameters<typeof createUnitFunction>[0]);
factoryScope.unit = unit;

// ---------------------------------------------------------------------------
// Tier 13: factories unlocked by subtract, divide, Index
// ---------------------------------------------------------------------------

import { createColumn } from '../matrix/column.js';
import { createRow } from '../matrix/row.js';
import { createCross } from '../matrix/cross.js';
import { createDiff } from '../matrix/diff.js';
import { createSqrtm } from '../matrix/sqrtm.js';
import { createLup } from '../algebra/decomposition/lup.js';
import { createSlu } from '../algebra/decomposition/slu.js';
import { createCsChol } from '../algebra/sparse/csChol.js';
import { createCsLu } from '../algebra/sparse/csLu.js';
import { createCsSpsolve } from '../algebra/sparse/csSpsolve.js';
import { createSpaClass } from '../type/matrix/Spa.js';
import { createIntersect } from '../geometry/intersect.js';
import { createMean } from '../statistics/mean.js';
import { createMedian } from '../statistics/median.js';
import { createVariance } from '../statistics/variance.js';
import { createQuantileSeq } from '../statistics/quantileSeq.js';
import { createKldivergence } from '../probability/kldivergence.js';
import { createMultinomial } from '../probability/multinomial.js';
import { createFreqz } from '../signal/freqz.js';
import { createSetCartesian } from '../set/setCartesian.js';
import { createSetDifference } from '../set/setDifference.js';
import { createSetDistinct } from '../set/setDistinct.js';
import { createSetIntersect } from '../set/setIntersect.js';
import { createSetIsSubset } from '../set/setIsSubset.js';
import { createSetMultiplicity } from '../set/setMultiplicity.js';
import { createSetPowerset } from '../set/setPowerset.js';
import { createSimplifyCore } from '../algebra/simplifyCore.js';
import { createPolynomialRoot } from '../algebra/polynomialRoot.js';
import { createSolveODE } from '../numeric/solveODE.js';
import { createZeta } from '../special/zeta.js';
import { createIndex as createIndexFn } from '../type/matrix/function/index.js';

// Spa needs FibonacciHeap
const _Spa = createSpaClass(factoryScope as Parameters<typeof createSpaClass>[0]);
factoryScope.Spa = _Spa;

export const column = createColumn(factoryScope as Parameters<typeof createColumn>[0]);
factoryScope.column = column;

export const row = createRow(factoryScope as Parameters<typeof createRow>[0]);
factoryScope.row = row;

export const cross = createCross(factoryScope as Parameters<typeof createCross>[0]);
factoryScope.cross = cross;

export const diff = createDiff(factoryScope as Parameters<typeof createDiff>[0]);
factoryScope.diff = diff;

export const sqrtm = createSqrtm(factoryScope as Parameters<typeof createSqrtm>[0]);
factoryScope.sqrtm = sqrtm;

export const lup = createLup(factoryScope as Parameters<typeof createLup>[0]);
factoryScope.lup = lup;

export const slu = createSlu(factoryScope as Parameters<typeof createSlu>[0]);
factoryScope.slu = slu;

export const csChol = createCsChol(factoryScope as Parameters<typeof createCsChol>[0]);
factoryScope.csChol = csChol;

export const csLu = createCsLu(factoryScope as Parameters<typeof createCsLu>[0]);
factoryScope.csLu = csLu;

export const csSpsolve = createCsSpsolve(factoryScope as Parameters<typeof createCsSpsolve>[0]);
factoryScope.csSpsolve = csSpsolve;

export const intersect = createIntersect(factoryScope as Parameters<typeof createIntersect>[0]);
factoryScope.intersect = intersect;

export const factory_mean = createMean(factoryScope as Parameters<typeof createMean>[0]);
factoryScope.mean = factory_mean;

export const median = createMedian(factoryScope as Parameters<typeof createMedian>[0]);
factoryScope.median = median;

export const factory_variance = createVariance(factoryScope as Parameters<typeof createVariance>[0]);
factoryScope.variance = factory_variance;

export const quantileSeq = createQuantileSeq(factoryScope as Parameters<typeof createQuantileSeq>[0]);
factoryScope.quantileSeq = quantileSeq;

export const kldivergence = createKldivergence(factoryScope as Parameters<typeof createKldivergence>[0]);
factoryScope.kldivergence = kldivergence;

// probability (synced factory — superseded by typed/probability; kept internal for factoryScope wiring)
const multinomial_factory = createMultinomial(factoryScope as Parameters<typeof createMultinomial>[0]);
factoryScope.multinomial = multinomial_factory;

export const freqz = createFreqz(factoryScope as Parameters<typeof createFreqz>[0]);
factoryScope.freqz = freqz;

// setCartesian (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setCartesian = createSetCartesian(factoryScope as Parameters<typeof createSetCartesian>[0]);
factoryScope.setCartesian = setCartesian;

// setDifference (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setDifference = createSetDifference(factoryScope as Parameters<typeof createSetDifference>[0]);
factoryScope.setDifference = setDifference;

// setDistinct (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setDistinct = createSetDistinct(factoryScope as Parameters<typeof createSetDistinct>[0]);
factoryScope.setDistinct = setDistinct;

// setIntersect (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setIntersect = createSetIntersect(factoryScope as Parameters<typeof createSetIntersect>[0]);
factoryScope.setIntersect = setIntersect;

// setIsSubset (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setIsSubset = createSetIsSubset(factoryScope as Parameters<typeof createSetIsSubset>[0]);
factoryScope.setIsSubset = setIsSubset;

// setMultiplicity (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setMultiplicity = createSetMultiplicity(factoryScope as Parameters<typeof createSetMultiplicity>[0]);
factoryScope.setMultiplicity = setMultiplicity;

// setPowerset (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setPowerset = createSetPowerset(factoryScope as Parameters<typeof createSetPowerset>[0]);
factoryScope.setPowerset = setPowerset;

export const simplifyCore = createSimplifyCore(factoryScope as Parameters<typeof createSimplifyCore>[0]);
factoryScope.simplifyCore = simplifyCore;

export const polynomialRoot = createPolynomialRoot(factoryScope as Parameters<typeof createPolynomialRoot>[0]);
factoryScope.polynomialRoot = polynomialRoot;

export const solveODE = createSolveODE(factoryScope as Parameters<typeof createSolveODE>[0]);
factoryScope.solveODE = solveODE;

export const zeta = createZeta(factoryScope as Parameters<typeof createZeta>[0]);
factoryScope.zeta = zeta;

export const indexFn = createIndexFn(factoryScope as Parameters<typeof createIndexFn>[0]);
factoryScope.index = indexFn;

// ---------------------------------------------------------------------------
// Tier 14: factories unlocked by tier 13
// ---------------------------------------------------------------------------

import { createEigs } from '../matrix/eigs.js';
import { createLusolve } from '../algebra/solver/lusolve.js';
import { createCorr } from '../statistics/corr.js';
import { createMad } from '../statistics/mad.js';
import { createStd } from '../statistics/std.js';
import { createSetSymDifference } from '../set/setSymDifference.js';
import { createSimplify } from '../algebra/simplify.js';

export const eigs = createEigs(factoryScope as Parameters<typeof createEigs>[0]);
factoryScope.eigs = eigs;

export const lusolve = createLusolve(factoryScope as Parameters<typeof createLusolve>[0]);
factoryScope.lusolve = lusolve;

export const corr = createCorr(factoryScope as Parameters<typeof createCorr>[0]);
factoryScope.corr = corr;

export const mad = createMad(factoryScope as Parameters<typeof createMad>[0]);
factoryScope.mad = mad;

export const factory_std = createStd(factoryScope as Parameters<typeof createStd>[0]);
factoryScope.std = factory_std;

// setSymDifference (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setSymDifference = createSetSymDifference(factoryScope as Parameters<typeof createSetSymDifference>[0]);
factoryScope.setSymDifference = setSymDifference;

export const simplify = createSimplify(factoryScope as Parameters<typeof createSimplify>[0]);
factoryScope.simplify = simplify;

// ---------------------------------------------------------------------------
// Tier 15: factories unlocked by tier 14
// ---------------------------------------------------------------------------

import { createDerivative } from '../algebra/derivative.js';
import { createNorm } from '../arithmetic/norm.js';
import { createRationalize } from '../algebra/rationalize.js';
import { createSetUnion } from '../set/setUnion.js';
import { createSymbolicEqual } from '../algebra/symbolicEqual.js';

export const derivative = createDerivative(factoryScope as Parameters<typeof createDerivative>[0]);
factoryScope.derivative = derivative;

export const factory_norm = createNorm(factoryScope as Parameters<typeof createNorm>[0]);
factoryScope.norm = factory_norm;

export const rationalize = createRationalize(factoryScope as Parameters<typeof createRationalize>[0]);
factoryScope.rationalize = rationalize;

// setUnion (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setUnion = createSetUnion(factoryScope as Parameters<typeof createSetUnion>[0]);
factoryScope.setUnion = setUnion;

export const symbolicEqual = createSymbolicEqual(factoryScope as Parameters<typeof createSymbolicEqual>[0]);
factoryScope.symbolicEqual = symbolicEqual;

// ---------------------------------------------------------------------------
// Tier 16: factories unlocked by tier 15
// ---------------------------------------------------------------------------

import { createRotationMatrix } from '../matrix/rotationMatrix.js';
import { createSchur } from '../algebra/decomposition/schur.js';

export const rotationMatrix = createRotationMatrix(factoryScope as Parameters<typeof createRotationMatrix>[0]);
factoryScope.rotationMatrix = rotationMatrix;

export const schur = createSchur(factoryScope as Parameters<typeof createSchur>[0]);
factoryScope.schur = schur;

// ---------------------------------------------------------------------------
// Tier 17: factories unlocked by tier 16
// ---------------------------------------------------------------------------

import { createRotate } from '../matrix/rotate.js';
import { createSylvester } from '../algebra/sylvester.js';

export const rotate = createRotate(factoryScope as Parameters<typeof createRotate>[0]);
factoryScope.rotate = rotate;

export const sylvester = createSylvester(factoryScope as Parameters<typeof createSylvester>[0]);
factoryScope.sylvester = sylvester;

// ---------------------------------------------------------------------------
// Tier 18: factories unlocked by tier 17
// ---------------------------------------------------------------------------

import { createLyap } from '../algebra/lyap.js';

export const lyap = createLyap(factoryScope as Parameters<typeof createLyap>[0]);
factoryScope.lyap = lyap;

// ---------------------------------------------------------------------------
// Tier 19: physical constants — leaf factories that need `config`, `Unit`
// (tier 12), and `BigNumber`. Activated under the default `number` config;
// each produces a `Unit` (or a dimensionless number) — see EXPANSION_PLAN W1.
// ---------------------------------------------------------------------------

import {
  createSpeedOfLight,
  createGravitationConstant,
  createPlanckConstant,
  createReducedPlanckConstant,
  createMagneticConstant,
  createElectricConstant,
  createVacuumImpedance,
  createCoulomb,
  createCoulombConstant,
  createElementaryCharge,
  createBohrMagneton,
  createConductanceQuantum,
  createInverseConductanceQuantum,
  createMagneticFluxQuantum,
  createNuclearMagneton,
  createKlitzing,
  createJosephson,
  createFaraday,
  createFineStructure,
  createBoltzmann,
  createGasConstant,
  createMolarVolume,
  createMolarMass,
  createMolarMassC12,
  createMolarPlanckConstant,
  createAvogadro,
  createLoschmidt,
  createSackurTetrode,
  createStefanBoltzmann,
  createFirstRadiation,
  createSecondRadiation,
  createWienDisplacement,
  createElectronMass,
  createProtonMass,
  createNeutronMass,
  createDeuteronMass,
  createAtomicMass,
  createBohrRadius,
  createClassicalElectronRadius,
} from '../type/unit/physicalConstants.js';
import {
  createGravity,
  createPlanckLength,
  createPlanckMass,
  createPlanckTime,
  createPlanckCharge,
  createPlanckTemperature,
  createHartreeEnergy,
  createQuantumOfCirculation,
  createRydberg,
  createThomsonCrossSection,
  createWeakMixingAngle,
  createEfimovFactor,
  createFermiCoupling,
} from '../type/unit/physicalConstants.js';

export const speedOfLight = createSpeedOfLight(factoryScope as Parameters<typeof createSpeedOfLight>[0]);
export const gravitationConstant = createGravitationConstant(factoryScope as Parameters<typeof createGravitationConstant>[0]);
export const planckConstant = createPlanckConstant(factoryScope as Parameters<typeof createPlanckConstant>[0]);
export const reducedPlanckConstant = createReducedPlanckConstant(factoryScope as Parameters<typeof createReducedPlanckConstant>[0]);
export const magneticConstant = createMagneticConstant(factoryScope as Parameters<typeof createMagneticConstant>[0]);
export const electricConstant = createElectricConstant(factoryScope as Parameters<typeof createElectricConstant>[0]);
export const vacuumImpedance = createVacuumImpedance(factoryScope as Parameters<typeof createVacuumImpedance>[0]);
export const coulomb = createCoulomb(factoryScope as Parameters<typeof createCoulomb>[0]);
export const coulombConstant = createCoulombConstant(factoryScope as Parameters<typeof createCoulombConstant>[0]);
export const elementaryCharge = createElementaryCharge(factoryScope as Parameters<typeof createElementaryCharge>[0]);
export const bohrMagneton = createBohrMagneton(factoryScope as Parameters<typeof createBohrMagneton>[0]);
export const conductanceQuantum = createConductanceQuantum(factoryScope as Parameters<typeof createConductanceQuantum>[0]);
export const inverseConductanceQuantum = createInverseConductanceQuantum(factoryScope as Parameters<typeof createInverseConductanceQuantum>[0]);
export const magneticFluxQuantum = createMagneticFluxQuantum(factoryScope as Parameters<typeof createMagneticFluxQuantum>[0]);
export const nuclearMagneton = createNuclearMagneton(factoryScope as Parameters<typeof createNuclearMagneton>[0]);
export const klitzing = createKlitzing(factoryScope as Parameters<typeof createKlitzing>[0]);
export const josephson = createJosephson(factoryScope as Parameters<typeof createJosephson>[0]);
export const faraday = createFaraday(factoryScope as Parameters<typeof createFaraday>[0]);
export const fineStructure = createFineStructure(factoryScope as Parameters<typeof createFineStructure>[0]);
export const boltzmann = createBoltzmann(factoryScope as Parameters<typeof createBoltzmann>[0]);
export const gasConstant = createGasConstant(factoryScope as Parameters<typeof createGasConstant>[0]);
export const molarVolume = createMolarVolume(factoryScope as Parameters<typeof createMolarVolume>[0]);
export const molarMass = createMolarMass(factoryScope as Parameters<typeof createMolarMass>[0]);
export const molarMassC12 = createMolarMassC12(factoryScope as Parameters<typeof createMolarMassC12>[0]);
export const molarPlanckConstant = createMolarPlanckConstant(factoryScope as Parameters<typeof createMolarPlanckConstant>[0]);
export const avogadro = createAvogadro(factoryScope as Parameters<typeof createAvogadro>[0]);
export const loschmidt = createLoschmidt(factoryScope as Parameters<typeof createLoschmidt>[0]);
export const sackurTetrode = createSackurTetrode(factoryScope as Parameters<typeof createSackurTetrode>[0]);
export const stefanBoltzmann = createStefanBoltzmann(factoryScope as Parameters<typeof createStefanBoltzmann>[0]);
export const firstRadiation = createFirstRadiation(factoryScope as Parameters<typeof createFirstRadiation>[0]);
export const secondRadiation = createSecondRadiation(factoryScope as Parameters<typeof createSecondRadiation>[0]);
export const wienDisplacement = createWienDisplacement(factoryScope as Parameters<typeof createWienDisplacement>[0]);
export const electronMass = createElectronMass(factoryScope as Parameters<typeof createElectronMass>[0]);
export const protonMass = createProtonMass(factoryScope as Parameters<typeof createProtonMass>[0]);
export const neutronMass = createNeutronMass(factoryScope as Parameters<typeof createNeutronMass>[0]);
export const deuteronMass = createDeuteronMass(factoryScope as Parameters<typeof createDeuteronMass>[0]);
export const atomicMass = createAtomicMass(factoryScope as Parameters<typeof createAtomicMass>[0]);
export const bohrRadius = createBohrRadius(factoryScope as Parameters<typeof createBohrRadius>[0]);
export const classicalElectronRadius = createClassicalElectronRadius(factoryScope as Parameters<typeof createClassicalElectronRadius>[0]);
export const gravity = createGravity(factoryScope as Parameters<typeof createGravity>[0]);
export const planckLength = createPlanckLength(factoryScope as Parameters<typeof createPlanckLength>[0]);
export const planckMass = createPlanckMass(factoryScope as Parameters<typeof createPlanckMass>[0]);
export const planckTime = createPlanckTime(factoryScope as Parameters<typeof createPlanckTime>[0]);
export const planckCharge = createPlanckCharge(factoryScope as Parameters<typeof createPlanckCharge>[0]);
export const planckTemperature = createPlanckTemperature(factoryScope as Parameters<typeof createPlanckTemperature>[0]);
export const hartreeEnergy = createHartreeEnergy(factoryScope as Parameters<typeof createHartreeEnergy>[0]);
export const quantumOfCirculation = createQuantumOfCirculation(factoryScope as Parameters<typeof createQuantumOfCirculation>[0]);
export const rydberg = createRydberg(factoryScope as Parameters<typeof createRydberg>[0]);
export const thomsonCrossSection = createThomsonCrossSection(factoryScope as Parameters<typeof createThomsonCrossSection>[0]);
export const weakMixingAngle = createWeakMixingAngle(factoryScope as Parameters<typeof createWeakMixingAngle>[0]);
export const efimovFactor = createEfimovFactor(factoryScope as Parameters<typeof createEfimovFactor>[0]);
export const fermiCoupling = createFermiCoupling(factoryScope as Parameters<typeof createFermiCoupling>[0]);

// ---------------------------------------------------------------------------
// Type-conversion functions (EXPANSION_PLAN W9)
// Collision-free named exports — the scope already holds the constructors.
// ---------------------------------------------------------------------------

export const complex = factoryScope.complex as (re?: number, im?: number) => unknown;
export const fraction = factoryScope.fraction as (n: number, d?: number) => unknown;
export const bignumber = factoryScope.bignumber as (x: number | string) => unknown;
export const matrix = factoryScope.matrix as (data?: unknown, format?: string) => unknown;
export const sparse = factoryScope.createSparseMatrix as (data?: unknown) => unknown;
export const number = (x?: unknown): number => Number(x ?? 0);
export const string = (x?: unknown): string => (x === undefined ? '' : String(x));
export const boolean = (x?: unknown): boolean => Boolean(x);
export const bigint = (x?: unknown): bigint => BigInt((x ?? 0) as never);

// ---------------------------------------------------------------------------
// Update mathWithTransform with all activated factories
// ---------------------------------------------------------------------------
Object.assign(_mathWithTransform, factoryScope);
