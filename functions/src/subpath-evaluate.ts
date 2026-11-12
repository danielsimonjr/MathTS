/**
 * Focused entry: `import { evaluate } from '@danielsimonjr/mathts-functions/evaluate'`.
 * Omits the main barrel's GPU surface and is the supported tree-shake entry for
 * expression evaluation in browsers.
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
