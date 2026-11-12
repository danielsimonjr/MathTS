/**
 * Isolated Node gate for #712: sort(number[]) vs Float64Array.sort.
 * stdout: one JSON line { ratio, sortMs, nativeMs, checksum }.
 */
import { sort } from '../../dist/index.js';
import { gatePasses, wallClockAbRatio } from '../../../tools/test/wall-clock-perf-gate.mjs';

const n = 100_000;
const src = [];
for (let i = 0; i < n; i++) src.push(Math.sin(i));

let checksum = 0;

const { ratio, baselineMs, candidateMs } = wallClockAbRatio(
  () => {
    const f = new Float64Array(src);
    f.sort();
    checksum += f[0] + f[n - 1];
  },
  () => {
    const b = src.slice();
    sort(b);
    checksum += b[0] + b[n - 1];
  },
  {
    warmup: { minPairs: 10, maxPairs: 32 },
    sample: { samplePairs: 14, gcBetween: true },
  }
);

process.stdout.write(
  JSON.stringify({
    ratio,
    sortMs: candidateMs,
    nativeMs: baselineMs,
    checksum,
    gateWouldPass: gatePasses(ratio, 1.5),
  }) + '\n'
);
