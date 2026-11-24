import { factory_mathjsCompat } from '@danielsimonjr/mathts-functions';
import { instanceSymbols } from './instance-symbols.js';

const factory: typeof factory_mathjsCompat.factory = factory_mathjsCompat.factory;
const factories = /* #__PURE__ */ factory_mathjsCompat.compatFactoryExports();
type ConstructorFactory<T> = ReturnType<typeof factory<Record<string, unknown>, T>>;
type CompatFactoryExports = ReturnType<typeof factory_mathjsCompat.compatFactoryExports>;

/** Factory for the MathJS-compatible sine function. */
const mathjsCreateSin: CompatFactoryExports['createSin'] = factories.createSin;

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

/** Factory bundle for a minimal MathJS-compatible sine instance. */
const sinDependencies: {
  typedDependencies: typeof typedDependencies;
  createSin: typeof mathjsCreateSin;
} = { typedDependencies, createSin: mathjsCreateSin };

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
  mathjsCreateSin as createSin,
  mathjsCreateTyped as createTyped,
  sinDependencies,
  typedDependencies,
};
