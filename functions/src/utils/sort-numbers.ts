import { cmpNanLast } from '../wasm/sort/wasm-bridge.js';

/** Returns true when any entry is NaN (needs NaN-last ordering). */
export function arrayHasNaN(arr: readonly number[]): boolean {
  for (let i = 0; i < arr.length; i++) {
    if (Number.isNaN(arr[i])) return true;
  }
  return false;
}

type NumberCompare = (a: number, b: number) => number;

/**
 * Sort a plain `number[]` in place (ascending). Uses native `Float64Array.sort`
 * when all values are finite numbers; `defaultCompare` when any NaN is present
 * (matches factory `compare`, not NaN-last f64 kernels).
 */
export function sortNumbersInPlace(
  arr: number[],
  descending = false,
  defaultCompare?: NumberCompare
): void {
  if (arr.length === 0) return;
  if (arrayHasNaN(arr)) {
    const cmp = defaultCompare;
    if (!cmp) {
      throw new Error('sortNumbersInPlace: default compare required when array contains NaN');
    }
    const c = descending ? (a: number, b: number) => -cmp(a, b) : cmp;
    arr.sort(c);
    return;
  }

  const buf = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) buf[i] = arr[i];
  buf.sort();
  if (!descending) {
    for (let i = 0; i < arr.length; i++) arr[i] = buf[i];
    return;
  }
  for (let i = 0, j = arr.length - 1; j >= 0; i++, j--) arr[i] = buf[j];
}

/** Descending number sort (mirrors `compare` desc on numbers). */
export function sortNumbersDescendingInPlace(arr: number[], defaultCompare?: NumberCompare): void {
  if (arr.length === 0) return;
  if (arrayHasNaN(arr)) {
    sortNumbersInPlace(arr, true, defaultCompare);
    return;
  }
  const buf = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) buf[i] = arr[i];
  buf.sort((a, b) => cmpNanLast(b, a));
  for (let i = 0; i < arr.length; i++) arr[i] = buf[i];
}
