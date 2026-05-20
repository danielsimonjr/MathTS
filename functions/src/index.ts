/**
 * @danielsimonjr/mathts-functions
 *
 * Mathematical functions for MathTS - arithmetic, algebra,
 * trigonometry, statistics, and more.
 *
 * Uses typed-function for polymorphic dispatch across numeric types.
 *
 * @packageDocumentation
 */

// Typed functions (polymorphic via mathTyped)
export * from './typed/index.js';

// Activated mathjs leaf factory functions
export * from './factories/index.js';

// Expression evaluator (wired to full math scope)
export {
  evaluate,
  compileExpr,
  parse,
  parser,
  reviver,
  replacer,
} from './factories/evaluate.js';
