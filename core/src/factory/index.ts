/**
 * Factory pattern exports
 */

export {
  FunctionRegistry,
  createFactory,
  createTypedFunction,
  registry,
  math,
  DEFAULT_CONFIG,
} from './factory.js';

export type {
  MathTSConfig,
  FactoryFunction,
  FactoryDependencies,
  FactoryImport,
} from './factory.js';
