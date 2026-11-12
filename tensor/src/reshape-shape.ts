/** Resolve a single `-1` placeholder in a reshape target shape (NumPy rules). */
export function resolveReshapeShape(currentSize: number, shape: ReadonlyArray<number>): number[] {
  const out = [...shape];
  const minusOnes: number[] = [];
  for (let i = 0; i < out.length; i++) {
    if (out[i] === -1) minusOnes.push(i);
  }
  if (minusOnes.length > 1) {
    throw new Error(`Tensor.reshape: only one dimension can be -1, got [${shape}]`);
  }
  if (minusOnes.length === 1) {
    const known = out.reduce((acc, dim, idx) => (idx === minusOnes[0] ? acc : acc * dim), 1);
    if (known === 0) {
      throw new Error(`Tensor.reshape: cannot infer -1 with zero-sized dimension [${shape}]`);
    }
    if (currentSize % known !== 0) {
      throw new Error(
        `Tensor.reshape: size mismatch cannot infer -1 for [${shape}] (size ${currentSize})`
      );
    }
    out[minusOnes[0]!] = currentSize / known;
  }
  const newSize = out.reduce((a, b) => a * b, 1);
  if (newSize !== currentSize) {
    throw new Error(
      `Tensor.reshape: size mismatch [${shape}] -> [${out}] (size ${currentSize} vs ${newSize})`
    );
  }
  return out;
}
