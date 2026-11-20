/**
 * Isolated Node gate for #716: `simplify` of a polynomial with a coefficient above the
 * canonical-form cap must not walk the divisors of the coefficient (an O(|c|) loop).
 * Limit and round counts: tools/test/wall-clock-gates.json ("simplify-coefficient-cap").
 * The baseline arm simplifies `x^2 + 2`; the candidate arm simplifies `x^2 + 2000000000`.
 * stdout: one JSON line, see reportGate.
 */
import { simplify } from '../../dist/index.js';
import {
  loadGateConfig,
  reportGate,
  wallClockAbGate,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

const gate = loadGateConfig('simplify-coefficient-cap');

let checksum = 0;

const result = wallClockAbGate(
  () => {
    checksum += String(simplify('x^2 + 2')).length;
  },
  () => {
    checksum += String(simplify('x^2 + 2000000000')).length;
  },
  { ...gate, warmup: { minPairs: 4, maxPairs: 8 } }
);

reportGate(gate, result, { checksum });
