/**
 * Isolated Node process gate for #692: sin(Float64Array) vs Math.sin loop.
 * stdout: one JSON line { ratio, loopMs, sinMs }.
 */
import { sin } from '../../dist/index.js';

const n = 1_000_000;
const template = new Float64Array(n);
for (let i = 0; i < n; i++) template[i] = (i % 997) / 997;
const buf = new Float64Array(n);

function median(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function timeLoop() {
  buf.set(template);
  const t0 = performance.now();
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.sin(buf[i]);
  return performance.now() - t0;
}

function timeSin() {
  buf.set(template);
  const t0 = performance.now();
  sin(buf);
  return performance.now() - t0;
}

for (let w = 0; w < 5; w++) {
  timeLoop();
  timeSin();
}

const loopTimes = [];
const sinTimes = [];
for (let r = 0; r < 9; r++) {
  loopTimes.push(timeLoop());
  sinTimes.push(timeSin());
}

const loopMs = median(loopTimes);
const sinMs = median(sinTimes);
process.stdout.write(
  JSON.stringify({ ratio: sinMs / loopMs, loopMs, sinMs }) + '\n'
);
