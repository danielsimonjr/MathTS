import { factory_mathjsCompat } from '@danielsimonjr/mathts-functions';
import {
  BigNumberDependencies,
  ComplexDependencies,
  addScalarDependencies,
  ceilDependencies,
  conjDependencies,
  divideScalarDependencies,
  dotDivideDependencies,
  expDependencies,
  log2Dependencies,
  matrixDependencies,
  multiplyScalarDependencies,
  powDependencies,
  typedDependencies,
  createFft,
  createIfft,
} from './native-factory-exports.js';
import { configuredMathjsConstant } from './instance-constants.js';

const factory: typeof factory_mathjsCompat.factory = factory_mathjsCompat.factory;
type NumericFactoryDependencies = {
  config: Parameters<typeof configuredMathjsConstant>[2];
  BigNumber?: new (value: string) => object;
};
type NumberFactory = ReturnType<typeof factory<NumericFactoryDependencies, number | object>>;
type NumericBundle<Key extends string> = {
  BigNumberDependencies: typeof BigNumberDependencies;
} & Record<Key, NumberFactory>;

function numberFactory(
  name: Parameters<typeof configuredMathjsConstant>[0],
  value: number
): NumberFactory {
  return factory(
    name,
    ['?BigNumber', 'config'],
    ({ BigNumber, config }: NumericFactoryDependencies) => {
      const result = configuredMathjsConstant(name, value, config);
      return typeof result === 'number' || !BigNumber ? result : new BigNumber(result.toString());
    },
    { recreateOnConfigChange: true }
  );
}

const createE: NumberFactory = /* #__PURE__ */ numberFactory('e', Math.E);
const eDependencies: NumericBundle<'createE'> = { BigNumberDependencies, createE };
const createPi: NumberFactory = /* #__PURE__ */ numberFactory('pi', Math.PI);
const piDependencies: NumericBundle<'createPi'> = { BigNumberDependencies, createPi };
const createTau: NumberFactory = /* #__PURE__ */ numberFactory('tau', 2 * Math.PI);
const tauDependencies: NumericBundle<'createTau'> = { BigNumberDependencies, createTau };
const createPhi: NumberFactory = /* #__PURE__ */ numberFactory('phi', (1 + Math.sqrt(5)) / 2);
const phiDependencies: NumericBundle<'createPhi'> = { BigNumberDependencies, createPhi };
const createLN2: NumberFactory = /* #__PURE__ */ numberFactory('LN2', Math.LN2);
const LN2Dependencies: NumericBundle<'createLN2'> = { BigNumberDependencies, createLN2 };
const createLN10: NumberFactory = /* #__PURE__ */ numberFactory('LN10', Math.LN10);
const LN10Dependencies: NumericBundle<'createLN10'> = { BigNumberDependencies, createLN10 };
const createLOG2E: NumberFactory = /* #__PURE__ */ numberFactory('LOG2E', Math.LOG2E);
const LOG2EDependencies: NumericBundle<'createLOG2E'> = { BigNumberDependencies, createLOG2E };
const createLOG10E: NumberFactory = /* #__PURE__ */ numberFactory('LOG10E', Math.LOG10E);
const LOG10EDependencies: NumericBundle<'createLOG10E'> = { BigNumberDependencies, createLOG10E };
const createSQRT1_2: NumberFactory = /* #__PURE__ */ numberFactory('SQRT1_2', Math.SQRT1_2);
const SQRT1_2Dependencies: NumericBundle<'createSQRT1_2'> = {
  BigNumberDependencies,
  createSQRT1_2,
};
const createSQRT2: NumberFactory = /* #__PURE__ */ numberFactory('SQRT2', Math.SQRT2);
const SQRT2Dependencies: NumericBundle<'createSQRT2'> = { BigNumberDependencies, createSQRT2 };
const createInfinity: NumberFactory = /* #__PURE__ */ numberFactory('Infinity', Infinity);
const InfinityDependencies: NumericBundle<'createInfinity'> = {
  BigNumberDependencies,
  createInfinity,
};
const createNaN: NumberFactory = /* #__PURE__ */ numberFactory('NaN', NaN);
const NaNDependencies: NumericBundle<'createNaN'> = { BigNumberDependencies, createNaN };

type ConstantFactory<T> = ReturnType<typeof factory<Record<string, unknown>, T>>;

const createUppercaseE: ConstantFactory<number | object> = /* #__PURE__ */ factory(
  'E',
  ['e'],
  ({ e }: { e: number | object }) => e
);
const createUppercasePi: ConstantFactory<number | object> = /* #__PURE__ */ factory(
  'PI',
  ['pi'],
  ({ pi }: { pi: number | object }) => pi
);
const EDependencies: {
  eDependencies: typeof eDependencies;
  createUppercaseE: typeof createUppercaseE;
} = { eDependencies, createUppercaseE };
const PIDependencies: {
  piDependencies: typeof piDependencies;
  createUppercasePi: typeof createUppercasePi;
} = { piDependencies, createUppercasePi };

const createFalse: ConstantFactory<false> = /* #__PURE__ */ factory('false', [], () => false);
const createTrue: ConstantFactory<true> = /* #__PURE__ */ factory('true', [], () => true);
const createNull: ConstantFactory<null> = /* #__PURE__ */ factory('null', [], () => null);
const falseDependencies: { createFalse: typeof createFalse } = { createFalse };
const trueDependencies: { createTrue: typeof createTrue } = { createTrue };
const nullDependencies: { createNull: typeof createNull } = { createNull };

const createI: ConstantFactory<object> = /* #__PURE__ */ factory(
  'i',
  ['Complex'],
  ({ Complex }: { Complex: new (re: number, im: number) => object }) => new Complex(0, 1),
  { recreateOnConfigChange: true }
);
const iDependencies: { ComplexDependencies: typeof ComplexDependencies; createI: typeof createI } =
  { ComplexDependencies, createI };

const mathjsFalse = false;
const mathjsTrue = true;
const mathjsNull = null;
export { Infinity_ as _Infinity, NaN_ as _NaN } from './shims.js';

const fftDependencies: {
  addScalarDependencies: typeof addScalarDependencies;
  ceilDependencies: typeof ceilDependencies;
  conjDependencies: typeof conjDependencies;
  divideScalarDependencies: typeof divideScalarDependencies;
  dotDivideDependencies: typeof dotDivideDependencies;
  expDependencies: typeof expDependencies;
  iDependencies: typeof iDependencies;
  log2Dependencies: typeof log2Dependencies;
  matrixDependencies: typeof matrixDependencies;
  multiplyScalarDependencies: typeof multiplyScalarDependencies;
  powDependencies: typeof powDependencies;
  tauDependencies: typeof tauDependencies;
  typedDependencies: typeof typedDependencies;
  createFft: typeof createFft;
} = {
  addScalarDependencies,
  ceilDependencies,
  conjDependencies,
  divideScalarDependencies,
  dotDivideDependencies,
  expDependencies,
  iDependencies,
  log2Dependencies,
  matrixDependencies,
  multiplyScalarDependencies,
  powDependencies,
  tauDependencies,
  typedDependencies,
  createFft,
};

const ifftDependencies: {
  conjDependencies: typeof conjDependencies;
  dotDivideDependencies: typeof dotDivideDependencies;
  fftDependencies: typeof fftDependencies;
  typedDependencies: typeof typedDependencies;
  createIfft: typeof createIfft;
} = {
  conjDependencies,
  dotDivideDependencies,
  fftDependencies,
  typedDependencies,
  createIfft,
};

export {
  ifftDependencies,
  fftDependencies,
  mathjsFalse as _false,
  mathjsTrue as _true,
  mathjsNull as _null,
  createUppercaseE,
  createUppercasePi,
  EDependencies,
  PIDependencies,
  createFalse,
  createTrue,
  createNull,
  falseDependencies,
  trueDependencies,
  nullDependencies,
  createI,
  iDependencies,
  createE,
  eDependencies,
  createPi,
  piDependencies,
  createTau,
  tauDependencies,
  createPhi,
  phiDependencies,
  createLN2,
  LN2Dependencies,
  createLN10,
  LN10Dependencies,
  createLOG2E,
  LOG2EDependencies,
  createLOG10E,
  LOG10EDependencies,
  createSQRT1_2,
  SQRT1_2Dependencies,
  createSQRT2,
  SQRT2Dependencies,
  createInfinity,
  InfinityDependencies,
  createNaN,
  NaNDependencies,
};
