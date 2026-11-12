/**
 * Isolated Node process gate for #692 / G26: sin(Float64Array) vs Math.sin loop.
 * stdout: one JSON line { ratio, loopMs, sinMs, checksum }.
 */
import { sin } from '../../dist/index.js';
import { gatePasses, wallClockAbRatio } from '../../../tools/test/wall-clock-perf-gate.mjs';

const n = 1_000_000;
// One 1e6 pass is only ~4ms on Node 20, so a 1ms preemption swings a round
// ratio by ~25%. Intra-run ratios were observed from 0.48 to 2.31 and the
// median was bimodal (~0.89 vs ~1.11), leaving little margin under the 1.2
// bound. Repeating the same 1e6 work 8 times makes each sample ~35ms. The
// array size and the 1.2 exclusive bound are unchanged.
const INNER_REPEATS = 8;
const template = new Float64Array(n);
for (let i = 0; i < n; i++) template[i] = (i % 997) / 997;
const buf = new Float64Array(n);
let checksum = 0;

function runLoop() {
  for (let r = 0; r < INNER_REPEATS; r++) {
    buf.set(template);
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.sin(buf[i]);
    checksum += out[n - 1];
  }
}

function runSin() {
  for (let r = 0; r < INNER_REPEATS; r++) {
    buf.set(template);
    const out = sin(buf);
    checksum += out[out.length - 1];
  }
}

const { ratio, baselineMs, candidateMs, candidateInjectionFactor } = wallClockAbRatio(
  runLoop,
  runSin,
  {
    fullWarmupPairs: 4,
    warmup: { minPairs: 8, maxPairs: 24 },
    sample: {
      samplePairs: 31,
      leadingDiscard: 4,
      // Child is always spawned with --expose-gc (see perf-gate-spawn.mjs).
      gcBetween: true,
    },
  }
);

process.stdout.write(
  JSON.stringify({
    ratio,
    loopMs: baselineMs,
    sinMs: candidateMs,
    checksum,
    gateWouldPass: gatePasses(ratio, 1.2),
    candidateInjectionFactor,
  }) + '\n'
);
