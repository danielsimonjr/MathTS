/**
 * @danielsimonjr/mathts-evaluator
 *
 * Standalone compiler + evaluator for MathTS expressions. Re-exports the
 * evaluation half of {@link @danielsimonjr/mathts-expression} -- `compile`
 * (AST -> executable), `createEvaluate` (build an `evaluate(expr, scope?)`
 * function), and `compileExpression` -- as a focused package, completing the
 * `parse -> compile -> evaluate` pipeline alongside `@danielsimonjr/mathts-parser`.
 * The implementation lives in expression; this is an entry point, not a copy.
 *
 * @example
 * ```ts
 * import { createEvaluate } from '@danielsimonjr/mathts-evaluator';
 * import { createParse } from '@danielsimonjr/mathts-parser';
 * // wire createParse into a math scope, then:
 * // const evaluate = createEvaluate(parse, mathScope);
 * // evaluate('2 + 3'); // 5
 * ```
 *
 * @packageDocumentation
 */

export {
  compile,
  createEvaluate,
  compileExpression,
} from '@danielsimonjr/mathts-expression';

export type { CompiledExpression, Scope } from '@danielsimonjr/mathts-expression';
