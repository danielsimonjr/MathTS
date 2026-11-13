/**
 * Isolated Node gate for #712: sort(number[]) vs Float64Array.sort.
 * Limit and round counts: tools/test/wall-clock-gates.json ("sort-number").
 * stdout: one JSON line, see reportGate.
 */
import { sort } from '../../dist/index.js';
import {
  loadGateConfig,
  reportGate,
  wallClockAbGate,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

const gate = loadGateConfig('sort-number');
const n = 100_000;
const src = [];
for (let i = 0; i < n; i++) src.push(Math.sin(i));

let checksum = 0;

const result = wallClockAbGate(
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
  { ...gate, warmup: { minPairs: 10, maxPairs: 32 } }
);

reportGate(gate, result, { checksum });
