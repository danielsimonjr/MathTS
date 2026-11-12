/**
 * Isolated Node gate for #712: median(number[]) quickselect at n=1e6.
 * stdout: one JSON line { medianMs }.
 */
import { median } from '../../dist/index.js';

const n = 1_000_000;
const data = Array.from({ length: n }, (_, i) => Math.sin(i));

function medianTime(fn, warmup, reps) {
  for (let i = 0; i < warmup; i++) fn();
  const xs = [];
  for (let i = 0; i < reps; i++) {
    const t0 = performance.now();
    fn();
    xs.push(performance.now() - t0);
  }
  xs.sort((a, b) => a - b);
  return xs[Math.floor(xs.length / 2)];
}

for (let w = 0; w < 12; w++) {
  median(data);
}

const medians = [];
for (let r = 0; r < 9; r++) {
  const ms = medianTime(() => {
    median(data);
  }, 2, 5);
  medians.push(ms);
}
medians.sort((a, b) => a - b);
const medianMs = medians[Math.floor(medians.length / 2)];

process.stdout.write(JSON.stringify({ medianMs, sample: median(data) }) + '\n');
