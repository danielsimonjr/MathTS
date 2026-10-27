/**
 * Sprint 2R clone-merge batch 7: independent oracles for graph restart scheduler,
 * matrix slice/CSC/FFT helpers, CAS renderCoeffTimes, and rankNearest k semantics.
 *
 * Expected values are literals / hand-computed arrays / exact strings. Errors are
 * compared by class + message string (vitest `toThrow(new Error(...))` also
 * compares IndexError extra fields and is the wrong matcher here).
 */
import { describe, it, expect } from 'vitest';
import { IndexError } from '../src/error/IndexError.js';
import {
  pageRank,
  betweennessCentrality,
  eigenvectorCentrality,
  CENTRALITY_WORKER_THRESHOLD,
} from '../src/typed/graph.js';
import {
  CENTRALITY_WORKER_THRESHOLD as HELPER_THRESHOLD,
  runCentralityRestarts,
} from '../src/typed/centrality-restarts.js';
import { column, row, matrixFromColumns, matrixFromRows } from '../src/factories/index.js';
import { MathJSSparseMatrix, createMatrixBridge } from '../src/factories/matrix-bridge.js';
import { fft, ifft } from '../src/index.js';
import { kdTreeKNN } from '../src/geometry/geometry-extra.js';
import { knnClassify, rankNearest } from '../src/ml/dbscan-knn.js';
import { renderCoeffTimes } from '../src/cas/render-coeff-times.js';
import { complexToInterleaved } from '../src/matrix/complex-to-interleaved.js';
import { slice2d } from '../src/matrix/slice-2d.js';
import { buildSparseCscFromEntries } from '../src/matrix/sparse-csc-tail.js';

type MatrixLike = { size(): number[]; subset(index: unknown): unknown; valueOf?: () => unknown };
type TestMatrixCtor = (data: unknown[][]) => MatrixLike;
const passThroughCtor: TestMatrixCtor = ((data: unknown[][]) => data) as unknown as TestMatrixCtor;
const dummyCtor: TestMatrixCtor = () => ({ size: () => [1, 1], subset: () => 0 });

function splitSeed(baseSeed: number, k: number): number {
  return ((baseSeed ^ (((k * 0x9e3779b9) | 0) >>> 0)) >>> 0) | 0;
}

function expectError(
  fn: () => unknown,
  ctor: typeof Error | typeof IndexError,
  message: string
): void {
  let thrown: unknown;
  try {
    fn();
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(ctor);
  expect(Object.getPrototypeOf(thrown)).toBe(ctor.prototype);
  expect((thrown as Error).message).toBe(message);
}

describe('clone batch7 pin — restart scheduler (runCentralityRestarts)', () => {
  it('CENTRALITY_WORKER_THRESHOLD is 4 on the helper and the graph re-export', () => {
    expect(HELPER_THRESHOLD).toBe(4);
    expect(CENTRALITY_WORKER_THRESHOLD).toBe(4);
  });

  it('sequential path (restarts=3 < 4) applies splitSeed then seed===0 ? 1 : seed', async () => {
    const seen: number[] = [];
    const out = await runCentralityRestarts(
      3,
      0,
      splitSeed,
      (s) => {
        seen.push(s);
        return new Float64Array([s]);
      },
      (vectors) => vectors.map((v) => v[0]),
      'mean'
    );
    // k=0: splitSeed(0,0)=0 → coerced to 1; k=1,2: non-zero Fibonacci-hash literals
    expect(seen).toEqual([1, -1640531527, 1013904242]);
    expect(out).toEqual([1, -1640531527, 1013904242]);
  });

  it('fan-out path (restarts=4) records the same coerced seeds in k order', async () => {
    const seen: number[] = [];
    await runCentralityRestarts(
      4,
      99,
      splitSeed,
      (s) => {
        seen.push(s);
        return new Float64Array([s]);
      },
      (vectors) => vectors,
      'mean'
    );
    expect(seen).toEqual([99, -1640531494, 1013904145, -626627256]);
  });

  it('restarts===1 stays in wrappers with seed 0; return keys stay {ranks} vs {centrality}', async () => {
    const adj = [
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 0],
    ];
    const pr = await pageRank(adj, { restarts: 1, restartSeed: 999, aggregation: 'all' });
    expect(Object.keys(pr)).toEqual(['ranks']);
    expect(pr).not.toHaveProperty('ranksPerRestart');
    expect(pr.ranks.length).toBe(3);

    const bc = await betweennessCentrality(adj, { restarts: 1, aggregation: 'all' });
    expect(Object.keys(bc)).toEqual(['centrality']);
    expect(bc).not.toHaveProperty('centralityPerRestart');

    const ev = await eigenvectorCentrality(adj, { restarts: 1, aggregation: 'all' });
    expect(Object.keys(ev)).toEqual(['centrality']);
  });

  it('multi-restart pageRank returns {ranks}; betweenness/eigenvector return {centrality}', async () => {
    const adj = [
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 0],
    ];
    const pr = await pageRank(adj, { restarts: 2, restartSeed: 7 });
    expect(Object.keys(pr).sort()).toEqual(['ranks']);
    const bc = await betweennessCentrality(adj, { restarts: 2, restartSeed: 7 });
    expect(Object.keys(bc).sort()).toEqual(['centrality']);
    const ev = await eigenvectorCentrality(adj, { restarts: 2, restartSeed: 7 });
    expect(Object.keys(ev).sort()).toEqual(['centrality']);
    expect(bc.centrality.every((v) => Number.isFinite(v))).toBe(true);
    expect(ev.centrality.every((v) => Number.isFinite(v))).toBe(true);
  });
});

describe('clone batch7 pin — column/row slice (slice2d)', () => {
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

  it('axis 0 builds Index([i], cols); axis 1 builds Index(rows, [j])', () => {
    class FakeIndex {
      args: unknown[];
      constructor(...args: unknown[]) {
        this.args = args;
      }
    }
    const rangeFn = (start: number, end: number) => ({ start, end });
    let seen: unknown;
    const value: MatrixLike = {
      size: () => [3, 5],
      subset: (index: unknown) => {
        seen = index;
        return 0;
      },
    };
    slice2d(value, 1, 2, passThroughCtor, FakeIndex, rangeFn);
    expect((seen as FakeIndex).args).toEqual([{ start: 0, end: 3 }, [2]]);
    slice2d(value, 0, 1, passThroughCtor, FakeIndex, rangeFn);
    expect((seen as FakeIndex).args).toEqual([[1], { start: 0, end: 5 }]);
  });

  it('non-2-D input throws Error with the original message (class + string)', () => {
    const value: MatrixLike = {
      size: () => [2, 2, 2],
      subset: () => {
        throw new Error('subset must not run');
      },
    };
    expectError(
      () => slice2d(value, 0, 0, dummyCtor, class {}, () => 0),
      Error,
      'Only two dimensional matrix is supported'
    );
  });

  it('out-of-range column/row throw IndexError by class + message (not toThrow(new Error))', () => {
    expectError(() => column(m, 2), IndexError, 'Index out of range (2 > 1)');
    expectError(() => row(m, 2), IndexError, 'Index out of range (2 > 1)');
    expectError(() => column(m, -1), IndexError, 'Index out of range (-1 < 0)');
  });

  it('subset matrix result is returned as-is; a scalar is wrapped as [[value]]', () => {
    class FakeIndex {
      args: unknown[];
      constructor(...args: unknown[]) {
        this.args = args;
      }
    }
    class FakeMatrix {
      size(): number[] {
        return [2, 1];
      }
      subset(): unknown {
        return 0;
      }
    }
    Object.defineProperty(FakeMatrix.prototype, 'isMatrix', { value: true });
    const wrapped: unknown[][][] = [];
    const wrap: TestMatrixCtor = ((data: unknown[][]) => {
      wrapped.push(data);
      return data;
    }) as unknown as TestMatrixCtor;
    const matrixResult = new FakeMatrix();
    const asMatrix: MatrixLike = {
      size: () => [2, 2],
      subset: () => matrixResult,
    };
    expect(slice2d(asMatrix, 1, 0, wrap, FakeIndex, (a, b) => ({ a, b }))).toBe(matrixResult);
    expect(wrapped).toEqual([]);

    const asScalar: MatrixLike = {
      size: () => [2, 2],
      subset: () => 4,
    };
    expect(slice2d(asScalar, 1, 1, wrap, FakeIndex, (a, b) => ({ a, b }))).toEqual([[4]]);
    expect(wrapped).toEqual([[[4]]]);
  });
});

describe('clone batch7 pin — CSC tail (buildSparseCscFromEntries)', () => {
  const matrixBridge = createMatrixBridge();

  it('sparse matrixFromColumns CSC matches hand-built ptr/index/values', () => {
    const c0 = matrixBridge([[1], [0], [3]], 'sparse');
    const c1 = matrixBridge([[0], [2], [0]], 'sparse');
    const result = matrixFromColumns(c0, c1) as MathJSSparseMatrix;
    expect(result.storage()).toBe('sparse');
    expect(result.size()).toEqual([3, 2]);
    expect(result._ptr).toEqual([0, 2, 3]);
    expect(result._index).toEqual([0, 2, 1]);
    expect(result._values).toEqual([1, 3, 2]);
  });

  it('sparse matrixFromRows builds the swapped [N,M] CSC pattern', () => {
    const r0 = matrixBridge([[1, 0, 3]], 'sparse');
    const r1 = matrixBridge([[0, 2, 0]], 'sparse');
    const result = matrixFromRows(r0, r1) as MathJSSparseMatrix;
    expect(result.size()).toEqual([2, 3]);
    expect(result._ptr).toEqual([0, 1, 2, 3]);
    expect(result._index).toEqual([0, 1, 0]);
    expect(result._values).toEqual([1, 2, 3]);
  });

  it('sorts by col then row and keeps duplicate (col,row) pairs in encounter order', () => {
    const captured = buildSparseCscFromEntries(
      [
        { row: 1, col: 0, value: 5 },
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 0, value: 7 },
      ],
      2,
      [3, 2],
      (data) => data
    ) as { values: unknown[]; index: number[]; ptr: number[]; size: number[] };
    // After sort: (0,0,1), (1,0,5), (1,0,7). Col 0 has 3 nnz; col 1 empty.
    expect(captured.ptr).toEqual([0, 3, 3]);
    expect(captured.index).toEqual([0, 1, 1]);
    expect(captured.values).toEqual([1, 5, 7]);
    expect(captured.size).toEqual([3, 2]);
  });

  it('wrappers pass size through: columns [N,M], rows [N,M] with N/M swapped meaning', () => {
    const asCols = buildSparseCscFromEntries([], 4, [7, 4], (data) => data) as { size: number[] };
    const asRows = buildSparseCscFromEntries([], 4, [3, 4], (data) => data) as { size: number[] };
    expect(asCols.size).toEqual([7, 4]);
    expect(asRows.size).toEqual([3, 4]);
    expect(asCols).not.toEqual(asRows);
  });
});

describe('clone batch7 pin — complexToInterleaved oracle', () => {
  it('number → imag 0; {re,im} pair; anything else null', () => {
    expect(complexToInterleaved([1, { re: 2, im: -1 }], () => null)).toEqual(
      new Float64Array([1, 0, 2, -1])
    );
    expect(complexToInterleaved([3, 4], () => null)).toEqual(new Float64Array([3, 0, 4, 0]));
    expect(complexToInterleaved([{ re: 1, im: 2 }], () => null)).toEqual(new Float64Array([1, 2]));
    expect(complexToInterleaved([], () => null)).toEqual(new Float64Array(0));
    expect(complexToInterleaved([1, 'x'], () => null)).toBeNull();
    expect(complexToInterleaved([{ re: 1 }], () => null)).toBeNull();
    expect(complexToInterleaved([null], () => null)).toBeNull();
  });

  it('factory fft/ifft accept mixed number and {re,im} on the fast path (n=64)', () => {
    const x = Array.from({ length: 64 }, (_, i) =>
      i % 3 === 0 ? { re: Math.sin(i * 0.1), im: 0.01 * i } : Math.cos(i * 0.07)
    );
    expect(complexToInterleaved(x, () => null)).not.toBeNull();
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
    { num: 3n, den: 1n, rest: 'x', want: '3*x' },
    { num: 0n, den: 1n, rest: 'x', want: '0*x' },
    { num: 5n, den: 5n, rest: 'x', want: 'x' },
  ];

  for (const { num, den, rest, want } of cases) {
    it(`renders ${num}/${den} * ${rest} as ${want}`, () => {
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
  const dist = (a: number[], b: number[]): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

  it('k=-1: kNearestIndices slices from the end; kdTreeKNN clamps with Math.max(0,k)', () => {
    expect(rankNearest(pts, [0, 0], -1, dist)).toEqual([0, 1, 2]);
    expect(rankNearest(pts, [0, 0], 0, dist)).toEqual([]);
    expect(kdTreeKNN(pts, [0, 0], -1)).toEqual([]);
    expect(kdTreeKNN(pts, [0, 0], 0)).toEqual([]);
  });

  it('knnClassify k=-1 majority is first-3 labels, distinct from k=1 and k=4', () => {
    const labels = ['A', 'B', 'B', 'A'];
    expect(knnClassify(pts, labels, [[0, 0]], -1)[0]).toBe('B');
    expect(knnClassify(pts, labels, [[0, 0]], 1)[0]).toBe('A');
    expect(knnClassify(pts, labels, [[0, 0]], 4)[0]).toBe('A');
  });

  it('k=2: nearest-first indices; equal distances keep insertion order', () => {
    expect(kdTreeKNN(pts, [0, 0], 2)).toEqual([0, 1]);
    const ties = [
      [0, 1],
      [0, -1],
      [10, 0],
    ];
    expect(rankNearest(ties, [0, 0], 2, dist)).toEqual([0, 1]);
  });
});
