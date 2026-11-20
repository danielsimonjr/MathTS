/**
 * Isolated Node gate for #1005: quantileSeq(number[], 0.9) on a sorted array rotated by half
 * against quantileSeq on random values, at n=2e5. Both find one order statistic by selection, so
 * the two must cost about the same. A fixed first, middle and last pivot made the rotated input
 * quadratic: 2.3 s against 8 ms at this size.
 * Limit and round counts: tools/test/wall-clock-gates.json ("quantile-rotated-vs-random").
 * The baseline arm is the random input; the candidate arm is the rotated input.
 * stdout: one JSON line, see reportGate.
 */
import { quantileSeq } from '../../dist/index.js';
import {
  loadGateConfig,
  reportGate,
  wallClockAbGate,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

const gate = loadGateConfig('quantile-rotated-vs-random');
const n = 200_000;
let seed = 12345;
const random = Array.from(
  { length: n },
  () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0)
);
const rotated = Array.from({ length: n }, (_, i) => (i + n / 2) % n);

let checksum = 0;

const result = wallClockAbGate(
  () => {
    checksum += quantileSeq(random, 0.9);
  },
  () => {
    checksum += quantileSeq(rotated, 0.9);
  },
  { ...gate, warmup: { minPairs: 4, maxPairs: 8 } }
);

reportGate(gate, result, { checksum });
