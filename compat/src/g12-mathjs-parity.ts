/**
 * Thin compat adapters so `create(all)` matches mathjs 15.3.0 error shapes and block results
 * without changing the critical typed libraries (#G12 adversarial F1–F3).
 */

import { isMatrix } from '@danielsimonjr/mathts-matrix';

function vectorLength(value: unknown): number | undefined {
  if (Array.isArray(value)) return value.length;
  if (isMatrix(value)) {
    const sized = value as unknown as { size: number[] | (() => number[]) };
    const size = typeof sized.size === 'function' ? sized.size() : sized.size;
    return size.length === 1 ? size[0] : undefined;
  }
  return undefined;
}

/**
 * Re-throw typed element-wise mismatch errors as mathjs's `Error` broadcast shape.
 */
export function mapElementwiseBroadcastError(err: unknown, a: unknown, b: unknown): never {
  if (!(err instanceof Error)) throw err;
  const message = err.message;
  if (
    !message.includes('element-wise') &&
    !message.includes('Dimension mismatch') &&
    !message.includes('Matrix dimensions must match')
  ) {
    throw err;
  }
  const leftLen = vectorLength(a);
  const rightLen = vectorLength(b);
  if (leftLen === undefined || rightLen === undefined || leftLen === rightLen) {
    throw err;
  }
  const shorter = Math.min(leftLen, rightLen);
  const longer = Math.max(leftLen, rightLen);
  throw new Error(
    `shape mismatch: mismatch is found in arg with shape (${shorter}) not possible to broadcast dimension 1 with size ${shorter} to size ${longer}`
  );
}

/**
 * Re-throw typed `divide` vector mismatch as mathjs's square-matrix `RangeError`.
 */
export function mapDivideBroadcastError(err: unknown, b: unknown): never {
  if (!(err instanceof RangeError)) throw err;
  if (!err.message.includes('Vectors must have')) throw err;
  const len = vectorLength(b);
  const size = len !== undefined ? len : 3;
  throw new RangeError(`Matrix must be square (size: [${size}])`);
}

/**
 * True when a string expression is a multi-statement block (newline or top-level `;`).
 * Matrix row separators (`[1,2;3,4]`) use `;` inside brackets and must not trigger wrapping.
 */
export function isMultiStatementExpression(expr: string): boolean {
  if (expr.includes('\n')) return true;
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
    else if (c === ';' && depth === 0) return true;
  }
  return false;
}

/** Wrap a plain block array in the compat instance's `ResultSet` constructor. */
export function wrapBlockArrayAsResultSet(
  value: unknown,
  expr: string,
  ResultSetCtor: new (entries?: unknown[]) => unknown
): unknown {
  if (!isMultiStatementExpression(expr)) return value;
  if (!Array.isArray(value)) return value;
  const ctor = (value as { constructor?: { prototype?: { isResultSet?: boolean } } }).constructor;
  if (ctor?.prototype?.isResultSet === true) return value;
  return new ResultSetCtor(value);
}
