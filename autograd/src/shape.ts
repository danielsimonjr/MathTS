/**
 * Shared shape guard for DualTensor and TapedTensor elementwise ops.
 */
export function assertSameShape(
  aShape: ReadonlyArray<number>,
  bShape: ReadonlyArray<number>,
  typeName: string,
  op: string
): void {
  if (aShape.length !== bShape.length || !aShape.every((v, i) => v === bShape[i])) {
    throw new Error(`${typeName}.${op}: shape mismatch [${aShape}] vs [${bShape}]`);
  }
}
