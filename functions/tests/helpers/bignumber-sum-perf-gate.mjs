/**
 * Isolated Node gate for #1118: a 10,000-term BigNumber sum at precision 64 against decimal.js.
 * Each add rounds to the precision, so this sum times the rounding step.
 * Limit and round counts: tools/test/wall-clock-gates.json ("bignumber-sum").
 * stdout: one JSON line, see reportGate.
 */
import { BigNumber } from '@danielsimonjr/mathts-core';
import Decimal from 'decimal.js';
import {
  loadGateConfig,
  reportGate,
  wallClockAbGate,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

const gate = loadGateConfig('bignumber-sum');
const PRECISION = 64;
BigNumber.config({ precision: PRECISION });
const D = Decimal.clone({ precision: PRECISION });

// Deterministic 64-digit terms in [0, 1).
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
const terms = Array.from({ length: 10_000 }, () => {
  let s = '0.';
  for (let i = 0; i < 16; i++) s += String(rnd() % 10000).padStart(4, '0');
  return s;
});
const dTerms = terms.map((s) => new D(s));
const bTerms = terms.map((s) => BigNumber.parse(s));

const sumD = () => {
  let s = new D(0);
  for (const x of dTerms) s = s.add(x);
  return s;
};
const sumB = () => {
  let s = BigNumber.fromNumber(0);
  for (const x of bTerms) s = s.add(x);
  return s;
};

const result = wallClockAbGate(sumD, sumB, gate);

reportGate(gate, result, { parity: sumB().toString() === sumD().toString() });
