import { isCollection } from '../../utils/is.js';

interface EvalNode {
  compile(): { evaluate(scope: unknown): unknown };
}

/** Short-circuit decision for the left operand of a binary transform. */
export type Absorb = { readonly take: false } | { readonly take: true; readonly value: unknown };

/**
 * Evaluate a lazy binary operator transform: compile/evaluate the left arg
 * with `scope`, optionally return early via `absorb` when the left value is
 * not a collection (so the right arg is never compiled/evaluated), otherwise
 * evaluate the right arg with the same `scope` and call `op`.
 */
export function evalShortCircuitBinary(
  args: EvalNode[],
  scope: unknown,
  op: (left: unknown, right: unknown) => unknown,
  absorb: (left: unknown) => Absorb
): unknown {
  const left = args[0].compile().evaluate(scope);
  if (!isCollection(left)) {
    const early = absorb(left);
    if (early.take) {
      return early.value;
    }
  }
  const right = args[1].compile().evaluate(scope);
  return op(left, right);
}
