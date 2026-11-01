import type { TypedFunction } from '../core/function/typed.js';

/**
 * The implementation `typed` dispatches to for `signature`, resolved once so that a hot loop can
 * call it without per-call dispatch.
 *
 * `typed.find` throws when `fn` is not a typed function or has no such signature, and a factory
 * dependency can be replaced by either. Then this returns `null` and the caller keeps its
 * generic path, which dispatches per call exactly as before.
 */
export function findTypedImpl<A extends unknown[], R>(
  typed: TypedFunction,
  fn: unknown,
  signature: string[]
): ((...args: A) => R) | null {
  try {
    return typed.find(fn as TypedFunction, signature) as unknown as (...args: A) => R;
  } catch {
    return null;
  }
}
