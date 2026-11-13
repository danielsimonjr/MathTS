/**
 * Focused entry: `import { evaluate } from '@danielsimonjr/mathts-functions/evaluate'`.
 * Re-exports `evaluate`, `parse` and `compileExpr` without the rest of the barrel.
 * `evaluate` resolves any function name, so this entry needs the whole function
 * table; it is not a size saving (about 1.19 MB minified, under 1 percent below
 * the barrel). For a small bundle use `@danielsimonjr/mathts-expression`.
 *
 * @packageDocumentation
 */

export {
  evaluate,
  compileExpr,
  parse,
  parser,
  physicsScope,
  reviver,
  replacer,
} from './factories/evaluate.js';
export type { PhysicsEvaluateOptions } from './factories/evaluate.js';
