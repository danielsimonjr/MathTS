/**
 * LaTeX tabular and JSON export for scored Pareto fronts (PySR M15).
 *
 * Formula cells use {@link scalarToTex}; canonical keys use {@link scalarCanonicalKey}.
 *
 * @packageDocumentation
 */

import type { ScalarNode, StringOptions } from '@danielsimonjr/mathts-expression';
import { scalarCanonicalKey } from '@danielsimonjr/mathts-expression';
import { scalarToTex } from './factories/index.js';
import type { ScoredCandidate } from './pareto-front.js';

const DEFAULT_PRECISION = 6;

/** One row of {@link frontToJson}. */
export interface FrontJsonRow {
  readonly complexity: number;
  readonly loss: number;
  readonly score: number | null;
  readonly key: string;
  readonly tex: string;
}

/** JSON report from {@link frontToJson}. */
export interface FrontJson {
  readonly schemaVersion: 1;
  readonly rows: readonly FrontJsonRow[];
}

/** Options for {@link frontToLatexTable}. */
export interface FrontLatexTableOptions {
  /** Passed through to {@link scalarToTex} for each formula cell. */
  readonly variables?: Readonly<Record<string, unknown>>;
  /** Significant digits for loss and score via `Number.toPrecision`; default 6. */
  readonly precision?: number;
}

function texOptions(options?: FrontLatexTableOptions): StringOptions | undefined {
  if (options?.variables === undefined) return undefined;
  return { variables: options.variables };
}

function formatLossOrScore(value: number | null, precision: number): string {
  if (value === null) return '';
  if (value === Infinity) return '\\infty';
  if (value === -Infinity) return '-\\infty';
  if (Number.isNaN(value)) return 'NaN';
  return value.toPrecision(precision);
}

/**
 * Render a scored front as a LaTeX `tabular` (complexity, loss, score, equation).
 *
 * @example
 * ```ts
 * import { frontToLatexTable, scoreFront, paretoFront, scalar } from '@danielsimonjr/mathts-functions';
 * const scored = scoreFront(
 *   paretoFront([{ loss: 0.5, complexity: 1, item: scalar.symbol('x') }]),
 * );
 * frontToLatexTable(scored);
 * ```
 */
export function frontToLatexTable(
  scored: readonly ScoredCandidate<ScalarNode>[],
  options?: FrontLatexTableOptions
): string {
  const precision = options?.precision ?? DEFAULT_PRECISION;
  const texOpts = texOptions(options);
  const lines: string[] = ['\\begin{tabular}{cccc}', 'complexity & loss & score & equation \\\\'];
  for (const row of scored) {
    const eq = scalarToTex(row.item, texOpts);
    const loss = formatLossOrScore(row.loss, precision);
    const score = formatLossOrScore(row.score, precision);
    lines.push(`${row.complexity} & ${loss} & ${score} & ${eq} \\\\`);
  }
  lines.push('\\end{tabular}');
  return lines.join('\n');
}

/**
 * Stable JSON report for a scored front (`schemaVersion` 1).
 *
 * @example
 * ```ts
 * import { frontToJson, scalar } from '@danielsimonjr/mathts-functions';
 * frontToJson([{ complexity: 1, loss: 0.5, score: 0, item: scalar.symbol('x') }]).schemaVersion; // 1
 * ```
 */
export function frontToJson(
  scored: readonly ScoredCandidate<ScalarNode>[],
  options?: FrontLatexTableOptions
): FrontJson {
  const texOpts = texOptions(options);
  const rows: FrontJsonRow[] = scored.map((row) => ({
    complexity: row.complexity,
    loss: row.loss,
    score: row.score,
    key: scalarCanonicalKey(row.item),
    tex: scalarToTex(row.item, texOpts),
  }));
  return { schemaVersion: 1, rows };
}
