/**
 * Isolated Node gate for #693: DenseMatrix.multiply vs ml-matrix mmul at n=1000.
 * Limit and round counts: tools/test/wall-clock-gates.json ("gemm").
 * stdout: one JSON line, see reportGate.
 */
import { DenseMatrix } from '../../dist/index.js';
import { Matrix as MLMatrix } from 'ml-matrix';
import {
  loadGateConfig,
  reportGate,
  wallClockAbGate,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

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

const gate = loadGateConfig('gemm');
const n = 1000;
const A = randSpd(n, 42);
const B = randSpd(n, 99);
const AD = DenseMatrix.fromArray(A);
const BD = DenseMatrix.fromArray(B);
const AM = new MLMatrix(A);
const BM = new MLMatrix(B);

let checksum = 0;

const result = wallClockAbGate(
  () => {
    AM.mmul(BM);
    checksum += 1;
  },
  () => {
    AD.multiply(BD);
    checksum += 1;
  },
  { ...gate, skipSymmetricWarmup: true, fullWarmupPairs: 4 }
);

reportGate(gate, result, { checksum });
