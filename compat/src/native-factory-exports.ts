import { factory_mathjsCompat } from '@danielsimonjr/mathts-functions';
import { instanceSymbols } from './instance-symbols.js';

const factory: typeof factory_mathjsCompat.factory = factory_mathjsCompat.factory;
const factories = /* #__PURE__ */ factory_mathjsCompat.compatFactoryExports();
type ConstructorFactory<T> = ReturnType<typeof factory<Record<string, unknown>, T>>;
type CompatFactoryExports = ReturnType<typeof factory_mathjsCompat.compatFactoryExports>;

const mathjsCreateAcos: CompatFactoryExports['createAcos'] = factories.createAcos;
const mathjsCreateAcosh: CompatFactoryExports['createAcosh'] = factories.createAcosh;
const mathjsCreateAcot: CompatFactoryExports['createAcot'] = factories.createAcot;
const mathjsCreateAcoth: CompatFactoryExports['createAcoth'] = factories.createAcoth;
const mathjsCreateAcsc: CompatFactoryExports['createAcsc'] = factories.createAcsc;
const mathjsCreateAcsch: CompatFactoryExports['createAcsch'] = factories.createAcsch;
const mathjsCreateAsec: CompatFactoryExports['createAsec'] = factories.createAsec;
const mathjsCreateAsech: CompatFactoryExports['createAsech'] = factories.createAsech;
const mathjsCreateAsin: CompatFactoryExports['createAsin'] = factories.createAsin;
const mathjsCreateAsinh: CompatFactoryExports['createAsinh'] = factories.createAsinh;
const mathjsCreateAtan: CompatFactoryExports['createAtan'] = factories.createAtan;
const mathjsCreateAtanh: CompatFactoryExports['createAtanh'] = factories.createAtanh;
const mathjsCreateCos: CompatFactoryExports['createCos'] = factories.createCos;
const mathjsCreateCosh: CompatFactoryExports['createCosh'] = factories.createCosh;
const mathjsCreateCot: CompatFactoryExports['createCot'] = factories.createCot;
const mathjsCreateCoth: CompatFactoryExports['createCoth'] = factories.createCoth;
const mathjsCreateCsc: CompatFactoryExports['createCsc'] = factories.createCsc;
const mathjsCreateCsch: CompatFactoryExports['createCsch'] = factories.createCsch;
const mathjsCreateSec: CompatFactoryExports['createSec'] = factories.createSec;
const mathjsCreateSech: CompatFactoryExports['createSech'] = factories.createSech;
const mathjsCreateSin: CompatFactoryExports['createSin'] = factories.createSin;
const mathjsCreateSinh: CompatFactoryExports['createSinh'] = factories.createSinh;
const mathjsCreateTan: CompatFactoryExports['createTan'] = factories.createTan;
const mathjsCreateTanh: CompatFactoryExports['createTanh'] = factories.createTanh;

const mathjsCreateAbs: CompatFactoryExports['createAbs'] = factories.createAbs;
const mathjsCreateAddScalar: CompatFactoryExports['createAddScalar'] = factories.createAddScalar;
const mathjsCreateArg: CompatFactoryExports['createArg'] = factories.createArg;
const mathjsCreateBitNot: CompatFactoryExports['createBitNot'] = factories.createBitNot;
const mathjsCreateClone: CompatFactoryExports['createClone'] = factories.createClone;
const mathjsCreateConj: CompatFactoryExports['createConj'] = factories.createConj;
const mathjsCreateCube: CompatFactoryExports['createCube'] = factories.createCube;
const mathjsCreateEqualScalar: CompatFactoryExports['createEqualScalar'] =
  factories.createEqualScalar;
const mathjsCreateErf: CompatFactoryExports['createErf'] = factories.createErf;
const mathjsCreateExp: CompatFactoryExports['createExp'] = factories.createExp;
const mathjsCreateExpm1: CompatFactoryExports['createExpm1'] = factories.createExpm1;
const mathjsCreateIm: CompatFactoryExports['createIm'] = factories.createIm;
const mathjsCreateIsBounded: CompatFactoryExports['createIsBounded'] = factories.createIsBounded;
const mathjsCreateIsNaN: CompatFactoryExports['createIsNaN'] = factories.createIsNaN;
const mathjsCreateIsNegative: CompatFactoryExports['createIsNegative'] = factories.createIsNegative;
const mathjsCreateIsNumeric: CompatFactoryExports['createIsNumeric'] = factories.createIsNumeric;
const mathjsCreateIsPositive: CompatFactoryExports['createIsPositive'] = factories.createIsPositive;
const mathjsCreateIsPrime: CompatFactoryExports['createIsPrime'] = factories.createIsPrime;
const mathjsCreateLgamma: CompatFactoryExports['createLgamma'] = factories.createLgamma;
const mathjsCreateLog10: CompatFactoryExports['createLog10'] = factories.createLog10;
const mathjsCreateLog2: CompatFactoryExports['createLog2'] = factories.createLog2;
const mathjsCreateMultiplyScalar: CompatFactoryExports['createMultiplyScalar'] =
  factories.createMultiplyScalar;
const mathjsCreateNot: CompatFactoryExports['createNot'] = factories.createNot;
const mathjsCreateRe: CompatFactoryExports['createRe'] = factories.createRe;
const mathjsCreateSquare: CompatFactoryExports['createSquare'] = factories.createSquare;
const mathjsCreateSubtractScalar: CompatFactoryExports['createSubtractScalar'] =
  factories.createSubtractScalar;

const mathjsCreateSqrt: CompatFactoryExports['createSqrt'] = factories.createSqrt;
const mathjsCreateUnaryMinus: CompatFactoryExports['createUnaryMinus'] = factories.createUnaryMinus;

/** Factory for the MathJS-compatible typed dispatcher. */
const mathjsCreateTyped: CompatFactoryExports['createTyped'] = factories.createTyped;

/** Factory for the BigNumber constructor in a selected dependency bundle. */
const createBigNumberClass: ConstructorFactory<(typeof instanceSymbols)['BigNumber']> =
  /* #__PURE__ */ factory('BigNumber', ['?on', 'config'], () => instanceSymbols.BigNumber);

/** Factory for the Complex constructor in a selected dependency bundle. */
const createComplexClass: ConstructorFactory<(typeof instanceSymbols)['Complex']> =
  /* #__PURE__ */ factory('Complex', [], () => instanceSymbols.Complex);

/** Factory for the base Matrix constructor in a selected dependency bundle. */
const createMatrixClass: ConstructorFactory<(typeof instanceSymbols)['Matrix']> =
  /* #__PURE__ */ factory('Matrix', [], () => instanceSymbols.Matrix);

/** Factory for the DenseMatrix constructor in a selected dependency bundle. */
const createDenseMatrixClass: ConstructorFactory<
  (typeof factory_mathjsCompat.constructors)['DenseMatrix']
> = /* #__PURE__ */ factory(
  'DenseMatrix',
  ['Matrix', 'config'],
  () => factory_mathjsCompat.constructors.DenseMatrix
);

/** Factory for the Fraction constructor in a selected dependency bundle. */
const createFractionClass: ConstructorFactory<(typeof instanceSymbols)['Fraction']> =
  /* #__PURE__ */ factory('Fraction', [], () => instanceSymbols.Fraction);

/** Factory bundle for the BigNumber constructor. */
const BigNumberDependencies: { createBigNumberClass: typeof createBigNumberClass } = {
  createBigNumberClass,
};
/** Factory bundle for the Complex constructor. */
const ComplexDependencies: { createComplexClass: typeof createComplexClass } = {
  createComplexClass,
};
/** Factory bundle for the base Matrix constructor. */
const MatrixDependencies: { createMatrixClass: typeof createMatrixClass } = { createMatrixClass };
/** Factory bundle for the dense Matrix constructor. */
const DenseMatrixDependencies: {
  MatrixDependencies: typeof MatrixDependencies;
  createDenseMatrixClass: typeof createDenseMatrixClass;
} = { MatrixDependencies, createDenseMatrixClass };
/** Factory bundle for the Fraction constructor. */
const FractionDependencies: { createFractionClass: typeof createFractionClass } = {
  createFractionClass,
};

/** Factory bundle for the typed dispatcher. */
const typedDependencies: {
  BigNumberDependencies: typeof BigNumberDependencies;
  ComplexDependencies: typeof ComplexDependencies;
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  FractionDependencies: typeof FractionDependencies;
  createTyped: typeof mathjsCreateTyped;
} = {
  BigNumberDependencies,
  ComplexDependencies,
  DenseMatrixDependencies,
  FractionDependencies,
  createTyped: mathjsCreateTyped,
};

type UnaryBundle<Key extends keyof CompatFactoryExports> = Pick<CompatFactoryExports, Key> & {
  typedDependencies: typeof typedDependencies;
};
type WithBigNumber = { BigNumberDependencies: typeof BigNumberDependencies };
type WithComplex = { ComplexDependencies: typeof ComplexDependencies };

const acosDependencies: UnaryBundle<'createAcos'> & WithComplex = {
  ComplexDependencies,
  typedDependencies,
  createAcos: mathjsCreateAcos,
};
const acoshDependencies: UnaryBundle<'createAcosh'> & WithComplex = {
  ComplexDependencies,
  typedDependencies,
  createAcosh: mathjsCreateAcosh,
};
const acotDependencies: UnaryBundle<'createAcot'> & WithBigNumber = {
  BigNumberDependencies,
  typedDependencies,
  createAcot: mathjsCreateAcot,
};
const acothDependencies: UnaryBundle<'createAcoth'> & WithBigNumber & WithComplex = {
  BigNumberDependencies,
  ComplexDependencies,
  typedDependencies,
  createAcoth: mathjsCreateAcoth,
};
const acscDependencies: UnaryBundle<'createAcsc'> & WithBigNumber & WithComplex = {
  BigNumberDependencies,
  ComplexDependencies,
  typedDependencies,
  createAcsc: mathjsCreateAcsc,
};
const acschDependencies: UnaryBundle<'createAcsch'> & WithBigNumber = {
  BigNumberDependencies,
  typedDependencies,
  createAcsch: mathjsCreateAcsch,
};
const asecDependencies: UnaryBundle<'createAsec'> & WithBigNumber & WithComplex = {
  BigNumberDependencies,
  ComplexDependencies,
  typedDependencies,
  createAsec: mathjsCreateAsec,
};
const asechDependencies: UnaryBundle<'createAsech'> & WithBigNumber & WithComplex = {
  BigNumberDependencies,
  ComplexDependencies,
  typedDependencies,
  createAsech: mathjsCreateAsech,
};
const asinDependencies: UnaryBundle<'createAsin'> & WithComplex = {
  ComplexDependencies,
  typedDependencies,
  createAsin: mathjsCreateAsin,
};
const asinhDependencies: UnaryBundle<'createAsinh'> = {
  typedDependencies,
  createAsinh: mathjsCreateAsinh,
};
const atanDependencies: UnaryBundle<'createAtan'> = {
  typedDependencies,
  createAtan: mathjsCreateAtan,
};
const atanhDependencies: UnaryBundle<'createAtanh'> & WithComplex = {
  ComplexDependencies,
  typedDependencies,
  createAtanh: mathjsCreateAtanh,
};
const cosDependencies: UnaryBundle<'createCos'> = { typedDependencies, createCos: mathjsCreateCos };
const coshDependencies: UnaryBundle<'createCosh'> = {
  typedDependencies,
  createCosh: mathjsCreateCosh,
};
const cotDependencies: UnaryBundle<'createCot'> & WithBigNumber = {
  BigNumberDependencies,
  typedDependencies,
  createCot: mathjsCreateCot,
};
const cothDependencies: UnaryBundle<'createCoth'> & WithBigNumber = {
  BigNumberDependencies,
  typedDependencies,
  createCoth: mathjsCreateCoth,
};
const cscDependencies: UnaryBundle<'createCsc'> & WithBigNumber = {
  BigNumberDependencies,
  typedDependencies,
  createCsc: mathjsCreateCsc,
};
const cschDependencies: UnaryBundle<'createCsch'> & WithBigNumber = {
  BigNumberDependencies,
  typedDependencies,
  createCsch: mathjsCreateCsch,
};
const secDependencies: UnaryBundle<'createSec'> & WithBigNumber = {
  BigNumberDependencies,
  typedDependencies,
  createSec: mathjsCreateSec,
};
const sechDependencies: UnaryBundle<'createSech'> & WithBigNumber = {
  BigNumberDependencies,
  typedDependencies,
  createSech: mathjsCreateSech,
};
const sinDependencies: UnaryBundle<'createSin'> = { typedDependencies, createSin: mathjsCreateSin };
const sinhDependencies: UnaryBundle<'createSinh'> = {
  typedDependencies,
  createSinh: mathjsCreateSinh,
};
const tanDependencies: UnaryBundle<'createTan'> = { typedDependencies, createTan: mathjsCreateTan };
const tanhDependencies: UnaryBundle<'createTanh'> = {
  typedDependencies,
  createTanh: mathjsCreateTanh,
};

const absDependencies: UnaryBundle<'createAbs'> = { typedDependencies, createAbs: mathjsCreateAbs };
const addScalarDependencies: UnaryBundle<'createAddScalar'> = {
  typedDependencies,
  createAddScalar: mathjsCreateAddScalar,
};
const argDependencies: UnaryBundle<'createArg'> = { typedDependencies, createArg: mathjsCreateArg };
const bitNotDependencies: UnaryBundle<'createBitNot'> = {
  typedDependencies,
  createBitNot: mathjsCreateBitNot,
};
const cloneDependencies: UnaryBundle<'createClone'> = {
  typedDependencies,
  createClone: mathjsCreateClone,
};
const conjDependencies: UnaryBundle<'createConj'> = {
  typedDependencies,
  createConj: mathjsCreateConj,
};
const cubeDependencies: UnaryBundle<'createCube'> = {
  typedDependencies,
  createCube: mathjsCreateCube,
};
const equalScalarDependencies: UnaryBundle<'createEqualScalar'> = {
  typedDependencies,
  createEqualScalar: mathjsCreateEqualScalar,
};
const erfDependencies: UnaryBundle<'createErf'> = { typedDependencies, createErf: mathjsCreateErf };
const expDependencies: UnaryBundle<'createExp'> = { typedDependencies, createExp: mathjsCreateExp };
const expm1Dependencies: UnaryBundle<'createExpm1'> & WithComplex = {
  ComplexDependencies,
  typedDependencies,
  createExpm1: mathjsCreateExpm1,
};
const imDependencies: UnaryBundle<'createIm'> = { typedDependencies, createIm: mathjsCreateIm };
const isBoundedDependencies: UnaryBundle<'createIsBounded'> = {
  typedDependencies,
  createIsBounded: mathjsCreateIsBounded,
};
const isNaNDependencies: UnaryBundle<'createIsNaN'> = {
  typedDependencies,
  createIsNaN: mathjsCreateIsNaN,
};
const isNegativeDependencies: UnaryBundle<'createIsNegative'> = {
  typedDependencies,
  createIsNegative: mathjsCreateIsNegative,
};
const isNumericDependencies: UnaryBundle<'createIsNumeric'> = {
  typedDependencies,
  createIsNumeric: mathjsCreateIsNumeric,
};
const isPositiveDependencies: UnaryBundle<'createIsPositive'> = {
  typedDependencies,
  createIsPositive: mathjsCreateIsPositive,
};
const isPrimeDependencies: UnaryBundle<'createIsPrime'> = {
  typedDependencies,
  createIsPrime: mathjsCreateIsPrime,
};
const lgammaDependencies: UnaryBundle<'createLgamma'> & WithComplex = {
  ComplexDependencies,
  typedDependencies,
  createLgamma: mathjsCreateLgamma,
};
const log10Dependencies: UnaryBundle<'createLog10'> & WithComplex = {
  ComplexDependencies,
  typedDependencies,
  createLog10: mathjsCreateLog10,
};
const log2Dependencies: UnaryBundle<'createLog2'> & WithComplex = {
  ComplexDependencies,
  typedDependencies,
  createLog2: mathjsCreateLog2,
};
const multiplyScalarDependencies: UnaryBundle<'createMultiplyScalar'> = {
  typedDependencies,
  createMultiplyScalar: mathjsCreateMultiplyScalar,
};
const notDependencies: UnaryBundle<'createNot'> = { typedDependencies, createNot: mathjsCreateNot };
const reDependencies: UnaryBundle<'createRe'> = { typedDependencies, createRe: mathjsCreateRe };
const squareDependencies: UnaryBundle<'createSquare'> = {
  typedDependencies,
  createSquare: mathjsCreateSquare,
};
const subtractScalarDependencies: UnaryBundle<'createSubtractScalar'> = {
  typedDependencies,
  createSubtractScalar: mathjsCreateSubtractScalar,
};

const sqrtDependencies: UnaryBundle<'createSqrt'> & WithComplex = {
  ComplexDependencies,
  typedDependencies,
  createSqrt: mathjsCreateSqrt,
};
const unaryMinusDependencies: UnaryBundle<'createUnaryMinus'> = {
  typedDependencies,
  createUnaryMinus: mathjsCreateUnaryMinus,
};

export {
  BigNumberDependencies,
  ComplexDependencies,
  DenseMatrixDependencies,
  FractionDependencies,
  MatrixDependencies,
  createBigNumberClass,
  createComplexClass,
  createDenseMatrixClass,
  createFractionClass,
  createMatrixClass,
  mathjsCreateAcos as createAcos,
  mathjsCreateAcosh as createAcosh,
  mathjsCreateAcot as createAcot,
  mathjsCreateAcoth as createAcoth,
  mathjsCreateAcsc as createAcsc,
  mathjsCreateAcsch as createAcsch,
  mathjsCreateAsec as createAsec,
  mathjsCreateAsech as createAsech,
  mathjsCreateAsin as createAsin,
  mathjsCreateAsinh as createAsinh,
  mathjsCreateAtan as createAtan,
  mathjsCreateAtanh as createAtanh,
  mathjsCreateCos as createCos,
  mathjsCreateCosh as createCosh,
  mathjsCreateCot as createCot,
  mathjsCreateCoth as createCoth,
  mathjsCreateCsc as createCsc,
  mathjsCreateCsch as createCsch,
  mathjsCreateSec as createSec,
  mathjsCreateSech as createSech,
  mathjsCreateSin as createSin,
  mathjsCreateSinh as createSinh,
  mathjsCreateTan as createTan,
  mathjsCreateTanh as createTanh,
  mathjsCreateAbs as createAbs,
  mathjsCreateAddScalar as createAddScalar,
  mathjsCreateArg as createArg,
  mathjsCreateBitNot as createBitNot,
  mathjsCreateClone as createClone,
  mathjsCreateConj as createConj,
  mathjsCreateCube as createCube,
  mathjsCreateEqualScalar as createEqualScalar,
  mathjsCreateErf as createErf,
  mathjsCreateExp as createExp,
  mathjsCreateExpm1 as createExpm1,
  mathjsCreateIm as createIm,
  mathjsCreateIsBounded as createIsBounded,
  mathjsCreateIsNaN as createIsNaN,
  mathjsCreateIsNegative as createIsNegative,
  mathjsCreateIsNumeric as createIsNumeric,
  mathjsCreateIsPositive as createIsPositive,
  mathjsCreateIsPrime as createIsPrime,
  mathjsCreateLgamma as createLgamma,
  mathjsCreateLog10 as createLog10,
  mathjsCreateLog2 as createLog2,
  mathjsCreateMultiplyScalar as createMultiplyScalar,
  mathjsCreateNot as createNot,
  mathjsCreateRe as createRe,
  mathjsCreateSquare as createSquare,
  mathjsCreateSubtractScalar as createSubtractScalar,
  mathjsCreateTyped as createTyped,
  acosDependencies,
  acoshDependencies,
  acotDependencies,
  acothDependencies,
  acscDependencies,
  acschDependencies,
  asecDependencies,
  asechDependencies,
  asinDependencies,
  asinhDependencies,
  atanDependencies,
  atanhDependencies,
  cosDependencies,
  coshDependencies,
  cotDependencies,
  cothDependencies,
  cscDependencies,
  cschDependencies,
  secDependencies,
  sechDependencies,
  sinDependencies,
  sinhDependencies,
  tanDependencies,
  tanhDependencies,
  absDependencies,
  addScalarDependencies,
  argDependencies,
  bitNotDependencies,
  cloneDependencies,
  conjDependencies,
  cubeDependencies,
  equalScalarDependencies,
  erfDependencies,
  expDependencies,
  expm1Dependencies,
  imDependencies,
  isBoundedDependencies,
  isNaNDependencies,
  isNegativeDependencies,
  isNumericDependencies,
  isPositiveDependencies,
  isPrimeDependencies,
  lgammaDependencies,
  log10Dependencies,
  log2Dependencies,
  multiplyScalarDependencies,
  notDependencies,
  reDependencies,
  squareDependencies,
  subtractScalarDependencies,
  mathjsCreateSqrt as createSqrt,
  mathjsCreateUnaryMinus as createUnaryMinus,
  sqrtDependencies,
  unaryMinusDependencies,
  typedDependencies,
};
