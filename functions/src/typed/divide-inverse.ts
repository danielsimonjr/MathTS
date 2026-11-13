/**
 * The public `inv` that `divide(scalar, square matrix)` uses. The factory layer imports the
 * typed arithmetic module, so the typed module cannot import `inv` itself. The factory layer
 * registers `inv` once, when it is defined. This module is internal: it is not re-exported.
 */

export type InverseFn = (m: unknown) => unknown;

const registered: { fn?: InverseFn } = {};

export function registerDivideInverse(fn: InverseFn): void {
  registered.fn = fn;
}

export function divideInverse(): InverseFn {
  if (registered.fn === undefined) {
    throw new Error('divide(scalar, matrix): the inverse function is not registered');
  }
  return registered.fn;
}
