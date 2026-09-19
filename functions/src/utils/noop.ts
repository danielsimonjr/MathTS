/** Throw an error, because no BigNumber implementation is available. */
export function noBignumber(): never {
  throw new Error('No "bignumber" implementation available');
}

/** Throw an error, because no Fraction implementation is available. */
export function noFraction(): never {
  throw new Error('No "fraction" implementation available');
}

/** Throw an error, because no Matrix implementation is available. */
export function noMatrix(): never {
  throw new Error('No "matrix" implementation available');
}
