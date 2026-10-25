/**
 * Pareto hall of fame, PySR log-loss scores, and model selection.
 *
 * Mirrors PySR {@link https://github.com/MilesCranmer/PySR | PySR}
 * `calculate_scores` and `idx_model_selection` at commit `72a9ab9`
 * (`pysr/sr.py`).
 *
 * @packageDocumentation
 */

/**
 * One hall-of-fame row. `item` is opaque and is not inspected.
 *
 * @example
 * ```ts
 * import { paretoFront } from '@danielsimonjr/mathts-functions';
 * const front = paretoFront([
 *   { loss: 0.5, complexity: 1, item: 'A' },
 *   { loss: 0.1, complexity: 3, item: 'D-front' },
 * ]);
 * front.map((r) => r.item).join(','); // 'A,D-front'
 * ```
 */
export interface FrontCandidate<T = unknown> {
  readonly loss: number;
  readonly complexity: number;
  readonly item: T;
}

/**
 * A {@link FrontCandidate} plus a PySR score.
 * `null` means the linear loss scale, where PySR stores no score column.
 * A numeric score may be `+Infinity`, `-Infinity`, or `NaN` (a zero complexity gap).
 *
 * @example
 * ```ts
 * import { paretoFront, scoreFront } from '@danielsimonjr/mathts-functions';
 * const front = paretoFront([{ loss: 0.5, complexity: 1, item: 'A' }]);
 * scoreFront(front)[0]!.score; // 0 (log scale)
 * scoreFront(front, { lossScale: 'linear' })[0]!.score; // null
 * ```
 */
export interface ScoredCandidate<T = unknown> extends FrontCandidate<T> {
  readonly score: number | null;
}

/**
 * Thrown by {@link scoreFront} and {@link selectFrontModel} for an empty
 * selection, a bad mode, a bad loss scale, or a mixed score column.
 * `paretoFront` does not throw.
 *
 * @example
 * ```ts
 * import { selectFrontModel, ParetoFrontError } from '@danielsimonjr/mathts-functions';
 * try {
 *   selectFrontModel([]);
 * } catch (e) {
 *   e instanceof ParetoFrontError && e.message; // 'selectFrontModel: empty front'
 * }
 * ```
 */
export class ParetoFrontError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParetoFrontError';
  }
}

function isFiniteLossAndComplexity(c: FrontCandidate<unknown>): boolean {
  return Number.isFinite(c.loss) && Number.isFinite(c.complexity);
}

/**
 * Hall of fame: one survivor per complexity, sorted by complexity ascending.
 *
 * A candidate whose `loss` or `complexity` is not finite (`NaN`, `+Infinity`,
 * `-Infinity`) is dropped. That is a documented choice; PySR's frame is assumed
 * to contain finite losses before scoring.
 *
 * Among finite candidates with `===` complexity (`-0` and `0` are the same),
 * keep the strictly smallest loss. If two losses are equal, keep the earlier
 * input. The survivor is then kept only when its loss is **strictly** smaller
 * than the loss of every survivor of lower complexity. The lowest complexity
 * is always kept. A simpler row is never removed because a more complex row
 * is better.
 *
 * Returns a new array of new wrapper objects. `item` is the input reference.
 * The input array and objects are not mutated.
 *
 * @example
 * ```ts
 * import { paretoFront } from '@danielsimonjr/mathts-functions';
 * const front = paretoFront([
 *   { loss: 0.5, complexity: 1, item: 'A' },
 *   { loss: 0.5, complexity: 2, item: 'B-tie' },
 *   { loss: 0.2, complexity: 4, item: 'C-dominated' },
 *   { loss: 0.1, complexity: 3, item: 'D-front' },
 *   { loss: Number.NaN, complexity: 1, item: 'drop' },
 * ]);
 * front.length; // 2 — non-finite row dropped; paretoFront never throws
 * paretoFront([]).length; // 0
 * ```
 */
export function paretoFront<T>(candidates: readonly FrontCandidate<T>[]): FrontCandidate<T>[] {
  const byComplexity = new Map<number, { loss: number; item: T }>();

  for (const c of candidates) {
    if (!isFiniteLossAndComplexity(c)) continue;

    const key = c.complexity;
    const prev = byComplexity.get(key);
    // Scan is input order, so an equal later loss keeps the earlier survivor.
    if (prev === undefined || c.loss < prev.loss) {
      byComplexity.set(key, { loss: c.loss, item: c.item });
    }
  }

  const perComplexity = [...byComplexity.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([complexity, { loss, item }]) => ({ loss, complexity, item }));

  const front: FrontCandidate<T>[] = [];
  for (const row of perComplexity) {
    if (front.length === 0) {
      front.push({ loss: row.loss, complexity: row.complexity, item: row.item });
      continue;
    }
    let strictlyBetter = true;
    for (const kept of front) {
      if (row.loss >= kept.loss) {
        strictlyBetter = false;
        break;
      }
    }
    if (strictlyBetter) {
      front.push({ loss: row.loss, complexity: row.complexity, item: row.item });
    }
  }

  return front;
}

/**
 * PySR `calculate_scores`, in array order. Does not sort and does not drop rows.
 *
 * `lossScale` defaults to `'log'`. On `'log'`, the first row scores `0`.
 * Each later row scores `-Math.log(loss / previousLoss) / (complexity - previousComplexity)`
 * when `loss > 0`. When `loss <= 0` (zero **or** negative), the score is `+Infinity`.
 * A zero complexity gap is left to IEEE division (`NaN`, `+Infinity`, or `-Infinity`);
 * there is no special case. On `'linear'`, every score is `null` and a zero loss
 * does **not** become `+Infinity`.
 *
 * Any other `lossScale` throws `ParetoFrontError`
 * (`scoreFront: lossScale must be 'log' or 'linear'`).
 *
 * @example
 * ```ts
 * import { paretoFront, scoreFront } from '@danielsimonjr/mathts-functions';
 * const front = paretoFront([
 *   { loss: 0.5, complexity: 1, item: 'A' },
 *   { loss: 0.1, complexity: 3, item: 'D-front' },
 * ]);
 * scoreFront(front)[0]!.score; // 0
 * scoreFront(front, { lossScale: 'linear' })[0]!.score; // null
 * ```
 */
export function scoreFront<T>(
  front: readonly FrontCandidate<T>[],
  options?: { lossScale?: 'log' | 'linear' }
): ScoredCandidate<T>[] {
  const lossScale = options?.lossScale ?? 'log';
  if (lossScale !== 'log' && lossScale !== 'linear') {
    throw new ParetoFrontError("scoreFront: lossScale must be 'log' or 'linear'");
  }

  if (lossScale === 'linear') {
    return front.map((row) => ({
      loss: row.loss,
      complexity: row.complexity,
      item: row.item,
      score: null,
    }));
  }

  const scored: ScoredCandidate<T>[] = [];
  for (let i = 0; i < front.length; i++) {
    const row = front[i];
    if (i === 0) {
      scored.push({
        loss: row.loss,
        complexity: row.complexity,
        item: row.item,
        score: 0,
      });
      continue;
    }
    const prev = front[i - 1];
    let score: number;
    if (row.loss > 0) {
      score = -Math.log(row.loss / prev.loss) / (row.complexity - prev.complexity);
    } else {
      score = Infinity;
    }
    scored.push({
      loss: row.loss,
      complexity: row.complexity,
      item: row.item,
      score,
    });
  }
  return scored;
}

function scoreIsBetter(candidate: number, champion: number): boolean {
  if (Number.isNaN(candidate)) return false;
  if (Number.isNaN(champion)) return true;
  return candidate > champion;
}

/** IEEE `===` is false for NaN; two NaN scores are a tie (both worst). */
function scoresTie(a: number, b: number): boolean {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

function pickChampionIndex<T>(
  rows: readonly ScoredCandidate<T>[],
  mode: 'accuracy' | 'score'
): number {
  let champion = 0;
  for (let j = 1; j < rows.length; j++) {
    const c = rows[champion];
    const n = rows[j];
    if (mode === 'accuracy') {
      if (n.loss < c.loss) {
        champion = j;
      } else if (n.loss === c.loss) {
        if (n.complexity < c.complexity) {
          champion = j;
        }
      }
      continue;
    }
    const cScore = c.score;
    const nScore = n.score;
    if (cScore === null || nScore === null) {
      continue;
    }
    if (scoreIsBetter(nScore, cScore)) {
      champion = j;
    } else if (scoresTie(nScore, cScore) && n.complexity < c.complexity) {
      champion = j;
    }
  }
  return champion;
}

function allScoresNull<T>(rows: readonly ScoredCandidate<T>[]): boolean {
  return rows.every((r) => r.score === null);
}

function hasMixedScores<T>(rows: readonly ScoredCandidate<T>[]): boolean {
  let sawNull = false;
  let sawNumeric = false;
  for (const r of rows) {
    if (r.score === null) sawNull = true;
    else sawNumeric = true;
    if (sawNull && sawNumeric) return true;
  }
  return false;
}

/**
 * PySR `idx_model_selection`. `mode` defaults to `'best'`.
 *
 * `'accuracy'` is the minimum loss. `'score'` is the maximum score.
 * `'best'` keeps rows with `loss <= bestLossFactor * min(loss)` (`bestLossFactor`
 * defaults to `1.5`) and then takes the maximum score among them.
 * If every `score` is `null`, `'score'` and `'best'` both fall back to `'accuracy'`
 * (PySR does this when the score column is absent).
 *
 * Ties on the chosen metric: lower complexity wins, then the earlier input index.
 * Score order treats `NaN` as worse than every other score, including `-Infinity`.
 * Two `+Infinity` scores, or two `NaN` scores, tie and use complexity, then input order.
 *
 * Returns the **same object reference** as the chosen element of `scored`.
 * Throws `ParetoFrontError` on an empty list, a non-finite loss or complexity,
 * a non-finite `bestLossFactor`, a mode other than the three names, a mix of
 * `null` and numeric scores, or a `'best'` filter that keeps no row.
 *
 * @example
 * ```ts
 * import { paretoFront, scoreFront, selectFrontModel } from '@danielsimonjr/mathts-functions';
 * const front = paretoFront([
 *   { loss: 0.5, complexity: 1, item: 'A' },
 *   { loss: 0.1, complexity: 3, item: 'D-front' },
 * ]);
 * const scored = scoreFront(front);
 * selectFrontModel(scored, 'accuracy').item; // 'D-front'
 * selectFrontModel(scored, 'best').item; // 'D-front'
 * selectFrontModel(scoreFront(front, { lossScale: 'linear' }), 'score').item; // null-score → accuracy fallback
 * ```
 */
export function selectFrontModel<T>(
  scored: readonly ScoredCandidate<T>[],
  mode?: 'accuracy' | 'score' | 'best',
  options?: { bestLossFactor?: number }
): ScoredCandidate<T> {
  if (scored.length === 0) {
    throw new ParetoFrontError('selectFrontModel: empty front');
  }

  const selectionMode = mode ?? 'best';
  if (selectionMode !== 'accuracy' && selectionMode !== 'score' && selectionMode !== 'best') {
    throw new ParetoFrontError(
      `selectFrontModel: '${selectionMode}' is not a valid model selection strategy.`
    );
  }

  const bestLossFactor = options?.bestLossFactor ?? 1.5;
  if (selectionMode === 'best' && !Number.isFinite(bestLossFactor)) {
    throw new ParetoFrontError('selectFrontModel: bestLossFactor must be a finite number');
  }

  for (const row of scored) {
    if (!isFiniteLossAndComplexity(row)) {
      throw new ParetoFrontError('selectFrontModel: loss and complexity must be finite');
    }
  }

  if (hasMixedScores(scored)) {
    throw new ParetoFrontError('selectFrontModel: mixed null and numeric scores');
  }

  if (selectionMode === 'accuracy' || allScoresNull(scored)) {
    const idx = pickChampionIndex(scored, 'accuracy');
    return scored[idx];
  }

  if (selectionMode === 'score') {
    const idx = pickChampionIndex(scored, 'score');
    return scored[idx];
  }

  const minLoss = scored.reduce((m, r) => (r.loss < m ? r.loss : m), scored[0].loss);
  const threshold = bestLossFactor * minLoss;
  const filtered = scored.filter((r) => r.loss <= threshold);
  if (filtered.length === 0) {
    throw new ParetoFrontError(`selectFrontModel: no row has loss <= ${threshold}`);
  }

  const idxInFiltered = pickChampionIndex(filtered, 'score');
  return filtered[idxInFiltered];
}
