import type { Tensor } from '@danielsimonjr/mathts-tensor';
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

/**
 * Return a new Float64Array that holds the logical values of `t`, in row-major order.
 * The array never shares storage with `t`. The function copies the values once.
 */
export function ownedCopy(t: Tensor): Float64Array {
  return t.isContiguous() ? t.buffer.slice() : t.data;
}
