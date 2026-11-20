/**
 * Isolated Node gate for #1005: quantileSeq(number[], p) against median(number[]) at n=1e6.
 * Both find order statistics by selection, so quantileSeq must cost about as much as median.
 * Limit and round counts: tools/test/wall-clock-gates.json ("quantile-vs-median").
 * The baseline arm is median(); the candidate arm is quantileSeq() at p = 0.9.
 * stdout: one JSON line, see reportGate.
 */
import { median, quantileSeq } from '../../dist/index.js';
import {
  loadGateConfig,
  reportGate,
  wallClockAbGate,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

const gate = loadGateConfig('quantile-vs-median');
const n = 1_000_000;
const data = Array.from({ length: n }, (_, i) => Math.sin(i));

let checksum = 0;

const result = wallClockAbGate(
  () => {
    checksum += median(data);
  },
  () => {
    checksum += quantileSeq(data, 0.9);
  },
  { ...gate, warmup: { minPairs: 4, maxPairs: 8 } }
);

reportGate(gate, result, { checksum });
