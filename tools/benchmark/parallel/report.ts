/**
 * Machine-readable report for the parallel benchmark suite.
 *
 * `buildBenchReport` is a **pure** transform from the harness's timed
 * `OperationResult[]` into a serializable JSON shape whose headline field is
 * `recommendedThreshold` — the per-op element count a future
 * `DEFAULT_THRESHOLD_BY_OP` retune (WS-2) should consume programmatically
 * instead of eyeballing the printed tables. It contains no timing or I/O, so it
 * is deterministic and unit-testable; `run.ts` calls it behind `--json`.
 */
import { breakEvenElementCount, type OperationResult, type SizeResult } from './harness.js';

/** Hardware/runtime tag so a JSON artifact records where it was measured. */
export interface BenchMachine {
  logicalCpus: number;
  node: string;
  arch: string;
  platform: string;
}

/** One operation's serialized result + its recommended threshold. */
export interface BenchReportOp {
  operation: string;
  category: string;
  sizeUnit: string;
  breakEvenSize: number | null;
  /** Break-even expressed in elements (matrix-dim/points are squared). */
  breakEvenElements: number | null;
  /** What a per-op `thresholdElements` should be set to: the element count, or
   *  `'never'` when parallel never reaches a persistent win. */
  recommendedThreshold: number | 'never';
  note?: string;
  sizes: SizeResult[];
}

export interface BenchReport {
  /** ISO date; passed in (not read from the clock) so the transform stays pure. */
  generated: string;
  machine: BenchMachine;
  operations: BenchReportOp[];
}

/**
 * Map timed `OperationResult`s to the serializable report. Pure: same inputs →
 * same output, no clock/FS access.
 */
export function buildBenchReport(
  results: OperationResult[],
  meta: { generated: string; machine: BenchMachine }
): BenchReport {
  return {
    generated: meta.generated,
    machine: meta.machine,
    operations: results.map((r) => {
      const breakEvenElements = breakEvenElementCount(r);
      const reportOp: BenchReportOp = {
        operation: r.operation,
        category: r.category,
        sizeUnit: r.sizeUnit,
        breakEvenSize: r.breakEvenSize,
        breakEvenElements,
        recommendedThreshold: breakEvenElements ?? 'never',
        sizes: r.sizes,
      };
      if (r.note !== undefined) reportOp.note = r.note;
      return reportOp;
    }),
  };
}
