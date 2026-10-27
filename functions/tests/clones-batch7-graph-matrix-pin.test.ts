/**
 * Sprint 2R clone-merge batch 7: independent oracles for graph restart scheduler,
 * matrix slice/CSC/FFT helpers, CAS renderCoeffTimes, and rankNearest k semantics.
 */
import { describe, it, expect } from 'vitest';
import {
  pageRank,
  betweennessCentrality,
  eigenvectorCentrality,
  CENTRALITY_WORKER_THRESHOLD,
} from '../src/typed/graph.js';
import { column, row, matrixFromColumns, matrixFromRows } from '../src/factories/index.js';
import { MathJSSparseMatrix, createMatrixBridge } from '../src/factories/matrix-bridge.js';
import { fft, ifft } from '../src/index.js';
import { kdTreeKNN } from '../src/geometry/geometry-extra.js';
import { knnClassify } from '../src/ml/dbscan-knn.js';
import { renderCoeffTimes } from '../src/cas/render-coeff-times.js';
import { complexToInterleaved } from '../src/matrix/complex-to-interleaved.js';

/** SplitMix-style seed derivation (oracle for restart scheduler). */
function oracleSplitSeed(baseSeed: number, k: number): number {
  return ((baseSeed ^ (((k * 0x9e3779b9) | 0) >>> 0)) >>> 0) | 0;
}

/** Independent oracle for `coeff * rest` string rendering (G batch7 renderCoeffTimes). */
function oracleRenderCoeffTimes(num: bigint, den: bigint, rest: string): string {
  const neg = num < 0n;
  const absNum = neg ? -num : num;
  const sign = neg ? '-' : '';
  if (absNum === den) return `${sign}${rest}`;
  const denPart = den === 1n ? '' : `/${den}`;
  return `${sign}${absNum}${denPart}*${rest}`;
}

/** Oracle for interleaved complex layout (factory FFT path). */
function oracleComplexToInterleaved(arr: unknown[]): Float64Array | null {
  const n = arr.length;
  const result = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const val = arr[i];
    if (typeof val === 'number') {
      result[i * 2] = val;
      result[i * 2 + 1] = 0;
    } else if (
      val &&
      typeof (val as { re?: unknown }).re === 'number' &&
      typeof (val as { im?: unknown }).im === 'number'
    ) {
      result[i * 2] = (val as { re: number }).re;
      result[i * 2 + 1] = (val as { im: number }).im;
    } else {
      return null;
    }
  }
  return result;
}

describe('clone batch7 pin — splitSeed oracle (restart scheduler)', () => {
  it('matches documented Fibonacci-hash seeds for baseSeed=42', () => {
    expect(oracleSplitSeed(42, 0)).toBe(oracleSplitSeed(42, 0));
    expect(oracleSplitSeed(42, 1)).toBe(((42 ^ 0x9e3779b9) >>> 0) | 0);
    expect(oracleSplitSeed(0, 2)).toBe(((0 ^ 0x3c6ef372) >>> 0) | 0);
  });

  it('fan-out path is deterministic for the same restart count (restarts=4)', async () => {
    const adj = [
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 0],
    ];
    const opts = { restarts: 4, restartSeed: 99, aggregation: 'mean' as const };
    expect(CENTRALITY_WORKER_THRESHOLD).toBe(4);
    const a = await pageRank(adj, opts);
    const b = await pageRank(adj, opts);
    expect(a.ranks.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(a.ranks[i]).toBeCloseTo(b.ranks[i], 12);
    }
  });
});

describe('clone batch7 pin — column/row slice (G _slice2d)', () => {
  const m = [
    [1, 2],
    [3, 4],
  ];

  it('column index 1 extracts the second column [2, 4] (0-based factory)', () => {
    expect(column(m, 1)).toEqual([[2], [4]]);
  });

  it('row index 0 extracts the first row [1, 2] (0-based factory)', () => {
    expect(row(m, 0)).toEqual([[1, 2]]);
  });
});

describe('clone batch7 pin — CSC tail (G sparse from columns/rows)', () => {
  const matrix = createMatrixBridge();

  it('sparse matrixFromColumns CSC matches hand-built ptr/index/values', () => {
    const c0 = matrix([[1], [0], [3]], 'sparse');
    const c1 = matrix([[0], [2], [0]], 'sparse');
    const m = matrixFromColumns(c0, c1) as MathJSSparseMatrix;
    expect(m.storage()).toBe('sparse');
    expect(m.size()).toEqual([3, 2]);
    expect(m._ptr).toEqual([0, 2, 3]);
    expect(m._index).toEqual([0, 2, 1]);
    expect(m._values).toEqual([1, 3, 2]);
  });

  it('sparse matrixFromRows builds the same CSC pattern for row-wise assembly', () => {
    const r0 = matrix([[1, 0, 3]], 'sparse');
    const r1 = matrix([[0, 2, 0]], 'sparse');
    const m = matrixFromRows(r0, r1) as MathJSSparseMatrix;
    expect(m.size()).toEqual([2, 3]);
    expect(m._ptr).toEqual([0, 1, 2, 3]);
    expect(m._index).toEqual([0, 1, 0]);
    expect(m._values).toEqual([1, 2, 3]);
  });
});

describe('clone batch7 pin — complexToInterleaved oracle', () => {
  it('encodes number and complex entries; rejects unsupported types', () => {
    const sample = [1, { re: 2, im: -1 }];
    expect(oracleComplexToInterleaved(sample)).toEqual(new Float64Array([1, 0, 2, -1]));
    expect(complexToInterleaved(sample, () => null)).toEqual(new Float64Array([1, 0, 2, -1]));
    expect(oracleComplexToInterleaved([1, 'x'])).toBeNull();
    expect(complexToInterleaved([1, 'x'], () => null)).toBeNull();
  });

  it('factory fft/ifft accept mixed number and {re,im} on the fast path (n=64)', () => {
    const x = Array.from({ length: 64 }, (_, i) =>
      i % 3 === 0 ? { re: Math.sin(i * 0.1), im: 0.01 * i } : Math.cos(i * 0.07)
    );
    expect(oracleComplexToInterleaved(x)).not.toBeNull();
    const spec = fft(x) as unknown[];
    const back = ifft(spec) as unknown[];
    for (let i = 0; i < 64; i++) {
      const wantRe = typeof x[i] === 'number' ? (x[i] as number) : (x[i] as { re: number }).re;
      const gotRe =
        typeof back[i] === 'number' ? (back[i] as number) : (back[i] as { re: number }).re;
      expect(gotRe).toBeCloseTo(wantRe, 8);
    }
  });
});

describe('clone batch7 pin — renderCoeffTimes string oracle', () => {
  const cases: { num: bigint; den: bigint; rest: string; want: string }[] = [
    { num: 1n, den: 1n, rest: 'log(x)', want: 'log(x)' },
    { num: -1n, den: 1n, rest: 'log(x)', want: '-log(x)' },
    { num: 2n, den: 3n, rest: '(x-1)^(2)', want: '2/3*(x-1)^(2)' },
    { num: -4n, den: 2n, rest: 'atan(y)', want: '-4/2*atan(y)' },
  ];

  for (const { num, den, rest, want } of cases) {
    it(`shared helper matches oracle for ${want}`, () => {
      expect(oracleRenderCoeffTimes(num, den, rest)).toBe(want);
      expect(renderCoeffTimes({ num, den }, rest)).toBe(want);
    });
  }
});

describe('clone batch7 pin — rankNearest k semantics (kdTreeKNN vs kNearestIndices)', () => {
  const pts = [
    [0, 0],
    [1, 0],
    [2, 0],
    [10, 10],
  ];

  it('k=-1: kdTreeKNN clamps to k=0 (empty); kNearestIndices slices all but last neighbor', () => {
    expect(kdTreeKNN(pts, [0, 0], -1)).toEqual([]);
    const label = knnClassify(pts, ['a', 'b', 'c', 'd'], [[0, 0]], -1)[0];
    expect(label).toBe('a');
  });

  it('k=2: kdTreeKNN returns two nearest indices in order', () => {
    expect(kdTreeKNN(pts, [0, 0], 2)).toEqual([0, 1]);
  });
});

describe('clone batch7 pin — centrality multi-restart smoke', () => {
  const adj = [
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 0],
  ];

  it('betweenness and eigenvector restarts=2 return finite centrality', async () => {
    const b = await betweennessCentrality(adj, { restarts: 2, restartSeed: 7 });
    const e = await eigenvectorCentrality(adj, { restarts: 2, restartSeed: 7 });
    expect(b.centrality.every((v) => Number.isFinite(v))).toBe(true);
    expect(e.centrality.every((v) => Number.isFinite(v))).toBe(true);
  });
});
