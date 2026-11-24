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

const mathjsCreateFormat: CompatFactoryExports['createFormat'] = factories.createFormat;
const mathjsCreatePrint: CompatFactoryExports['createPrint'] = factories.createPrint;
const mathjsCreatePickRandom: CompatFactoryExports['createPickRandom'] = factories.createPickRandom;
const mathjsCreateRandom: CompatFactoryExports['createRandom'] = factories.createRandom;
const mathjsCreateMap: CompatFactoryExports['createMap'] = factories.createMap;
const mathjsCreateFilter: CompatFactoryExports['createFilter'] = factories.createFilter;
const mathjsCreateForEach: CompatFactoryExports['createForEach'] = factories.createForEach;
const mathjsCreateFlatten: CompatFactoryExports['createFlatten'] = factories.createFlatten;
const mathjsCreateSize: CompatFactoryExports['createSize'] = factories.createSize;
const mathjsCreateSqueeze: CompatFactoryExports['createSqueeze'] = factories.createSqueeze;
const mathjsCreateGetMatrixDataType: CompatFactoryExports['createGetMatrixDataType'] =
  factories.createGetMatrixDataType;
const mathjsCreateTypeOf: CompatFactoryExports['createTypeOf'] = factories.createTypeOf;

const mathjsCreateMatrix: CompatFactoryExports['createMatrix'] = factories.createMatrix;
const mathjsCreateEqual: CompatFactoryExports['createEqual'] = factories.createEqual;
const mathjsCreateIsInteger: CompatFactoryExports['createIsInteger'] = factories.createIsInteger;
const mathjsCreateConcat: CompatFactoryExports['createConcat'] = factories.createConcat;
const mathjsCreateAtan2: CompatFactoryExports['createAtan2'] = factories.createAtan2;

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

const formatDependencies: UnaryBundle<'createFormat'> = {
  typedDependencies,
  createFormat: mathjsCreateFormat,
};
const printDependencies: UnaryBundle<'createPrint'> = {
  typedDependencies,
  createPrint: mathjsCreatePrint,
};
const pickRandomDependencies: UnaryBundle<'createPickRandom'> = {
  typedDependencies,
  createPickRandom: mathjsCreatePickRandom,
};
const randomDependencies: UnaryBundle<'createRandom'> = {
  typedDependencies,
  createRandom: mathjsCreateRandom,
};
const mapDependencies: UnaryBundle<'createMap'> = { typedDependencies, createMap: mathjsCreateMap };
const filterDependencies: UnaryBundle<'createFilter'> = {
  typedDependencies,
  createFilter: mathjsCreateFilter,
};
const forEachDependencies: UnaryBundle<'createForEach'> = {
  typedDependencies,
  createForEach: mathjsCreateForEach,
};
const flattenDependencies: UnaryBundle<'createFlatten'> = {
  typedDependencies,
  createFlatten: mathjsCreateFlatten,
};
const sizeDependencies: UnaryBundle<'createSize'> = {
  typedDependencies,
  createSize: mathjsCreateSize,
};
const squeezeDependencies: UnaryBundle<'createSqueeze'> = {
  typedDependencies,
  createSqueeze: mathjsCreateSqueeze,
};
const getMatrixDataTypeDependencies: UnaryBundle<'createGetMatrixDataType'> = {
  typedDependencies,
  createGetMatrixDataType: mathjsCreateGetMatrixDataType,
};
const typeOfDependencies: UnaryBundle<'createTypeOf'> = {
  typedDependencies,
  createTypeOf: mathjsCreateTypeOf,
};

const createSparseMatrixClass: ConstructorFactory<
  (typeof factory_mathjsCompat.constructors)['SparseMatrix']
> = /* #__PURE__ */ factory(
  'SparseMatrix',
  ['Matrix', 'equalScalar', 'typed'],
  () => factory_mathjsCompat.constructors.SparseMatrix
);

const SparseMatrixDependencies: {
  MatrixDependencies: typeof MatrixDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  typedDependencies: typeof typedDependencies;
  createSparseMatrixClass: typeof createSparseMatrixClass;
} = { MatrixDependencies, equalScalarDependencies, typedDependencies, createSparseMatrixClass };

const matrixDependencies: UnaryBundle<'createMatrix'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  MatrixDependencies: typeof MatrixDependencies;
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
} = {
  DenseMatrixDependencies,
  MatrixDependencies,
  SparseMatrixDependencies,
  typedDependencies,
  createMatrix: mathjsCreateMatrix,
};

const equalDependencies: UnaryBundle<'createEqual'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  DenseMatrixDependencies,
  SparseMatrixDependencies,
  equalScalarDependencies,
  matrixDependencies,
  typedDependencies,
  createEqual: mathjsCreateEqual,
};

const isIntegerDependencies: UnaryBundle<'createIsInteger'> & {
  equalDependencies: typeof equalDependencies;
} = { equalDependencies, typedDependencies, createIsInteger: mathjsCreateIsInteger };

const concatDependencies: UnaryBundle<'createConcat'> & {
  isIntegerDependencies: typeof isIntegerDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  isIntegerDependencies,
  matrixDependencies,
  typedDependencies,
  createConcat: mathjsCreateConcat,
};

const atan2Dependencies: UnaryBundle<'createAtan2'> &
  WithBigNumber & {
    DenseMatrixDependencies: typeof DenseMatrixDependencies;
    concatDependencies: typeof concatDependencies;
    equalScalarDependencies: typeof equalScalarDependencies;
    matrixDependencies: typeof matrixDependencies;
  } = {
  BigNumberDependencies,
  DenseMatrixDependencies,
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  typedDependencies,
  createAtan2: mathjsCreateAtan2,
};

const mathjsCreateBitAnd: CompatFactoryExports['createBitAnd'] = factories.createBitAnd;
const bitAndDependencies: UnaryBundle<'createBitAnd'> & {
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  typedDependencies,
  createBitAnd: mathjsCreateBitAnd,
};
const mathjsCreateBitOr: CompatFactoryExports['createBitOr'] = factories.createBitOr;
const bitOrDependencies: UnaryBundle<'createBitOr'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  DenseMatrixDependencies,
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  typedDependencies,
  createBitOr: mathjsCreateBitOr,
};
const mathjsCreateBitXor: CompatFactoryExports['createBitXor'] = factories.createBitXor;
const bitXorDependencies: UnaryBundle<'createBitXor'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
  concatDependencies: typeof concatDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  DenseMatrixDependencies,
  SparseMatrixDependencies,
  concatDependencies,
  matrixDependencies,
  typedDependencies,
  createBitXor: mathjsCreateBitXor,
};
const mathjsCreateCompare: CompatFactoryExports['createCompare'] = factories.createCompare;
const compareDependencies: UnaryBundle<'createCompare'> & {
  BigNumberDependencies: typeof BigNumberDependencies;
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  FractionDependencies: typeof FractionDependencies;
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  BigNumberDependencies,
  DenseMatrixDependencies,
  FractionDependencies,
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  typedDependencies,
  createCompare: mathjsCreateCompare,
};
const mathjsCreateCompareText: CompatFactoryExports['createCompareText'] =
  factories.createCompareText;
const compareTextDependencies: UnaryBundle<'createCompareText'> & {
  concatDependencies: typeof concatDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  concatDependencies,
  matrixDependencies,
  typedDependencies,
  createCompareText: mathjsCreateCompareText,
};
const mathjsCreateDeepEqual: CompatFactoryExports['createDeepEqual'] = factories.createDeepEqual;
const deepEqualDependencies: UnaryBundle<'createDeepEqual'> & {
  equalDependencies: typeof equalDependencies;
} = { equalDependencies, typedDependencies, createDeepEqual: mathjsCreateDeepEqual };
const mathjsCreateDot: CompatFactoryExports['createDot'] = factories.createDot;
const dotDependencies: UnaryBundle<'createDot'> & {
  addScalarDependencies: typeof addScalarDependencies;
  conjDependencies: typeof conjDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  sizeDependencies: typeof sizeDependencies;
} = {
  addScalarDependencies,
  conjDependencies,
  multiplyScalarDependencies,
  sizeDependencies,
  typedDependencies,
  createDot: mathjsCreateDot,
};
const mathjsCreateDotMultiply: CompatFactoryExports['createDotMultiply'] =
  factories.createDotMultiply;
const dotMultiplyDependencies: UnaryBundle<'createDotMultiply'> & {
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
} = {
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  multiplyScalarDependencies,
  typedDependencies,
  createDotMultiply: mathjsCreateDotMultiply,
};
const mathjsCreateHasNumericValue: CompatFactoryExports['createHasNumericValue'] =
  factories.createHasNumericValue;
const hasNumericValueDependencies: UnaryBundle<'createHasNumericValue'> & {
  isNumericDependencies: typeof isNumericDependencies;
} = {
  isNumericDependencies,
  typedDependencies,
  createHasNumericValue: mathjsCreateHasNumericValue,
};
const mathjsCreateIsFinite: CompatFactoryExports['createIsFinite'] = factories.createIsFinite;
const isFiniteDependencies: UnaryBundle<'createIsFinite'> & {
  isBoundedDependencies: typeof isBoundedDependencies;
  mapDependencies: typeof mapDependencies;
} = {
  isBoundedDependencies,
  mapDependencies,
  typedDependencies,
  createIsFinite: mathjsCreateIsFinite,
};
const mathjsCreateIsZero: CompatFactoryExports['createIsZero'] = factories.createIsZero;
const isZeroDependencies: UnaryBundle<'createIsZero'> & {
  equalScalarDependencies: typeof equalScalarDependencies;
} = { equalScalarDependencies, typedDependencies, createIsZero: mathjsCreateIsZero };
const mathjsCreateLcm: CompatFactoryExports['createLcm'] = factories.createLcm;
const lcmDependencies: UnaryBundle<'createLcm'> & {
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  typedDependencies,
  createLcm: mathjsCreateLcm,
};
const mathjsCreateLargerEq: CompatFactoryExports['createLargerEq'] = factories.createLargerEq;
const largerEqDependencies: UnaryBundle<'createLargerEq'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
  concatDependencies: typeof concatDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  DenseMatrixDependencies,
  SparseMatrixDependencies,
  concatDependencies,
  matrixDependencies,
  typedDependencies,
  createLargerEq: mathjsCreateLargerEq,
};
const mathjsCreateSmallerEq: CompatFactoryExports['createSmallerEq'] = factories.createSmallerEq;
const smallerEqDependencies: UnaryBundle<'createSmallerEq'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
  concatDependencies: typeof concatDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  DenseMatrixDependencies,
  SparseMatrixDependencies,
  concatDependencies,
  matrixDependencies,
  typedDependencies,
  createSmallerEq: mathjsCreateSmallerEq,
};
const mathjsCreateUnequal: CompatFactoryExports['createUnequal'] = factories.createUnequal;
const unequalDependencies: UnaryBundle<'createUnequal'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  DenseMatrixDependencies,
  SparseMatrixDependencies,
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  typedDependencies,
  createUnequal: mathjsCreateUnequal,
};
const mathjsCreateOr: CompatFactoryExports['createOr'] = factories.createOr;
const orDependencies: UnaryBundle<'createOr'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  DenseMatrixDependencies,
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  typedDependencies,
  createOr: mathjsCreateOr,
};
const mathjsCreateXor: CompatFactoryExports['createXor'] = factories.createXor;
const xorDependencies: UnaryBundle<'createXor'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
  concatDependencies: typeof concatDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  DenseMatrixDependencies,
  SparseMatrixDependencies,
  concatDependencies,
  matrixDependencies,
  typedDependencies,
  createXor: mathjsCreateXor,
};

const mathjsCreateAdd: CompatFactoryExports['createAdd'] = factories.createAdd;
const addDependencies: UnaryBundle<'createAdd'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
  addScalarDependencies: typeof addScalarDependencies;
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  DenseMatrixDependencies,
  SparseMatrixDependencies,
  addScalarDependencies,
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  typedDependencies,
  createAdd: mathjsCreateAdd,
};
const mathjsCreateSubtract: CompatFactoryExports['createSubtract'] = factories.createSubtract;
const subtractDependencies: UnaryBundle<'createSubtract'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  subtractScalarDependencies: typeof subtractScalarDependencies;
  unaryMinusDependencies: typeof unaryMinusDependencies;
} = {
  DenseMatrixDependencies,
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  subtractScalarDependencies,
  typedDependencies,
  unaryMinusDependencies,
  createSubtract: mathjsCreateSubtract,
};

const mathjsCreateDiag: CompatFactoryExports['createDiag'] = factories.createDiag;
const diagDependencies: UnaryBundle<'createDiag'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  DenseMatrixDependencies,
  SparseMatrixDependencies,
  matrixDependencies,
  typedDependencies,
  createDiag: mathjsCreateDiag,
};
const mathjsCreateIdentity: CompatFactoryExports['createIdentity'] = factories.createIdentity;
const identityDependencies: UnaryBundle<'createIdentity'> & {
  BigNumberDependencies: typeof BigNumberDependencies;
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  BigNumberDependencies,
  DenseMatrixDependencies,
  SparseMatrixDependencies,
  matrixDependencies,
  typedDependencies,
  createIdentity: mathjsCreateIdentity,
};
const mathjsCreateMatrixFromColumns: CompatFactoryExports['createMatrixFromColumns'] =
  factories.createMatrixFromColumns;
const matrixFromColumnsDependencies: UnaryBundle<'createMatrixFromColumns'> & {
  flattenDependencies: typeof flattenDependencies;
  matrixDependencies: typeof matrixDependencies;
  sizeDependencies: typeof sizeDependencies;
} = {
  flattenDependencies,
  matrixDependencies,
  sizeDependencies,
  typedDependencies,
  createMatrixFromColumns: mathjsCreateMatrixFromColumns,
};
const mathjsCreateMatrixFromRows: CompatFactoryExports['createMatrixFromRows'] =
  factories.createMatrixFromRows;
const matrixFromRowsDependencies: UnaryBundle<'createMatrixFromRows'> & {
  flattenDependencies: typeof flattenDependencies;
  matrixDependencies: typeof matrixDependencies;
  sizeDependencies: typeof sizeDependencies;
} = {
  flattenDependencies,
  matrixDependencies,
  sizeDependencies,
  typedDependencies,
  createMatrixFromRows: mathjsCreateMatrixFromRows,
};
const mathjsCreateOnes: CompatFactoryExports['createOnes'] = factories.createOnes;
const onesDependencies: UnaryBundle<'createOnes'> & {
  BigNumberDependencies: typeof BigNumberDependencies;
  matrixDependencies: typeof matrixDependencies;
} = { BigNumberDependencies, matrixDependencies, typedDependencies, createOnes: mathjsCreateOnes };
const mathjsCreateReshape: CompatFactoryExports['createReshape'] = factories.createReshape;
const reshapeDependencies: UnaryBundle<'createReshape'> & {
  isIntegerDependencies: typeof isIntegerDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  isIntegerDependencies,
  matrixDependencies,
  typedDependencies,
  createReshape: mathjsCreateReshape,
};
const mathjsCreateResize: CompatFactoryExports['createResize'] = factories.createResize;
const resizeDependencies: {
  matrixDependencies: typeof matrixDependencies;
  createResize: typeof mathjsCreateResize;
} = { matrixDependencies, createResize: mathjsCreateResize };
const mathjsCreateTranspose: CompatFactoryExports['createTranspose'] = factories.createTranspose;
const transposeDependencies: UnaryBundle<'createTranspose'> & {
  matrixDependencies: typeof matrixDependencies;
} = { matrixDependencies, typedDependencies, createTranspose: mathjsCreateTranspose };
const mathjsCreateZeros: CompatFactoryExports['createZeros'] = factories.createZeros;
const zerosDependencies: UnaryBundle<'createZeros'> & {
  BigNumberDependencies: typeof BigNumberDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  BigNumberDependencies,
  matrixDependencies,
  typedDependencies,
  createZeros: mathjsCreateZeros,
};

const mathjsCreateBin: CompatFactoryExports['createBin'] = factories.createBin;
const binDependencies: UnaryBundle<'createBin'> & {
  formatDependencies: typeof formatDependencies;
} = {
  formatDependencies,
  typedDependencies,
  createBin: mathjsCreateBin,
};

const mathjsCreateHex: CompatFactoryExports['createHex'] = factories.createHex;
const hexDependencies: UnaryBundle<'createHex'> & {
  formatDependencies: typeof formatDependencies;
} = {
  formatDependencies,
  typedDependencies,
  createHex: mathjsCreateHex,
};

const mathjsCreateOct: CompatFactoryExports['createOct'] = factories.createOct;
const octDependencies: UnaryBundle<'createOct'> & {
  formatDependencies: typeof formatDependencies;
} = {
  formatDependencies,
  typedDependencies,
  createOct: mathjsCreateOct,
};

const mathjsCreateCbrt: CompatFactoryExports['createCbrt'] = factories.createCbrt;
const cbrtDependencies: UnaryBundle<'createCbrt'> & {
  BigNumberDependencies: typeof BigNumberDependencies;
  ComplexDependencies: typeof ComplexDependencies;
  FractionDependencies: typeof FractionDependencies;
  isNegativeDependencies: typeof isNegativeDependencies;
  matrixDependencies: typeof matrixDependencies;
  unaryMinusDependencies: typeof unaryMinusDependencies;
} = {
  BigNumberDependencies,
  ComplexDependencies,
  FractionDependencies,
  isNegativeDependencies,
  matrixDependencies,
  typedDependencies,
  unaryMinusDependencies,
  createCbrt: mathjsCreateCbrt,
};

const mathjsCreateAnd: CompatFactoryExports['createAnd'] = factories.createAnd;
const andDependencies: UnaryBundle<'createAnd'> & {
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  notDependencies: typeof notDependencies;
  zerosDependencies: typeof zerosDependencies;
} = {
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  notDependencies,
  typedDependencies,
  zerosDependencies,
  createAnd: mathjsCreateAnd,
};

const mathjsCreateCompareNatural: CompatFactoryExports['createCompareNatural'] =
  factories.createCompareNatural;
const compareNaturalDependencies: UnaryBundle<'createCompareNatural'> & {
  compareDependencies: typeof compareDependencies;
} = {
  compareDependencies,
  typedDependencies,
  createCompareNatural: mathjsCreateCompareNatural,
};

const mathjsCreateCtranspose: CompatFactoryExports['createCtranspose'] = factories.createCtranspose;
const ctransposeDependencies: UnaryBundle<'createCtranspose'> & {
  conjDependencies: typeof conjDependencies;
  transposeDependencies: typeof transposeDependencies;
} = {
  conjDependencies,
  transposeDependencies,
  typedDependencies,
  createCtranspose: mathjsCreateCtranspose,
};

const mathjsCreateEqualText: CompatFactoryExports['createEqualText'] = factories.createEqualText;
const equalTextDependencies: UnaryBundle<'createEqualText'> & {
  compareTextDependencies: typeof compareTextDependencies;
  isZeroDependencies: typeof isZeroDependencies;
} = {
  compareTextDependencies,
  isZeroDependencies,
  typedDependencies,
  createEqualText: mathjsCreateEqualText,
};

const mathjsCreateKron: CompatFactoryExports['createKron'] = factories.createKron;
const kronDependencies: UnaryBundle<'createKron'> & {
  matrixDependencies: typeof matrixDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
} = {
  matrixDependencies,
  multiplyScalarDependencies,
  typedDependencies,
  createKron: mathjsCreateKron,
};

const mathjsCreateLeftShift: CompatFactoryExports['createLeftShift'] = factories.createLeftShift;
const leftShiftDependencies: UnaryBundle<'createLeftShift'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  zerosDependencies: typeof zerosDependencies;
} = {
  DenseMatrixDependencies,
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  typedDependencies,
  zerosDependencies,
  createLeftShift: mathjsCreateLeftShift,
};

const mathjsCreateNthRoot: CompatFactoryExports['createNthRoot'] = factories.createNthRoot;
const nthRootDependencies: UnaryBundle<'createNthRoot'> & {
  BigNumberDependencies: typeof BigNumberDependencies;
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  BigNumberDependencies,
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  typedDependencies,
  createNthRoot: mathjsCreateNthRoot,
};

const mathjsCreateNullish: CompatFactoryExports['createNullish'] = factories.createNullish;
const nullishDependencies: UnaryBundle<'createNullish'> & {
  deepEqualDependencies: typeof deepEqualDependencies;
  flattenDependencies: typeof flattenDependencies;
  matrixDependencies: typeof matrixDependencies;
  sizeDependencies: typeof sizeDependencies;
} = {
  deepEqualDependencies,
  flattenDependencies,
  matrixDependencies,
  sizeDependencies,
  typedDependencies,
  createNullish: mathjsCreateNullish,
};

const mathjsCreatePartitionSelect: CompatFactoryExports['createPartitionSelect'] =
  factories.createPartitionSelect;
const partitionSelectDependencies: UnaryBundle<'createPartitionSelect'> & {
  compareDependencies: typeof compareDependencies;
  isNaNDependencies: typeof isNaNDependencies;
  isNumericDependencies: typeof isNumericDependencies;
} = {
  compareDependencies,
  isNaNDependencies,
  isNumericDependencies,
  typedDependencies,
  createPartitionSelect: mathjsCreatePartitionSelect,
};

const mathjsCreateRandomInt: CompatFactoryExports['createRandomInt'] = factories.createRandomInt;
const randomIntDependencies: UnaryBundle<'createRandomInt'> & {
  log2Dependencies: typeof log2Dependencies;
} = {
  log2Dependencies,
  typedDependencies,
  createRandomInt: mathjsCreateRandomInt,
};

const mathjsCreateRightArithShift: CompatFactoryExports['createRightArithShift'] =
  factories.createRightArithShift;
const rightArithShiftDependencies: UnaryBundle<'createRightArithShift'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  zerosDependencies: typeof zerosDependencies;
} = {
  DenseMatrixDependencies,
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  typedDependencies,
  zerosDependencies,
  createRightArithShift: mathjsCreateRightArithShift,
};

const mathjsCreateRightLogShift: CompatFactoryExports['createRightLogShift'] =
  factories.createRightLogShift;
const rightLogShiftDependencies: UnaryBundle<'createRightLogShift'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  zerosDependencies: typeof zerosDependencies;
} = {
  DenseMatrixDependencies,
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  typedDependencies,
  zerosDependencies,
  createRightLogShift: mathjsCreateRightLogShift,
};

const mathjsCreateRound: CompatFactoryExports['createRound'] = factories.createRound;
const roundDependencies: UnaryBundle<'createRound'> & {
  BigNumberDependencies: typeof BigNumberDependencies;
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  zerosDependencies: typeof zerosDependencies;
} = {
  BigNumberDependencies,
  DenseMatrixDependencies,
  equalScalarDependencies,
  matrixDependencies,
  typedDependencies,
  zerosDependencies,
  createRound: mathjsCreateRound,
};

const mathjsCreateSubset: CompatFactoryExports['createSubset'] = factories.createSubset;
const subsetDependencies: UnaryBundle<'createSubset'> & {
  addDependencies: typeof addDependencies;
  matrixDependencies: typeof matrixDependencies;
  zerosDependencies: typeof zerosDependencies;
} = {
  addDependencies,
  matrixDependencies,
  typedDependencies,
  zerosDependencies,
  createSubset: mathjsCreateSubset,
};

const mathjsCreateTrace: CompatFactoryExports['createTrace'] = factories.createTrace;
const traceDependencies: UnaryBundle<'createTrace'> & {
  addDependencies: typeof addDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  addDependencies,
  matrixDependencies,
  typedDependencies,
  createTrace: mathjsCreateTrace,
};

const mathjsCreateMapSlices: CompatFactoryExports['createMapSlices'] = factories.createMapSlices;
const mapSlicesDependencies: UnaryBundle<'createMapSlices'> & {
  isIntegerDependencies: typeof isIntegerDependencies;
} = { isIntegerDependencies, typedDependencies, createMapSlices: mathjsCreateMapSlices };

const mathjsCreateMode: CompatFactoryExports['createMode'] = factories.createMode;
const modeDependencies: UnaryBundle<'createMode'> & {
  isNaNDependencies: typeof isNaNDependencies;
  isNumericDependencies: typeof isNumericDependencies;
} = { isNaNDependencies, isNumericDependencies, typedDependencies, createMode: mathjsCreateMode };

const mathjsCreateNumber: CompatFactoryExports['createNumber'] = factories.createNumber;
const numberDependencies: UnaryBundle<'createNumber'> = {
  typedDependencies,
  createNumber: mathjsCreateNumber,
};

const mathjsCreateCeil: CompatFactoryExports['createCeil'] = factories.createCeil;
const ceilDependencies: UnaryBundle<'createCeil'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  roundDependencies: typeof roundDependencies;
  zerosDependencies: typeof zerosDependencies;
} = {
  DenseMatrixDependencies,
  equalScalarDependencies,
  matrixDependencies,
  roundDependencies,
  typedDependencies,
  zerosDependencies,
  createCeil: mathjsCreateCeil,
};

const mathjsCreateFloor: CompatFactoryExports['createFloor'] = factories.createFloor;
const floorDependencies: UnaryBundle<'createFloor'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  roundDependencies: typeof roundDependencies;
  zerosDependencies: typeof zerosDependencies;
} = {
  DenseMatrixDependencies,
  equalScalarDependencies,
  matrixDependencies,
  roundDependencies,
  typedDependencies,
  zerosDependencies,
  createFloor: mathjsCreateFloor,
};

const mathjsCreateGcd: CompatFactoryExports['createGcd'] = factories.createGcd;
const gcdDependencies: UnaryBundle<'createGcd'> & {
  BigNumberDependencies: typeof BigNumberDependencies;
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  roundDependencies: typeof roundDependencies;
  zerosDependencies: typeof zerosDependencies;
} = {
  BigNumberDependencies,
  DenseMatrixDependencies,
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  roundDependencies,
  typedDependencies,
  zerosDependencies,
  createGcd: mathjsCreateGcd,
};

const mathjsCreateMod: CompatFactoryExports['createMod'] = factories.createMod;
const modDependencies: UnaryBundle<'createMod'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  roundDependencies: typeof roundDependencies;
  zerosDependencies: typeof zerosDependencies;
} = {
  DenseMatrixDependencies,
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  roundDependencies,
  typedDependencies,
  zerosDependencies,
  createMod: mathjsCreateMod,
};

const mathjsCreateMatrixFromFunction: CompatFactoryExports['createMatrixFromFunction'] =
  factories.createMatrixFromFunction;
const matrixFromFunctionDependencies: UnaryBundle<'createMatrixFromFunction'> & {
  isZeroDependencies: typeof isZeroDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  isZeroDependencies,
  matrixDependencies,
  typedDependencies,
  createMatrixFromFunction: mathjsCreateMatrixFromFunction,
};

const mathjsCreateSetSize: CompatFactoryExports['createSetSize'] = factories.createSetSize;
const setSizeDependencies: UnaryBundle<'createSetSize'> & {
  compareNaturalDependencies: typeof compareNaturalDependencies;
} = {
  compareNaturalDependencies,
  typedDependencies,
  createSetSize: mathjsCreateSetSize,
};

const mathjsCreateSort: CompatFactoryExports['createSort'] = factories.createSort;
const sortDependencies: UnaryBundle<'createSort'> & {
  compareDependencies: typeof compareDependencies;
  compareNaturalDependencies: typeof compareNaturalDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  compareDependencies,
  compareNaturalDependencies,
  matrixDependencies,
  typedDependencies,
  createSort: mathjsCreateSort,
};

const mathjsCreateChainClass: CompatFactoryExports['createChainClass'] = factories.createChainClass;
const ChainDependencies: UnaryBundle<'createChainClass'> = {
  typedDependencies,
  createChainClass: mathjsCreateChainClass,
};
const mathjsCreateChain: CompatFactoryExports['createChain'] = factories.createChain;
const chainDependencies: UnaryBundle<'createChain'> & {
  ChainDependencies: typeof ChainDependencies;
} = {
  ChainDependencies,
  typedDependencies,
  createChain: mathjsCreateChain,
};
const mathjsCreateResultSet: CompatFactoryExports['createResultSet'] = factories.createResultSet;
const ResultSetDependencies: Pick<CompatFactoryExports, 'createResultSet'> = {
  createResultSet: mathjsCreateResultSet,
};

const mathjsCreateBignumber: CompatFactoryExports['createBignumber'] = factories.createBignumber;
const bignumberDependencies: UnaryBundle<'createBignumber'> & {
  BigNumberDependencies: typeof BigNumberDependencies;
} = {
  BigNumberDependencies,
  typedDependencies,
  createBignumber: mathjsCreateBignumber,
};

const mathjsCreateFraction: CompatFactoryExports['createFraction'] = factories.createFraction;
const fractionDependencies: UnaryBundle<'createFraction'> & {
  FractionDependencies: typeof FractionDependencies;
} = {
  FractionDependencies,
  typedDependencies,
  createFraction: mathjsCreateFraction,
};

const mathjsCreateComplex: CompatFactoryExports['createComplex'] = factories.createComplex;
const complexDependencies: UnaryBundle<'createComplex'> & {
  ComplexDependencies: typeof ComplexDependencies;
} = {
  ComplexDependencies,
  typedDependencies,
  createComplex: mathjsCreateComplex,
};

const mathjsCreateNumeric: CompatFactoryExports['createNumeric'] = factories.createNumeric;
const numericDependencies: Pick<CompatFactoryExports, 'createNumeric'> & {
  bignumberDependencies: typeof bignumberDependencies;
  fractionDependencies: typeof fractionDependencies;
  numberDependencies: typeof numberDependencies;
} = {
  bignumberDependencies,
  fractionDependencies,
  numberDependencies,
  createNumeric: mathjsCreateNumeric,
};

const mathjsCreateDiff: CompatFactoryExports['createDiff'] = factories.createDiff;
const diffDependencies: UnaryBundle<'createDiff'> & {
  matrixDependencies: typeof matrixDependencies;
  numberDependencies: typeof numberDependencies;
  subtractDependencies: typeof subtractDependencies;
} = {
  matrixDependencies,
  numberDependencies,
  subtractDependencies,
  typedDependencies,
  createDiff: mathjsCreateDiff,
};

const mathjsCreateDivideScalar: CompatFactoryExports['createDivideScalar'] =
  factories.createDivideScalar;
const divideScalarDependencies: UnaryBundle<'createDivideScalar'> & {
  numericDependencies: typeof numericDependencies;
} = {
  numericDependencies,
  typedDependencies,
  createDivideScalar: mathjsCreateDivideScalar,
};

const mathjsCreateFix: CompatFactoryExports['createFix'] = factories.createFix;
const fixDependencies: UnaryBundle<'createFix'> & {
  ComplexDependencies: typeof ComplexDependencies;
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  ceilDependencies: typeof ceilDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  floorDependencies: typeof floorDependencies;
  matrixDependencies: typeof matrixDependencies;
  zerosDependencies: typeof zerosDependencies;
} = {
  ComplexDependencies,
  DenseMatrixDependencies,
  ceilDependencies,
  equalScalarDependencies,
  floorDependencies,
  matrixDependencies,
  typedDependencies,
  zerosDependencies,
  createFix: mathjsCreateFix,
};

const mathjsCreateLarger: CompatFactoryExports['createLarger'] = factories.createLarger;
const largerDependencies: UnaryBundle<'createLarger'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
  bignumberDependencies: typeof bignumberDependencies;
  concatDependencies: typeof concatDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  DenseMatrixDependencies,
  SparseMatrixDependencies,
  bignumberDependencies,
  concatDependencies,
  matrixDependencies,
  typedDependencies,
  createLarger: mathjsCreateLarger,
};

const mathjsCreateSign: CompatFactoryExports['createSign'] = factories.createSign;
const signDependencies: UnaryBundle<'createSign'> & {
  BigNumberDependencies: typeof BigNumberDependencies;
  FractionDependencies: typeof FractionDependencies;
  complexDependencies: typeof complexDependencies;
} = {
  BigNumberDependencies,
  FractionDependencies,
  complexDependencies,
  typedDependencies,
  createSign: mathjsCreateSign,
};

const mathjsCreateSmaller: CompatFactoryExports['createSmaller'] = factories.createSmaller;
const smallerDependencies: UnaryBundle<'createSmaller'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
  bignumberDependencies: typeof bignumberDependencies;
  concatDependencies: typeof concatDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  DenseMatrixDependencies,
  SparseMatrixDependencies,
  bignumberDependencies,
  concatDependencies,
  matrixDependencies,
  typedDependencies,
  createSmaller: mathjsCreateSmaller,
};

const mathjsCreateUnaryPlus: CompatFactoryExports['createUnaryPlus'] = factories.createUnaryPlus;
const unaryPlusDependencies: UnaryBundle<'createUnaryPlus'> & {
  numericDependencies: typeof numericDependencies;
} = {
  numericDependencies,
  typedDependencies,
  createUnaryPlus: mathjsCreateUnaryPlus,
};

const mathjsCreateDotDivide: CompatFactoryExports['createDotDivide'] = factories.createDotDivide;
const dotDivideDependencies: UnaryBundle<'createDotDivide'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
  concatDependencies: typeof concatDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  DenseMatrixDependencies,
  SparseMatrixDependencies,
  concatDependencies,
  divideScalarDependencies,
  equalScalarDependencies,
  matrixDependencies,
  typedDependencies,
  createDotDivide: mathjsCreateDotDivide,
};

const mathjsCreateHypot: CompatFactoryExports['createHypot'] = factories.createHypot;
const hypotDependencies: UnaryBundle<'createHypot'> & {
  absDependencies: typeof absDependencies;
  addScalarDependencies: typeof addScalarDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  isPositiveDependencies: typeof isPositiveDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  smallerDependencies: typeof smallerDependencies;
  sqrtDependencies: typeof sqrtDependencies;
} = {
  absDependencies,
  addScalarDependencies,
  divideScalarDependencies,
  isPositiveDependencies,
  multiplyScalarDependencies,
  smallerDependencies,
  sqrtDependencies,
  typedDependencies,
  createHypot: mathjsCreateHypot,
};

const mathjsCreateLog: CompatFactoryExports['createLog'] = factories.createLog;
const logDependencies: UnaryBundle<'createLog'> & {
  ComplexDependencies: typeof ComplexDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  typeOfDependencies: typeof typeOfDependencies;
} = {
  ComplexDependencies,
  divideScalarDependencies,
  typeOfDependencies,
  typedDependencies,
  createLog: mathjsCreateLog,
};

const mathjsCreateNthRoots: CompatFactoryExports['createNthRoots'] = factories.createNthRoots;
const nthRootsDependencies: UnaryBundle<'createNthRoots'> & {
  ComplexDependencies: typeof ComplexDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
} = {
  ComplexDependencies,
  divideScalarDependencies,
  typedDependencies,
  createNthRoots: mathjsCreateNthRoots,
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
  mathjsCreateFormat as createFormat,
  mathjsCreatePrint as createPrint,
  mathjsCreatePickRandom as createPickRandom,
  mathjsCreateRandom as createRandom,
  mathjsCreateMap as createMap,
  mathjsCreateFilter as createFilter,
  mathjsCreateForEach as createForEach,
  mathjsCreateFlatten as createFlatten,
  mathjsCreateSize as createSize,
  mathjsCreateSqueeze as createSqueeze,
  mathjsCreateGetMatrixDataType as createGetMatrixDataType,
  mathjsCreateTypeOf as createTypeOf,
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
  formatDependencies,
  printDependencies,
  pickRandomDependencies,
  randomDependencies,
  mapDependencies,
  filterDependencies,
  forEachDependencies,
  flattenDependencies,
  sizeDependencies,
  squeezeDependencies,
  getMatrixDataTypeDependencies,
  typeOfDependencies,
  mathjsCreateMatrix as createMatrix,
  mathjsCreateEqual as createEqual,
  mathjsCreateIsInteger as createIsInteger,
  mathjsCreateConcat as createConcat,
  mathjsCreateAtan2 as createAtan2,
  createSparseMatrixClass,
  SparseMatrixDependencies,
  matrixDependencies,
  equalDependencies,
  isIntegerDependencies,
  concatDependencies,
  atan2Dependencies,
  mathjsCreateBitAnd as createBitAnd,
  bitAndDependencies,
  mathjsCreateBitOr as createBitOr,
  bitOrDependencies,
  mathjsCreateBitXor as createBitXor,
  bitXorDependencies,
  mathjsCreateCompare as createCompare,
  compareDependencies,
  mathjsCreateCompareText as createCompareText,
  compareTextDependencies,
  mathjsCreateDeepEqual as createDeepEqual,
  deepEqualDependencies,
  mathjsCreateDot as createDot,
  dotDependencies,
  mathjsCreateDotMultiply as createDotMultiply,
  dotMultiplyDependencies,
  mathjsCreateHasNumericValue as createHasNumericValue,
  hasNumericValueDependencies,
  mathjsCreateIsFinite as createIsFinite,
  isFiniteDependencies,
  mathjsCreateIsZero as createIsZero,
  isZeroDependencies,
  mathjsCreateLcm as createLcm,
  lcmDependencies,
  mathjsCreateLargerEq as createLargerEq,
  largerEqDependencies,
  mathjsCreateSmallerEq as createSmallerEq,
  smallerEqDependencies,
  mathjsCreateUnequal as createUnequal,
  unequalDependencies,
  mathjsCreateOr as createOr,
  orDependencies,
  mathjsCreateXor as createXor,
  xorDependencies,
  mathjsCreateAdd as createAdd,
  mathjsCreateSubtract as createSubtract,
  addDependencies,
  subtractDependencies,
  mathjsCreateDiag as createDiag,
  diagDependencies,
  mathjsCreateIdentity as createIdentity,
  identityDependencies,
  mathjsCreateMatrixFromColumns as createMatrixFromColumns,
  matrixFromColumnsDependencies,
  mathjsCreateMatrixFromRows as createMatrixFromRows,
  matrixFromRowsDependencies,
  mathjsCreateOnes as createOnes,
  onesDependencies,
  mathjsCreateReshape as createReshape,
  reshapeDependencies,
  mathjsCreateResize as createResize,
  resizeDependencies,
  mathjsCreateTranspose as createTranspose,
  transposeDependencies,
  mathjsCreateZeros as createZeros,
  zerosDependencies,
  mathjsCreateBin as createBin,
  binDependencies,
  mathjsCreateHex as createHex,
  hexDependencies,
  mathjsCreateOct as createOct,
  octDependencies,
  mathjsCreateCbrt as createCbrt,
  cbrtDependencies,
  mathjsCreateAnd as createAnd,
  andDependencies,
  mathjsCreateCompareNatural as createCompareNatural,
  compareNaturalDependencies,
  mathjsCreateCtranspose as createCtranspose,
  ctransposeDependencies,
  mathjsCreateEqualText as createEqualText,
  equalTextDependencies,
  mathjsCreateKron as createKron,
  kronDependencies,
  mathjsCreateLeftShift as createLeftShift,
  leftShiftDependencies,
  mathjsCreateNthRoot as createNthRoot,
  nthRootDependencies,
  mathjsCreateNullish as createNullish,
  nullishDependencies,
  mathjsCreatePartitionSelect as createPartitionSelect,
  partitionSelectDependencies,
  mathjsCreateRandomInt as createRandomInt,
  randomIntDependencies,
  mathjsCreateRightArithShift as createRightArithShift,
  rightArithShiftDependencies,
  mathjsCreateRightLogShift as createRightLogShift,
  rightLogShiftDependencies,
  mathjsCreateRound as createRound,
  roundDependencies,
  mathjsCreateSubset as createSubset,
  subsetDependencies,
  mathjsCreateTrace as createTrace,
  traceDependencies,
  mathjsCreateMapSlices as createMapSlices,
  mapSlicesDependencies,
  mathjsCreateMode as createMode,
  modeDependencies,
  mathjsCreateNumber as createNumber,
  numberDependencies,
  mathjsCreateCeil as createCeil,
  ceilDependencies,
  mathjsCreateFloor as createFloor,
  floorDependencies,
  mathjsCreateGcd as createGcd,
  gcdDependencies,
  mathjsCreateMod as createMod,
  modDependencies,
  mathjsCreateMatrixFromFunction as createMatrixFromFunction,
  matrixFromFunctionDependencies,
  mathjsCreateSetSize as createSetSize,
  setSizeDependencies,
  mathjsCreateSort as createSort,
  sortDependencies,
  mathjsCreateChainClass as createChainClass,
  ChainDependencies,
  mathjsCreateChain as createChain,
  chainDependencies,
  mathjsCreateResultSet as createResultSet,
  ResultSetDependencies,
  mathjsCreateBignumber as createBignumber,
  bignumberDependencies,
  mathjsCreateFraction as createFraction,
  fractionDependencies,
  mathjsCreateComplex as createComplex,
  complexDependencies,
  mathjsCreateNumeric as createNumeric,
  numericDependencies,
  mathjsCreateDiff as createDiff,
  diffDependencies,
  mathjsCreateDivideScalar as createDivideScalar,
  divideScalarDependencies,
  mathjsCreateFix as createFix,
  fixDependencies,
  mathjsCreateLarger as createLarger,
  largerDependencies,
  mathjsCreateSign as createSign,
  signDependencies,
  mathjsCreateSmaller as createSmaller,
  smallerDependencies,
  mathjsCreateUnaryPlus as createUnaryPlus,
  unaryPlusDependencies,
  mathjsCreateDotDivide as createDotDivide,
  dotDivideDependencies,
  mathjsCreateHypot as createHypot,
  hypotDependencies,
  mathjsCreateLog as createLog,
  logDependencies,
  mathjsCreateNthRoots as createNthRoots,
  nthRootsDependencies,
  typedDependencies,
};
