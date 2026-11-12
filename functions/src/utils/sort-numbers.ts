import { cmpNanLast, sortF64JS } from '../wasm/sort/wasm-bridge.js';

/** Returns true when any entry is NaN (needs NaN-last ordering). */
export function arrayHasNaN(arr: readonly number[]): boolean {
  for (let i = 0; i < arr.length; i++) {
    if (Number.isNaN(arr[i])) return true;
  }
  return false;
}

/**
 * Sort a plain `number[]` in place (ascending). Uses native `Float64Array.sort`
 * when all values are finite numbers; NaN-last when any NaN is present.
 */
export function sortNumbersInPlace(arr: number[], descending = false): void {
  if (arr.length === 0) return;
  if (arrayHasNaN(arr)) {
    const buf = new Float64Array(arr.length);
    for (let i = 0; i < arr.length; i++) buf[i] = arr[i];
    sortF64JS(buf);
    if (!descending) {
      for (let i = 0; i < arr.length; i++) arr[i] = buf[i];
      return;
    }
    for (let i = 0, j = arr.length - 1; j >= 0; i++, j--) arr[i] = buf[j];
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

/** Descending number sort with NaN-last (mirrors `compare` desc on numbers). */
export function sortNumbersDescendingInPlace(arr: number[]): void {
  if (arr.length === 0) return;
  if (arrayHasNaN(arr)) {
    sortNumbersInPlace(arr, false);
    arr.reverse();
    return;
  }
  const buf = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) buf[i] = arr[i];
  buf.sort((a, b) => cmpNanLast(b, a));
  for (let i = 0; i < arr.length; i++) arr[i] = buf[i];
}
