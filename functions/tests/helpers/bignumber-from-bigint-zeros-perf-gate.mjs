/**
 * Isolated Node gate: `BigNumber.fromBigInt` of a power of ten removes its trailing zeros in
 * fewer than O(zeros * size) steps.
 *
 * Baseline: 10^10000. Candidate: 10^40000 (4 times the zeros and 4 times the size). A loop that
 * removes one zero in each step does 4 times the divisions on numbers 4 times as long, so the
 * ratio is about 16. Division by the powers 10^(2^j) does about 3 * log2(zeros) divisions, so the
 * ratio is that of a few long divisions on a number 4 times as long.
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
const small = 10n ** 10000n;
const large = 10n ** 40000n;

let checksum = 0;

const result = wallClockAbGate(
  () => {
    checksum += BigNumber.fromBigInt(small).e;
  },
  () => {
    checksum += BigNumber.fromBigInt(large).e;
  },
  gate
);

reportGate(gate, result, { checksum });
