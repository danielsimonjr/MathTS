/**
 * @danielsimonjr/mathts
 *
 * One npm install for the MathTS calls Universal-Physics-Tensor makes:
 * `parse`, `evaluate`, and `simplify`.
 *
 * Tensor and automatic differentiation are separate entry points so a formula
 * parser does not load them:
 *
 * ```ts
 * import { Tensor } from '@danielsimonjr/mathts/tensor';
 * import { forwardGrad, reverseGrad } from '@danielsimonjr/mathts/autograd';
 * ```
 *
 * `@danielsimonjr/mathts/functions` is the same module shape as
 * `@danielsimonjr/mathts-functions` (a re-export, not a copy).
 *
 * ESM-only. Node >= 20 and Bun >= 1.4.2.
 *
 * @example
 * ```ts
 * import { evaluate, parse } from '@danielsimonjr/mathts';
 *
 * evaluate('1 + 2 * 3'); // 7
 * parse('sqrt(4)').evaluate({}); // 2
 * ```
 *
 * @packageDocumentation
 */

export { evaluate, parse, simplify } from '@danielsimonjr/mathts-functions';
