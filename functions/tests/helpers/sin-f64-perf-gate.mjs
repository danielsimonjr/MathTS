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

const { ratio, baselineMs, candidateMs } = wallClockAbRatio(runLoop, runSin, {
  skipSymmetricWarmup: true,
  fullWarmupPairs: 4,
  sample: { samplePairs: 21, gcBetween: false },
});

process.stdout.write(
  JSON.stringify({
    ratio,
    loopMs: baselineMs,
    sinMs: candidateMs,
    checksum,
    gateWouldPass: gatePasses(ratio, 1.2),
  }) + '\n'
);
