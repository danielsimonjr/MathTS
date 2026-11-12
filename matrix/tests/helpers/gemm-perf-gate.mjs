/**
 * Isolated Node gate for #693: DenseMatrix.multiply vs ml-matrix mmul at n=1000.
 * stdout: one JSON line { ratio, mathTsMs, mlMs }.
 */
import { DenseMatrix } from '../../dist/index.js';
import { Matrix as MLMatrix } from 'ml-matrix';

function randSpd(n, seed) {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const A = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = rnd();
      A[i][j] += v;
      A[j][i] += v;
    }
    A[i][i] += n;
  }
  return A;
}

const n = 1000;
const A = randSpd(n, 42);
const B = randSpd(n, 99);
const AD = DenseMatrix.fromArray(A);
const BD = DenseMatrix.fromArray(B);
const AM = new MLMatrix(A);
const BM = new MLMatrix(B);

function median(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function timeMl() {
  const t0 = performance.now();
  AM.mmul(BM);
  return performance.now() - t0;
}

function timeMathTs() {
  const t0 = performance.now();
  AD.multiply(BD);
  return performance.now() - t0;
}

for (let w = 0; w < 6; w++) {
  if (w % 2 === 0) {
    timeMathTs();
    timeMl();
  } else {
    timeMl();
    timeMathTs();
  }
}

const mathTsTimes = [];
const mlTimes = [];
const ratios = [];
let checksum = 0;
for (let r = 0; r < 9; r++) {
  const mathTsFirst = r % 2 === 0;
  let mathTsMs;
  let mlMs;
  if (mathTsFirst) {
    mathTsMs = timeMathTs();
    mlMs = timeMl();
  } else {
    mlMs = timeMl();
    mathTsMs = timeMathTs();
  }
  mathTsTimes.push(mathTsMs);
  mlTimes.push(mlMs);
  ratios.push(mathTsMs / mlMs);
  checksum += mathTsMs + mlMs;
}

const ratio = median(ratios);
process.stdout.write(
  JSON.stringify({
    ratio,
    mathTsMs: median(mathTsTimes),
    mlMs: median(mlTimes),
    checksum,
  }) + '\n'
);
