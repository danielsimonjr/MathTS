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
