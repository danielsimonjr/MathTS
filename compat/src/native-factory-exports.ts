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
  typedDependencies,
};
