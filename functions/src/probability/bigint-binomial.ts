/**
 * Shared BigNumber binomial product `C(total, choose)` via the short multiplicative
 * loop (per-step `times` then `dividedBy` for exact integer arithmetic).
 *
 * Not exported from the package barrel; factory handlers keep their own validation.
 */

/** Structural BigNumber shape used by legacy mathjs factory handlers. */
export interface BigNumberBinomialType {
  constructor: BigNumberBinomialConstructor;
  minus(n: BigNumberBinomialType | number): BigNumberBinomialType;
  plus(n: BigNumberBinomialType | number): BigNumberBinomialType;
  times(n: BigNumberBinomialType | number): BigNumberBinomialType;
  dividedBy(n: BigNumberBinomialType | number): BigNumberBinomialType;
  lt(n: BigNumberBinomialType | number): boolean;
  gt(n: BigNumberBinomialType | number): boolean;
  lte(n: BigNumberBinomialType | number): boolean;
  gte(n: BigNumberBinomialType | number): boolean;
  isInteger(): boolean;
}

interface BigNumberBinomialConstructor {
  new (value: number): BigNumberBinomialType;
}

/** True when `n` is a non-negative integer BigNumber. */
export function isPositiveInteger(n: BigNumberBinomialType): boolean {
  return n.isInteger() && n.gte(0);
}

/**
 * Binomial coefficient `C(total, choose)`. Same branch as the former factory
 * loops: if `choose < total - choose`, iterate `i = 1 .. total - choose`
 * multiplying `(choose + i) / i`; otherwise iterate `i = 1 .. choose`
 * multiplying `(total - choose + i) / i`. Per-step order is
 * `result.times(...).dividedBy(i)` so integer BigNumbers stay exact.
 */
export function binomialProductBigNumber<T extends BigNumberBinomialType>(total: T, choose: T): T {
  const BigNumber = total.constructor;
  const one = new BigNumber(1);
  const totalMinusChoose = total.minus(choose);
  let result: T = one as T;
  if (choose.lt(totalMinusChoose)) {
    for (let i = one; i.lte(totalMinusChoose); i = i.plus(one)) {
      result = result.times(choose.plus(i)).dividedBy(i) as T;
    }
  } else {
    for (let i = one; i.lte(choose); i = i.plus(one)) {
      result = result.times(totalMinusChoose.plus(i)).dividedBy(i) as T;
    }
  }
  return result;
}
