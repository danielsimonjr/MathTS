import { factory_mathjsCompat, help as nativeHelp } from '@danielsimonjr/mathts-functions';
import { instanceSymbols } from './instance-symbols.js';

import { compatReplacer as replacer, reviveWithClasses } from './serialization.js';

const factory: typeof factory_mathjsCompat.factory = factory_mathjsCompat.factory;
const fractionPart: typeof factory_mathjsCompat.fractionPart = factory_mathjsCompat.fractionPart;
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
  /* #__PURE__ */ factory('BigNumber', ['?on', 'config'], () => instanceSymbols.BigNumber, {
    isClass: true,
  });

/** Factory for the Complex constructor in a selected dependency bundle. */
const createComplexClass: ConstructorFactory<(typeof instanceSymbols)['Complex']> =
  /* #__PURE__ */ factory('Complex', [], () => instanceSymbols.Complex, { isClass: true });

/** Factory for the base Matrix constructor in a selected dependency bundle. */
const createMatrixClass: ConstructorFactory<(typeof instanceSymbols)['Matrix']> =
  /* #__PURE__ */ factory('Matrix', [], () => instanceSymbols.Matrix, { isClass: true });

/** Factory for the DenseMatrix constructor in a selected dependency bundle. */
const createDenseMatrixClass: ConstructorFactory<
  (typeof factory_mathjsCompat.constructors)['DenseMatrix']
> = /* #__PURE__ */ factory(
  'DenseMatrix',
  ['Matrix', 'config'],
  () => factory_mathjsCompat.constructors.DenseMatrix,
  { isClass: true }
);

/** Factory for the Fraction constructor in a selected dependency bundle. */
const createFractionClass: ConstructorFactory<(typeof instanceSymbols)['Fraction']> =
  /* #__PURE__ */ factory('Fraction', [], () => instanceSymbols.Fraction, { isClass: true });

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
  () => factory_mathjsCompat.constructors.SparseMatrix,
  { isClass: true }
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

const mathjsCreateDistance: CompatFactoryExports['createDistance'] = factories.createDistance;
const distanceDependencies: UnaryBundle<'createDistance'> & {
  absDependencies: typeof absDependencies;
  addScalarDependencies: typeof addScalarDependencies;
  deepEqualDependencies: typeof deepEqualDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  sqrtDependencies: typeof sqrtDependencies;
  subtractScalarDependencies: typeof subtractScalarDependencies;
} = {
  absDependencies,
  addScalarDependencies,
  deepEqualDependencies,
  divideScalarDependencies,
  multiplyScalarDependencies,
  sqrtDependencies,
  subtractScalarDependencies,
  typedDependencies,
  createDistance: mathjsCreateDistance,
};

const mathjsCreateLsolve: CompatFactoryExports['createLsolve'] = factories.createLsolve;
const lsolveDependencies: UnaryBundle<'createLsolve'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  subtractScalarDependencies: typeof subtractScalarDependencies;
} = {
  DenseMatrixDependencies,
  divideScalarDependencies,
  equalScalarDependencies,
  matrixDependencies,
  multiplyScalarDependencies,
  subtractScalarDependencies,
  typedDependencies,
  createLsolve: mathjsCreateLsolve,
};

const mathjsCreateUsolve: CompatFactoryExports['createUsolve'] = factories.createUsolve;
const usolveDependencies: UnaryBundle<'createUsolve'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  subtractScalarDependencies: typeof subtractScalarDependencies;
} = {
  DenseMatrixDependencies,
  divideScalarDependencies,
  equalScalarDependencies,
  matrixDependencies,
  multiplyScalarDependencies,
  subtractScalarDependencies,
  typedDependencies,
  createUsolve: mathjsCreateUsolve,
};

const mathjsCreateLsolveAll: CompatFactoryExports['createLsolveAll'] = factories.createLsolveAll;
const lsolveAllDependencies: UnaryBundle<'createLsolveAll'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  subtractScalarDependencies: typeof subtractScalarDependencies;
} = {
  DenseMatrixDependencies,
  divideScalarDependencies,
  equalScalarDependencies,
  matrixDependencies,
  multiplyScalarDependencies,
  subtractScalarDependencies,
  typedDependencies,
  createLsolveAll: mathjsCreateLsolveAll,
};

const mathjsCreateUsolveAll: CompatFactoryExports['createUsolveAll'] = factories.createUsolveAll;
const usolveAllDependencies: UnaryBundle<'createUsolveAll'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  subtractScalarDependencies: typeof subtractScalarDependencies;
} = {
  DenseMatrixDependencies,
  divideScalarDependencies,
  equalScalarDependencies,
  matrixDependencies,
  multiplyScalarDependencies,
  subtractScalarDependencies,
  typedDependencies,
  createUsolveAll: mathjsCreateUsolveAll,
};

const mathjsCreateLog1p: CompatFactoryExports['createLog1p'] = factories.createLog1p;
const log1pDependencies: UnaryBundle<'createLog1p'> & {
  ComplexDependencies: typeof ComplexDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  logDependencies: typeof logDependencies;
} = {
  ComplexDependencies,
  divideScalarDependencies,
  logDependencies,
  typedDependencies,
  createLog1p: mathjsCreateLog1p,
};

const mathjsCreateRange: CompatFactoryExports['createRange'] = factories.createRange;
const rangeDependencies: UnaryBundle<'createRange'> & {
  bignumberDependencies: typeof bignumberDependencies;
  matrixDependencies: typeof matrixDependencies;
  addDependencies: typeof addDependencies;
  equalDependencies: typeof equalDependencies;
  isPositiveDependencies: typeof isPositiveDependencies;
  isZeroDependencies: typeof isZeroDependencies;
  largerDependencies: typeof largerDependencies;
  largerEqDependencies: typeof largerEqDependencies;
  smallerDependencies: typeof smallerDependencies;
  smallerEqDependencies: typeof smallerEqDependencies;
} = {
  bignumberDependencies,
  matrixDependencies,
  addDependencies,
  equalDependencies,
  isPositiveDependencies,
  isZeroDependencies,
  largerDependencies,
  largerEqDependencies,
  smallerDependencies,
  smallerEqDependencies,
  typedDependencies,
  createRange: mathjsCreateRange,
};

const mathjsCreateBernoulli: CompatFactoryExports['createBernoulli'] = factories.createBernoulli;
const bernoulliDependencies: UnaryBundle<'createBernoulli'> & {
  BigNumberDependencies: typeof BigNumberDependencies;
  FractionDependencies: typeof FractionDependencies;
  isIntegerDependencies: typeof isIntegerDependencies;
  numberDependencies: typeof numberDependencies;
} = {
  BigNumberDependencies,
  FractionDependencies,
  isIntegerDependencies,
  numberDependencies,
  typedDependencies,
  createBernoulli: mathjsCreateBernoulli,
};

const mathjsCreateNode: CompatFactoryExports['createNode'] = factories.createNode;
const NodeDependencies: Pick<CompatFactoryExports, 'createNode'> = {
  createNode: mathjsCreateNode,
};

const mathjsCreateConstantNode: CompatFactoryExports['createConstantNode'] =
  factories.createConstantNode;
const ConstantNodeDependencies: Pick<CompatFactoryExports, 'createConstantNode'> & {
  NodeDependencies: typeof NodeDependencies;
  isBoundedDependencies: typeof isBoundedDependencies;
} = {
  NodeDependencies,
  isBoundedDependencies,
  createConstantNode: mathjsCreateConstantNode,
};

const mathjsCreateParenthesisNode: CompatFactoryExports['createParenthesisNode'] =
  factories.createParenthesisNode;
const ParenthesisNodeDependencies: Pick<CompatFactoryExports, 'createParenthesisNode'> & {
  NodeDependencies: typeof NodeDependencies;
} = {
  NodeDependencies,
  createParenthesisNode: mathjsCreateParenthesisNode,
};

const mathjsCreateArrayNode: CompatFactoryExports['createArrayNode'] = factories.createArrayNode;
const ArrayNodeDependencies: Pick<CompatFactoryExports, 'createArrayNode'> & {
  NodeDependencies: typeof NodeDependencies;
} = {
  NodeDependencies,
  createArrayNode: mathjsCreateArrayNode,
};

const mathjsCreateBlockNode: CompatFactoryExports['createBlockNode'] = factories.createBlockNode;
const BlockNodeDependencies: Pick<CompatFactoryExports, 'createBlockNode'> & {
  NodeDependencies: typeof NodeDependencies;
  ResultSetDependencies: typeof ResultSetDependencies;
} = {
  NodeDependencies,
  ResultSetDependencies,
  createBlockNode: mathjsCreateBlockNode,
};

const mathjsCreateOperatorNode: CompatFactoryExports['createOperatorNode'] =
  factories.createOperatorNode;
const OperatorNodeDependencies: Pick<CompatFactoryExports, 'createOperatorNode'> & {
  NodeDependencies: typeof NodeDependencies;
} = {
  NodeDependencies,
  createOperatorNode: mathjsCreateOperatorNode,
};

const mathjsCreateRangeNode: CompatFactoryExports['createRangeNode'] = factories.createRangeNode;
const RangeNodeDependencies: Pick<CompatFactoryExports, 'createRangeNode'> & {
  NodeDependencies: typeof NodeDependencies;
} = {
  NodeDependencies,
  createRangeNode: mathjsCreateRangeNode,
};

const mathjsCreateAccessorNode: CompatFactoryExports['createAccessorNode'] =
  factories.createAccessorNode;
const AccessorNodeDependencies: Pick<CompatFactoryExports, 'createAccessorNode'> & {
  NodeDependencies: typeof NodeDependencies;
  subsetDependencies: typeof subsetDependencies;
} = {
  NodeDependencies,
  subsetDependencies,
  createAccessorNode: mathjsCreateAccessorNode,
};

const mathjsCreateConditionalNode: CompatFactoryExports['createConditionalNode'] =
  factories.createConditionalNode;
const ConditionalNodeDependencies: Pick<CompatFactoryExports, 'createConditionalNode'> & {
  NodeDependencies: typeof NodeDependencies;
} = {
  NodeDependencies,
  createConditionalNode: mathjsCreateConditionalNode,
};

const mathjsCreateFunctionAssignmentNode: CompatFactoryExports['createFunctionAssignmentNode'] =
  factories.createFunctionAssignmentNode;
const FunctionAssignmentNodeDependencies: Pick<
  CompatFactoryExports,
  'createFunctionAssignmentNode'
> & {
  NodeDependencies: typeof NodeDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  NodeDependencies,
  typedDependencies,
  createFunctionAssignmentNode: mathjsCreateFunctionAssignmentNode,
};

const mathjsCreateObjectNode: CompatFactoryExports['createObjectNode'] = factories.createObjectNode;
const ObjectNodeDependencies: Pick<CompatFactoryExports, 'createObjectNode'> & {
  NodeDependencies: typeof NodeDependencies;
} = {
  NodeDependencies,
  createObjectNode: mathjsCreateObjectNode,
};

const mathjsCreateIndexNode: CompatFactoryExports['createIndexNode'] = factories.createIndexNode;
const IndexNodeDependencies: Pick<CompatFactoryExports, 'createIndexNode'> & {
  NodeDependencies: typeof NodeDependencies;
  sizeDependencies: typeof sizeDependencies;
} = {
  NodeDependencies,
  sizeDependencies,
  createIndexNode: mathjsCreateIndexNode,
};

const mathjsCreateRelationalNode: CompatFactoryExports['createRelationalNode'] =
  factories.createRelationalNode;
const RelationalNodeDependencies: Pick<CompatFactoryExports, 'createRelationalNode'> & {
  NodeDependencies: typeof NodeDependencies;
} = {
  NodeDependencies,
  createRelationalNode: mathjsCreateRelationalNode,
};

const mathjsCreateImmutableDenseMatrixClass: CompatFactoryExports['createImmutableDenseMatrixClass'] =
  factories.createImmutableDenseMatrixClass;
const ImmutableDenseMatrixDependencies: Pick<
  CompatFactoryExports,
  'createImmutableDenseMatrixClass'
> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  smallerDependencies: typeof smallerDependencies;
} = {
  DenseMatrixDependencies,
  smallerDependencies,
  createImmutableDenseMatrixClass: mathjsCreateImmutableDenseMatrixClass,
};

const mathjsCreateIndexClass: CompatFactoryExports['createIndexClass'] = factories.createIndexClass;
const IndexDependencies: Pick<CompatFactoryExports, 'createIndexClass'> & {
  ImmutableDenseMatrixDependencies: typeof ImmutableDenseMatrixDependencies;
  getMatrixDataTypeDependencies: typeof getMatrixDataTypeDependencies;
} = {
  ImmutableDenseMatrixDependencies,
  getMatrixDataTypeDependencies,
  createIndexClass: mathjsCreateIndexClass,
};

const mathjsCreateIndex: CompatFactoryExports['createIndex'] = factories.createIndex;
const indexDependencies: Pick<CompatFactoryExports, 'createIndex'> & {
  IndexDependencies: typeof IndexDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  IndexDependencies,
  typedDependencies,
  createIndex: mathjsCreateIndex,
};

const mathjsCreateSetDifference: CompatFactoryExports['createSetDifference'] =
  factories.createSetDifference;
const setDifferenceDependencies: Pick<CompatFactoryExports, 'createSetDifference'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  IndexDependencies: typeof IndexDependencies;
  compareNaturalDependencies: typeof compareNaturalDependencies;
  sizeDependencies: typeof sizeDependencies;
  subsetDependencies: typeof subsetDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  DenseMatrixDependencies,
  IndexDependencies,
  compareNaturalDependencies,
  sizeDependencies,
  subsetDependencies,
  typedDependencies,
  createSetDifference: mathjsCreateSetDifference,
};

const mathjsCreateSetIntersect: CompatFactoryExports['createSetIntersect'] =
  factories.createSetIntersect;
const setIntersectDependencies: Pick<CompatFactoryExports, 'createSetIntersect'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  IndexDependencies: typeof IndexDependencies;
  compareNaturalDependencies: typeof compareNaturalDependencies;
  sizeDependencies: typeof sizeDependencies;
  subsetDependencies: typeof subsetDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  DenseMatrixDependencies,
  IndexDependencies,
  compareNaturalDependencies,
  sizeDependencies,
  subsetDependencies,
  typedDependencies,
  createSetIntersect: mathjsCreateSetIntersect,
};

const mathjsCreateSetDistinct: CompatFactoryExports['createSetDistinct'] =
  factories.createSetDistinct;
const setDistinctDependencies: Pick<CompatFactoryExports, 'createSetDistinct'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  IndexDependencies: typeof IndexDependencies;
  compareNaturalDependencies: typeof compareNaturalDependencies;
  sizeDependencies: typeof sizeDependencies;
  subsetDependencies: typeof subsetDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  DenseMatrixDependencies,
  IndexDependencies,
  compareNaturalDependencies,
  sizeDependencies,
  subsetDependencies,
  typedDependencies,
  createSetDistinct: mathjsCreateSetDistinct,
};

const mathjsCreateSetCartesian: CompatFactoryExports['createSetCartesian'] =
  factories.createSetCartesian;
const setCartesianDependencies: Pick<CompatFactoryExports, 'createSetCartesian'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  IndexDependencies: typeof IndexDependencies;
  compareNaturalDependencies: typeof compareNaturalDependencies;
  sizeDependencies: typeof sizeDependencies;
  subsetDependencies: typeof subsetDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  DenseMatrixDependencies,
  IndexDependencies,
  compareNaturalDependencies,
  sizeDependencies,
  subsetDependencies,
  typedDependencies,
  createSetCartesian: mathjsCreateSetCartesian,
};

const mathjsCreateSetIsSubset: CompatFactoryExports['createSetIsSubset'] =
  factories.createSetIsSubset;
const setIsSubsetDependencies: Pick<CompatFactoryExports, 'createSetIsSubset'> & {
  IndexDependencies: typeof IndexDependencies;
  compareNaturalDependencies: typeof compareNaturalDependencies;
  sizeDependencies: typeof sizeDependencies;
  subsetDependencies: typeof subsetDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  IndexDependencies,
  compareNaturalDependencies,
  sizeDependencies,
  subsetDependencies,
  typedDependencies,
  createSetIsSubset: mathjsCreateSetIsSubset,
};

const mathjsCreateSetMultiplicity: CompatFactoryExports['createSetMultiplicity'] =
  factories.createSetMultiplicity;
const setMultiplicityDependencies: Pick<CompatFactoryExports, 'createSetMultiplicity'> & {
  IndexDependencies: typeof IndexDependencies;
  compareNaturalDependencies: typeof compareNaturalDependencies;
  sizeDependencies: typeof sizeDependencies;
  subsetDependencies: typeof subsetDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  IndexDependencies,
  compareNaturalDependencies,
  sizeDependencies,
  subsetDependencies,
  typedDependencies,
  createSetMultiplicity: mathjsCreateSetMultiplicity,
};

const mathjsCreateSetPowerset: CompatFactoryExports['createSetPowerset'] =
  factories.createSetPowerset;
const setPowersetDependencies: Pick<CompatFactoryExports, 'createSetPowerset'> & {
  IndexDependencies: typeof IndexDependencies;
  compareNaturalDependencies: typeof compareNaturalDependencies;
  sizeDependencies: typeof sizeDependencies;
  subsetDependencies: typeof subsetDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  IndexDependencies,
  compareNaturalDependencies,
  sizeDependencies,
  subsetDependencies,
  typedDependencies,
  createSetPowerset: mathjsCreateSetPowerset,
};

const mathjsCreateColumn: CompatFactoryExports['createColumn'] = factories.createColumn;
const columnDependencies: Pick<CompatFactoryExports, 'createColumn'> & {
  IndexDependencies: typeof IndexDependencies;
  matrixDependencies: typeof matrixDependencies;
  rangeDependencies: typeof rangeDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  IndexDependencies,
  matrixDependencies,
  rangeDependencies,
  typedDependencies,
  createColumn: mathjsCreateColumn,
};

const mathjsCreateRow: CompatFactoryExports['createRow'] = factories.createRow;
const rowDependencies: Pick<CompatFactoryExports, 'createRow'> & {
  IndexDependencies: typeof IndexDependencies;
  matrixDependencies: typeof matrixDependencies;
  rangeDependencies: typeof rangeDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  IndexDependencies,
  matrixDependencies,
  rangeDependencies,
  typedDependencies,
  createRow: mathjsCreateRow,
};

const mathjsCreateFibonacciHeapClass: CompatFactoryExports['createFibonacciHeapClass'] =
  factories.createFibonacciHeapClass;
const FibonacciHeapDependencies: Pick<CompatFactoryExports, 'createFibonacciHeapClass'> & {
  largerDependencies: typeof largerDependencies;
  smallerDependencies: typeof smallerDependencies;
} = {
  largerDependencies,
  smallerDependencies,
  createFibonacciHeapClass: mathjsCreateFibonacciHeapClass,
};

const mathjsCreateSpaClass: CompatFactoryExports['createSpaClass'] = factories.createSpaClass;
const SpaDependencies: Pick<CompatFactoryExports, 'createSpaClass'> & {
  FibonacciHeapDependencies: typeof FibonacciHeapDependencies;
  addScalarDependencies: typeof addScalarDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
} = {
  FibonacciHeapDependencies,
  addScalarDependencies,
  equalScalarDependencies,
  createSpaClass: mathjsCreateSpaClass,
};

const mathjsCreateQr: CompatFactoryExports['createQr'] = factories.createQr;
const qrDependencies: Pick<CompatFactoryExports, 'createQr'> & {
  addScalarDependencies: typeof addScalarDependencies;
  complexDependencies: typeof complexDependencies;
  conjDependencies: typeof conjDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  equalDependencies: typeof equalDependencies;
  identityDependencies: typeof identityDependencies;
  isZeroDependencies: typeof isZeroDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  signDependencies: typeof signDependencies;
  sqrtDependencies: typeof sqrtDependencies;
  subtractScalarDependencies: typeof subtractScalarDependencies;
  typedDependencies: typeof typedDependencies;
  unaryMinusDependencies: typeof unaryMinusDependencies;
  zerosDependencies: typeof zerosDependencies;
} = {
  addScalarDependencies,
  complexDependencies,
  conjDependencies,
  divideScalarDependencies,
  equalDependencies,
  identityDependencies,
  isZeroDependencies,
  matrixDependencies,
  multiplyScalarDependencies,
  signDependencies,
  sqrtDependencies,
  subtractScalarDependencies,
  typedDependencies,
  unaryMinusDependencies,
  zerosDependencies,
  createQr: mathjsCreateQr,
};

const mathjsCreateLup: CompatFactoryExports['createLup'] = factories.createLup;
const lupDependencies: Pick<CompatFactoryExports, 'createLup'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  SpaDependencies: typeof SpaDependencies;
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
  absDependencies: typeof absDependencies;
  addScalarDependencies: typeof addScalarDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  largerDependencies: typeof largerDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  subtractScalarDependencies: typeof subtractScalarDependencies;
  typedDependencies: typeof typedDependencies;
  unaryMinusDependencies: typeof unaryMinusDependencies;
} = {
  DenseMatrixDependencies,
  SpaDependencies,
  SparseMatrixDependencies,
  absDependencies,
  addScalarDependencies,
  divideScalarDependencies,
  equalScalarDependencies,
  largerDependencies,
  matrixDependencies,
  multiplyScalarDependencies,
  subtractScalarDependencies,
  typedDependencies,
  unaryMinusDependencies,
  createLup: mathjsCreateLup,
};

const mathjsCreateMax: CompatFactoryExports['createMax'] = factories.createMax;
const maxDependencies: Pick<CompatFactoryExports, 'createMax'> & {
  isNaNDependencies: typeof isNaNDependencies;
  largerDependencies: typeof largerDependencies;
  numericDependencies: typeof numericDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  isNaNDependencies,
  largerDependencies,
  numericDependencies,
  typedDependencies,
  createMax: mathjsCreateMax,
};

const mathjsCreateMin: CompatFactoryExports['createMin'] = factories.createMin;
const minDependencies: Pick<CompatFactoryExports, 'createMin'> & {
  isNaNDependencies: typeof isNaNDependencies;
  numericDependencies: typeof numericDependencies;
  smallerDependencies: typeof smallerDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  isNaNDependencies,
  numericDependencies,
  smallerDependencies,
  typedDependencies,
  createMin: mathjsCreateMin,
};

const mathjsCreateCumSum: CompatFactoryExports['createCumSum'] = factories.createCumSum;
const cumsumDependencies: Pick<CompatFactoryExports, 'createCumSum'> & {
  addDependencies: typeof addDependencies;
  typedDependencies: typeof typedDependencies;
  unaryPlusDependencies: typeof unaryPlusDependencies;
} = {
  addDependencies,
  typedDependencies,
  unaryPlusDependencies,
  createCumSum: mathjsCreateCumSum,
};

const mathjsCreateSetSymDifference: CompatFactoryExports['createSetSymDifference'] =
  factories.createSetSymDifference;
const setSymDifferenceDependencies: Pick<CompatFactoryExports, 'createSetSymDifference'> & {
  IndexDependencies: typeof IndexDependencies;
  concatDependencies: typeof concatDependencies;
  setDifferenceDependencies: typeof setDifferenceDependencies;
  sizeDependencies: typeof sizeDependencies;
  subsetDependencies: typeof subsetDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  IndexDependencies,
  concatDependencies,
  setDifferenceDependencies,
  sizeDependencies,
  subsetDependencies,
  typedDependencies,
  createSetSymDifference: mathjsCreateSetSymDifference,
};

const mathjsCreateSum: CompatFactoryExports['createSum'] = factories.createSum;
const sumDependencies: UnaryBundle<'createSum'> & {
  addDependencies: typeof addDependencies;
  numericDependencies: typeof numericDependencies;
} = { addDependencies, numericDependencies, typedDependencies, createSum: mathjsCreateSum };

const mathjsCreateProd: CompatFactoryExports['createProd'] = factories.createProd;
const prodDependencies: UnaryBundle<'createProd'> & {
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  numericDependencies: typeof numericDependencies;
} = {
  multiplyScalarDependencies,
  numericDependencies,
  typedDependencies,
  createProd: mathjsCreateProd,
};

const mathjsCreateCount: CompatFactoryExports['createCount'] = factories.createCount;
const countDependencies: UnaryBundle<'createCount'> & {
  prodDependencies: typeof prodDependencies;
  sizeDependencies: typeof sizeDependencies;
} = { prodDependencies, sizeDependencies, typedDependencies, createCount: mathjsCreateCount };

const mathjsCreateMultiply: CompatFactoryExports['createMultiply'] = factories.createMultiply;
const multiplyDependencies: UnaryBundle<'createMultiply'> & {
  addScalarDependencies: typeof addScalarDependencies;
  dotDependencies: typeof dotDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
} = {
  addScalarDependencies,
  dotDependencies,
  equalScalarDependencies,
  matrixDependencies,
  multiplyScalarDependencies,
  typedDependencies,
  createMultiply: mathjsCreateMultiply,
};

const mathjsCreateDet: CompatFactoryExports['createDet'] = factories.createDet;
const detDependencies: UnaryBundle<'createDet'> & {
  divideScalarDependencies: typeof divideScalarDependencies;
  isZeroDependencies: typeof isZeroDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  subtractScalarDependencies: typeof subtractScalarDependencies;
  unaryMinusDependencies: typeof unaryMinusDependencies;
} = {
  divideScalarDependencies,
  isZeroDependencies,
  matrixDependencies,
  multiplyDependencies,
  subtractScalarDependencies,
  typedDependencies,
  unaryMinusDependencies,
  createDet: mathjsCreateDet,
};

const mathjsCreateInv: CompatFactoryExports['createInv'] = factories.createInv;
const invDependencies: UnaryBundle<'createInv'> & {
  absDependencies: typeof absDependencies;
  addScalarDependencies: typeof addScalarDependencies;
  detDependencies: typeof detDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  identityDependencies: typeof identityDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  unaryMinusDependencies: typeof unaryMinusDependencies;
} = {
  absDependencies,
  addScalarDependencies,
  detDependencies,
  divideScalarDependencies,
  identityDependencies,
  matrixDependencies,
  multiplyDependencies,
  typedDependencies,
  unaryMinusDependencies,
  createInv: mathjsCreateInv,
};

const mathjsCreatePow: CompatFactoryExports['createPow'] = factories.createPow;
const powDependencies: UnaryBundle<'createPow'> & {
  ComplexDependencies: typeof ComplexDependencies;
  fractionDependencies: typeof fractionDependencies;
  identityDependencies: typeof identityDependencies;
  invDependencies: typeof invDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  numberDependencies: typeof numberDependencies;
} = {
  ComplexDependencies,
  fractionDependencies,
  identityDependencies,
  invDependencies,
  matrixDependencies,
  multiplyDependencies,
  numberDependencies,
  typedDependencies,
  createPow: mathjsCreatePow,
};

const mathjsCreateCross: CompatFactoryExports['createCross'] = factories.createCross;
const crossDependencies: UnaryBundle<'createCross'> & {
  matrixDependencies: typeof matrixDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  subtractDependencies: typeof subtractDependencies;
} = {
  matrixDependencies,
  multiplyDependencies,
  subtractDependencies,
  typedDependencies,
  createCross: mathjsCreateCross,
};

const mathjsCreateDotPow: CompatFactoryExports['createDotPow'] = factories.createDotPow;
const dotPowDependencies: UnaryBundle<'createDotPow'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  powDependencies: typeof powDependencies;
} = {
  DenseMatrixDependencies,
  SparseMatrixDependencies,
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  powDependencies,
  typedDependencies,
  createDotPow: mathjsCreateDotPow,
};

const mathjsCreateSlu: CompatFactoryExports['createSlu'] = factories.createSlu;
const sluDependencies: UnaryBundle<'createSlu'> & {
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
  absDependencies: typeof absDependencies;
  addDependencies: typeof addDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  largerDependencies: typeof largerDependencies;
  largerEqDependencies: typeof largerEqDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  subtractDependencies: typeof subtractDependencies;
  transposeDependencies: typeof transposeDependencies;
} = {
  SparseMatrixDependencies,
  absDependencies,
  addDependencies,
  divideScalarDependencies,
  largerDependencies,
  largerEqDependencies,
  multiplyDependencies,
  subtractDependencies,
  transposeDependencies,
  typedDependencies,
  createSlu: mathjsCreateSlu,
};

const mathjsCreateUnitClass: CompatFactoryExports['createUnitClass'] = factories.createUnitClass;
const UnitDependencies: Pick<CompatFactoryExports, 'createUnitClass'> & {
  BigNumberDependencies: typeof BigNumberDependencies;
  ComplexDependencies: typeof ComplexDependencies;
  FractionDependencies: typeof FractionDependencies;
  absDependencies: typeof absDependencies;
  addScalarDependencies: typeof addScalarDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  equalDependencies: typeof equalDependencies;
  fixDependencies: typeof fixDependencies;
  formatDependencies: typeof formatDependencies;
  isNumericDependencies: typeof isNumericDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  numberDependencies: typeof numberDependencies;
  powDependencies: typeof powDependencies;
  roundDependencies: typeof roundDependencies;
  subtractScalarDependencies: typeof subtractScalarDependencies;
} = {
  BigNumberDependencies,
  ComplexDependencies,
  FractionDependencies,
  absDependencies,
  addScalarDependencies,
  divideScalarDependencies,
  equalDependencies,
  fixDependencies,
  formatDependencies,
  isNumericDependencies,
  multiplyScalarDependencies,
  numberDependencies,
  powDependencies,
  roundDependencies,
  subtractScalarDependencies,
  createUnitClass: mathjsCreateUnitClass,
};

const mathjsCreateUnitFunction: CompatFactoryExports['createUnitFunction'] =
  factories.createUnitFunction;
const unitDependencies: Pick<CompatFactoryExports, 'createUnitFunction'> & {
  UnitDependencies: typeof UnitDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  UnitDependencies,
  typedDependencies,
  createUnitFunction: mathjsCreateUnitFunction,
};

const mathjsCreateCreateUnit: CompatFactoryExports['createCreateUnit'] = factories.createCreateUnit;
const createUnitDependencies: Pick<CompatFactoryExports, 'createCreateUnit'> & {
  UnitDependencies: typeof UnitDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  UnitDependencies,
  typedDependencies,
  createCreateUnit: mathjsCreateCreateUnit,
};

const mathjsCreateSymbolNode: CompatFactoryExports['createSymbolNode'] = factories.createSymbolNode;
const SymbolNodeDependencies: Pick<CompatFactoryExports, 'createSymbolNode'> & {
  UnitDependencies: typeof UnitDependencies;
  NodeDependencies: typeof NodeDependencies;
} = {
  UnitDependencies,
  NodeDependencies,
  createSymbolNode: mathjsCreateSymbolNode,
};

const mathjsCreateFunctionNode: CompatFactoryExports['createFunctionNode'] =
  factories.createFunctionNode;
const FunctionNodeDependencies: Pick<CompatFactoryExports, 'createFunctionNode'> & {
  NodeDependencies: typeof NodeDependencies;
  SymbolNodeDependencies: typeof SymbolNodeDependencies;
} = {
  NodeDependencies,
  SymbolNodeDependencies,
  createFunctionNode: mathjsCreateFunctionNode,
};

const mathjsCreateAssignmentNode: CompatFactoryExports['createAssignmentNode'] =
  factories.createAssignmentNode;
const AssignmentNodeDependencies: Pick<CompatFactoryExports, 'createAssignmentNode'> & {
  matrixDependencies: typeof matrixDependencies;
  NodeDependencies: typeof NodeDependencies;
  subsetDependencies: typeof subsetDependencies;
} = {
  matrixDependencies,
  NodeDependencies,
  subsetDependencies,
  createAssignmentNode: mathjsCreateAssignmentNode,
};

const mathjsCreateParse: CompatFactoryExports['createParse'] = factories.createParse;
const parseDependencies: Pick<CompatFactoryExports, 'createParse'> & {
  AccessorNodeDependencies: typeof AccessorNodeDependencies;
  ArrayNodeDependencies: typeof ArrayNodeDependencies;
  AssignmentNodeDependencies: typeof AssignmentNodeDependencies;
  BlockNodeDependencies: typeof BlockNodeDependencies;
  ConditionalNodeDependencies: typeof ConditionalNodeDependencies;
  ConstantNodeDependencies: typeof ConstantNodeDependencies;
  FunctionAssignmentNodeDependencies: typeof FunctionAssignmentNodeDependencies;
  FunctionNodeDependencies: typeof FunctionNodeDependencies;
  IndexNodeDependencies: typeof IndexNodeDependencies;
  ObjectNodeDependencies: typeof ObjectNodeDependencies;
  OperatorNodeDependencies: typeof OperatorNodeDependencies;
  ParenthesisNodeDependencies: typeof ParenthesisNodeDependencies;
  RangeNodeDependencies: typeof RangeNodeDependencies;
  RelationalNodeDependencies: typeof RelationalNodeDependencies;
  SymbolNodeDependencies: typeof SymbolNodeDependencies;
  numericDependencies: typeof numericDependencies;
  typedDependencies: typeof typedDependencies;
} = {
  AccessorNodeDependencies,
  ArrayNodeDependencies,
  AssignmentNodeDependencies,
  BlockNodeDependencies,
  ConditionalNodeDependencies,
  ConstantNodeDependencies,
  FunctionAssignmentNodeDependencies,
  FunctionNodeDependencies,
  IndexNodeDependencies,
  ObjectNodeDependencies,
  OperatorNodeDependencies,
  ParenthesisNodeDependencies,
  RangeNodeDependencies,
  RelationalNodeDependencies,
  SymbolNodeDependencies,
  numericDependencies,
  typedDependencies,
  createParse: mathjsCreateParse,
};

const mathjsCreateCompile: CompatFactoryExports['createCompile'] = factories.createCompile;
const compileDependencies: UnaryBundle<'createCompile'> & {
  parseDependencies: typeof parseDependencies;
} = { parseDependencies, typedDependencies, createCompile: mathjsCreateCompile };

const mathjsCreateEvaluate: CompatFactoryExports['createEvaluate'] = factories.createEvaluate;
const evaluateDependencies: UnaryBundle<'createEvaluate'> & {
  parseDependencies: typeof parseDependencies;
} = { parseDependencies, typedDependencies, createEvaluate: mathjsCreateEvaluate };

const selectedCreateAtomicMass: CompatFactoryExports['createAtomicMass'] =
  factories.createAtomicMass;
const selectedCreateAvogadro: CompatFactoryExports['createAvogadro'] = factories.createAvogadro;
const selectedCreateBohrMagneton: CompatFactoryExports['createBohrMagneton'] =
  factories.createBohrMagneton;
const selectedCreateBohrRadius: CompatFactoryExports['createBohrRadius'] =
  factories.createBohrRadius;
const selectedCreateBoltzmann: CompatFactoryExports['createBoltzmann'] = factories.createBoltzmann;
const selectedCreateClassicalElectronRadius: CompatFactoryExports['createClassicalElectronRadius'] =
  factories.createClassicalElectronRadius;
const selectedCreateConductanceQuantum: CompatFactoryExports['createConductanceQuantum'] =
  factories.createConductanceQuantum;
const selectedCreateCoulomb: CompatFactoryExports['createCoulomb'] = factories.createCoulomb;
const selectedCreateCoulombConstant: CompatFactoryExports['createCoulombConstant'] =
  factories.createCoulombConstant;
const selectedCreateDeuteronMass: CompatFactoryExports['createDeuteronMass'] =
  factories.createDeuteronMass;
const selectedCreateEfimovFactor: CompatFactoryExports['createEfimovFactor'] =
  factories.createEfimovFactor;
const selectedCreateElectricConstant: CompatFactoryExports['createElectricConstant'] =
  factories.createElectricConstant;
const selectedCreateElectronMass: CompatFactoryExports['createElectronMass'] =
  factories.createElectronMass;
const selectedCreateElementaryCharge: CompatFactoryExports['createElementaryCharge'] =
  factories.createElementaryCharge;
const selectedCreateFaraday: CompatFactoryExports['createFaraday'] = factories.createFaraday;
const selectedCreateFermiCoupling: CompatFactoryExports['createFermiCoupling'] =
  factories.createFermiCoupling;
const selectedCreateFineStructure: CompatFactoryExports['createFineStructure'] =
  factories.createFineStructure;
const selectedCreateFirstRadiation: CompatFactoryExports['createFirstRadiation'] =
  factories.createFirstRadiation;
const selectedCreateGasConstant: CompatFactoryExports['createGasConstant'] =
  factories.createGasConstant;
const selectedCreateGravitationConstant: CompatFactoryExports['createGravitationConstant'] =
  factories.createGravitationConstant;
const selectedCreateGravity: CompatFactoryExports['createGravity'] = factories.createGravity;
const selectedCreateHartreeEnergy: CompatFactoryExports['createHartreeEnergy'] =
  factories.createHartreeEnergy;
const selectedCreateInverseConductanceQuantum: CompatFactoryExports['createInverseConductanceQuantum'] =
  factories.createInverseConductanceQuantum;
const selectedCreateKlitzing: CompatFactoryExports['createKlitzing'] = factories.createKlitzing;
const selectedCreateLoschmidt: CompatFactoryExports['createLoschmidt'] = factories.createLoschmidt;
const selectedCreateMagneticConstant: CompatFactoryExports['createMagneticConstant'] =
  factories.createMagneticConstant;
const selectedCreateMagneticFluxQuantum: CompatFactoryExports['createMagneticFluxQuantum'] =
  factories.createMagneticFluxQuantum;
const selectedCreateMolarMass: CompatFactoryExports['createMolarMass'] = factories.createMolarMass;
const selectedCreateMolarMassC12: CompatFactoryExports['createMolarMassC12'] =
  factories.createMolarMassC12;
const selectedCreateMolarPlanckConstant: CompatFactoryExports['createMolarPlanckConstant'] =
  factories.createMolarPlanckConstant;
const selectedCreateMolarVolume: CompatFactoryExports['createMolarVolume'] =
  factories.createMolarVolume;
const selectedCreateNeutronMass: CompatFactoryExports['createNeutronMass'] =
  factories.createNeutronMass;
const selectedCreateNuclearMagneton: CompatFactoryExports['createNuclearMagneton'] =
  factories.createNuclearMagneton;
const selectedCreatePlanckCharge: CompatFactoryExports['createPlanckCharge'] =
  factories.createPlanckCharge;
const selectedCreatePlanckConstant: CompatFactoryExports['createPlanckConstant'] =
  factories.createPlanckConstant;
const selectedCreatePlanckLength: CompatFactoryExports['createPlanckLength'] =
  factories.createPlanckLength;
const selectedCreatePlanckMass: CompatFactoryExports['createPlanckMass'] =
  factories.createPlanckMass;
const selectedCreatePlanckTemperature: CompatFactoryExports['createPlanckTemperature'] =
  factories.createPlanckTemperature;
const selectedCreatePlanckTime: CompatFactoryExports['createPlanckTime'] =
  factories.createPlanckTime;
const selectedCreateProtonMass: CompatFactoryExports['createProtonMass'] =
  factories.createProtonMass;
const selectedCreateQuantumOfCirculation: CompatFactoryExports['createQuantumOfCirculation'] =
  factories.createQuantumOfCirculation;
const selectedCreateReducedPlanckConstant: CompatFactoryExports['createReducedPlanckConstant'] =
  factories.createReducedPlanckConstant;
const selectedCreateRydberg: CompatFactoryExports['createRydberg'] = factories.createRydberg;
const selectedCreateSackurTetrode: CompatFactoryExports['createSackurTetrode'] =
  factories.createSackurTetrode;
const selectedCreateSecondRadiation: CompatFactoryExports['createSecondRadiation'] =
  factories.createSecondRadiation;
const selectedCreateSpeedOfLight: CompatFactoryExports['createSpeedOfLight'] =
  factories.createSpeedOfLight;
const selectedCreateStefanBoltzmann: CompatFactoryExports['createStefanBoltzmann'] =
  factories.createStefanBoltzmann;
const selectedCreateThomsonCrossSection: CompatFactoryExports['createThomsonCrossSection'] =
  factories.createThomsonCrossSection;
const selectedCreateVacuumImpedance: CompatFactoryExports['createVacuumImpedance'] =
  factories.createVacuumImpedance;
const selectedCreateWeakMixingAngle: CompatFactoryExports['createWeakMixingAngle'] =
  factories.createWeakMixingAngle;
const selectedCreateWienDisplacement: CompatFactoryExports['createWienDisplacement'] =
  factories.createWienDisplacement;

type NumericConstantBundle<Key extends keyof CompatFactoryExports> = Pick<
  CompatFactoryExports,
  Key
> &
  WithBigNumber;
type PhysicalConstantBundle<Key extends keyof CompatFactoryExports> = NumericConstantBundle<Key> & {
  UnitDependencies: typeof UnitDependencies;
};

const atomicMassDependencies: PhysicalConstantBundle<'createAtomicMass'> = {
  BigNumberDependencies,
  UnitDependencies,
  createAtomicMass: selectedCreateAtomicMass,
};

const avogadroDependencies: PhysicalConstantBundle<'createAvogadro'> = {
  BigNumberDependencies,
  UnitDependencies,
  createAvogadro: selectedCreateAvogadro,
};

const bohrMagnetonDependencies: PhysicalConstantBundle<'createBohrMagneton'> = {
  BigNumberDependencies,
  UnitDependencies,
  createBohrMagneton: selectedCreateBohrMagneton,
};

const bohrRadiusDependencies: PhysicalConstantBundle<'createBohrRadius'> = {
  BigNumberDependencies,
  UnitDependencies,
  createBohrRadius: selectedCreateBohrRadius,
};

const boltzmannDependencies: PhysicalConstantBundle<'createBoltzmann'> = {
  BigNumberDependencies,
  UnitDependencies,
  createBoltzmann: selectedCreateBoltzmann,
};

const classicalElectronRadiusDependencies: PhysicalConstantBundle<'createClassicalElectronRadius'> =
  {
    BigNumberDependencies,
    UnitDependencies,
    createClassicalElectronRadius: selectedCreateClassicalElectronRadius,
  };

const conductanceQuantumDependencies: PhysicalConstantBundle<'createConductanceQuantum'> = {
  BigNumberDependencies,
  UnitDependencies,
  createConductanceQuantum: selectedCreateConductanceQuantum,
};

const coulombDependencies: PhysicalConstantBundle<'createCoulomb'> = {
  BigNumberDependencies,
  UnitDependencies,
  createCoulomb: selectedCreateCoulomb,
};

const coulombConstantDependencies: PhysicalConstantBundle<'createCoulombConstant'> = {
  BigNumberDependencies,
  UnitDependencies,
  createCoulombConstant: selectedCreateCoulombConstant,
};

const deuteronMassDependencies: PhysicalConstantBundle<'createDeuteronMass'> = {
  BigNumberDependencies,
  UnitDependencies,
  createDeuteronMass: selectedCreateDeuteronMass,
};

const efimovFactorDependencies: NumericConstantBundle<'createEfimovFactor'> = {
  BigNumberDependencies,
  createEfimovFactor: selectedCreateEfimovFactor,
};

const electricConstantDependencies: PhysicalConstantBundle<'createElectricConstant'> = {
  BigNumberDependencies,
  UnitDependencies,
  createElectricConstant: selectedCreateElectricConstant,
};

const electronMassDependencies: PhysicalConstantBundle<'createElectronMass'> = {
  BigNumberDependencies,
  UnitDependencies,
  createElectronMass: selectedCreateElectronMass,
};

const elementaryChargeDependencies: PhysicalConstantBundle<'createElementaryCharge'> = {
  BigNumberDependencies,
  UnitDependencies,
  createElementaryCharge: selectedCreateElementaryCharge,
};

const faradayDependencies: PhysicalConstantBundle<'createFaraday'> = {
  BigNumberDependencies,
  UnitDependencies,
  createFaraday: selectedCreateFaraday,
};

const fermiCouplingDependencies: PhysicalConstantBundle<'createFermiCoupling'> = {
  BigNumberDependencies,
  UnitDependencies,
  createFermiCoupling: selectedCreateFermiCoupling,
};

const fineStructureDependencies: NumericConstantBundle<'createFineStructure'> = {
  BigNumberDependencies,
  createFineStructure: selectedCreateFineStructure,
};

const firstRadiationDependencies: PhysicalConstantBundle<'createFirstRadiation'> = {
  BigNumberDependencies,
  UnitDependencies,
  createFirstRadiation: selectedCreateFirstRadiation,
};

const gasConstantDependencies: PhysicalConstantBundle<'createGasConstant'> = {
  BigNumberDependencies,
  UnitDependencies,
  createGasConstant: selectedCreateGasConstant,
};

const gravitationConstantDependencies: PhysicalConstantBundle<'createGravitationConstant'> = {
  BigNumberDependencies,
  UnitDependencies,
  createGravitationConstant: selectedCreateGravitationConstant,
};

const gravityDependencies: PhysicalConstantBundle<'createGravity'> = {
  BigNumberDependencies,
  UnitDependencies,
  createGravity: selectedCreateGravity,
};

const hartreeEnergyDependencies: PhysicalConstantBundle<'createHartreeEnergy'> = {
  BigNumberDependencies,
  UnitDependencies,
  createHartreeEnergy: selectedCreateHartreeEnergy,
};

const inverseConductanceQuantumDependencies: PhysicalConstantBundle<'createInverseConductanceQuantum'> =
  {
    BigNumberDependencies,
    UnitDependencies,
    createInverseConductanceQuantum: selectedCreateInverseConductanceQuantum,
  };

const klitzingDependencies: PhysicalConstantBundle<'createKlitzing'> = {
  BigNumberDependencies,
  UnitDependencies,
  createKlitzing: selectedCreateKlitzing,
};

const loschmidtDependencies: PhysicalConstantBundle<'createLoschmidt'> = {
  BigNumberDependencies,
  UnitDependencies,
  createLoschmidt: selectedCreateLoschmidt,
};

const magneticConstantDependencies: PhysicalConstantBundle<'createMagneticConstant'> = {
  BigNumberDependencies,
  UnitDependencies,
  createMagneticConstant: selectedCreateMagneticConstant,
};

const magneticFluxQuantumDependencies: PhysicalConstantBundle<'createMagneticFluxQuantum'> = {
  BigNumberDependencies,
  UnitDependencies,
  createMagneticFluxQuantum: selectedCreateMagneticFluxQuantum,
};

const molarMassDependencies: PhysicalConstantBundle<'createMolarMass'> = {
  BigNumberDependencies,
  UnitDependencies,
  createMolarMass: selectedCreateMolarMass,
};

const molarMassC12Dependencies: PhysicalConstantBundle<'createMolarMassC12'> = {
  BigNumberDependencies,
  UnitDependencies,
  createMolarMassC12: selectedCreateMolarMassC12,
};

const molarPlanckConstantDependencies: PhysicalConstantBundle<'createMolarPlanckConstant'> = {
  BigNumberDependencies,
  UnitDependencies,
  createMolarPlanckConstant: selectedCreateMolarPlanckConstant,
};

const molarVolumeDependencies: PhysicalConstantBundle<'createMolarVolume'> = {
  BigNumberDependencies,
  UnitDependencies,
  createMolarVolume: selectedCreateMolarVolume,
};

const neutronMassDependencies: PhysicalConstantBundle<'createNeutronMass'> = {
  BigNumberDependencies,
  UnitDependencies,
  createNeutronMass: selectedCreateNeutronMass,
};

const nuclearMagnetonDependencies: PhysicalConstantBundle<'createNuclearMagneton'> = {
  BigNumberDependencies,
  UnitDependencies,
  createNuclearMagneton: selectedCreateNuclearMagneton,
};

const planckChargeDependencies: PhysicalConstantBundle<'createPlanckCharge'> = {
  BigNumberDependencies,
  UnitDependencies,
  createPlanckCharge: selectedCreatePlanckCharge,
};

const planckConstantDependencies: PhysicalConstantBundle<'createPlanckConstant'> = {
  BigNumberDependencies,
  UnitDependencies,
  createPlanckConstant: selectedCreatePlanckConstant,
};

const planckLengthDependencies: PhysicalConstantBundle<'createPlanckLength'> = {
  BigNumberDependencies,
  UnitDependencies,
  createPlanckLength: selectedCreatePlanckLength,
};

const planckMassDependencies: PhysicalConstantBundle<'createPlanckMass'> = {
  BigNumberDependencies,
  UnitDependencies,
  createPlanckMass: selectedCreatePlanckMass,
};

const planckTemperatureDependencies: PhysicalConstantBundle<'createPlanckTemperature'> = {
  BigNumberDependencies,
  UnitDependencies,
  createPlanckTemperature: selectedCreatePlanckTemperature,
};

const planckTimeDependencies: PhysicalConstantBundle<'createPlanckTime'> = {
  BigNumberDependencies,
  UnitDependencies,
  createPlanckTime: selectedCreatePlanckTime,
};

const protonMassDependencies: PhysicalConstantBundle<'createProtonMass'> = {
  BigNumberDependencies,
  UnitDependencies,
  createProtonMass: selectedCreateProtonMass,
};

const quantumOfCirculationDependencies: PhysicalConstantBundle<'createQuantumOfCirculation'> = {
  BigNumberDependencies,
  UnitDependencies,
  createQuantumOfCirculation: selectedCreateQuantumOfCirculation,
};

const reducedPlanckConstantDependencies: PhysicalConstantBundle<'createReducedPlanckConstant'> = {
  BigNumberDependencies,
  UnitDependencies,
  createReducedPlanckConstant: selectedCreateReducedPlanckConstant,
};

const rydbergDependencies: PhysicalConstantBundle<'createRydberg'> = {
  BigNumberDependencies,
  UnitDependencies,
  createRydberg: selectedCreateRydberg,
};

const sackurTetrodeDependencies: NumericConstantBundle<'createSackurTetrode'> = {
  BigNumberDependencies,
  createSackurTetrode: selectedCreateSackurTetrode,
};

const secondRadiationDependencies: PhysicalConstantBundle<'createSecondRadiation'> = {
  BigNumberDependencies,
  UnitDependencies,
  createSecondRadiation: selectedCreateSecondRadiation,
};

const speedOfLightDependencies: PhysicalConstantBundle<'createSpeedOfLight'> = {
  BigNumberDependencies,
  UnitDependencies,
  createSpeedOfLight: selectedCreateSpeedOfLight,
};

const stefanBoltzmannDependencies: PhysicalConstantBundle<'createStefanBoltzmann'> = {
  BigNumberDependencies,
  UnitDependencies,
  createStefanBoltzmann: selectedCreateStefanBoltzmann,
};

const thomsonCrossSectionDependencies: PhysicalConstantBundle<'createThomsonCrossSection'> = {
  BigNumberDependencies,
  UnitDependencies,
  createThomsonCrossSection: selectedCreateThomsonCrossSection,
};

const vacuumImpedanceDependencies: PhysicalConstantBundle<'createVacuumImpedance'> = {
  BigNumberDependencies,
  UnitDependencies,
  createVacuumImpedance: selectedCreateVacuumImpedance,
};

const weakMixingAngleDependencies: NumericConstantBundle<'createWeakMixingAngle'> = {
  BigNumberDependencies,
  createWeakMixingAngle: selectedCreateWeakMixingAngle,
};

const wienDisplacementDependencies: PhysicalConstantBundle<'createWienDisplacement'> = {
  BigNumberDependencies,
  UnitDependencies,
  createWienDisplacement: selectedCreateWienDisplacement,
};

const mathjsCreateLeafCount: CompatFactoryExports['createLeafCount'] = factories.createLeafCount;
const leafCountDependencies: UnaryBundle<'createLeafCount'> & {
  parseDependencies: typeof parseDependencies;
} = {
  parseDependencies,
  typedDependencies,
  createLeafCount: mathjsCreateLeafCount,
};

const mathjsCreatePinv: CompatFactoryExports['createPinv'] = factories.createPinv;
const pinvDependencies: UnaryBundle<'createPinv'> & {
  ComplexDependencies: typeof ComplexDependencies;
  addDependencies: typeof addDependencies;
  ctransposeDependencies: typeof ctransposeDependencies;
  deepEqualDependencies: typeof deepEqualDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  dotDependencies: typeof dotDependencies;
  dotDivideDependencies: typeof dotDivideDependencies;
  equalDependencies: typeof equalDependencies;
  invDependencies: typeof invDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyDependencies: typeof multiplyDependencies;
} = {
  ComplexDependencies,
  addDependencies,
  ctransposeDependencies,
  deepEqualDependencies,
  divideScalarDependencies,
  dotDependencies,
  dotDivideDependencies,
  equalDependencies,
  invDependencies,
  matrixDependencies,
  multiplyDependencies,
  typedDependencies,
  createPinv: mathjsCreatePinv,
};

const mathjsCreateZpk2tf: CompatFactoryExports['createZpk2tf'] = factories.createZpk2tf;
const zpk2tfDependencies: UnaryBundle<'createZpk2tf'> & {
  ComplexDependencies: typeof ComplexDependencies;
  addDependencies: typeof addDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  numberDependencies: typeof numberDependencies;
} = {
  ComplexDependencies,
  addDependencies,
  multiplyDependencies,
  numberDependencies,
  typedDependencies,
  createZpk2tf: mathjsCreateZpk2tf,
};

const mathjsCreateTo: CompatFactoryExports['createTo'] = factories.createTo;
const toDependencies: UnaryBundle<'createTo'> & {
  concatDependencies: typeof concatDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  concatDependencies,
  matrixDependencies,
  typedDependencies,
  createTo: mathjsCreateTo,
};

const mathjsCreateToBest: CompatFactoryExports['createToBest'] = factories.createToBest;
const toBestDependencies: UnaryBundle<'createToBest'> = {
  typedDependencies,
  createToBest: mathjsCreateToBest,
};

const mathjsCreateSplitUnit: CompatFactoryExports['createSplitUnit'] = factories.createSplitUnit;
const splitUnitDependencies: UnaryBundle<'createSplitUnit'> = {
  typedDependencies,
  createSplitUnit: mathjsCreateSplitUnit,
};

const mathjsCreateSparse: CompatFactoryExports['createSparse'] = factories.createSparse;
const sparseDependencies: UnaryBundle<'createSparse'> & {
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
} = { SparseMatrixDependencies, typedDependencies, createSparse: mathjsCreateSparse };

const mathjsCreateIntersect: CompatFactoryExports['createIntersect'] = factories.createIntersect;
const intersectDependencies: UnaryBundle<'createIntersect'> & {
  absDependencies: typeof absDependencies;
  addDependencies: typeof addDependencies;
  addScalarDependencies: typeof addScalarDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  flattenDependencies: typeof flattenDependencies;
  isNumericDependencies: typeof isNumericDependencies;
  isZeroDependencies: typeof isZeroDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  smallerDependencies: typeof smallerDependencies;
  subtractDependencies: typeof subtractDependencies;
} = {
  absDependencies,
  addDependencies,
  addScalarDependencies,
  divideScalarDependencies,
  equalScalarDependencies,
  flattenDependencies,
  isNumericDependencies,
  isZeroDependencies,
  matrixDependencies,
  multiplyDependencies,
  multiplyScalarDependencies,
  smallerDependencies,
  subtractDependencies,
  typedDependencies,
  createIntersect: mathjsCreateIntersect,
};

const mathjsCreateResolve: CompatFactoryExports['createResolve'] = factories.createResolve;
const resolveDependencies: UnaryBundle<'createResolve'> & {
  ConstantNodeDependencies: typeof ConstantNodeDependencies;
  FunctionNodeDependencies: typeof FunctionNodeDependencies;
  OperatorNodeDependencies: typeof OperatorNodeDependencies;
  ParenthesisNodeDependencies: typeof ParenthesisNodeDependencies;
  parseDependencies: typeof parseDependencies;
} = {
  ConstantNodeDependencies,
  FunctionNodeDependencies,
  OperatorNodeDependencies,
  ParenthesisNodeDependencies,
  parseDependencies,
  typedDependencies,
  createResolve: mathjsCreateResolve,
};

const mathjsCreateSetUnion: CompatFactoryExports['createSetUnion'] = factories.createSetUnion;
const setUnionDependencies: UnaryBundle<'createSetUnion'> & {
  IndexDependencies: typeof IndexDependencies;
  concatDependencies: typeof concatDependencies;
  setIntersectDependencies: typeof setIntersectDependencies;
  setSymDifferenceDependencies: typeof setSymDifferenceDependencies;
  sizeDependencies: typeof sizeDependencies;
  subsetDependencies: typeof subsetDependencies;
} = {
  IndexDependencies,
  concatDependencies,
  setIntersectDependencies,
  setSymDifferenceDependencies,
  sizeDependencies,
  subsetDependencies,
  typedDependencies,
  createSetUnion: mathjsCreateSetUnion,
};

const mathjsCreateDivide: CompatFactoryExports['createDivide'] = factories.createDivide;
const divideDependencies: UnaryBundle<'createDivide'> & {
  divideScalarDependencies: typeof divideScalarDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  invDependencies: typeof invDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyDependencies: typeof multiplyDependencies;
} = {
  divideScalarDependencies,
  equalScalarDependencies,
  invDependencies,
  matrixDependencies,
  multiplyDependencies,
  typedDependencies,
  createDivide: mathjsCreateDivide,
};

const mathjsCreateMean: CompatFactoryExports['createMean'] = factories.createMean;
const meanDependencies: UnaryBundle<'createMean'> & {
  addDependencies: typeof addDependencies;
  divideDependencies: typeof divideDependencies;
} = {
  addDependencies,
  divideDependencies,
  typedDependencies,
  createMean: mathjsCreateMean,
};

const mathjsCreatePolynomialRoot: CompatFactoryExports['createPolynomialRoot'] =
  factories.createPolynomialRoot;
const polynomialRootDependencies: UnaryBundle<'createPolynomialRoot'> & {
  addDependencies: typeof addDependencies;
  cbrtDependencies: typeof cbrtDependencies;
  divideDependencies: typeof divideDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  imDependencies: typeof imDependencies;
  isZeroDependencies: typeof isZeroDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  reDependencies: typeof reDependencies;
  sqrtDependencies: typeof sqrtDependencies;
  subtractDependencies: typeof subtractDependencies;
  typeOfDependencies: typeof typeOfDependencies;
  unaryMinusDependencies: typeof unaryMinusDependencies;
} = {
  addDependencies,
  cbrtDependencies,
  divideDependencies,
  equalScalarDependencies,
  imDependencies,
  isZeroDependencies,
  multiplyDependencies,
  reDependencies,
  sqrtDependencies,
  subtractDependencies,
  typeOfDependencies,
  typedDependencies,
  unaryMinusDependencies,
  createPolynomialRoot: mathjsCreatePolynomialRoot,
};

const mathjsCreateCombinations: CompatFactoryExports['createCombinations'] =
  factories.createCombinations;
const combinationsDependencies: UnaryBundle<'createCombinations'> = {
  typedDependencies,
  createCombinations: mathjsCreateCombinations,
};

const mathjsCreateCombinationsWithRep: CompatFactoryExports['createCombinationsWithRep'] =
  factories.createCombinationsWithRep;
const combinationsWithRepDependencies: UnaryBundle<'createCombinationsWithRep'> = {
  typedDependencies,
  createCombinationsWithRep: mathjsCreateCombinationsWithRep,
};

type FractionPartFactoryDependencies = {
  typed: NonNullable<Parameters<typeof fractionPart>[2]>;
  fraction: NonNullable<Parameters<typeof fractionPart>[3]>;
};

const createNum: ConstructorFactory<ReturnType<typeof fractionPart>> = /* #__PURE__ */ factory(
  'num',
  ['typed', 'fraction'],
  ({ typed, fraction }: FractionPartFactoryDependencies) =>
    fractionPart('num', 'numerator', typed, fraction)
);

const createDen: ConstructorFactory<ReturnType<typeof fractionPart>> = /* #__PURE__ */ factory(
  'den',
  ['typed', 'fraction'],
  ({ typed, fraction }: FractionPartFactoryDependencies) =>
    fractionPart('den', 'denominator', typed, fraction)
);

type FractionPartBundle = {
  fractionDependencies: typeof fractionDependencies;
  typedDependencies: typeof typedDependencies;
};

const numDependencies: FractionPartBundle & { createNum: typeof createNum } = {
  fractionDependencies,
  typedDependencies,
  createNum,
};
const denDependencies: FractionPartBundle & { createDen: typeof createDen } = {
  fractionDependencies,
  typedDependencies,
  createDen,
};

const createRangeClass: ConstructorFactory<(typeof instanceSymbols)['Range']> =
  /* #__PURE__ */ factory('Range', [], () => instanceSymbols.Range, { isClass: true });
const RangeDependencies: { createRangeClass: typeof createRangeClass } = { createRangeClass };

const createReplacer: ConstructorFactory<typeof replacer> = /* #__PURE__ */ factory(
  'replacer',
  [],
  () => replacer
);
const replacerDependencies: { createReplacer: typeof createReplacer } = { createReplacer };

const mathjsCreateMapTransform: CompatFactoryExports['createMapTransform'] =
  factories.createMapTransform;
const mapTransformDependencies: UnaryBundle<'createMapTransform'> = {
  typedDependencies,
  createMapTransform: mathjsCreateMapTransform,
};

const mathjsCreateFilterTransform: CompatFactoryExports['createFilterTransform'] =
  factories.createFilterTransform;
const filterTransformDependencies: UnaryBundle<'createFilterTransform'> = {
  typedDependencies,
  createFilterTransform: mathjsCreateFilterTransform,
};

const mathjsCreateForEachTransform: CompatFactoryExports['createForEachTransform'] =
  factories.createForEachTransform;
const forEachTransformDependencies: UnaryBundle<'createForEachTransform'> = {
  typedDependencies,
  createForEachTransform: mathjsCreateForEachTransform,
};

const mathjsCreateMinTransform: CompatFactoryExports['createMinTransform'] =
  factories.createMinTransform;
const minTransformDependencies: UnaryBundle<'createMinTransform'> & {
  isNaNDependencies: typeof isNaNDependencies;
  numericDependencies: typeof numericDependencies;
  smallerDependencies: typeof smallerDependencies;
} = {
  isNaNDependencies,
  numericDependencies,
  smallerDependencies,
  typedDependencies,
  createMinTransform: mathjsCreateMinTransform,
};

const mathjsCreateMaxTransform: CompatFactoryExports['createMaxTransform'] =
  factories.createMaxTransform;
const maxTransformDependencies: UnaryBundle<'createMaxTransform'> & {
  isNaNDependencies: typeof isNaNDependencies;
  largerDependencies: typeof largerDependencies;
  numericDependencies: typeof numericDependencies;
} = {
  isNaNDependencies,
  largerDependencies,
  numericDependencies,
  typedDependencies,
  createMaxTransform: mathjsCreateMaxTransform,
};

const mathjsCreateSumTransform: CompatFactoryExports['createSumTransform'] =
  factories.createSumTransform;
const sumTransformDependencies: UnaryBundle<'createSumTransform'> & {
  addDependencies: typeof addDependencies;
  numericDependencies: typeof numericDependencies;
} = {
  addDependencies,
  numericDependencies,
  typedDependencies,
  createSumTransform: mathjsCreateSumTransform,
};

const mathjsCreateCumSumTransform: CompatFactoryExports['createCumSumTransform'] =
  factories.createCumSumTransform;
const cumsumTransformDependencies: UnaryBundle<'createCumSumTransform'> & {
  addDependencies: typeof addDependencies;
  unaryPlusDependencies: typeof unaryPlusDependencies;
} = {
  addDependencies,
  typedDependencies,
  unaryPlusDependencies,
  createCumSumTransform: mathjsCreateCumSumTransform,
};

const mathjsCreateMapSlicesTransform: CompatFactoryExports['createMapSlicesTransform'] =
  factories.createMapSlicesTransform;
const mapSlicesTransformDependencies: UnaryBundle<'createMapSlicesTransform'> & {
  isIntegerDependencies: typeof isIntegerDependencies;
} = {
  isIntegerDependencies,
  typedDependencies,
  createMapSlicesTransform: mathjsCreateMapSlicesTransform,
};

const mathjsCreateMeanTransform: CompatFactoryExports['createMeanTransform'] =
  factories.createMeanTransform;
const meanTransformDependencies: UnaryBundle<'createMeanTransform'> & {
  addDependencies: typeof addDependencies;
  divideDependencies: typeof divideDependencies;
} = {
  addDependencies,
  divideDependencies,
  typedDependencies,
  createMeanTransform: mathjsCreateMeanTransform,
};

const mathjsCreateOrTransform: CompatFactoryExports['createOrTransform'] =
  factories.createOrTransform;
const orTransformDependencies: UnaryBundle<'createOrTransform'> & {
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
  createOrTransform: mathjsCreateOrTransform,
};

const mathjsCreateBitOrTransform: CompatFactoryExports['createBitOrTransform'] =
  factories.createBitOrTransform;
const bitOrTransformDependencies: UnaryBundle<'createBitOrTransform'> & {
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
  createBitOrTransform: mathjsCreateBitOrTransform,
};

const mathjsCreateNullishTransform: CompatFactoryExports['createNullishTransform'] =
  factories.createNullishTransform;
const nullishTransformDependencies: UnaryBundle<'createNullishTransform'> & {
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
  createNullishTransform: mathjsCreateNullishTransform,
};

const mathjsCreateColumnTransform: CompatFactoryExports['createColumnTransform'] =
  factories.createColumnTransform;
const columnTransformDependencies: UnaryBundle<'createColumnTransform'> & {
  IndexDependencies: typeof IndexDependencies;
  matrixDependencies: typeof matrixDependencies;
  rangeDependencies: typeof rangeDependencies;
} = {
  IndexDependencies,
  matrixDependencies,
  rangeDependencies,
  typedDependencies,
  createColumnTransform: mathjsCreateColumnTransform,
};

const mathjsCreateRowTransform: CompatFactoryExports['createRowTransform'] =
  factories.createRowTransform;
const rowTransformDependencies: UnaryBundle<'createRowTransform'> & {
  IndexDependencies: typeof IndexDependencies;
  matrixDependencies: typeof matrixDependencies;
  rangeDependencies: typeof rangeDependencies;
} = {
  IndexDependencies,
  matrixDependencies,
  rangeDependencies,
  typedDependencies,
  createRowTransform: mathjsCreateRowTransform,
};

const mathjsCreateConcatTransform: CompatFactoryExports['createConcatTransform'] =
  factories.createConcatTransform;
const concatTransformDependencies: UnaryBundle<'createConcatTransform'> & {
  isIntegerDependencies: typeof isIntegerDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  isIntegerDependencies,
  matrixDependencies,
  typedDependencies,
  createConcatTransform: mathjsCreateConcatTransform,
};

const mathjsCreateAndTransform: CompatFactoryExports['createAndTransform'] =
  factories.createAndTransform;
const andTransformDependencies: UnaryBundle<'createAndTransform'> & {
  addDependencies: typeof addDependencies;
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  notDependencies: typeof notDependencies;
  zerosDependencies: typeof zerosDependencies;
} = {
  addDependencies,
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  notDependencies,
  typedDependencies,
  zerosDependencies,
  createAndTransform: mathjsCreateAndTransform,
};

const mathjsCreateBitAndTransform: CompatFactoryExports['createBitAndTransform'] =
  factories.createBitAndTransform;
const bitAndTransformDependencies: UnaryBundle<'createBitAndTransform'> & {
  addDependencies: typeof addDependencies;
  concatDependencies: typeof concatDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  matrixDependencies: typeof matrixDependencies;
  notDependencies: typeof notDependencies;
  zerosDependencies: typeof zerosDependencies;
} = {
  addDependencies,
  concatDependencies,
  equalScalarDependencies,
  matrixDependencies,
  notDependencies,
  typedDependencies,
  zerosDependencies,
  createBitAndTransform: mathjsCreateBitAndTransform,
};

const mathjsCreateDiffTransform: CompatFactoryExports['createDiffTransform'] =
  factories.createDiffTransform;
const diffTransformDependencies: UnaryBundle<'createDiffTransform'> & {
  bignumberDependencies: typeof bignumberDependencies;
  matrixDependencies: typeof matrixDependencies;
  numberDependencies: typeof numberDependencies;
  subtractDependencies: typeof subtractDependencies;
} = {
  bignumberDependencies,
  matrixDependencies,
  numberDependencies,
  subtractDependencies,
  typedDependencies,
  createDiffTransform: mathjsCreateDiffTransform,
};

const mathjsCreateSubsetTransform: CompatFactoryExports['createSubsetTransform'] =
  factories.createSubsetTransform;
const subsetTransformDependencies: UnaryBundle<'createSubsetTransform'> & {
  addDependencies: typeof addDependencies;
  matrixDependencies: typeof matrixDependencies;
  zerosDependencies: typeof zerosDependencies;
} = {
  addDependencies,
  matrixDependencies,
  typedDependencies,
  zerosDependencies,
  createSubsetTransform: mathjsCreateSubsetTransform,
};

const mathjsCreatePrintTransform: CompatFactoryExports['createPrintTransform'] =
  factories.createPrintTransform;
const printTransformDependencies: UnaryBundle<'createPrintTransform'> & {
  addDependencies: typeof addDependencies;
  matrixDependencies: typeof matrixDependencies;
  zerosDependencies: typeof zerosDependencies;
} = {
  addDependencies,
  matrixDependencies,
  typedDependencies,
  zerosDependencies,
  createPrintTransform: mathjsCreatePrintTransform,
};

const mathjsCreateRangeTransform: CompatFactoryExports['createRangeTransform'] =
  factories.createRangeTransform;
const rangeTransformDependencies: UnaryBundle<'createRangeTransform'> & {
  bignumberDependencies: typeof bignumberDependencies;
  matrixDependencies: typeof matrixDependencies;
  addDependencies: typeof addDependencies;
  equalDependencies: typeof equalDependencies;
  isPositiveDependencies: typeof isPositiveDependencies;
  isZeroDependencies: typeof isZeroDependencies;
  largerDependencies: typeof largerDependencies;
  largerEqDependencies: typeof largerEqDependencies;
  smallerDependencies: typeof smallerDependencies;
  smallerEqDependencies: typeof smallerEqDependencies;
} = {
  bignumberDependencies,
  matrixDependencies,
  addDependencies,
  equalDependencies,
  isPositiveDependencies,
  isZeroDependencies,
  largerDependencies,
  largerEqDependencies,
  smallerDependencies,
  smallerEqDependencies,
  typedDependencies,
  createRangeTransform: mathjsCreateRangeTransform,
};

const mathjsCreateIndexTransform: CompatFactoryExports['createIndexTransform'] =
  factories.createIndexTransform;
const indexTransformDependencies: { createIndexTransform: typeof mathjsCreateIndexTransform } & {
  IndexDependencies: typeof IndexDependencies;
  getMatrixDataTypeDependencies: typeof getMatrixDataTypeDependencies;
} = {
  IndexDependencies,
  getMatrixDataTypeDependencies,
  createIndexTransform: mathjsCreateIndexTransform,
};

const mathjsCreateFreqz: CompatFactoryExports['createFreqz'] = factories.createFreqz;
const freqzDependencies: UnaryBundle<'createFreqz'> & {
  ComplexDependencies: typeof ComplexDependencies;
  addDependencies: typeof addDependencies;
  divideDependencies: typeof divideDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyDependencies: typeof multiplyDependencies;
} = {
  ComplexDependencies,
  addDependencies,
  divideDependencies,
  matrixDependencies,
  multiplyDependencies,
  typedDependencies,
  createFreqz: mathjsCreateFreqz,
};

const mathjsCreateKldivergence: CompatFactoryExports['createKldivergence'] =
  factories.createKldivergence;
const kldivergenceDependencies: UnaryBundle<'createKldivergence'> & {
  divideDependencies: typeof divideDependencies;
  dotDivideDependencies: typeof dotDivideDependencies;
  isNumericDependencies: typeof isNumericDependencies;
  logDependencies: typeof logDependencies;
  mapDependencies: typeof mapDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  sumDependencies: typeof sumDependencies;
} = {
  divideDependencies,
  dotDivideDependencies,
  isNumericDependencies,
  logDependencies,
  mapDependencies,
  matrixDependencies,
  multiplyDependencies,
  sumDependencies,
  typedDependencies,
  createKldivergence: mathjsCreateKldivergence,
};

const mathjsCreateComposition: CompatFactoryExports['createComposition'] =
  factories.createComposition;
const compositionDependencies: UnaryBundle<'createComposition'> & {
  addScalarDependencies: typeof addScalarDependencies;
  combinationsDependencies: typeof combinationsDependencies;
  isIntegerDependencies: typeof isIntegerDependencies;
  isNegativeDependencies: typeof isNegativeDependencies;
  isPositiveDependencies: typeof isPositiveDependencies;
  largerDependencies: typeof largerDependencies;
} = {
  addScalarDependencies,
  combinationsDependencies,
  isIntegerDependencies,
  isNegativeDependencies,
  isPositiveDependencies,
  largerDependencies,
  typedDependencies,
  createComposition: mathjsCreateComposition,
};

const mathjsCreateParserClass: CompatFactoryExports['createParserClass'] =
  factories.createParserClass;
const ParserDependencies: Pick<CompatFactoryExports, 'createParserClass'> & {
  evaluateDependencies: typeof evaluateDependencies;
  parseDependencies: typeof parseDependencies;
} = {
  evaluateDependencies,
  parseDependencies,
  createParserClass: mathjsCreateParserClass,
};

const mathjsCreateParser: CompatFactoryExports['createParser'] = factories.createParser;
const parserDependencies: UnaryBundle<'createParser'> & {
  ParserDependencies: typeof ParserDependencies;
} = {
  ParserDependencies,
  typedDependencies,
  createParser: mathjsCreateParser,
};

const mathjsCreateHelpClass: CompatFactoryExports['createHelpClass'] = factories.createHelpClass;
const HelpDependencies: Pick<CompatFactoryExports, 'createHelpClass'> & {
  evaluateDependencies: typeof evaluateDependencies;
} = {
  evaluateDependencies,
  createHelpClass: mathjsCreateHelpClass,
};

type HelpFactoryDependencies = {
  typed: (
    name: string,
    signatures: { any: (search: unknown) => unknown }
  ) => (search: unknown) => unknown;
  mathWithTransform: Record<string, unknown>;
  Help: new (doc: unknown) => unknown;
};

const createHelp: ConstructorFactory<(search: unknown) => unknown> = /* #__PURE__ */ factory(
  'help',
  ['typed', 'mathWithTransform', 'Help'],
  ({ typed, mathWithTransform, Help }: HelpFactoryDependencies) =>
    typed('help', {
      any: (search) => {
        const name =
          typeof search === 'string'
            ? search
            : Object.keys(mathWithTransform).find((key) => mathWithTransform[key] === search);
        if (name === undefined) {
          const label = typeof search === 'function' ? search.name : String(search);
          throw new Error(`No documentation found on "${label}"`);
        }
        return new Help(nativeHelp(name).doc);
      },
    })
);

const helpDependencies: {
  HelpDependencies: typeof HelpDependencies;
  typedDependencies: typeof typedDependencies;
  createHelp: typeof createHelp;
} = { HelpDependencies, typedDependencies, createHelp };

const mathjsCreateBigint: CompatFactoryExports['createBigint'] = factories.createBigint;
const bigintDependencies: UnaryBundle<'createBigint'> = {
  typedDependencies,
  createBigint: mathjsCreateBigint,
};

const mathjsCreateBoolean: CompatFactoryExports['createBoolean'] = factories.createBoolean;
const booleanDependencies: UnaryBundle<'createBoolean'> = {
  typedDependencies,
  createBoolean: mathjsCreateBoolean,
};

const mathjsCreateString: CompatFactoryExports['createString'] = factories.createString;
const stringDependencies: UnaryBundle<'createString'> = {
  typedDependencies,
  createString: mathjsCreateString,
};

const createVersion: ConstructorFactory<string> = /* #__PURE__ */ factory(
  'version',
  [],
  () => instanceSymbols.version
);
const versionDependencies: { createVersion: typeof createVersion } = { createVersion };

const createReviver: ConstructorFactory<(_key: string, value: unknown) => unknown> =
  /* #__PURE__ */ factory(
    'reviver',
    ['classes'],
    ({ classes }: { classes: Record<string, unknown> }) =>
      (_key: string, value: unknown): unknown =>
        reviveWithClasses(value, classes)
  );
const reviverDependencies: { createReviver: typeof createReviver } = { createReviver };

const mathjsCreateSimplifyCore: CompatFactoryExports['createSimplifyCore'] =
  factories.createSimplifyCore;
const simplifyCoreDependencies: UnaryBundle<'createSimplifyCore'> & {
  AccessorNodeDependencies: typeof AccessorNodeDependencies;
  ArrayNodeDependencies: typeof ArrayNodeDependencies;
  ConstantNodeDependencies: typeof ConstantNodeDependencies;
  FunctionNodeDependencies: typeof FunctionNodeDependencies;
  IndexNodeDependencies: typeof IndexNodeDependencies;
  ObjectNodeDependencies: typeof ObjectNodeDependencies;
  OperatorNodeDependencies: typeof OperatorNodeDependencies;
  ParenthesisNodeDependencies: typeof ParenthesisNodeDependencies;
  SymbolNodeDependencies: typeof SymbolNodeDependencies;
  addDependencies: typeof addDependencies;
  divideDependencies: typeof divideDependencies;
  equalDependencies: typeof equalDependencies;
  isZeroDependencies: typeof isZeroDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  parseDependencies: typeof parseDependencies;
  powDependencies: typeof powDependencies;
  subtractDependencies: typeof subtractDependencies;
} = {
  AccessorNodeDependencies,
  ArrayNodeDependencies,
  ConstantNodeDependencies,
  FunctionNodeDependencies,
  IndexNodeDependencies,
  ObjectNodeDependencies,
  OperatorNodeDependencies,
  ParenthesisNodeDependencies,
  SymbolNodeDependencies,
  addDependencies,
  divideDependencies,
  equalDependencies,
  isZeroDependencies,
  multiplyDependencies,
  parseDependencies,
  powDependencies,
  subtractDependencies,
  typedDependencies,
  createSimplifyCore: mathjsCreateSimplifyCore,
};

const mathjsCreateSimplifyConstant: CompatFactoryExports['createSimplifyConstant'] =
  factories.createSimplifyConstant;
const simplifyConstantDependencies: UnaryBundle<'createSimplifyConstant'> & {
  bignumberDependencies: typeof bignumberDependencies;
  fractionDependencies: typeof fractionDependencies;
  AccessorNodeDependencies: typeof AccessorNodeDependencies;
  ArrayNodeDependencies: typeof ArrayNodeDependencies;
  ConstantNodeDependencies: typeof ConstantNodeDependencies;
  FunctionNodeDependencies: typeof FunctionNodeDependencies;
  IndexNodeDependencies: typeof IndexNodeDependencies;
  ObjectNodeDependencies: typeof ObjectNodeDependencies;
  OperatorNodeDependencies: typeof OperatorNodeDependencies;
  SymbolNodeDependencies: typeof SymbolNodeDependencies;
  isBoundedDependencies: typeof isBoundedDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  bignumberDependencies,
  fractionDependencies,
  AccessorNodeDependencies,
  ArrayNodeDependencies,
  ConstantNodeDependencies,
  FunctionNodeDependencies,
  IndexNodeDependencies,
  ObjectNodeDependencies,
  OperatorNodeDependencies,
  SymbolNodeDependencies,
  isBoundedDependencies,
  matrixDependencies,
  typedDependencies,
  createSimplifyConstant: mathjsCreateSimplifyConstant,
};

const mathjsCreateSimplify: CompatFactoryExports['createSimplify'] = factories.createSimplify;
const simplifyDependencies: UnaryBundle<'createSimplify'> & {
  AccessorNodeDependencies: typeof AccessorNodeDependencies;
  ArrayNodeDependencies: typeof ArrayNodeDependencies;
  ConstantNodeDependencies: typeof ConstantNodeDependencies;
  FunctionNodeDependencies: typeof FunctionNodeDependencies;
  IndexNodeDependencies: typeof IndexNodeDependencies;
  ObjectNodeDependencies: typeof ObjectNodeDependencies;
  OperatorNodeDependencies: typeof OperatorNodeDependencies;
  ParenthesisNodeDependencies: typeof ParenthesisNodeDependencies;
  SymbolNodeDependencies: typeof SymbolNodeDependencies;
  equalDependencies: typeof equalDependencies;
  parseDependencies: typeof parseDependencies;
  replacerDependencies: typeof replacerDependencies;
  resolveDependencies: typeof resolveDependencies;
  simplifyConstantDependencies: typeof simplifyConstantDependencies;
  simplifyCoreDependencies: typeof simplifyCoreDependencies;
} = {
  AccessorNodeDependencies,
  ArrayNodeDependencies,
  ConstantNodeDependencies,
  FunctionNodeDependencies,
  IndexNodeDependencies,
  ObjectNodeDependencies,
  OperatorNodeDependencies,
  ParenthesisNodeDependencies,
  SymbolNodeDependencies,
  equalDependencies,
  parseDependencies,
  replacerDependencies,
  resolveDependencies,
  simplifyConstantDependencies,
  simplifyCoreDependencies,
  typedDependencies,
  createSimplify: mathjsCreateSimplify,
};

const mathjsCreateSymbolicEqual: CompatFactoryExports['createSymbolicEqual'] =
  factories.createSymbolicEqual;
const symbolicEqualDependencies: UnaryBundle<'createSymbolicEqual'> & {
  OperatorNodeDependencies: typeof OperatorNodeDependencies;
  parseDependencies: typeof parseDependencies;
  simplifyDependencies: typeof simplifyDependencies;
} = {
  OperatorNodeDependencies,
  parseDependencies,
  simplifyDependencies,
  typedDependencies,
  createSymbolicEqual: mathjsCreateSymbolicEqual,
};

const mathjsCreateDerivative: CompatFactoryExports['createDerivative'] = factories.createDerivative;
const derivativeDependencies: UnaryBundle<'createDerivative'> & {
  ConstantNodeDependencies: typeof ConstantNodeDependencies;
  FunctionNodeDependencies: typeof FunctionNodeDependencies;
  OperatorNodeDependencies: typeof OperatorNodeDependencies;
  ParenthesisNodeDependencies: typeof ParenthesisNodeDependencies;
  SymbolNodeDependencies: typeof SymbolNodeDependencies;
  equalDependencies: typeof equalDependencies;
  isZeroDependencies: typeof isZeroDependencies;
  numericDependencies: typeof numericDependencies;
  parseDependencies: typeof parseDependencies;
  simplifyDependencies: typeof simplifyDependencies;
} = {
  ConstantNodeDependencies,
  FunctionNodeDependencies,
  OperatorNodeDependencies,
  ParenthesisNodeDependencies,
  SymbolNodeDependencies,
  equalDependencies,
  isZeroDependencies,
  numericDependencies,
  parseDependencies,
  simplifyDependencies,
  typedDependencies,
  createDerivative: mathjsCreateDerivative,
};

const mathjsCreateRationalize: CompatFactoryExports['createRationalize'] =
  factories.createRationalize;
const rationalizeDependencies: UnaryBundle<'createRationalize'> & {
  bignumberDependencies: typeof bignumberDependencies;
  fractionDependencies: typeof fractionDependencies;
  AccessorNodeDependencies: typeof AccessorNodeDependencies;
  ArrayNodeDependencies: typeof ArrayNodeDependencies;
  ConstantNodeDependencies: typeof ConstantNodeDependencies;
  FunctionNodeDependencies: typeof FunctionNodeDependencies;
  IndexNodeDependencies: typeof IndexNodeDependencies;
  ObjectNodeDependencies: typeof ObjectNodeDependencies;
  OperatorNodeDependencies: typeof OperatorNodeDependencies;
  ParenthesisNodeDependencies: typeof ParenthesisNodeDependencies;
  SymbolNodeDependencies: typeof SymbolNodeDependencies;
  addDependencies: typeof addDependencies;
  divideDependencies: typeof divideDependencies;
  equalDependencies: typeof equalDependencies;
  isZeroDependencies: typeof isZeroDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  parseDependencies: typeof parseDependencies;
  powDependencies: typeof powDependencies;
  simplifyDependencies: typeof simplifyDependencies;
  simplifyConstantDependencies: typeof simplifyConstantDependencies;
  simplifyCoreDependencies: typeof simplifyCoreDependencies;
  subtractDependencies: typeof subtractDependencies;
} = {
  bignumberDependencies,
  fractionDependencies,
  AccessorNodeDependencies,
  ArrayNodeDependencies,
  ConstantNodeDependencies,
  FunctionNodeDependencies,
  IndexNodeDependencies,
  ObjectNodeDependencies,
  OperatorNodeDependencies,
  ParenthesisNodeDependencies,
  SymbolNodeDependencies,
  addDependencies,
  divideDependencies,
  equalDependencies,
  isZeroDependencies,
  matrixDependencies,
  multiplyDependencies,
  parseDependencies,
  powDependencies,
  simplifyDependencies,
  simplifyConstantDependencies,
  simplifyCoreDependencies,
  subtractDependencies,
  typedDependencies,
  createRationalize: mathjsCreateRationalize,
};

const mathjsCreateGamma: CompatFactoryExports['createGamma'] = factories.createGamma;
const gammaDependencies: UnaryBundle<'createGamma'> & {
  BigNumberDependencies: typeof BigNumberDependencies;
  ComplexDependencies: typeof ComplexDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  powDependencies: typeof powDependencies;
} = {
  BigNumberDependencies,
  ComplexDependencies,
  multiplyScalarDependencies,
  powDependencies,
  typedDependencies,
  createGamma: mathjsCreateGamma,
};

const mathjsCreateFactorial: CompatFactoryExports['createFactorial'] = factories.createFactorial;
const factorialDependencies: UnaryBundle<'createFactorial'> & {
  gammaDependencies: typeof gammaDependencies;
} = {
  gammaDependencies,
  typedDependencies,
  createFactorial: mathjsCreateFactorial,
};

const mathjsCreateLusolve: CompatFactoryExports['createLusolve'] = factories.createLusolve;
const lusolveDependencies: UnaryBundle<'createLusolve'> & {
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  lsolveDependencies: typeof lsolveDependencies;
  lupDependencies: typeof lupDependencies;
  matrixDependencies: typeof matrixDependencies;
  sluDependencies: typeof sluDependencies;
  usolveDependencies: typeof usolveDependencies;
} = {
  DenseMatrixDependencies,
  lsolveDependencies,
  lupDependencies,
  matrixDependencies,
  sluDependencies,
  typedDependencies,
  usolveDependencies,
  createLusolve: mathjsCreateLusolve,
};

const mathjsCreateSolveODE: CompatFactoryExports['createSolveODE'] = factories.createSolveODE;
const solveODEDependencies: UnaryBundle<'createSolveODE'> & {
  absDependencies: typeof absDependencies;
  addDependencies: typeof addDependencies;
  bignumberDependencies: typeof bignumberDependencies;
  divideDependencies: typeof divideDependencies;
  isNegativeDependencies: typeof isNegativeDependencies;
  isPositiveDependencies: typeof isPositiveDependencies;
  largerDependencies: typeof largerDependencies;
  mapDependencies: typeof mapDependencies;
  matrixDependencies: typeof matrixDependencies;
  maxDependencies: typeof maxDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  smallerDependencies: typeof smallerDependencies;
  subtractDependencies: typeof subtractDependencies;
  unaryMinusDependencies: typeof unaryMinusDependencies;
} = {
  absDependencies,
  addDependencies,
  bignumberDependencies,
  divideDependencies,
  isNegativeDependencies,
  isPositiveDependencies,
  largerDependencies,
  mapDependencies,
  matrixDependencies,
  maxDependencies,
  multiplyDependencies,
  smallerDependencies,
  subtractDependencies,
  typedDependencies,
  unaryMinusDependencies,
  createSolveODE: mathjsCreateSolveODE,
};

const mathjsCreatePermutations: CompatFactoryExports['createPermutations'] =
  factories.createPermutations;
const permutationsDependencies: UnaryBundle<'createPermutations'> & {
  factorialDependencies: typeof factorialDependencies;
} = {
  factorialDependencies,
  typedDependencies,
  createPermutations: mathjsCreatePermutations,
};

const mathjsCreateCatalan: CompatFactoryExports['createCatalan'] = factories.createCatalan;
const catalanDependencies: UnaryBundle<'createCatalan'> & {
  addScalarDependencies: typeof addScalarDependencies;
  combinationsDependencies: typeof combinationsDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  isIntegerDependencies: typeof isIntegerDependencies;
  isNegativeDependencies: typeof isNegativeDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
} = {
  addScalarDependencies,
  combinationsDependencies,
  divideScalarDependencies,
  isIntegerDependencies,
  isNegativeDependencies,
  multiplyScalarDependencies,
  typedDependencies,
  createCatalan: mathjsCreateCatalan,
};

const mathjsCreateMultinomial: CompatFactoryExports['createMultinomial'] =
  factories.createMultinomial;
const multinomialDependencies: UnaryBundle<'createMultinomial'> & {
  addDependencies: typeof addDependencies;
  divideDependencies: typeof divideDependencies;
  factorialDependencies: typeof factorialDependencies;
  isIntegerDependencies: typeof isIntegerDependencies;
  isPositiveDependencies: typeof isPositiveDependencies;
  multiplyDependencies: typeof multiplyDependencies;
} = {
  addDependencies,
  divideDependencies,
  factorialDependencies,
  isIntegerDependencies,
  isPositiveDependencies,
  multiplyDependencies,
  typedDependencies,
  createMultinomial: mathjsCreateMultinomial,
};

const mathjsCreateStirlingS2: CompatFactoryExports['createStirlingS2'] = factories.createStirlingS2;
const stirlingS2Dependencies: UnaryBundle<'createStirlingS2'> & {
  bignumberDependencies: typeof bignumberDependencies;
  addScalarDependencies: typeof addScalarDependencies;
  combinationsDependencies: typeof combinationsDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  factorialDependencies: typeof factorialDependencies;
  isIntegerDependencies: typeof isIntegerDependencies;
  isNegativeDependencies: typeof isNegativeDependencies;
  largerDependencies: typeof largerDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  numberDependencies: typeof numberDependencies;
  powDependencies: typeof powDependencies;
  subtractScalarDependencies: typeof subtractScalarDependencies;
} = {
  bignumberDependencies,
  addScalarDependencies,
  combinationsDependencies,
  divideScalarDependencies,
  factorialDependencies,
  isIntegerDependencies,
  isNegativeDependencies,
  largerDependencies,
  multiplyScalarDependencies,
  numberDependencies,
  powDependencies,
  subtractScalarDependencies,
  typedDependencies,
  createStirlingS2: mathjsCreateStirlingS2,
};

const mathjsCreateBellNumbers: CompatFactoryExports['createBellNumbers'] =
  factories.createBellNumbers;
const bellNumbersDependencies: UnaryBundle<'createBellNumbers'> & {
  addScalarDependencies: typeof addScalarDependencies;
  isIntegerDependencies: typeof isIntegerDependencies;
  isNegativeDependencies: typeof isNegativeDependencies;
  stirlingS2Dependencies: typeof stirlingS2Dependencies;
} = {
  addScalarDependencies,
  isIntegerDependencies,
  isNegativeDependencies,
  stirlingS2Dependencies,
  typedDependencies,
  createBellNumbers: mathjsCreateBellNumbers,
};

const mathjsCreateFft: CompatFactoryExports['createFft'] = factories.createFft;

const mathjsCreateIfft: CompatFactoryExports['createIfft'] = factories.createIfft;

const mathjsCreateSqrtm: CompatFactoryExports['createSqrtm'] = factories.createSqrtm;
const sqrtmDependencies: UnaryBundle<'createSqrtm'> & {
  absDependencies: typeof absDependencies;
  addDependencies: typeof addDependencies;
  identityDependencies: typeof identityDependencies;
  invDependencies: typeof invDependencies;
  mapDependencies: typeof mapDependencies;
  maxDependencies: typeof maxDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  sizeDependencies: typeof sizeDependencies;
  sqrtDependencies: typeof sqrtDependencies;
  subtractDependencies: typeof subtractDependencies;
} = {
  absDependencies,
  addDependencies,
  identityDependencies,
  invDependencies,
  mapDependencies,
  maxDependencies,
  multiplyDependencies,
  sizeDependencies,
  sqrtDependencies,
  subtractDependencies,
  typedDependencies,
  createSqrtm: mathjsCreateSqrtm,
};

const mathjsCreateMedian: CompatFactoryExports['createMedian'] = factories.createMedian;
const medianDependencies: UnaryBundle<'createMedian'> & {
  addDependencies: typeof addDependencies;
  compareDependencies: typeof compareDependencies;
  divideDependencies: typeof divideDependencies;
  partitionSelectDependencies: typeof partitionSelectDependencies;
} = {
  addDependencies,
  compareDependencies,
  divideDependencies,
  partitionSelectDependencies,
  typedDependencies,
  createMedian: mathjsCreateMedian,
};

const mathjsCreateMad: CompatFactoryExports['createMad'] = factories.createMad;
const madDependencies: UnaryBundle<'createMad'> & {
  absDependencies: typeof absDependencies;
  mapDependencies: typeof mapDependencies;
  medianDependencies: typeof medianDependencies;
  subtractDependencies: typeof subtractDependencies;
} = {
  absDependencies,
  mapDependencies,
  medianDependencies,
  subtractDependencies,
  typedDependencies,
  createMad: mathjsCreateMad,
};

const mathjsCreateVariance: CompatFactoryExports['createVariance'] = factories.createVariance;
const varianceDependencies: UnaryBundle<'createVariance'> & {
  addDependencies: typeof addDependencies;
  divideDependencies: typeof divideDependencies;
  isNaNDependencies: typeof isNaNDependencies;
  mapSlicesDependencies: typeof mapSlicesDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  subtractDependencies: typeof subtractDependencies;
} = {
  addDependencies,
  divideDependencies,
  isNaNDependencies,
  mapSlicesDependencies,
  multiplyDependencies,
  subtractDependencies,
  typedDependencies,
  createVariance: mathjsCreateVariance,
};

const mathjsCreateStd: CompatFactoryExports['createStd'] = factories.createStd;
const stdDependencies: UnaryBundle<'createStd'> & {
  mapDependencies: typeof mapDependencies;
  sqrtDependencies: typeof sqrtDependencies;
  varianceDependencies: typeof varianceDependencies;
} = {
  mapDependencies,
  sqrtDependencies,
  typedDependencies,
  varianceDependencies,
  createStd: mathjsCreateStd,
};

const mathjsCreateQuantileSeq: CompatFactoryExports['createQuantileSeq'] =
  factories.createQuantileSeq;
const quantileSeqDependencies: UnaryBundle<'createQuantileSeq'> & {
  bignumberDependencies: typeof bignumberDependencies;
  addDependencies: typeof addDependencies;
  compareDependencies: typeof compareDependencies;
  divideDependencies: typeof divideDependencies;
  isIntegerDependencies: typeof isIntegerDependencies;
  largerDependencies: typeof largerDependencies;
  mapSlicesDependencies: typeof mapSlicesDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  partitionSelectDependencies: typeof partitionSelectDependencies;
  smallerDependencies: typeof smallerDependencies;
  smallerEqDependencies: typeof smallerEqDependencies;
  subtractDependencies: typeof subtractDependencies;
} = {
  bignumberDependencies,
  addDependencies,
  compareDependencies,
  divideDependencies,
  isIntegerDependencies,
  largerDependencies,
  mapSlicesDependencies,
  multiplyDependencies,
  partitionSelectDependencies,
  smallerDependencies,
  smallerEqDependencies,
  subtractDependencies,
  typedDependencies,
  createQuantileSeq: mathjsCreateQuantileSeq,
};

const mathjsCreateQuantileSeqTransform: CompatFactoryExports['createQuantileSeqTransform'] =
  factories.createQuantileSeqTransform;
const quantileSeqTransformDependencies: UnaryBundle<'createQuantileSeqTransform'> & {
  addDependencies: typeof addDependencies;
  bignumberDependencies: typeof bignumberDependencies;
  compareDependencies: typeof compareDependencies;
  divideDependencies: typeof divideDependencies;
  isIntegerDependencies: typeof isIntegerDependencies;
  largerDependencies: typeof largerDependencies;
  mapSlicesDependencies: typeof mapSlicesDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  partitionSelectDependencies: typeof partitionSelectDependencies;
  smallerDependencies: typeof smallerDependencies;
  smallerEqDependencies: typeof smallerEqDependencies;
  subtractDependencies: typeof subtractDependencies;
} = {
  addDependencies,
  bignumberDependencies,
  compareDependencies,
  divideDependencies,
  isIntegerDependencies,
  largerDependencies,
  mapSlicesDependencies,
  multiplyDependencies,
  partitionSelectDependencies,
  smallerDependencies,
  smallerEqDependencies,
  subtractDependencies,
  typedDependencies,
  createQuantileSeqTransform: mathjsCreateQuantileSeqTransform,
};

const mathjsCreateVarianceTransform: CompatFactoryExports['createVarianceTransform'] =
  factories.createVarianceTransform;
const varianceTransformDependencies: UnaryBundle<'createVarianceTransform'> & {
  addDependencies: typeof addDependencies;
  divideDependencies: typeof divideDependencies;
  isNaNDependencies: typeof isNaNDependencies;
  mapSlicesDependencies: typeof mapSlicesDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  subtractDependencies: typeof subtractDependencies;
} = {
  addDependencies,
  divideDependencies,
  isNaNDependencies,
  mapSlicesDependencies,
  multiplyDependencies,
  subtractDependencies,
  typedDependencies,
  createVarianceTransform: mathjsCreateVarianceTransform,
};

const mathjsCreateStdTransform: CompatFactoryExports['createStdTransform'] =
  factories.createStdTransform;
const stdTransformDependencies: UnaryBundle<'createStdTransform'> & {
  mapDependencies: typeof mapDependencies;
  sqrtDependencies: typeof sqrtDependencies;
  varianceDependencies: typeof varianceDependencies;
} = {
  mapDependencies,
  sqrtDependencies,
  typedDependencies,
  varianceDependencies,
  createStdTransform: mathjsCreateStdTransform,
};

const mathjsCreateCorr: CompatFactoryExports['createCorr'] = factories.createCorr;
const corrDependencies: UnaryBundle<'createCorr'> & {
  addDependencies: typeof addDependencies;
  divideDependencies: typeof divideDependencies;
  matrixDependencies: typeof matrixDependencies;
  meanDependencies: typeof meanDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  powDependencies: typeof powDependencies;
  sqrtDependencies: typeof sqrtDependencies;
  subtractDependencies: typeof subtractDependencies;
  sumDependencies: typeof sumDependencies;
} = {
  addDependencies,
  divideDependencies,
  matrixDependencies,
  meanDependencies,
  multiplyDependencies,
  powDependencies,
  sqrtDependencies,
  subtractDependencies,
  sumDependencies,
  typedDependencies,
  createCorr: mathjsCreateCorr,
};

const mathjsCreateXgcd: CompatFactoryExports['createXgcd'] = factories.createXgcd;
const xgcdDependencies: UnaryBundle<'createXgcd'> & {
  BigNumberDependencies: typeof BigNumberDependencies;
  matrixDependencies: typeof matrixDependencies;
} = {
  BigNumberDependencies,
  matrixDependencies,
  typedDependencies,
  createXgcd: mathjsCreateXgcd,
};

const mathjsCreateInvmod: CompatFactoryExports['createInvmod'] = factories.createInvmod;
const invmodDependencies: UnaryBundle<'createInvmod'> & {
  BigNumberDependencies: typeof BigNumberDependencies;
  addDependencies: typeof addDependencies;
  equalDependencies: typeof equalDependencies;
  isIntegerDependencies: typeof isIntegerDependencies;
  modDependencies: typeof modDependencies;
  smallerDependencies: typeof smallerDependencies;
  xgcdDependencies: typeof xgcdDependencies;
} = {
  BigNumberDependencies,
  addDependencies,
  equalDependencies,
  isIntegerDependencies,
  modDependencies,
  smallerDependencies,
  typedDependencies,
  xgcdDependencies,
  createInvmod: mathjsCreateInvmod,
};

const mathjsCreateEigs: CompatFactoryExports['createEigs'] = factories.createEigs;
const eigsDependencies: UnaryBundle<'createEigs'> & {
  absDependencies: typeof absDependencies;
  addDependencies: typeof addDependencies;
  addScalarDependencies: typeof addScalarDependencies;
  atanDependencies: typeof atanDependencies;
  bignumberDependencies: typeof bignumberDependencies;
  columnDependencies: typeof columnDependencies;
  complexDependencies: typeof complexDependencies;
  cosDependencies: typeof cosDependencies;
  diagDependencies: typeof diagDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  dotDependencies: typeof dotDependencies;
  equalDependencies: typeof equalDependencies;
  flattenDependencies: typeof flattenDependencies;
  imDependencies: typeof imDependencies;
  invDependencies: typeof invDependencies;
  largerDependencies: typeof largerDependencies;
  matrixDependencies: typeof matrixDependencies;
  matrixFromColumnsDependencies: typeof matrixFromColumnsDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  numberDependencies: typeof numberDependencies;
  qrDependencies: typeof qrDependencies;
  reDependencies: typeof reDependencies;
  reshapeDependencies: typeof reshapeDependencies;
  sinDependencies: typeof sinDependencies;
  sizeDependencies: typeof sizeDependencies;
  smallerDependencies: typeof smallerDependencies;
  sqrtDependencies: typeof sqrtDependencies;
  subtractDependencies: typeof subtractDependencies;
  usolveDependencies: typeof usolveDependencies;
  usolveAllDependencies: typeof usolveAllDependencies;
} = {
  absDependencies,
  addDependencies,
  addScalarDependencies,
  atanDependencies,
  bignumberDependencies,
  columnDependencies,
  complexDependencies,
  cosDependencies,
  diagDependencies,
  divideScalarDependencies,
  dotDependencies,
  equalDependencies,
  flattenDependencies,
  imDependencies,
  invDependencies,
  largerDependencies,
  matrixDependencies,
  matrixFromColumnsDependencies,
  multiplyDependencies,
  multiplyScalarDependencies,
  numberDependencies,
  qrDependencies,
  reDependencies,
  reshapeDependencies,
  sinDependencies,
  sizeDependencies,
  smallerDependencies,
  sqrtDependencies,
  subtractDependencies,
  typedDependencies,
  usolveDependencies,
  usolveAllDependencies,
  createEigs: mathjsCreateEigs,
};

const mathjsCreateNorm: CompatFactoryExports['createNorm'] = factories.createNorm;
const normDependencies: UnaryBundle<'createNorm'> & {
  absDependencies: typeof absDependencies;
  addDependencies: typeof addDependencies;
  conjDependencies: typeof conjDependencies;
  ctransposeDependencies: typeof ctransposeDependencies;
  eigsDependencies: typeof eigsDependencies;
  equalScalarDependencies: typeof equalScalarDependencies;
  largerDependencies: typeof largerDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  powDependencies: typeof powDependencies;
  smallerDependencies: typeof smallerDependencies;
  sqrtDependencies: typeof sqrtDependencies;
} = {
  absDependencies,
  addDependencies,
  conjDependencies,
  ctransposeDependencies,
  eigsDependencies,
  equalScalarDependencies,
  largerDependencies,
  matrixDependencies,
  multiplyDependencies,
  powDependencies,
  smallerDependencies,
  sqrtDependencies,
  typedDependencies,
  createNorm: mathjsCreateNorm,
};

const mathjsCreateRotationMatrix: CompatFactoryExports['createRotationMatrix'] =
  factories.createRotationMatrix;
const rotationMatrixDependencies: UnaryBundle<'createRotationMatrix'> & {
  BigNumberDependencies: typeof BigNumberDependencies;
  DenseMatrixDependencies: typeof DenseMatrixDependencies;
  SparseMatrixDependencies: typeof SparseMatrixDependencies;
  addScalarDependencies: typeof addScalarDependencies;
  cosDependencies: typeof cosDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  normDependencies: typeof normDependencies;
  sinDependencies: typeof sinDependencies;
  unaryMinusDependencies: typeof unaryMinusDependencies;
} = {
  BigNumberDependencies,
  DenseMatrixDependencies,
  SparseMatrixDependencies,
  addScalarDependencies,
  cosDependencies,
  matrixDependencies,
  multiplyScalarDependencies,
  normDependencies,
  sinDependencies,
  typedDependencies,
  unaryMinusDependencies,
  createRotationMatrix: mathjsCreateRotationMatrix,
};

const mathjsCreateRotate: CompatFactoryExports['createRotate'] = factories.createRotate;
const rotateDependencies: UnaryBundle<'createRotate'> & {
  multiplyDependencies: typeof multiplyDependencies;
  rotationMatrixDependencies: typeof rotationMatrixDependencies;
} = {
  multiplyDependencies,
  rotationMatrixDependencies,
  typedDependencies,
  createRotate: mathjsCreateRotate,
};

const mathjsCreateSchur: CompatFactoryExports['createSchur'] = factories.createSchur;
const schurDependencies: UnaryBundle<'createSchur'> & {
  identityDependencies: typeof identityDependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  normDependencies: typeof normDependencies;
  qrDependencies: typeof qrDependencies;
  subtractDependencies: typeof subtractDependencies;
} = {
  identityDependencies,
  matrixDependencies,
  multiplyDependencies,
  normDependencies,
  qrDependencies,
  subtractDependencies,
  typedDependencies,
  createSchur: mathjsCreateSchur,
};

const mathjsCreateSylvester: CompatFactoryExports['createSylvester'] = factories.createSylvester;
const sylvesterDependencies: UnaryBundle<'createSylvester'> & {
  absDependencies: typeof absDependencies;
  addDependencies: typeof addDependencies;
  concatDependencies: typeof concatDependencies;
  identityDependencies: typeof identityDependencies;
  indexDependencies: typeof indexDependencies;
  lusolveDependencies: typeof lusolveDependencies;
  matrixDependencies: typeof matrixDependencies;
  matrixFromColumnsDependencies: typeof matrixFromColumnsDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  rangeDependencies: typeof rangeDependencies;
  schurDependencies: typeof schurDependencies;
  subsetDependencies: typeof subsetDependencies;
  subtractDependencies: typeof subtractDependencies;
  transposeDependencies: typeof transposeDependencies;
} = {
  absDependencies,
  addDependencies,
  concatDependencies,
  identityDependencies,
  indexDependencies,
  lusolveDependencies,
  matrixDependencies,
  matrixFromColumnsDependencies,
  multiplyDependencies,
  rangeDependencies,
  schurDependencies,
  subsetDependencies,
  subtractDependencies,
  transposeDependencies,
  typedDependencies,
  createSylvester: mathjsCreateSylvester,
};

const mathjsCreateLyap: CompatFactoryExports['createLyap'] = factories.createLyap;
const lyapDependencies: UnaryBundle<'createLyap'> & {
  matrixDependencies: typeof matrixDependencies;
  multiplyDependencies: typeof multiplyDependencies;
  sylvesterDependencies: typeof sylvesterDependencies;
  transposeDependencies: typeof transposeDependencies;
} = {
  matrixDependencies,
  multiplyDependencies,
  sylvesterDependencies,
  transposeDependencies,
  typedDependencies,
  createLyap: mathjsCreateLyap,
};

const mathjsCreateZeta: CompatFactoryExports['createZeta'] = factories.createZeta;
const mathjsCreateExpm: CompatFactoryExports['createExpm'] = factories.createExpm;
const expmDependencies: UnaryBundle<'createExpm'> & {
  absDependencies: typeof absDependencies;
  addDependencies: typeof addDependencies;
  identityDependencies: typeof identityDependencies;
  invDependencies: typeof invDependencies;
  multiplyDependencies: typeof multiplyDependencies;
} = {
  absDependencies,
  addDependencies,
  identityDependencies,
  invDependencies,
  multiplyDependencies,
  typedDependencies,
  createExpm: mathjsCreateExpm,
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
  mathjsCreatePrintTransform as createPrintTransform,
  printTransformDependencies,
  mathjsCreatePickRandom as createPickRandom,
  mathjsCreateRandom as createRandom,
  mathjsCreateMap as createMap,
  mathjsCreateMapTransform as createMapTransform,
  mapTransformDependencies,
  mathjsCreateFilter as createFilter,
  mathjsCreateFilterTransform as createFilterTransform,
  filterTransformDependencies,
  mathjsCreateForEach as createForEach,
  mathjsCreateForEachTransform as createForEachTransform,
  forEachTransformDependencies,
  mathjsCreateMeanTransform as createMeanTransform,
  meanTransformDependencies,
  mathjsCreateMapSlicesTransform as createMapSlicesTransform,
  mapSlicesTransformDependencies,
  mathjsCreateCumSumTransform as createCumSumTransform,
  cumsumTransformDependencies,
  mathjsCreateSumTransform as createSumTransform,
  sumTransformDependencies,
  mathjsCreateMaxTransform as createMaxTransform,
  maxTransformDependencies,
  mathjsCreateMinTransform as createMinTransform,
  minTransformDependencies,
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
  mathjsCreateConcatTransform as createConcatTransform,
  concatTransformDependencies,
  mathjsCreateAtan2 as createAtan2,
  createSparseMatrixClass,
  SparseMatrixDependencies,
  matrixDependencies,
  equalDependencies,
  isIntegerDependencies,
  concatDependencies,
  atan2Dependencies,
  mathjsCreateBitAnd as createBitAnd,
  mathjsCreateBitAndTransform as createBitAndTransform,
  bitAndTransformDependencies,
  bitAndDependencies,
  mathjsCreateBitOr as createBitOr,
  mathjsCreateBitOrTransform as createBitOrTransform,
  bitOrTransformDependencies,
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
  mathjsCreateOrTransform as createOrTransform,
  orTransformDependencies,
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
  mathjsCreateAndTransform as createAndTransform,
  andTransformDependencies,
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
  mathjsCreateNullishTransform as createNullishTransform,
  nullishTransformDependencies,
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
  mathjsCreateSubsetTransform as createSubsetTransform,
  subsetTransformDependencies,
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
  mathjsCreateDiffTransform as createDiffTransform,
  diffTransformDependencies,
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
  mathjsCreateDistance as createDistance,
  distanceDependencies,
  mathjsCreateLsolve as createLsolve,
  lsolveDependencies,
  mathjsCreateUsolve as createUsolve,
  usolveDependencies,
  mathjsCreateLsolveAll as createLsolveAll,
  lsolveAllDependencies,
  mathjsCreateUsolveAll as createUsolveAll,
  usolveAllDependencies,
  mathjsCreateLog1p as createLog1p,
  log1pDependencies,
  mathjsCreateRange as createRange,
  mathjsCreateRangeTransform as createRangeTransform,
  rangeTransformDependencies,
  rangeDependencies,
  mathjsCreateBernoulli as createBernoulli,
  bernoulliDependencies,
  mathjsCreateNode as createNode,
  NodeDependencies,
  mathjsCreateConstantNode as createConstantNode,
  ConstantNodeDependencies,
  mathjsCreateParenthesisNode as createParenthesisNode,
  ParenthesisNodeDependencies,
  mathjsCreateArrayNode as createArrayNode,
  ArrayNodeDependencies,
  mathjsCreateBlockNode as createBlockNode,
  BlockNodeDependencies,
  mathjsCreateOperatorNode as createOperatorNode,
  OperatorNodeDependencies,
  mathjsCreateRangeNode as createRangeNode,
  RangeNodeDependencies,
  mathjsCreateAccessorNode as createAccessorNode,
  AccessorNodeDependencies,
  mathjsCreateConditionalNode as createConditionalNode,
  ConditionalNodeDependencies,
  mathjsCreateFunctionAssignmentNode as createFunctionAssignmentNode,
  FunctionAssignmentNodeDependencies,
  mathjsCreateObjectNode as createObjectNode,
  ObjectNodeDependencies,
  mathjsCreateIndexNode as createIndexNode,
  IndexNodeDependencies,
  mathjsCreateRelationalNode as createRelationalNode,
  RelationalNodeDependencies,
  mathjsCreateImmutableDenseMatrixClass as createImmutableDenseMatrixClass,
  ImmutableDenseMatrixDependencies,
  mathjsCreateIndexClass as createIndexClass,
  IndexDependencies,
  mathjsCreateIndex as createIndex,
  mathjsCreateIndexTransform as createIndexTransform,
  indexTransformDependencies,
  indexDependencies,
  mathjsCreateSetDifference as createSetDifference,
  setDifferenceDependencies,
  mathjsCreateSetIntersect as createSetIntersect,
  setIntersectDependencies,
  mathjsCreateSetDistinct as createSetDistinct,
  setDistinctDependencies,
  mathjsCreateSetCartesian as createSetCartesian,
  setCartesianDependencies,
  mathjsCreateSetIsSubset as createSetIsSubset,
  setIsSubsetDependencies,
  mathjsCreateSetMultiplicity as createSetMultiplicity,
  setMultiplicityDependencies,
  mathjsCreateSetPowerset as createSetPowerset,
  setPowersetDependencies,
  mathjsCreateColumn as createColumn,
  mathjsCreateColumnTransform as createColumnTransform,
  columnTransformDependencies,
  columnDependencies,
  mathjsCreateRow as createRow,
  mathjsCreateRowTransform as createRowTransform,
  rowTransformDependencies,
  rowDependencies,
  mathjsCreateFibonacciHeapClass as createFibonacciHeapClass,
  FibonacciHeapDependencies,
  mathjsCreateSpaClass as createSpaClass,
  SpaDependencies,
  mathjsCreateQr as createQr,
  qrDependencies,
  mathjsCreateLup as createLup,
  lupDependencies,
  mathjsCreateMax as createMax,
  maxDependencies,
  mathjsCreateMin as createMin,
  minDependencies,
  mathjsCreateCumSum as createCumSum,
  cumsumDependencies,
  mathjsCreateSetSymDifference as createSetSymDifference,
  setSymDifferenceDependencies,
  mathjsCreateSum as createSum,
  sumDependencies,
  mathjsCreateProd as createProd,
  prodDependencies,
  mathjsCreateCount as createCount,
  countDependencies,
  mathjsCreateMultiply as createMultiply,
  multiplyDependencies,
  mathjsCreateDet as createDet,
  detDependencies,
  mathjsCreateInv as createInv,
  invDependencies,
  mathjsCreatePow as createPow,
  powDependencies,
  mathjsCreateCross as createCross,
  crossDependencies,
  mathjsCreateDotPow as createDotPow,
  dotPowDependencies,
  mathjsCreateSlu as createSlu,
  sluDependencies,
  mathjsCreateUnitClass as createUnitClass,
  UnitDependencies,
  mathjsCreateUnitFunction as createUnitFunction,
  unitDependencies,
  mathjsCreateCreateUnit as createCreateUnit,
  createUnitDependencies,
  mathjsCreateSymbolNode as createSymbolNode,
  SymbolNodeDependencies,
  mathjsCreateFunctionNode as createFunctionNode,
  FunctionNodeDependencies,
  mathjsCreateAssignmentNode as createAssignmentNode,
  AssignmentNodeDependencies,
  mathjsCreateParse as createParse,
  parseDependencies,
  mathjsCreateCompile as createCompile,
  compileDependencies,
  mathjsCreateEvaluate as createEvaluate,
  evaluateDependencies,
  atomicMassDependencies,
  avogadroDependencies,
  bohrMagnetonDependencies,
  bohrRadiusDependencies,
  boltzmannDependencies,
  classicalElectronRadiusDependencies,
  conductanceQuantumDependencies,
  coulombDependencies,
  coulombConstantDependencies,
  deuteronMassDependencies,
  efimovFactorDependencies,
  electricConstantDependencies,
  electronMassDependencies,
  elementaryChargeDependencies,
  faradayDependencies,
  fermiCouplingDependencies,
  fineStructureDependencies,
  firstRadiationDependencies,
  gasConstantDependencies,
  gravitationConstantDependencies,
  gravityDependencies,
  hartreeEnergyDependencies,
  inverseConductanceQuantumDependencies,
  klitzingDependencies,
  loschmidtDependencies,
  magneticConstantDependencies,
  magneticFluxQuantumDependencies,
  molarMassDependencies,
  molarMassC12Dependencies,
  molarPlanckConstantDependencies,
  molarVolumeDependencies,
  neutronMassDependencies,
  nuclearMagnetonDependencies,
  planckChargeDependencies,
  planckConstantDependencies,
  planckLengthDependencies,
  planckMassDependencies,
  planckTemperatureDependencies,
  planckTimeDependencies,
  protonMassDependencies,
  quantumOfCirculationDependencies,
  reducedPlanckConstantDependencies,
  rydbergDependencies,
  sackurTetrodeDependencies,
  secondRadiationDependencies,
  speedOfLightDependencies,
  stefanBoltzmannDependencies,
  thomsonCrossSectionDependencies,
  vacuumImpedanceDependencies,
  weakMixingAngleDependencies,
  wienDisplacementDependencies,
  selectedCreateAtomicMass as createAtomicMass,
  selectedCreateAvogadro as createAvogadro,
  selectedCreateBohrMagneton as createBohrMagneton,
  selectedCreateBohrRadius as createBohrRadius,
  selectedCreateBoltzmann as createBoltzmann,
  selectedCreateClassicalElectronRadius as createClassicalElectronRadius,
  selectedCreateConductanceQuantum as createConductanceQuantum,
  selectedCreateCoulomb as createCoulomb,
  selectedCreateCoulombConstant as createCoulombConstant,
  selectedCreateDeuteronMass as createDeuteronMass,
  selectedCreateEfimovFactor as createEfimovFactor,
  selectedCreateElectricConstant as createElectricConstant,
  selectedCreateElectronMass as createElectronMass,
  selectedCreateElementaryCharge as createElementaryCharge,
  selectedCreateFaraday as createFaraday,
  selectedCreateFermiCoupling as createFermiCoupling,
  selectedCreateFineStructure as createFineStructure,
  selectedCreateFirstRadiation as createFirstRadiation,
  selectedCreateGasConstant as createGasConstant,
  selectedCreateGravitationConstant as createGravitationConstant,
  selectedCreateGravity as createGravity,
  selectedCreateHartreeEnergy as createHartreeEnergy,
  selectedCreateInverseConductanceQuantum as createInverseConductanceQuantum,
  selectedCreateKlitzing as createKlitzing,
  selectedCreateLoschmidt as createLoschmidt,
  selectedCreateMagneticConstant as createMagneticConstant,
  selectedCreateMagneticFluxQuantum as createMagneticFluxQuantum,
  selectedCreateMolarMass as createMolarMass,
  selectedCreateMolarMassC12 as createMolarMassC12,
  selectedCreateMolarPlanckConstant as createMolarPlanckConstant,
  selectedCreateMolarVolume as createMolarVolume,
  selectedCreateNeutronMass as createNeutronMass,
  selectedCreateNuclearMagneton as createNuclearMagneton,
  selectedCreatePlanckCharge as createPlanckCharge,
  selectedCreatePlanckConstant as createPlanckConstant,
  selectedCreatePlanckLength as createPlanckLength,
  selectedCreatePlanckMass as createPlanckMass,
  selectedCreatePlanckTemperature as createPlanckTemperature,
  selectedCreatePlanckTime as createPlanckTime,
  selectedCreateProtonMass as createProtonMass,
  selectedCreateQuantumOfCirculation as createQuantumOfCirculation,
  selectedCreateReducedPlanckConstant as createReducedPlanckConstant,
  selectedCreateRydberg as createRydberg,
  selectedCreateSackurTetrode as createSackurTetrode,
  selectedCreateSecondRadiation as createSecondRadiation,
  selectedCreateSpeedOfLight as createSpeedOfLight,
  selectedCreateStefanBoltzmann as createStefanBoltzmann,
  selectedCreateThomsonCrossSection as createThomsonCrossSection,
  selectedCreateVacuumImpedance as createVacuumImpedance,
  selectedCreateWeakMixingAngle as createWeakMixingAngle,
  selectedCreateWienDisplacement as createWienDisplacement,
  mathjsCreateLeafCount as createLeafCount,
  leafCountDependencies,
  mathjsCreatePinv as createPinv,
  pinvDependencies,
  mathjsCreateZpk2tf as createZpk2tf,
  zpk2tfDependencies,
  mathjsCreateTo as createTo,
  toDependencies,
  mathjsCreateToBest as createToBest,
  toBestDependencies,
  mathjsCreateSplitUnit as createSplitUnit,
  splitUnitDependencies,
  mathjsCreateSparse as createSparse,
  sparseDependencies,
  mathjsCreateIntersect as createIntersect,
  intersectDependencies,
  mathjsCreateResolve as createResolve,
  resolveDependencies,
  mathjsCreateSetUnion as createSetUnion,
  setUnionDependencies,
  mathjsCreateDivide as createDivide,
  divideDependencies,
  mathjsCreateMean as createMean,
  meanDependencies,
  mathjsCreatePolynomialRoot as createPolynomialRoot,
  polynomialRootDependencies,
  mathjsCreateZeta as createZeta,
  mathjsCreateExpm as createExpm,
  expmDependencies,
  mathjsCreateLyap as createLyap,
  lyapDependencies,
  mathjsCreateSylvester as createSylvester,
  sylvesterDependencies,
  mathjsCreateSchur as createSchur,
  schurDependencies,
  mathjsCreateRotate as createRotate,
  rotateDependencies,
  mathjsCreateRotationMatrix as createRotationMatrix,
  rotationMatrixDependencies,
  mathjsCreateNorm as createNorm,
  normDependencies,
  mathjsCreateEigs as createEigs,
  eigsDependencies,
  mathjsCreateInvmod as createInvmod,
  invmodDependencies,
  mathjsCreateXgcd as createXgcd,
  xgcdDependencies,
  mathjsCreateCorr as createCorr,
  corrDependencies,
  mathjsCreateStdTransform as createStdTransform,
  stdTransformDependencies,
  mathjsCreateVarianceTransform as createVarianceTransform,
  varianceTransformDependencies,
  mathjsCreateQuantileSeqTransform as createQuantileSeqTransform,
  quantileSeqTransformDependencies,
  mathjsCreateQuantileSeq as createQuantileSeq,
  quantileSeqDependencies,
  mathjsCreateStd as createStd,
  stdDependencies,
  mathjsCreateVariance as createVariance,
  varianceDependencies,
  mathjsCreateMad as createMad,
  madDependencies,
  mathjsCreateMedian as createMedian,
  medianDependencies,
  mathjsCreateSqrtm as createSqrtm,
  sqrtmDependencies,
  mathjsCreateIfft as createIfft,
  mathjsCreateFft as createFft,
  mathjsCreateBellNumbers as createBellNumbers,
  bellNumbersDependencies,
  mathjsCreateStirlingS2 as createStirlingS2,
  stirlingS2Dependencies,
  mathjsCreateMultinomial as createMultinomial,
  multinomialDependencies,
  mathjsCreateCatalan as createCatalan,
  catalanDependencies,
  mathjsCreatePermutations as createPermutations,
  permutationsDependencies,
  mathjsCreateSolveODE as createSolveODE,
  solveODEDependencies,
  mathjsCreateLusolve as createLusolve,
  lusolveDependencies,
  mathjsCreateFactorial as createFactorial,
  factorialDependencies,
  mathjsCreateGamma as createGamma,
  gammaDependencies,
  mathjsCreateSymbolicEqual as createSymbolicEqual,
  symbolicEqualDependencies,
  mathjsCreateRationalize as createRationalize,
  rationalizeDependencies,
  mathjsCreateDerivative as createDerivative,
  derivativeDependencies,
  mathjsCreateSimplify as createSimplify,
  simplifyDependencies,
  mathjsCreateSimplifyConstant as createSimplifyConstant,
  simplifyConstantDependencies,
  mathjsCreateSimplifyCore as createSimplifyCore,
  simplifyCoreDependencies,
  mathjsCreateString as createString,
  stringDependencies,
  mathjsCreateBoolean as createBoolean,
  booleanDependencies,
  mathjsCreateBigint as createBigint,
  bigintDependencies,
  mathjsCreateComposition as createComposition,
  compositionDependencies,
  mathjsCreateKldivergence as createKldivergence,
  kldivergenceDependencies,
  mathjsCreateFreqz as createFreqz,
  freqzDependencies,
  mathjsCreateCombinations as createCombinations,
  combinationsDependencies,
  mathjsCreateCombinationsWithRep as createCombinationsWithRep,
  combinationsWithRepDependencies,
  createNum,
  numDependencies,
  createDen,
  denDependencies,
  createRangeClass,
  RangeDependencies,
  createReplacer,
  replacerDependencies,
  createReviver,
  reviverDependencies,
  createVersion,
  versionDependencies,
  mathjsCreateHelpClass as createHelpClass,
  HelpDependencies,
  createHelp,
  helpDependencies,
  mathjsCreateParser as createParser,
  parserDependencies,
  mathjsCreateParserClass as createParserClass,
  ParserDependencies,
  typedDependencies,
};
