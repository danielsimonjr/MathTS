/**
 * Isolated Node process gate for #692 / G26: sin(Float64Array) vs Math.sin loop.
 * stdout: one JSON line { ratio, loopMs, sinMs, checksum }.
 */
import { sin } from '../../dist/index.js';
import { gatePasses, wallClockAbRatio } from '../../../tools/test/wall-clock-perf-gate.mjs';

const n = 1_000_000;
const template = new Float64Array(n);
for (let i = 0; i < n; i++) template[i] = (i % 997) / 997;
const buf = new Float64Array(n);
let checksum = 0;

function runLoop() {
  buf.set(template);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.sin(buf[i]);
  checksum += out[n - 1];
}

function runSin() {
  buf.set(template);
  const out = sin(buf);
  checksum += out[out.length - 1];
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
      gcBetween: typeof globalThis.gc === 'function',
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
