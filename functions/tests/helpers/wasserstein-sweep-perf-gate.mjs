/**
 * Isolated Node gate: the sweep of wassersteinDistance over its sorted copies stays O(n log n).
 * Limit and round counts: tools/test/wall-clock-gates.json ("wasserstein-sweep").
 * The baseline arm runs n points 4 times; the candidate arm runs 4n points once. O(n log n)
 * gives a ratio near 1.1, and O(n²) gives a ratio near 4.
 * stdout: one JSON line, see reportGate.
 */
import { wassersteinDistance } from '../../dist/index.js';
import {
  loadGateConfig,
  reportGate,
  wallClockAbGate,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

const gate = loadGateConfig('wasserstein-sweep');
const n = 8192;
const points = (len, f) => Array.from({ length: len }, (_, i) => f(i));
const smallA = points(n, Math.sin);
const smallB = points(n, Math.cos);
const largeA = points(4 * n, Math.sin);
const largeB = points(4 * n, Math.cos);

let checksum = 0;

const result = wallClockAbGate(
  () => {
    for (let k = 0; k < 4; k++) checksum += wassersteinDistance(smallA, smallB);
  },
  () => {
    checksum += wassersteinDistance(largeA, largeB);
  },
  { ...gate, warmup: { minPairs: 4, maxPairs: 8 } }
);

reportGate(gate, result, { checksum });
