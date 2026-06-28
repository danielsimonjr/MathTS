import { memoize } from '../function.js';

/** Instance methods used when building BigNumber constants. */
interface BigNumberInstance {
  exp(): BigNumberInstance;
  plus(other: BigNumberInstance): BigNumberInstance;
  sqrt(): BigNumberInstance;
  div(other: number): BigNumberInstance;
  times(other: number): BigNumberInstance;
}

/** Constructor (with static helpers / precision) of a BigNumber implementation. */
interface BigNumberConstructor {
  new (value: number): BigNumberInstance;
  acos(value: number): BigNumberInstance;
  precision: number;
}

/**
 * Calculate BigNumber e
 * @param {function} BigNumber   BigNumber constructor
 * @returns {BigNumber} Returns e
 */
export const createBigNumberE = memoize(function (BigNumber: unknown) {
  return new (BigNumber as BigNumberConstructor)(1).exp();
}, { hasher });

/**
 * Calculate BigNumber golden ratio, phi = (1+sqrt(5))/2
 * @param {function} BigNumber   BigNumber constructor
 * @returns {BigNumber} Returns phi
 */
export const createBigNumberPhi = memoize(function (BigNumber: unknown) {
  const Ctor = BigNumber as BigNumberConstructor;
  return new Ctor(1).plus(new Ctor(5).sqrt()).div(2);
}, { hasher });

/**
 * Calculate BigNumber pi.
 * @param {function} BigNumber   BigNumber constructor
 * @returns {BigNumber} Returns pi
 */
export const createBigNumberPi = memoize(function (BigNumber: unknown) {
  return (BigNumber as BigNumberConstructor).acos(-1);
}, { hasher });

/**
 * Calculate BigNumber tau, tau = 2 * pi
 * @param {function} BigNumber   BigNumber constructor
 * @returns {BigNumber} Returns tau
 */
export const createBigNumberTau = memoize(function (BigNumber: unknown) {
  return (createBigNumberPi(BigNumber) as BigNumberInstance).times(2);
}, { hasher });

/**
 * Create a hash for a BigNumber constructor function. The created has is
 * the configured precision
 * @param {Array} args         Supposed to contain a single entry with
 *                             a BigNumber constructor
 * @return {number} precision
 * @private
 */
function hasher(args: unknown[]): string {
  return String((args[0] as { precision: number }).precision);
}
