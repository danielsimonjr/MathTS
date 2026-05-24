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
export const addScalar = createAddScalar(factoryScope as any);
export const multiplyScalar = createMultiplyScalar(factoryScope as any);
export const subtractScalar = createSubtractScalar(factoryScope as any);

// bitwise (synced factory — superseded by typed/bitwise; kept internal for factoryScope wiring)
const bitNot = createBitNot(factoryScope as any);

// complex (synced factories — superseded by typed/complex; kept internal for factoryScope wiring)
const arg = createArg(factoryScope as any);
const conj = createConj(factoryScope as any);
const im = createIm(factoryScope as any);
const re = createRe(factoryScope as any);

// logical (synced factory — superseded by typed/logical; kept internal for factoryScope wiring)
const not = createNot(factoryScope as any);

// matrix
export const filter = createFilter(factoryScope as any);
export const flatten = createFlatten(factoryScope as any);
export const forEach = createForEach(factoryScope as any);
export const getMatrixDataType = createGetMatrixDataType(factoryScope as any);
export const map = createMap(factoryScope as any);
export const size = createSize(factoryScope as any);
export const squeeze = createSqueeze(factoryScope as any);

// probability (synced factories — superseded by typed/probability; kept internal for factoryScope wiring)
const combinations = createCombinations(factoryScope as any);
const combinationsWithRep = createCombinationsWithRep(factoryScope as any);
export const lgamma = createLgamma(factoryScope as any);
const pickRandom = createPickRandom(factoryScope as any);
const random = createRandom(factoryScope as any);

// relational (synced factory — superseded by typed/relational; kept internal for factoryScope wiring)
const equalScalar = createEqualScalar(factoryScope as any);

// special
export const erf = createErf(factoryScope as any);

// string (synced factories — superseded by typed/string; kept internal for factoryScope wiring)
const format = createFormat(factoryScope as any);
const print = createPrint(factoryScope as any);

// trigonometry (non-conflicting)
export const acoth = createAcoth(factoryScope as any);
export const acsch = createAcsch(factoryScope as any);
export const asech = createAsech(factoryScope as any);
export const coth = createCoth(factoryScope as any);
export const csch = createCsch(factoryScope as any);
export const sech = createSech(factoryScope as any);

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
// Tier 1: factory_ versions of conflicting names
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
export const parseNumberWithConfig = createParseNumberWithConfig(factoryScope as any);
factoryScope.parseNumberWithConfig = parseNumberWithConfig;

// arithmetic
export const divideScalar = createDivideScalar(factoryScope as any);

// probability (synced factory — superseded by typed/probability; kept internal for factoryScope wiring)
const randomInt = createRandomInt(factoryScope as any);

// statistics
export const mode = createMode(factoryScope as any);
export const prod = createProd(factoryScope as any);

// string (synced factories — superseded by typed/string; kept internal for factoryScope wiring)
const bin = createBin(factoryScope as any);
const hex = createHex(factoryScope as any);
const oct = createOct(factoryScope as any);

// utils
export const hasNumericValue = createHasNumericValue(factoryScope as any);
export const isFinite = createIsFinite(factoryScope as any);
export const isZero = createIsZero(factoryScope as any);

// Tier 2 conflicting names — use factory_ prefix
export const factory_unaryPlus = createUnaryPlus(factoryScope as any);
export const factory_dot = createDot(factoryScope as any);

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
export const factory_transpose = createTranspose(factoryScope as any);
factoryScope.transpose = factory_transpose;

export const factory_ctranspose = createCtranspose(factoryScope as any);
factoryScope.ctranspose = factory_ctranspose;

export const identity = createIdentity(factoryScope as any);
factoryScope.identity = identity;

export const zeros = createZeros(factoryScope as any);
factoryScope.zeros = zeros;

export const ones = createOnes(factoryScope as any);
factoryScope.ones = ones;

export const diag = createDiag(factoryScope as any);
factoryScope.diag = diag;

export const kron = createKron(factoryScope as any);
factoryScope.kron = kron;

export const matrixFromFunction = createMatrixFromFunction(factoryScope as any);
factoryScope.matrixFromFunction = matrixFromFunction;

export const matrixFromColumns = createMatrixFromColumns(factoryScope as any);
factoryScope.matrixFromColumns = matrixFromColumns;

export const matrixFromRows = createMatrixFromRows(factoryScope as any);
factoryScope.matrixFromRows = matrixFromRows;

export const count = createCount(factoryScope as any);
factoryScope.count = count;

// Factories that need tier 3 deps (add needs concat which needs isInteger which
// needs equal — too deep for now). Use try/catch for safety.

// trace needs 'add' — provide addScalar as fallback
factoryScope.add = factoryScope.addScalar;
export const trace = createTrace(factoryScope as any);
factoryScope.trace = trace;

// det is created here (tier 3) because `inv` (tier 4) depends on it. det's
// internal use of `multiply` is scalar-only (Bareiss/LU over scalar elements),
// so binding `multiply` to `multiplyScalar` is correct for scalar-element
// matrices — full `multiply` would only add block-matrix support.
factoryScope.multiply = factoryScope.multiplyScalar;
export const det = createDet(factoryScope as any);
factoryScope.det = det;

// reshape needs isInteger — provide a simple stub
factoryScope.isInteger = (x: any) => typeof x === 'number' && Number.isInteger(x);
export const reshape = createReshape(factoryScope as any);
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
export const factory_equal = createEqual(factoryScope as any);
factoryScope.equal = factory_equal;

// isInteger needs `equal` — the real factory replaces the tier-3 inline stub
export const isInteger = createIsInteger(factoryScope as any);
factoryScope.isInteger = isInteger;

// matrix
export const concat = createConcat(factoryScope as any);
factoryScope.concat = concat;

export const mapSlices = createMapSlices(factoryScope as any);
factoryScope.mapSlices = mapSlices;

export const resize = createResize(factoryScope as any);
factoryScope.resize = resize;

export const subset = createSubset(factoryScope as any);
factoryScope.subset = subset;

export const inv = createInv(factoryScope as any);
factoryScope.inv = inv;

// arithmetic (conflicting names use factory_ prefix)
export const factory_cbrt = createCbrt(factoryScope as any);
factoryScope.cbrt = factory_cbrt;

export const nthRoots = createNthRoots(factoryScope as any);
factoryScope.nthRoots = nthRoots;

export const factory_round = createRound(factoryScope as any);
factoryScope.round = factory_round;

export const factory_xgcd = createXgcd(factoryScope as any);
factoryScope.xgcd = factory_xgcd;

export const factory_log = createLog(factoryScope as any);
factoryScope.log = factory_log;

// combinatorics
export const catalan = createCatalan(factoryScope as any);
factoryScope.catalan = catalan;

// probability (synced factory — superseded by typed/probability; kept internal for factoryScope wiring)
const bernoulli_factory = createBernoulli(factoryScope as any);
factoryScope.bernoulli = bernoulli_factory;

// signal
export const zpk2tf = createZpk2tf(factoryScope as any);
factoryScope.zpk2tf = zpk2tf;

// statistics (conflicting names use factory_ prefix)
export const factory_cumsum = createCumSum(factoryScope as any);
factoryScope.cumsum = factory_cumsum;

export const factory_sum = createSum(factoryScope as any);
factoryScope.sum = factory_sum;

// algebra/sparse
export const csCounts = createCsCounts(factoryScope as any);
factoryScope.csCounts = csCounts;

export const csSymperm = createCsSymperm(factoryScope as any);
factoryScope.csSymperm = csSymperm;

export const csAmd = createCsAmd(factoryScope as any);
factoryScope.csAmd = csAmd;

export const csSqr = createCsSqr(factoryScope as any);
factoryScope.csSqr = csSqr;

// algebra/solver
export const lsolve = createLsolve(factoryScope as any);
factoryScope.lsolve = lsolve;

export const lsolveAll = createLsolveAll(factoryScope as any);
factoryScope.lsolveAll = lsolveAll;

export const usolve = createUsolve(factoryScope as any);
factoryScope.usolve = usolve;

export const usolveAll = createUsolveAll(factoryScope as any);
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
export const factory_compare = createCompare(factoryScope as any);
factoryScope.compare = factory_compare;

// compareText (synced factory — superseded by typed/relational; kept internal for factoryScope wiring)
const compareText = createCompareText(factoryScope as any);
factoryScope.compareText = compareText;

// deepEqual (synced factory — superseded by typed/relational; kept internal for factoryScope wiring)
const deepEqual = createDeepEqual(factoryScope as any);
factoryScope.deepEqual = deepEqual;

export const factory_larger = createLarger(factoryScope as any);
factoryScope.larger = factory_larger;

export const factory_largerEq = createLargerEq(factoryScope as any);
factoryScope.largerEq = factory_largerEq;

export const factory_smaller = createSmaller(factoryScope as any);
factoryScope.smaller = factory_smaller;

export const factory_smallerEq = createSmallerEq(factoryScope as any);
factoryScope.smallerEq = factory_smallerEq;

// unequal (synced factory — superseded by typed/relational; kept internal for factoryScope wiring)
const unequal = createUnequal(factoryScope as any);
factoryScope.unequal = unequal;

// arithmetic
export const dotDivide = createDotDivide(factoryScope as any);
factoryScope.dotDivide = dotDivide;

export const dotMultiply = createDotMultiply(factoryScope as any);
factoryScope.dotMultiply = dotMultiply;

export const factory_gcd = createGcd(factoryScope as any);
factoryScope.gcd = factory_gcd;

export const factory_lcm = createLcm(factoryScope as any);
factoryScope.lcm = factory_lcm;

export const factory_log1p = createLog1p(factoryScope as any);
factoryScope.log1p = factory_log1p;

export const factory_mod = createMod(factoryScope as any);
factoryScope.mod = factory_mod;

export const factory_nthRoot = createNthRoot(factoryScope as any);
factoryScope.nthRoot = factory_nthRoot;

export const factory_pow = createPow(factoryScope as any);
factoryScope.pow = factory_pow;

export const factory_ceil = createCeil(factoryScope as any);
factoryScope.ceil = factory_ceil;

export const factory_floor = createFloor(factoryScope as any);
factoryScope.floor = factory_floor;

// bitwise (synced factories — superseded by typed/bitwise; kept internal for factoryScope wiring)
const bitAnd = createBitAnd(factoryScope as any);
factoryScope.bitAnd = bitAnd;

const bitOr = createBitOr(factoryScope as any);
factoryScope.bitOr = bitOr;

const bitXor = createBitXor(factoryScope as any);
factoryScope.bitXor = bitXor;

const leftShift = createLeftShift(factoryScope as any);
factoryScope.leftShift = leftShift;

const rightArithShift = createRightArithShift(factoryScope as any);
factoryScope.rightArithShift = rightArithShift;

const rightLogShift = createRightLogShift(factoryScope as any);
factoryScope.rightLogShift = rightLogShift;

// logical (synced factories — superseded by typed/logical; kept internal for factoryScope wiring)
const or = createOr(factoryScope as any);
factoryScope.or = or;

const xor = createXor(factoryScope as any);
factoryScope.xor = xor;

// matrix
export const expm = createExpm(factoryScope as any);
factoryScope.expm = expm;

// trigonometry
export const factory_atan2 = createAtan2(factoryScope as any);
factoryScope.atan2 = factory_atan2;

// unit
export const to = createTo(factoryScope as any);
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
const compareNatural = createCompareNatural(factoryScope as any);
factoryScope.compareNatural = compareNatural;

const equalText = createEqualText(factoryScope as any);
factoryScope.equalText = equalText;

// arithmetic
export const dotPow = createDotPow(factoryScope as any);
factoryScope.dotPow = dotPow;

export const factory_fix = createFix(factoryScope as any);
factoryScope.fix = factory_fix;

export const invmod = createInvmod(factoryScope as any);
factoryScope.invmod = invmod;

// logical (synced factories — superseded by typed/logical; kept internal for factoryScope wiring)
const and = createAnd(factoryScope as any);
factoryScope.and = and;

const nullish = createNullish(factoryScope as any);
factoryScope.nullish = nullish;

// combinatorics
export const composition = createComposition(factoryScope as any);
factoryScope.composition = composition;

// matrix
export const partitionSelect = createPartitionSelect(factoryScope as any);
factoryScope.partitionSelect = partitionSelect;

// pinv: the typed/ layer owns the public `pinv` export (Slice 5.2).
// Keep the factory internal so the factoryScope wiring still works.
const pinv_factory = createPinv(factoryScope as any);
factoryScope.pinv = pinv_factory;

export const qr = createQr(factoryScope as any);
factoryScope.qr = qr;

export const range = createRange(factoryScope as any);
factoryScope.range = range;

export const distance = createDistance(factoryScope as any);
factoryScope.distance = distance;

// probability
export const gamma = createGamma(factoryScope as any);
factoryScope.gamma = gamma;

// statistics
export const factory_max = createMax(factoryScope as any);
factoryScope.max = factory_max;

export const factory_min = createMin(factoryScope as any);
factoryScope.min = factory_min;

// trigonometry
export const factory_hypot = createHypot(factoryScope as any);
factoryScope.hypot = factory_hypot;

// ---------------------------------------------------------------------------
// Tier 7: factories unlocked by tier 6
// ---------------------------------------------------------------------------

import { createFactorial } from '../probability/factorial.js';
import { createSetSize } from '../set/setSize.js';
import { createSort } from '../matrix/sort.js';

export const factorial = createFactorial(factoryScope as any);
factoryScope.factorial = factorial;

// setSize (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setSize = createSetSize(factoryScope as any);
factoryScope.setSize = setSize;

export const sort = createSort(factoryScope as any);
factoryScope.sort = sort;

// ---------------------------------------------------------------------------
// Tier 8: factories unlocked by tier 7
// ---------------------------------------------------------------------------

import { createStirlingS2 } from '../combinatorics/stirlingS2.js';
import { createPermutations } from '../probability/permutations.js';

export const stirlingS2 = createStirlingS2(factoryScope as any);
factoryScope.stirlingS2 = stirlingS2;

// probability (synced factory — superseded by typed/probability; kept internal for factoryScope wiring)
const permutations_factory = createPermutations(factoryScope as any);
factoryScope.permutations = permutations_factory;

// ---------------------------------------------------------------------------
// Tier 9: bellNumbers (unlocked by stirlingS2)
// ---------------------------------------------------------------------------

import { createBellNumbers } from '../combinatorics/bellNumbers.js';

export const bellNumbers = createBellNumbers(factoryScope as any);
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
const _mathWithTransform: Record<string, any> = { ...factoryScope };
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
const _parseScope: Record<string, any> = {
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
const _parse = createParse(_parseScope);
factoryScope.parse = _parse;

// Math constants needed by some factories
factoryScope.pi = Math.PI;
factoryScope.tau = 2 * Math.PI;
factoryScope.i = new (factoryScope.Complex as any)(0, 1);
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

export const nodeOperations = createNodeOperations(factoryScope as any);
factoryScope.nodeOperations = nodeOperations;

export const leafCount = createLeafCount(factoryScope as any);
factoryScope.leafCount = leafCount;

export const resolve = createResolve(factoryScope as any);
factoryScope.resolve = resolve;

export const simplifyConstant = createSimplifyConstant(factoryScope as any);
factoryScope.simplifyConstant = simplifyConstant;

export const simplifyUtil = createSimplifyUtil(factoryScope as any);
factoryScope.simplifyUtil = simplifyUtil;

export const splitUnit = createSplitUnit(factoryScope as any);
factoryScope.splitUnit = splitUnit;

export const fft = createFft(factoryScope as any);
factoryScope.fft = fft;

export const Chain = createChainClass(factoryScope as any);
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
const _Unit = createUnitClass(factoryScope as any);
factoryScope.Unit = _Unit;

const _FibonacciHeap = createFibonacciHeapClass(factoryScope as any);
factoryScope.FibonacciHeap = _FibonacciHeap;

const _ImmutableDenseMatrix = createImmutableDenseMatrixClass(factoryScope as any);
factoryScope.ImmutableDenseMatrix = _ImmutableDenseMatrix;

export const factory_subtract = createSubtract(factoryScope as any);
factoryScope.subtract = factory_subtract;

export const factory_divide = createDivide(factoryScope as any);
factoryScope.divide = factory_divide;

// Upgrade add/multiply from scalar stubs to full typed implementations
factoryScope.add = add;
factoryScope.multiply = multiply;

export const ifft = createIfft(factoryScope as any);
factoryScope.ifft = ifft;

const _Index = createIndexClass(factoryScope as any);
factoryScope.Index = _Index;

export const chain = createChain(factoryScope as any);
factoryScope.chain = chain;

export const factory_createUnit = createCreateUnit(factoryScope as any);
factoryScope.createUnit = factory_createUnit;

export const unit = createUnitFunction(factoryScope as any);
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
const _Spa = createSpaClass(factoryScope as any);
factoryScope.Spa = _Spa;

export const column = createColumn(factoryScope as any);
factoryScope.column = column;

export const row = createRow(factoryScope as any);
factoryScope.row = row;

export const cross = createCross(factoryScope as any);
factoryScope.cross = cross;

export const diff = createDiff(factoryScope as any);
factoryScope.diff = diff;

export const sqrtm = createSqrtm(factoryScope as any);
factoryScope.sqrtm = sqrtm;

export const lup = createLup(factoryScope as any);
factoryScope.lup = lup;

export const slu = createSlu(factoryScope as any);
factoryScope.slu = slu;

export const csChol = createCsChol(factoryScope as any);
factoryScope.csChol = csChol;

export const csLu = createCsLu(factoryScope as any);
factoryScope.csLu = csLu;

export const csSpsolve = createCsSpsolve(factoryScope as any);
factoryScope.csSpsolve = csSpsolve;

export const intersect = createIntersect(factoryScope as any);
factoryScope.intersect = intersect;

export const factory_mean = createMean(factoryScope as any);
factoryScope.mean = factory_mean;

export const median = createMedian(factoryScope as any);
factoryScope.median = median;

export const factory_variance = createVariance(factoryScope as any);
factoryScope.variance = factory_variance;

export const quantileSeq = createQuantileSeq(factoryScope as any);
factoryScope.quantileSeq = quantileSeq;

export const kldivergence = createKldivergence(factoryScope as any);
factoryScope.kldivergence = kldivergence;

// probability (synced factory — superseded by typed/probability; kept internal for factoryScope wiring)
const multinomial_factory = createMultinomial(factoryScope as any);
factoryScope.multinomial = multinomial_factory;

export const freqz = createFreqz(factoryScope as any);
factoryScope.freqz = freqz;

// setCartesian (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setCartesian = createSetCartesian(factoryScope as any);
factoryScope.setCartesian = setCartesian;

// setDifference (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setDifference = createSetDifference(factoryScope as any);
factoryScope.setDifference = setDifference;

// setDistinct (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setDistinct = createSetDistinct(factoryScope as any);
factoryScope.setDistinct = setDistinct;

// setIntersect (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setIntersect = createSetIntersect(factoryScope as any);
factoryScope.setIntersect = setIntersect;

// setIsSubset (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setIsSubset = createSetIsSubset(factoryScope as any);
factoryScope.setIsSubset = setIsSubset;

// setMultiplicity (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setMultiplicity = createSetMultiplicity(factoryScope as any);
factoryScope.setMultiplicity = setMultiplicity;

// setPowerset (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setPowerset = createSetPowerset(factoryScope as any);
factoryScope.setPowerset = setPowerset;

export const simplifyCore = createSimplifyCore(factoryScope as any);
factoryScope.simplifyCore = simplifyCore;

export const polynomialRoot = createPolynomialRoot(factoryScope as any);
factoryScope.polynomialRoot = polynomialRoot;

export const solveODE = createSolveODE(factoryScope as any);
factoryScope.solveODE = solveODE;

export const zeta = createZeta(factoryScope as any);
factoryScope.zeta = zeta;

export const indexFn = createIndexFn(factoryScope as any);
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

export const eigs = createEigs(factoryScope as any);
factoryScope.eigs = eigs;

export const lusolve = createLusolve(factoryScope as any);
factoryScope.lusolve = lusolve;

export const corr = createCorr(factoryScope as any);
factoryScope.corr = corr;

export const mad = createMad(factoryScope as any);
factoryScope.mad = mad;

export const factory_std = createStd(factoryScope as any);
factoryScope.std = factory_std;

// setSymDifference (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setSymDifference = createSetSymDifference(factoryScope as any);
factoryScope.setSymDifference = setSymDifference;

export const simplify = createSimplify(factoryScope as any);
factoryScope.simplify = simplify;

// ---------------------------------------------------------------------------
// Tier 15: factories unlocked by tier 14
// ---------------------------------------------------------------------------

import { createDerivative } from '../algebra/derivative.js';
import { createNorm } from '../arithmetic/norm.js';
import { createRationalize } from '../algebra/rationalize.js';
import { createSetUnion } from '../set/setUnion.js';
import { createSymbolicEqual } from '../algebra/symbolicEqual.js';

export const derivative = createDerivative(factoryScope as any);
factoryScope.derivative = derivative;

export const factory_norm = createNorm(factoryScope as any);
factoryScope.norm = factory_norm;

export const rationalize = createRationalize(factoryScope as any);
factoryScope.rationalize = rationalize;

// setUnion (synced factory — superseded by typed/set; kept internal for factoryScope wiring)
const setUnion = createSetUnion(factoryScope as any);
factoryScope.setUnion = setUnion;

export const symbolicEqual = createSymbolicEqual(factoryScope as any);
factoryScope.symbolicEqual = symbolicEqual;

// ---------------------------------------------------------------------------
// Tier 16: factories unlocked by tier 15
// ---------------------------------------------------------------------------

import { createRotationMatrix } from '../matrix/rotationMatrix.js';
import { createSchur } from '../algebra/decomposition/schur.js';

export const rotationMatrix = createRotationMatrix(factoryScope as any);
factoryScope.rotationMatrix = rotationMatrix;

export const schur = createSchur(factoryScope as any);
factoryScope.schur = schur;

// ---------------------------------------------------------------------------
// Tier 17: factories unlocked by tier 16
// ---------------------------------------------------------------------------

import { createRotate } from '../matrix/rotate.js';
import { createSylvester } from '../algebra/sylvester.js';

export const rotate = createRotate(factoryScope as any);
factoryScope.rotate = rotate;

export const sylvester = createSylvester(factoryScope as any);
factoryScope.sylvester = sylvester;

// ---------------------------------------------------------------------------
// Tier 18: factories unlocked by tier 17
// ---------------------------------------------------------------------------

import { createLyap } from '../algebra/lyap.js';

export const lyap = createLyap(factoryScope as any);
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

export const speedOfLight = createSpeedOfLight(factoryScope as any);
export const gravitationConstant = createGravitationConstant(factoryScope as any);
export const planckConstant = createPlanckConstant(factoryScope as any);
export const reducedPlanckConstant = createReducedPlanckConstant(factoryScope as any);
export const magneticConstant = createMagneticConstant(factoryScope as any);
export const electricConstant = createElectricConstant(factoryScope as any);
export const vacuumImpedance = createVacuumImpedance(factoryScope as any);
export const coulomb = createCoulomb(factoryScope as any);
export const coulombConstant = createCoulombConstant(factoryScope as any);
export const elementaryCharge = createElementaryCharge(factoryScope as any);
export const bohrMagneton = createBohrMagneton(factoryScope as any);
export const conductanceQuantum = createConductanceQuantum(factoryScope as any);
export const inverseConductanceQuantum = createInverseConductanceQuantum(factoryScope as any);
export const magneticFluxQuantum = createMagneticFluxQuantum(factoryScope as any);
export const nuclearMagneton = createNuclearMagneton(factoryScope as any);
export const klitzing = createKlitzing(factoryScope as any);
export const josephson = createJosephson(factoryScope as any);
export const faraday = createFaraday(factoryScope as any);
export const fineStructure = createFineStructure(factoryScope as any);
export const boltzmann = createBoltzmann(factoryScope as any);
export const gasConstant = createGasConstant(factoryScope as any);
export const molarVolume = createMolarVolume(factoryScope as any);
export const molarMass = createMolarMass(factoryScope as any);
export const molarMassC12 = createMolarMassC12(factoryScope as any);
export const molarPlanckConstant = createMolarPlanckConstant(factoryScope as any);
export const avogadro = createAvogadro(factoryScope as any);
export const loschmidt = createLoschmidt(factoryScope as any);
export const sackurTetrode = createSackurTetrode(factoryScope as any);
export const stefanBoltzmann = createStefanBoltzmann(factoryScope as any);
export const firstRadiation = createFirstRadiation(factoryScope as any);
export const secondRadiation = createSecondRadiation(factoryScope as any);
export const wienDisplacement = createWienDisplacement(factoryScope as any);
export const electronMass = createElectronMass(factoryScope as any);
export const protonMass = createProtonMass(factoryScope as any);
export const neutronMass = createNeutronMass(factoryScope as any);
export const deuteronMass = createDeuteronMass(factoryScope as any);
export const atomicMass = createAtomicMass(factoryScope as any);
export const bohrRadius = createBohrRadius(factoryScope as any);
export const classicalElectronRadius = createClassicalElectronRadius(factoryScope as any);
export const gravity = createGravity(factoryScope as any);
export const planckLength = createPlanckLength(factoryScope as any);
export const planckMass = createPlanckMass(factoryScope as any);
export const planckTime = createPlanckTime(factoryScope as any);
export const planckCharge = createPlanckCharge(factoryScope as any);
export const planckTemperature = createPlanckTemperature(factoryScope as any);
export const hartreeEnergy = createHartreeEnergy(factoryScope as any);
export const quantumOfCirculation = createQuantumOfCirculation(factoryScope as any);
export const rydberg = createRydberg(factoryScope as any);
export const thomsonCrossSection = createThomsonCrossSection(factoryScope as any);
export const weakMixingAngle = createWeakMixingAngle(factoryScope as any);
export const efimovFactor = createEfimovFactor(factoryScope as any);
export const fermiCoupling = createFermiCoupling(factoryScope as any);

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
