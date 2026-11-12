/**
 * Shared wall-clock A/B gate statistics for CI perf tests (G26 / #876).
 *
 * Interleaved ABBA sampling, symmetric warmup, optional GC between rounds, and
 * median + trimmed-mean ratio estimates. Import from isolated Node gate scripts
 * under package test helpers.
 */

/** @param {number[]} xs */
export function median(xs) {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Trimmed mean dropping the same count from each tail (10% default, at least 0).
 * @param {number[]} xs
 * @param {number} [trimFraction]
 */
export function trimmedMean(xs, trimFraction = 0.1) {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const trim = Math.min(Math.floor(s.length * trimFraction), Math.floor((s.length - 1) / 2));
  const slice = trim > 0 ? s.slice(trim, s.length - trim) : s;
  if (slice.length === 0) return median(s);
  let sum = 0;
  for (const x of slice) sum += x;
  return sum / slice.length;
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
 * @param {() => void} fn
 * @param {'baseline' | 'candidate'} arm
 */
export function timeMs(fn, arm) {
  const t0 = performance.now();
  fn();
  let dt = performance.now() - t0;
  if (arm === 'candidate') dt *= candidateTimeScale();
  return dt;
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
 * ABBA timed ratio: baseline vs candidate (candidate/baseline).
 *
 * @param {() => void} baseline
 * @param {() => void} candidate
 * @param {{ samplePairs?: number, gcBetween?: boolean, leadingDiscard?: number }} [opts]
 */
export function abbaTimedRatio(baseline, candidate, opts = {}) {
  const samplePairs = opts.samplePairs ?? 16;
  const gcBetween = opts.gcBetween ?? true;
  const leadingDiscard = opts.leadingDiscard ?? 0;
  const baselineMs = [];
  const candidateMs = [];
  const roundRatios = [];

  for (let r = 0; r < samplePairs; r++) {
    if (gcBetween && globalThis.gc) globalThis.gc();
    let b;
    let c;
    if (r % 2 === 0) {
      b = timeMs(baseline, 'baseline');
      c = timeMs(candidate, 'candidate');
    } else {
      c = timeMs(candidate, 'candidate');
      b = timeMs(baseline, 'baseline');
    }
    baselineMs.push(b);
    candidateMs.push(c);
    if (b > 0) roundRatios.push(c / b);
  }

  const baseSlice = baselineMs.slice(leadingDiscard);
  const candSlice = candidateMs.slice(leadingDiscard);
  const ratioSlice = roundRatios.slice(leadingDiscard);
  const ratioOfMedians = median(candSlice) / Math.max(median(baseSlice), Number.EPSILON);
  const ratioOfTrimmed =
    trimmedMean(candSlice) / Math.max(trimmedMean(baseSlice), Number.EPSILON);
  const ratioOfRoundMedians = median(ratioSlice);
  const ratio = Math.max(ratioOfMedians, ratioOfTrimmed);

  return {
    ratio,
    ratioOfMedians,
    ratioOfTrimmed,
    ratioOfRoundMedians,
    baselineMs: median(baselineMs),
    candidateMs: median(candidateMs),
    roundRatios,
  };
}

/**
 * Full gate: warmup then ABBA ratio.
 *
 * @param {() => void} baseline
 * @param {() => void} candidate
 * @param {{ warmup?: Parameters<typeof symmetricWarmup>[2], sample?: Parameters<typeof abbaTimedRatio>[2], fullWarmupPairs?: number }} [opts]
 */
export function wallClockAbRatio(baseline, candidate, opts = {}) {
  symmetricWarmup(baseline, candidate, opts.warmup);
  const fullPairs = opts.fullWarmupPairs ?? 4;
  for (let p = 0; p < fullPairs; p++) {
    if (p % 2 === 0) {
      baseline();
      candidate();
    } else {
      candidate();
      baseline();
    }
  }
  return abbaTimedRatio(baseline, candidate, opts.sample);
}

/** @param {number} ratio @param {number} limit exclusive upper bound */
export function gatePasses(ratio, limit) {
  return Number.isFinite(ratio) && ratio < limit;
}
