/**
 * Compare repeated rounding of a million-digit BigNumber with one division at the same scale.
 * The control precomputes its divisor. The candidate must reuse its decimal boundary power.
 */
import { BigNumber } from '../../../core/dist/index.js';
import {
  loadGateConfig,
  reportGate,
  wallClockAbGate,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

const gate = loadGateConfig('bignumber-large-rounding');
const digits = 1_000_000;
const precision = 76;
const coefficient = 10n ** BigInt(digits) - 1n;
const divisor = 10n ** BigInt(digits - precision);
const input = BigNumber.fromBigInt(coefficient);
const expected = BigNumber.parse(`1e${digits}`);
let control = 0n;
let rounded = input.roundToPrecision(precision);

const result = wallClockAbGate(
  () => {
    control = (coefficient + divisor / 2n) / divisor;
  },
  () => {
    rounded = input.roundToPrecision(precision);
  },
  gate
);

reportGate(gate, result, {
  parity: rounded.equals(expected) && control === 10n ** BigInt(precision),
});
