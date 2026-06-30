import { describe, it, expect } from 'vitest';
import { Tensor, tensorSvd, tensorSvdWasm, tensorEig, tensorEigWasm } from '../../src/index';

/**
 * GC8 — tensor decompositions reach the AssemblyScript WASM primitives via async
 * tensorSvdWasm / tensorEigWasm. They must produce the same result as the sync
 * variants (svdWasm/eigWasm fall back to JS when no binary is present, so this
 * is exact agreement).
 */
const sym = new Tensor([3, 3], new Float64Array([4, 1, 2, 1, 5, 3, 2, 3, 6]));

describe('GC8: tensorSvdWasm', () => {
  it('matches tensorSvd singular values', async () => {
    const a = tensorSvd(sym, [0]);
    const b = await tensorSvdWasm(sym, [0]);
    const sa = Array.from(a.S.data);
    const sb = Array.from(b.S.data);
    expect(sb.length).toBe(sa.length);
    for (let i = 0; i < sa.length; i++) expect(sb[i]).toBeCloseTo(sa[i], 12);
    expect(b.U.shape).toEqual(a.U.shape);
    expect(b.V.shape).toEqual(a.V.shape);
  });
});

describe('GC8: tensorEigWasm', () => {
  it('matches tensorEig eigenvalues (symmetric)', async () => {
    const a = tensorEig(sym, [0], { symmetric: true });
    const b = await tensorEigWasm(sym, [0], { symmetric: true });
    const sortNum = (t: Tensor) => Array.from(t.data).sort((x, y) => x - y);
    const ea = sortNum(a.eigenvalues);
    const eb = sortNum(b.eigenvalues);
    for (let i = 0; i < ea.length; i++) expect(eb[i]).toBeCloseTo(ea[i], 9);
  });
});
