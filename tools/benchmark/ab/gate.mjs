/**
 * Gate arithmetic of the Phase 7 A/B harness, kept free of process spawning so the decisions
 * can be tested on synthetic run results (`tools/test/ab-harness.test.mjs`).
 *
 * A ratio is head time over base time, so lower is faster.
 */
import { geometricMean, median } from './util.mjs';

/** No case may be slower than this, on either engine. */
export const SLOW_LIMIT = 1.02;
/** A `gain` case must reach this or lower, on either engine. */
export const GAIN_LIMIT = 0.95;
/** In a `--control` session the A/A' median must stay inside 1 ± this. */
export const CONTROL_BAND = 0.02;
/** Runs of the rerun of a case which first read above `SLOW_LIMIT`; its processes join the first reading. */
export const RERUN_RUNS = 9;
/**
 * Processes per side in one run. A run times each tree alone in its own process, so the two
 * trees never share an engine, and alternates the sides base, head, head, base, base, head, ...
 * so that a drift in machine speed falls on both. Two processes per side per run, because one
 * process sits ±3-5% from the next on the same code.
 */
export const PROCESSES_PER_RUN = 2;

/**
 * The gate's estimate: the median per-call time of the head processes over the median of the
 * base processes, and the spread of the per-run ratios.
 *
 * Why single-tree processes decide, and not both trees in one process: whichever tree executes
 * second in a process (Node) or first (Bun) runs in a different engine state, by up to 20% for
 * `median` and 1.5x for `prod` on two identical trees. Swapping the order cancels the mean of
 * that effect, not its run-to-run variation, which is the noise this harness fights.
 * @param {number[]} baseUs per-call microseconds, one entry per base process, in run order
 * @param {number[]} headUs the same for the head processes
 * @returns {{ ratio: number, runRatios: number[], min: number, max: number } | null}
 */
export function estimate(baseUs, headUs) {
  if (baseUs.length === 0 || headUs.length === 0 || baseUs.length !== headUs.length) return null;
  const runRatios = [];
  for (let i = 0; i < baseUs.length; i += PROCESSES_PER_RUN) {
    let b = 0;
    let h = 0;
    for (let j = i; j < Math.min(i + PROCESSES_PER_RUN, baseUs.length); j++) {
      b += baseUs[j];
      h += headUs[j];
    }
    runRatios.push(h / b);
  }
  return {
    ratio: median(headUs) / median(baseUs),
    runRatios,
    min: Math.min(...runRatios),
    max: Math.max(...runRatios),
  };
}

/**
 * The cross-check from the two-tree processes: the geometric mean of the two import orders.
 * It is reported beside the gate's estimate and does not decide the gate.
 * @param {number} baseFirst
 * @param {number} headFirst
 */
export function twoTreeRatio(baseFirst, headFirst) {
  return geometricMean([baseFirst, headFirst]);
}

/**
 * A reading that would fail the gate is rerun once with `RERUN_RUNS` runs, and the processes of
 * both readings together decide it (`pooledEstimate`): a `neutral` or `gain` case above the slow limit, a `gain` case above the gain
 * limit, or, in a `--control` session, a case outside the control band. One run of five has a
 * noise floor of a few percent (a process sits 3-5% from the next), so a single marginal
 * reading is not evidence either way.
 * @param {{ kind: string, ratio: number }} row
 * @param {boolean} control
 * @param {number} [slowLimit] replaces `SLOW_LIMIT` (see `--slow-limit` in run.mjs)
 */
export function needsRerun(row, control, slowLimit = SLOW_LIMIT) {
  if (control) return Math.abs(row.ratio - 1) > CONTROL_BAND;
  return row.ratio > slowLimit || (row.kind === 'gain' && row.ratio > GAIN_LIMIT);
}

/**
 * In a `--control` session the head tree is a second copy of the base build, so `ratio` is the
 * A/A' ratio of the gate's own estimator.
 * @param {{ kind: string, ratio: number }} row
 * @param {boolean} control
 * @param {number} [slowLimit] replaces `SLOW_LIMIT` (see `--slow-limit` in run.mjs)
 * @returns {string | null} the reason the row fails the gate, or null
 */
export function failureOf(row, control, slowLimit = SLOW_LIMIT) {
  if (control) {
    return Math.abs(row.ratio - 1) > CONTROL_BAND ? 'control' : null;
  }
  if (row.ratio > slowLimit) return 'slow';
  if (row.kind === 'gain' && row.ratio > GAIN_LIMIT) return 'gain';
  return null;
}

/**
 * The environment of a child process: the inherited environment without the switch that skips
 * the equality check, then `extra`. Only run.mjs may set that switch, for one case named in
 * `allowed-output-changes.json`; a value in the environment of the caller must not reach a child.
 * @param {Record<string, string | undefined>} inherited
 * @param {Record<string, string>} extra
 * @returns {Record<string, string | undefined>}
 */
export function childEnvironment(inherited, extra) {
  const { PERF_ALLOW_UNEQUAL: _dropped, ...rest } = inherited;
  return { ...rest, ...extra };
}

/**
 * The estimate of a rerun: the samples of the first reading and of the rerun pooled, so the
 * rerun does not discard the first reading. The medians run over all processes of both readings.
 * @param {{ baseUs: number[], headUs: number[] }} first
 * @param {{ baseUs: number[], headUs: number[] }} second
 * @returns {ReturnType<typeof estimate>}
 */
export function pooledEstimate(first, second) {
  return estimate([...first.baseUs, ...second.baseUs], [...first.headUs, ...second.headUs]);
}

/**
 * The `--only` values that match no case name. A renamed case would otherwise leave the gate
 * without complaint as long as another value still matched.
 * @param {string[]} only
 * @param {string[]} caseNames every case name of the case files that were loaded
 * @returns {string[]}
 */
export function unmatchedOnly(only, caseNames) {
  return only.filter((o) => !caseNames.some((name) => name.includes(o)));
}

/**
 * The entries of `allowed-output-changes.json` that name no known case. Such an entry is stale
 * (the case was renamed or removed) and fails the run, whether or not the case is in this run.
 * @param {Iterable<string>} entryCases
 * @param {string[]} caseNames every case name of the case files in `cases/`
 * @returns {string[]}
 */
export function unknownAllowEntries(entryCases, caseNames) {
  const known = new Set(caseNames);
  return [...entryCases].filter((c) => !known.has(c));
}
