/**
 * Dynamic time warping with an optional Sakoe-Chiba band.
 *
 * @packageDocumentation
 */

type Vec = readonly number[] | Float64Array;
const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));

/** Options for {@link dtw}. */
export interface DtwOptions {
  /**
   * Sakoe-Chiba band half-width in samples. Widened automatically to at least
   * |a.length - b.length|. Default: unconstrained.
   */
  window?: number;
  /** Local cost between two samples (default `|x - y|`). */
  dist?: (x: number, y: number) => number;
}

/** Result of {@link dtw}. */
export interface DtwResult {
  /** Accumulated cost of the optimal warping path. */
  distance: number;
  /** Optimal alignment as (i, j) index pairs from [0, 0] to [n-1, m-1]. */
  path: Array<[number, number]>;
}

/**
 * Dynamic time warping between two sequences.
 *
 * @example
 * dtw([1, 2, 3], [1, 2, 2, 3]).distance; // 0
 */
export function dtw(a: Vec, b: Vec, opts?: DtwOptions): DtwResult {
  const x = arr(a);
  const y = arr(b);
  const n = x.length;
  const m = y.length;
  if (n === 0 || m === 0) throw new RangeError('dtw: inputs must be non-empty');

  const dist = opts?.dist ?? ((p: number, q: number) => Math.abs(p - q));
  const band = Math.max(opts?.window ?? Infinity, Math.abs(n - m));

  const D: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(Infinity));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (Math.abs(i - j) > band) continue;
      const cost = dist(x[i], y[j]);
      if (i === 0 && j === 0) {
        D[i][j] = cost;
        continue;
      }
      const up = i > 0 ? D[i - 1][j] : Infinity;
      const left = j > 0 ? D[i][j - 1] : Infinity;
      const diag = i > 0 && j > 0 ? D[i - 1][j - 1] : Infinity;
      D[i][j] = cost + Math.min(diag, up, left);
    }
  }

  // Backtrack from (n-1, m-1); ties prefer the diagonal step.
  const path: Array<[number, number]> = [];
  let i = n - 1;
  let j = m - 1;
  path.push([i, j]);
  while (i > 0 || j > 0) {
    const diag = i > 0 && j > 0 ? D[i - 1][j - 1] : Infinity;
    const up = i > 0 ? D[i - 1][j] : Infinity;
    const left = j > 0 ? D[i][j - 1] : Infinity;
    if (diag <= up && diag <= left) {
      i -= 1;
      j -= 1;
    } else if (up <= left) {
      i -= 1;
    } else {
      j -= 1;
    }
    path.push([i, j]);
  }
  path.reverse();

  return { distance: D[n - 1][m - 1], path };
}
