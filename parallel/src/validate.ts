/**
 * Argument validation shared by the parallel operations.
 *
 * Every check throws one message shape per kind of mistake, so callers and tests can match a
 * single text whatever the size of the input or the path (inline or workers) it would take.
 *
 * @packageDocumentation
 */

/**
 * Length check for binary element-wise operations: `<op>: lengths must match (<a> vs <b>)`.
 * @internal
 */
export function assertSameLength(op: string, a: number, b: number): void {
  if (a !== b) throw new Error(`${op}: lengths must match (${a} vs ${b})`);
}

function formatArgType(value: unknown): string {
  if (value instanceof Float64Array) return 'Float64Array';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value;
}

/**
 * Reject the common `matmul(a, b, n, n, n)` arity swap before shape checks stringify buffers.
 * @internal
 */
export function assertMatmulArgs(
  a: unknown,
  aRows: unknown,
  aCols: unknown,
  b: unknown,
  bCols: unknown
): void {
  const bad =
    !(a instanceof Float64Array) ||
    !(b instanceof Float64Array) ||
    typeof aRows !== 'number' ||
    !Number.isFinite(aRows) ||
    !Number.isInteger(aRows) ||
    typeof aCols !== 'number' ||
    !Number.isFinite(aCols) ||
    !Number.isInteger(aCols) ||
    typeof bCols !== 'number' ||
    !Number.isFinite(bCols) ||
    !Number.isInteger(bCols);

  if (bad) {
    const aLen = a instanceof Float64Array ? a.length : '?';
    throw new TypeError(
      `matmul: expected (a: Float64Array, aRows: number, aCols: number, b: Float64Array, bCols: number); ` +
        `got (a: ${formatArgType(a)}, aRows: ${formatArgType(aRows)}, aCols: ${formatArgType(aCols)}, ` +
        `b: ${formatArgType(b)}, bCols: ${formatArgType(bCols)}). a.length=${aLen}`
    );
  }
}

/**
 * Shape check for a row-major `aRows x aCols` times `bRows x bCols` product. Checks the inner
 * dimensions and that both buffers hold exactly the elements their shapes claim.
 * @internal
 */
export function assertMatmulShape(
  op: string,
  aLength: number,
  aRows: number,
  aCols: number,
  bLength: number,
  bRows: number,
  bCols: number
): void {
  if (aCols !== bRows) {
    throw new Error(`${op}: inner dimensions must match (aCols ${aCols} vs bRows ${bRows})`);
  }
  if (aLength !== aRows * aCols) {
    throw new Error(`${op}: a has ${aLength} elements, expected ${aRows}x${aCols}`);
  }
  if (bLength !== bRows * bCols) {
    throw new Error(`${op}: b has ${bLength} elements, expected ${bRows}x${bCols}`);
  }
}
