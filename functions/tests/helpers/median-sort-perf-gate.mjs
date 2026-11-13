/**
 * Isolated Node gate for #712: median(number[]) quickselect vs a full sort at n=1e6.
 * Limit and round counts: tools/test/wall-clock-gates.json ("median-vs-sort").
 * The candidate arm is median(); the baseline arm copies the data and sorts it.
 * stdout: one JSON line, see reportGate.
 */
import { median } from '../../dist/index.js';
import {
  loadGateConfig,
  reportGate,
  wallClockAbGate,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

const gate = loadGateConfig('median-vs-sort');
const n = 1_000_000;
const data = Array.from({ length: n }, (_, i) => Math.sin(i));

let checksum = 0;

const result = wallClockAbGate(
  () => {
    const s = data.slice();
    s.sort((a, b) => a - b);
    checksum += s[n >> 1];
  },
  () => {
    checksum += median(data);
  },
  { ...gate, warmup: { minPairs: 4, maxPairs: 8 } }
);

reportGate(gate, result, { checksum });
