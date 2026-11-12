/**
 * Isolated Node gate for G26 #694: lusolve vs matrix lu+luSolve at n=1000.
 * stdout: one JSON line { ratio, solveMs, facMs, checksum }.
 */
import { lusolve } from '../../dist/index.js';
import { lu, luSolve } from '@danielsimonjr/mathts-matrix';
import { gatePasses, wallClockAbRatio } from '../../../tools/test/wall-clock-perf-gate.mjs';

const n = 1000;
let s = 42;
const rnd = () => {
  s = (s * 1664525 + 1013904223) >>> 0;
  return s / 0xffffffff;
};
const M = Array.from({ length: n }, () => Array(n).fill(0));
for (let i = 0; i < n; i++) {
  for (let j = 0; j < n; j++) {
    const v = rnd();
    M[i][j] += v;
    M[j][i] += v;
  }
  M[i][i] += n;
}
const b = Array.from({ length: n }, (_, i) => 0.1 * (i + 1));

let checksum = 0;

const { ratio, baselineMs, candidateMs } = wallClockAbRatio(
  () => {
    const x = luSolve(lu(M), b);
    checksum += (x[0]?.[0] ?? 0) + (x[n - 1]?.[0] ?? 0);
  },
  () => {
    const x = lusolve(M, b);
    checksum += (x[0]?.[0] ?? 0) + (x[n - 1]?.[0] ?? 0);
  },
  {
    skipSymmetricWarmup: true,
    fullWarmupPairs: 4,
    sample: { samplePairs: 9, gcBetween: false },
  }
);

process.stdout.write(
  JSON.stringify({
    ratio,
    solveMs: candidateMs,
    facMs: baselineMs,
    checksum,
    gateWouldPass: gatePasses(ratio, 1.2),
  }) + '\n'
);
