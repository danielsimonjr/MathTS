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
  typedDependencies,
};
