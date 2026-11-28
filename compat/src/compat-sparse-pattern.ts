/**
 * mathjs 15.3.0 sparse pattern-matrix CSC union for `add` (#1785).
 */

export type CscLike = {
  _values: unknown[] | null;
  _index: number[];
  _ptr: number[];
  _size: number[];
  isSparseMatrix?: boolean;
  type?: string;
  storage?: () => string;
};

function isCompatSparse(m: unknown): m is CscLike {
  return (
    typeof m === 'object' &&
    m !== null &&
    Array.isArray((m as CscLike)._ptr) &&
    Array.isArray((m as CscLike)._index) &&
    ((m as CscLike).isSparseMatrix === true ||
      (m as { type?: string }).type === 'SparseMatrix' ||
      (m as { storage?: () => string }).storage?.() === 'sparse')
  );
}

function columnUnionPattern(
  a: CscLike,
  b: CscLike
): { index: number[]; ptr: number[]; size: number[] } {
  const rows = a._size[0];
  const columns = a._size[1];
  const index: number[] = [];
  const ptr = [0];
  for (let j = 0; j < columns; j++) {
    const rowsInCol = new Set<number>();
    for (let k = a._ptr[j]; k < a._ptr[j + 1]; k++) rowsInCol.add(a._index[k]);
    for (let k = b._ptr[j]; k < b._ptr[j + 1]; k++) rowsInCol.add(b._index[k]);
    for (const i of [...rowsInCol].sort((x, y) => x - y)) {
      if (i >= 0 && i < rows) index.push(i);
    }
    ptr.push(index.length);
  }
  return { index, ptr, size: [rows, columns] };
}

/**
 * True when `add` should use pattern CSC union (pattern⊕pattern or pattern⊕value).
 */
export function shouldUnionSparsePatterns(a: unknown, b: unknown): boolean {
  if (!isCompatSparse(a) || !isCompatSparse(b)) return false;
  return a._values === null || b._values === null;
}

/**
 * Union sparse CSC structures; pattern results keep `_values === null`.
 */
export function unionSparseForAdd(
  SparseCtor: new (data: unknown) => CscLike,
  a: CscLike,
  b: CscLike
): CscLike {
  const { index, ptr, size } = columnUnionPattern(a, b);
  const patternOut = a._values === null || b._values === null;
  return new SparseCtor({
    values: patternOut ? null : undefined,
    index,
    ptr,
    size,
  });
}
