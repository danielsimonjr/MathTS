/**
 * Isolated Node gate: `BigNumber.fromBigInt` of a power of ten removes its trailing zeros in
 * fewer than O(zeros * size) steps.
 *
 * Baseline: one division of 10^40000 by 10^20000. Candidate: `fromBigInt(10^40000)`. Division by
 * the powers 10^(2^j) does about 3 * log2(zeros) divisions, most of them shorter than the
 * baseline division, so the ratio is about 7 to 9 (Node 22 and Node 26). A loop that removes one
 * zero in each step does 40000 divisions of the whole number: a ratio of 600 to 1800. Both arms
 * divide numbers of the same size, so the ratio does not depend on how the engine scales a long
 * division with its size.
 * Limit and round counts: tools/test/wall-clock-gates.json ("bignumber-from-bigint-zeros").
 * stdout: one JSON line, see reportGate.
 */
import { BigNumber } from '../../../core/dist/index.js';
import {
  loadGateConfig,
  reportGate,
  wallClockAbGate,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

const gate = loadGateConfig('bignumber-from-bigint-zeros');
const value = 10n ** 40000n;
const divisor = 10n ** 20000n;

let checksum = 0;

const result = wallClockAbGate(
  () => {
    checksum += Number((value / divisor) % 1000003n);
  },
  () => {
    checksum += BigNumber.fromBigInt(value).e;
  },
  gate
);

reportGate(gate, result, { checksum });
