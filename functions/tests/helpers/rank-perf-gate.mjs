/**
 * Isolated Node gate for #1157: rank(A) of a 100 x 100 matrix vs the full singular-value rule.
 * Limit and round counts: tools/test/wall-clock-gates.json ("rank-vs-svd").
 * The baseline arm counts the singular values above max(S) * max(m, n) * eps; the candidate arm
 * is rank(), which decides by a QR with column pivoting and uses the SVD only near the cutoff.
 * stdout: one JSON line, see reportGate.
 */
import { rank } from '../../dist/index.js';
import { singularValues } from '@danielsimonjr/mathts-matrix';
import {
  loadGateConfig,
  reportGate,
  wallClockAbGate,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

const gate = loadGateConfig('rank-vs-svd');
const n = 100;
let s = 7;
const rnd = () => {
  s = (s * 1664525 + 1013904223) >>> 0;
  return s / 0xffffffff - 0.5;
};
const A = Array.from({ length: n }, () => Array.from({ length: n }, rnd));

let checksum = 0;

const result = wallClockAbGate(
  () => {
    const sv = singularValues(A);
    let largest = 0;
    for (const x of sv) if (x > largest) largest = x;
    const cut = largest * n * Number.EPSILON;
    checksum += sv.filter((x) => x > cut).length;
  },
  () => {
    checksum += rank(A);
  },
  { ...gate, warmup: { minPairs: 2, maxPairs: 4 } }
);

reportGate(gate, result, { checksum });
