/**
 * Chi-square test of independence + multiple-testing correction (Phase 3 Task 6).
 *
 * `chi2Contingency` complements the existing `chiSquareTest` 2D form
 * (`typed/hypothesis.ts`) by adding the Yates continuity correction (2x2 tables)
 * and Cramér's V effect size, matching `scipy.stats.chi2_contingency`.
 *
 * `multipleTest` complements the existing `multipleComparison`
 * (`typed/hypothesis.ts`) with the same three corrections under the name used
 * by `statsmodels.stats.multitest.multipletests`.
 */
import { chiSquaredCDF } from '../distribution-functions.js';

/** Result of {@link chi2Contingency}. */
export interface Chi2ContingencyResult {
  chi2: number;
  pValue: number;
  dof: number;
  expected: number[][];
  cramersV: number;
}

/** Options for {@link chi2Contingency}. */
export interface Chi2ContingencyOptions {
  /** Apply the Yates continuity correction on 2x2 tables. Default true (matches scipy). */
  correction?: boolean;
}

/**
 * Chi-square test of independence on a contingency table.
 *
 * Expected counts `E_ij = rowSum_i * colSum_j / total`. `chi2 = sum((O_ij -
 * E_ij)^2 / E_ij)`, with the Yates continuity correction
 * `(|O_ij - E_ij| - 0.5)^2 / E_ij` applied on 2x2 tables when
 * `opts.correction !== false` (default true, matching
 * `scipy.stats.chi2_contingency`). `dof = (rows - 1) * (cols - 1)`; `pValue =
 * 1 - chiSquaredCDF(chi2, dof)`. `cramersV = sqrt(chi2 / (total *
 * min(rows-1, cols-1)))`.
 *
 * @example
 * chi2Contingency([[10, 20], [30, 40]], { correction: false });
 * // { chi2: 0.7937, pValue: 0.373, dof: 1, expected: [[12, 18], [28, 42]], cramersV }
 */
export function chi2Contingency(
  table: readonly (readonly number[])[],
  opts: Chi2ContingencyOptions = {}
): Chi2ContingencyResult {
  const rows = table.length;
  if (rows < 2) throw new Error('chi2Contingency: table needs at least 2 rows');
  const cols = table[0].length;
  if (cols < 2) throw new Error('chi2Contingency: table needs at least 2 columns');
  for (const row of table) {
    if (row.length !== cols) throw new Error('chi2Contingency: table must be rectangular');
  }

  const rowTotals = new Array<number>(rows).fill(0);
  const colTotals = new Array<number>(cols).fill(0);
  let total = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const v = table[i][j];
      rowTotals[i] += v;
      colTotals[j] += v;
      total += v;
    }
  }
  if (total <= 0) throw new Error('chi2Contingency: table sum must be positive');

  const expected: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  const applyCorrection = rows === 2 && cols === 2 && opts.correction !== false;

  let chi2 = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const e = (rowTotals[i] * colTotals[j]) / total;
      expected[i][j] = e;
      if (e <= 0) continue;
      const o = table[i][j];
      const diff = applyCorrection ? Math.max(0, Math.abs(o - e) - 0.5) : o - e;
      chi2 += (diff * diff) / e;
    }
  }

  const dof = (rows - 1) * (cols - 1);
  const pValue = 1 - chiSquaredCDF(chi2, dof);
  const cramersV = Math.sqrt(chi2 / (total * Math.min(rows - 1, cols - 1)));

  return { chi2, pValue, dof, expected, cramersV };
}

/** Supported multiple-testing correction methods. */
export type MultipleTestMethod = 'bonferroni' | 'holm' | 'bh';

/**
 * Multiple-testing p-value adjustment, returned in the original input order.
 * Matches `statsmodels.stats.multitest.multipletests`.
 *
 * - `bonferroni`: `min(1, p_i * n)`.
 * - `holm` (step-down): sort ascending; adjusted_(k) = `min(1, max_{j<=k}
 *   (n - j + 1) * p_(j))`, enforced monotonic non-decreasing.
 * - `bh` (Benjamini-Hochberg FDR, step-up): sort ascending; adjusted_(k) =
 *   `min(1, min_{j>=k} (n / j) * p_(j))`, enforced monotonic non-decreasing
 *   from the largest p-value down.
 *
 * @example multipleTest([0.01, 0.04, 0.5], 'bonferroni'); // [0.03, 0.12, 1]
 */
export function multipleTest(pValues: readonly number[], method: MultipleTestMethod): number[] {
  const n = pValues.length;
  if (n === 0) return [];

  if (method === 'bonferroni') {
    return pValues.map((p) => Math.min(1, p * n));
  }

  // `order[k]` = original index of the k-th smallest p-value.
  const order = pValues.map((_, i) => i).sort((a, b) => pValues[a] - pValues[b]);
  const adjusted = new Array<number>(n);

  if (method === 'holm') {
    // Step-down: running max of (n - k) * p_(k) (0-indexed rank k), monotonic
    // non-decreasing as rank increases.
    let running = 0;
    for (let rank = 0; rank < n; rank++) {
      const idx = order[rank];
      running = Math.max(running, (n - rank) * pValues[idx]);
      adjusted[idx] = Math.min(1, running);
    }
    return adjusted;
  }

  // 'bh' — step-up: running min of (n / (rank + 1)) * p_(rank), scanning from
  // the largest p-value down, monotonic non-decreasing as rank increases.
  let running = 1;
  for (let rank = n - 1; rank >= 0; rank--) {
    const idx = order[rank];
    running = Math.min(running, (n / (rank + 1)) * pValues[idx]);
    adjusted[idx] = Math.min(1, running);
  }
  return adjusted;
}
