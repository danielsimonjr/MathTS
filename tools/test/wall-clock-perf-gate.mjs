/**
 * Shared wall-clock A/B gate statistics for CI perf gates (G26 / #876).
 *
 * Interleaved ABBA sampling, symmetric warmup, optional GC between rounds, and
 * a sequential verdict: the gate fails only when a distribution-free lower
 * bound of the median ratio reaches the limit, and it takes more rounds while
 * the noise is as large as the margin. Import from the isolated Node gate
 * scripts under the package test helpers. Limits and round counts live in
 * `wall-clock-gates.json`, not in the scripts.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Median of a numeric sample.
 * @param {number[]} xs
 */
export function median(xs) {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Multiplier applied to candidate-arm wall times (self-test: inject ~3× slowdown).
 * @returns {number}
 */
export function candidateTimeScale() {
  const raw = process.env.PERF_GATE_CANDIDATE_TIME_SCALE;
  if (raw === undefined || raw === '') return 1;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Wall-clock milliseconds for one gate arm (candidate arm honors PERF_GATE_CANDIDATE_TIME_SCALE).
 * @param {() => void} fn
 * @param {'baseline' | 'candidate'} arm
 * @returns {{ wall: number, raw: number }}
 */
export function timeMs(fn, arm) {
  const t0 = performance.now();
  fn();
  const raw = performance.now() - t0;
  let wall = raw;
  if (arm === 'candidate') wall *= candidateTimeScale();
  return { wall, raw };
}

/**
 * Ratio of median scaled candidate samples to median raw wall times (self-test injection probe).
 * @param {number[]} scaledMs
 * @param {number[]} rawMs
 */
export function measuredCandidateInjectionFactor(scaledMs, rawMs) {
  const rawMed = median(rawMs);
  const scaledMed = median(scaledMs);
  if (!Number.isFinite(rawMed) || rawMed <= 0) return NaN;
  return scaledMed / rawMed;
}

/**
 * Symmetric warmup: alternate baseline and candidate until recent pair medians
 * stabilize or `maxPairs` is reached.
 *
 * @param {() => void} baseline
 * @param {() => void} candidate
 * @param {{ minPairs?: number, maxPairs?: number, settleBand?: number }} [opts]
 */
export function symmetricWarmup(baseline, candidate, opts = {}) {
  const minPairs = opts.minPairs ?? 12;
  const maxPairs = opts.maxPairs ?? 48;
  const settleBand = opts.settleBand ?? 0.05;
  const recent = /** @type {number[]} */ ([]);

  for (let p = 0; p < maxPairs; p++) {
    if (p % 2 === 0) {
      baseline();
      candidate();
    } else {
      candidate();
      baseline();
    }
    if (p >= minPairs - 1 && p % 2 === 1) {
      const t0 = performance.now();
      baseline();
      const tb = performance.now() - t0;
      const t1 = performance.now();
      candidate();
      const tc = performance.now() - t1;
      if (tb > 0) recent.push(tc / tb);
      if (recent.length > 4) recent.shift();
      if (recent.length === 4 && p >= minPairs + 3) {
        const lo = Math.min(...recent);
        const hi = Math.max(...recent);
        if (hi <= lo * (1 + settleBand)) break;
      }
    }
  }
}

/**
 * P(X <= k) for X ~ Binomial(n, 1/2).
 * @param {number} n
 * @param {number} k
 */
function binomialHalfCdf(n, k) {
  if (k < 0) return 0;
  if (k >= n) return 1;
  let p = 0.5 ** n;
  let sum = p;
  for (let i = 0; i < k; i++) {
    p = (p * (n - i)) / (i + 1);
    sum += p;
  }
  return sum;
}

/**
 * Exact, distribution-free one-sided bounds for the median of `xs`, each at
 * confidence `1 - alpha` (the sign test). `lower` and `upper` are order
 * statistics, so one outlier moves neither of them. With too few samples for
 * the requested `alpha` the bounds are -Infinity and +Infinity.
 *
 * @param {number[]} xs finite samples
 * @param {number} alpha one-sided error rate, in (0, 0.5)
 * @returns {{ lower: number, upper: number }}
 */
export function medianBounds(xs, alpha) {
  if (!(alpha > 0 && alpha < 0.5)) throw new RangeError(`alpha must be in (0, 0.5), got ${alpha}`);
  const n = xs.length;
  if (n > 1000) throw new RangeError(`medianBounds supports at most 1000 samples, got ${n}`);
  const s = [...xs].sort((a, b) => a - b);
  // Largest 1-based rank r with P(Binomial(n, 1/2) <= r - 1) <= alpha.
  let r = 0;
  while (r + 1 <= n && binomialHalfCdf(n, r) <= alpha) r++;
  if (r === 0) return { lower: -Infinity, upper: Infinity };
  return { lower: s[r - 1], upper: s[n - r] };
}

/**
 * Verdict from the paired round ratios (candidate / baseline) collected so far.
 *
 * - `fail`: even the lower confidence bound of the median ratio reaches the limit.
 * - `pass`: even the upper confidence bound stays below the limit.
 * - `continue`: the limit lies inside the interval, and more rounds are allowed.
 * - at the final look, an interval that still holds the limit is a `pass` with
 *   `conclusive: false`: the measured noise is as large as the margin, so the
 *   sample cannot show a regression.
 *
 * @param {number[]} roundRatios
 * @param {{ limit: number, alpha: number, final: boolean }} p
 */
export function decideGate(roundRatios, p) {
  const xs = roundRatios.filter((x) => Number.isFinite(x));
  if (xs.length < 5) {
    throw new Error(
      `wall-clock gate has ${xs.length} valid rounds of ${roundRatios.length}; ` +
        'the timer resolution is too coarse for this workload'
    );
  }
  const ratio = median(xs);
  const { lower, upper } = medianBounds(xs, p.alpha);
  if (lower >= p.limit) return { verdict: 'fail', conclusive: true, ratio, lower, upper };
  if (upper < p.limit) return { verdict: 'pass', conclusive: true, ratio, lower, upper };
  if (!p.final) return { verdict: 'continue', conclusive: false, ratio, lower, upper };
  return { verdict: 'pass', conclusive: false, ratio, lower, upper };
}

/**
 * @typedef {object} SequentialParams
 * @property {number} limit exclusive upper bound for the median ratio
 * @property {number} alpha one-sided error rate of each look
 * @property {number} initialRounds rounds before the first look
 * @property {number} blockRounds rounds added between looks
 * @property {number} maxRounds rounds at the final look
 * @property {number} [discard] leading rounds taken and dropped (JIT settle)
 */

/**
 * Take paired rounds in blocks until the confidence interval of the median
 * ratio excludes the limit, or `maxRounds` is reached. Every round feeds one
 * estimate, and no round is dropped or repeated: this is one sequential
 * measurement, not a re-run.
 *
 * @param {(count: number) => number[]} takeRounds returns `count` new round ratios (NaN for an unusable round)
 * @param {SequentialParams} p
 */
export function sequentialDecision(takeRounds, p) {
  const discard = p.discard ?? 0;
  if (!(p.limit > 0) || !Number.isFinite(p.limit)) throw new RangeError(`bad limit ${p.limit}`);
  for (const key of ['initialRounds', 'blockRounds', 'maxRounds']) {
    if (!Number.isInteger(p[key]) || p[key] < 1) throw new RangeError(`${key} must be an integer >= 1`);
  }
  if (p.maxRounds < p.initialRounds) throw new RangeError('maxRounds must be >= initialRounds');
  if (!Number.isInteger(discard) || discard < 0) throw new RangeError('discard must be an integer >= 0');

  const all = [...takeRounds(discard + p.initialRounds)];
  for (;;) {
    const kept = all.slice(discard);
    const final = kept.length >= p.maxRounds;
    const d = decideGate(kept, { limit: p.limit, alpha: p.alpha, final });
    if (d.verdict !== 'continue') return { ...d, rounds: kept.length, roundRatios: kept };
    all.push(...takeRounds(Math.min(p.blockRounds, p.maxRounds - kept.length)));
  }
}

/**
 * True when the A/A control is on: the candidate arm runs the baseline function.
 * A gate must pass in this mode, whatever the machine does.
 */
export function aaControl() {
  const raw = process.env.PERF_GATE_AA;
  return raw !== undefined && raw !== '' && raw !== '0';
}

/**
 * Wall-clock A/B gate with a noise-aware sequential verdict.
 *
 * Warms both arms, then times paired ABBA rounds in blocks. The gate fails
 * only when the lower confidence bound of the median ratio reaches `limit`,
 * so a verdict never rests on a sample whose noise is as large as its margin;
 * such a sample gets more rounds first. `PERF_GATE_CANDIDATE_TIME_SCALE`
 * multiplies candidate times (injection self-test); `PERF_GATE_AA=1` times the
 * baseline function as both arms (control).
 *
 * @param {() => void} baseline
 * @param {() => void} candidate
 * @param {SequentialParams & { skipSymmetricWarmup?: boolean, warmup?: Parameters<typeof symmetricWarmup>[2], fullWarmupPairs?: number, gcBetween?: boolean }} opts
 */
export function wallClockAbGate(baseline, candidate, opts) {
  const cand = aaControl() ? baseline : candidate;
  if (!opts.skipSymmetricWarmup) symmetricWarmup(baseline, cand, opts.warmup);
  const fullPairs = opts.fullWarmupPairs ?? 4;
  for (let p = 0; p < fullPairs; p++) {
    if (p % 2 === 0) {
      baseline();
      cand();
    } else {
      cand();
      baseline();
    }
  }

  const gcBetween = opts.gcBetween ?? false;
  if (gcBetween && typeof globalThis.gc !== 'function') {
    throw new Error(
      'gcBetween needs a gate process started with --expose-gc; ' +
        'start the gate through run-wall-clock-gates.mjs (tools/test/perf-gate-spawn.mjs)'
    );
  }
  const discard = opts.discard ?? 0;
  const baselineMs = [];
  const candidateMs = [];
  const candidateRawMs = [];
  let round = 0;
  const takeRounds = (count) => {
    const out = [];
    for (let i = 0; i < count; i++, round++) {
      if (gcBetween) globalThis.gc();
      let b;
      let c;
      if (round % 2 === 0) {
        b = timeMs(baseline, 'baseline');
        c = timeMs(cand, 'candidate');
      } else {
        c = timeMs(cand, 'candidate');
        b = timeMs(baseline, 'baseline');
      }
      if (round >= discard) {
        baselineMs.push(b.wall);
        candidateMs.push(c.wall);
        candidateRawMs.push(c.raw);
      }
      out.push(b.wall > 0 ? c.wall / b.wall : NaN);
    }
    return out;
  };

  const decision = sequentialDecision(takeRounds, opts);
  const scale = candidateTimeScale();
  return {
    ...decision,
    limit: opts.limit,
    alpha: opts.alpha,
    aa: aaControl(),
    baselineMs: median(baselineMs),
    candidateMs: median(candidateMs),
    candidateRawMs: median(candidateRawMs),
    candidateInjectionFactor:
      scale === 1 ? 1 : measuredCandidateInjectionFactor(candidateMs, candidateRawMs),
  };
}

/** Default location of the gate list; `PERF_GATE_CONFIG` overrides it. */
export const DEFAULT_GATE_CONFIG = join(dirname(fileURLToPath(import.meta.url)), 'wall-clock-gates.json');

/** Path of the gate list in use. */
export function gateConfigPath() {
  const raw = process.env.PERF_GATE_CONFIG;
  return raw !== undefined && raw !== '' ? raw : DEFAULT_GATE_CONFIG;
}

/**
 * Read and validate the gate list. Every gate is `defaults` overlaid with its
 * own keys. A missing or malformed file throws; nothing falls back to a
 * built-in value.
 *
 * @param {string} [path]
 * @returns {Array<SequentialParams & { name: string, script: string, needs: string[], timeoutMs: number }>}
 */
export function loadGateList(path = gateConfigPath()) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`wall-clock gate list unreadable: ${path}: ${e.message}`);
  }
  if (!Array.isArray(parsed.gates) || parsed.gates.length === 0) {
    throw new Error(`wall-clock gate list ${path} has no "gates" array`);
  }
  const defaults = parsed.defaults ?? {};
  const names = new Set();
  return parsed.gates.map((g) => {
    const gate = { ...defaults, ...g };
    const where = `${path}: gate ${JSON.stringify(g.name)}`;
    if (typeof gate.name !== 'string' || gate.name === '') throw new Error(`${where}: name missing`);
    if (names.has(gate.name)) throw new Error(`${where}: duplicate name`);
    names.add(gate.name);
    if (typeof gate.script !== 'string' || gate.script === '') throw new Error(`${where}: script missing`);
    if (!Array.isArray(gate.needs)) throw new Error(`${where}: needs must be an array`);
    for (const key of ['limit', 'alpha', 'initialRounds', 'blockRounds', 'maxRounds', 'timeoutMs']) {
      if (typeof gate[key] !== 'number' || !Number.isFinite(gate[key]) || gate[key] <= 0) {
        throw new Error(`${where}: ${key} must be a positive number`);
      }
    }
    if (typeof gate.gcBetween !== 'boolean') throw new Error(`${where}: gcBetween must be true or false`);
    return gate;
  });
}

/**
 * One gate of the list, by name.
 * @param {string} name
 * @param {string} [path]
 */
export function loadGateConfig(name, path = gateConfigPath()) {
  const gate = loadGateList(path).find((g) => g.name === name);
  if (!gate) throw new Error(`wall-clock gate "${name}" is not in ${path}`);
  return gate;
}

/**
 * Print the one JSON line that a gate script owes the runner.
 * @param {{ name: string }} gate
 * @param {ReturnType<typeof wallClockAbGate>} result
 * @param {Record<string, unknown>} [extra]
 */
export function reportGate(gate, result, extra = {}) {
  const { roundRatios: _rounds, ...summary } = result;
  process.stdout.write(JSON.stringify({ gate: gate.name, ...summary, ...extra }) + '\n');
}
