/**
 * LaTeX tabular and JSON export for scored Pareto fronts (PySR M15).
 *
 * Formula cells use {@link scalarToTex}; canonical keys use {@link scalarCanonicalKey}.
 *
 * @packageDocumentation
 */

import type { ScalarNode } from '@danielsimonjr/mathts-expression';
import { scalarCanonicalKey } from '@danielsimonjr/mathts-expression';
import { scalarToTex } from './factories/index.js';
import type { ScoredCandidate } from './pareto-front.js';

const DEFAULT_PRECISION = 6;
const MAX_PRECISION = 100;

/**
 * A number in a {@link FrontJson} report. JSON has no `Infinity` or `NaN`:
 * `JSON.stringify` writes both as `null`, which would be read as the linear-scale
 * "no score" value. A finite value stays a number. A non-finite value is its
 * `String(value)` spelling, so the report survives `JSON.stringify` and `JSON.parse` unchanged.
 */
export type FrontJsonNumber = number | 'Infinity' | '-Infinity' | 'NaN';

/** One row of {@link frontToJson}. `score` is `null` only on the linear loss scale. */
export interface FrontJsonRow {
  readonly complexity: number;
  readonly loss: FrontJsonNumber;
  readonly score: FrontJsonNumber | null;
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
  /**
   * Significant digits of the loss and score cells, an integer from 1 to 100, passed to
   * `Number.prototype.toPrecision`. Default 6.
   */
  readonly precision?: number;
}

function checkComplexity(fn: string, row: ScoredCandidate<ScalarNode>, index: number): void {
  if (!Number.isFinite(row.complexity)) {
    throw new RangeError(
      `${fn}: row ${index} has complexity ${String(row.complexity)}; it must be finite`
    );
  }
}

function checkPrecision(precision: number): void {
  if (!Number.isInteger(precision) || precision < 1 || precision > MAX_PRECISION) {
    throw new RangeError(
      `frontToLatexTable: precision must be an integer from 1 to ${MAX_PRECISION}, got ${String(precision)}`
    );
  }
}

/** Loss or score cell. Text mode, except the infinity symbol, which needs math mode. */
function numberCell(value: number | null, precision: number): string {
  if (value === null) return '';
  if (value === Infinity) return '$\\infty$';
  if (value === -Infinity) return '$-\\infty$';
  if (Number.isNaN(value)) return 'NaN';
  return value.toPrecision(precision);
}

function jsonNumber(value: number): FrontJsonNumber {
  return Number.isFinite(value) ? value : (String(value) as FrontJsonNumber);
}

/**
 * Render a scored front as a LaTeX `tabular` with columns complexity, loss, score, equation
 * and one header row.
 *
 * Every equation cell is `$` + {@link scalarToTex} + `$`: the printer's output holds commands
 * such as `\cdot`, `\frac` and `\sin`, which LaTeX rejects outside math mode, and a `tabular`
 * cell is text mode. The infinity symbol is wrapped the same way. A `null` score (the linear
 * loss scale) is an empty cell. Loss and score are `toPrecision(precision)` text, so a value
 * far from 1 appears as `3.00000e-16`.
 *
 * @throws RangeError when `precision` is not an integer from 1 to 100, or a row's complexity is
 * not finite.
 *
 * @example
 * ```ts
 * import { frontToLatexTable, scoreFront, paretoFront, scalar } from '@danielsimonjr/mathts-functions';
 * const scored = scoreFront(
 *   paretoFront([{ loss: 0.5, complexity: 1, item: scalar.symbol('x') }]),
 * );
 * frontToLatexTable(scored);
 * // '\\begin{tabular}{cccc}\ncomplexity & loss & score & equation \\\\\n' +
 * // '1 & 0.500000 & 0.00000 & $ x$ \\\\\n\\end{tabular}'
 * ```
 */
export function frontToLatexTable(
  scored: readonly ScoredCandidate<ScalarNode>[],
  options?: FrontLatexTableOptions
): string {
  const precision = options?.precision ?? DEFAULT_PRECISION;
  checkPrecision(precision);
  const lines: string[] = ['\\begin{tabular}{cccc}', 'complexity & loss & score & equation \\\\'];
  scored.forEach((row, index) => {
    checkComplexity('frontToLatexTable', row, index);
    const equation = `$${scalarToTex(row.item)}$`;
    const loss = numberCell(row.loss, precision);
    const score = numberCell(row.score, precision);
    lines.push(`${row.complexity} & ${loss} & ${score} & ${equation} \\\\`);
  });
  lines.push('\\end{tabular}');
  return lines.join('\n');
}

/**
 * Stable JSON report for a scored front (`schemaVersion` 1). `key` is `scalarCanonicalKey(item)`
 * and `tex` is `scalarToTex(item)`, without the math-mode `$` of the table.
 *
 * The returned object is the same after `JSON.parse(JSON.stringify(report))`: a non-finite `loss`
 * or `score` is written as a string (see {@link FrontJsonNumber}), not as `null`. An exact fit
 * has loss 0, so its score is `Infinity`; that row must not collapse into the linear scale's `null`.
 *
 * @throws RangeError when a row's complexity is not finite.
 *
 * @example
 * ```ts
 * import { frontToJson, scalar } from '@danielsimonjr/mathts-functions';
 * const report = frontToJson([{ complexity: 1, loss: 0.5, score: 0, item: scalar.symbol('x') }]);
 * report.rows[0]!.key; // '{"k":"s","v":"x"}'
 * ```
 */
export function frontToJson(scored: readonly ScoredCandidate<ScalarNode>[]): FrontJson {
  const rows = scored.map((row, index): FrontJsonRow => {
    checkComplexity('frontToJson', row, index);
    return {
      complexity: row.complexity,
      loss: jsonNumber(row.loss),
      score: row.score === null ? null : jsonNumber(row.score),
      key: scalarCanonicalKey(row.item),
      tex: scalarToTex(row.item),
    };
  });
  return { schemaVersion: 1, rows };
}
