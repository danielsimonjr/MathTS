/**
 * Isolated Node gate for #1271: `multiply` of two CSC sparse matrices must cost O(flops), not
 * O(n^3). Limit and round counts: tools/test/wall-clock-gates.json ("sparse-product-1271").
 *
 * Operand(n) is the identity plus n / 10 seeded random entries, built directly in CSC form
 * (a dense 10000 x 10000 array needs 800 MB). So nnz and the flop count grow with n. The
 * baseline arm multiplies two operands of n = 5000. The candidate arm multiplies two of
 * n = 10000. A product that costs O(flops) has a ratio near 2. A product through dense
 * arrays has a ratio near 8, or runs out of memory.
 * stdout: one JSON line, see reportGate.
 */
import { multiply, sparse } from '../../dist/index.js';
import {
  loadGateConfig,
  reportGate,
  wallClockAbGate,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

const gate = loadGateConfig('sparse-product-1271');

/** A seeded generator, so each run builds the same operands. */
function lcg(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** The identity of order n plus n / 10 random entries, as a CSC matrix. */
function operand(n, seed) {
  const rnd = lcg(seed);
  const columns = Array.from({ length: n }, (_, j) => new Map([[j, 1]]));
  for (let t = 0; t < n / 10; t++) {
    const row = Math.floor(rnd() * n);
    const col = Math.floor(rnd() * n);
    if (!columns[col].has(row)) columns[col].set(row, 0.5 + rnd());
  }
  const values = [];
  const index = [];
  const ptr = [0];
  for (const column of columns) {
    for (const row of [...column.keys()].sort((x, y) => x - y)) {
      index.push(row);
      values.push(column.get(row));
    }
    ptr.push(index.length);
  }
  return sparse({ values, index, ptr, size: [n, n] });
}

const small = [operand(5000, 11), operand(5000, 22)];
const large = [operand(10000, 33), operand(10000, 44)];

let checksum = 0;

const result = wallClockAbGate(
  () => {
    const c = multiply(small[0], small[1]);
    checksum += c._ptr[c._ptr.length - 1];
  },
  () => {
    const c = multiply(large[0], large[1]);
    checksum += c._ptr[c._ptr.length - 1];
  },
  { ...gate, warmup: { minPairs: 4, maxPairs: 8 } }
);

reportGate(gate, result, { checksum });
