/**
 * Isolated Node process gate for #692 / G26: sin(Float64Array) vs Math.sin loop.
 * Limit and round counts: tools/test/wall-clock-gates.json ("sin-f64").
 * stdout: one JSON line, see reportGate.
 */
import { sin } from '../../dist/index.js';
import {
  loadGateConfig,
  reportGate,
  wallClockAbGate,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

const gate = loadGateConfig('sin-f64');
const n = 1_000_000;
// One 1e6 pass is only ~4ms on Node 20, so a 1ms preemption swings a round
// ratio by ~25%. Repeating the same 1e6 work 8 times makes each sample ~35ms.
const INNER_REPEATS = 8;
const template = new Float64Array(n);
for (let i = 0; i < n; i++) template[i] = (i % 997) / 997;
const buf = new Float64Array(n);
let checksum = 0;

function runLoop() {
  for (let r = 0; r < INNER_REPEATS; r++) {
    buf.set(template);
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.sin(buf[i]);
    checksum += out[n - 1];
  }
}

function runSin() {
  for (let r = 0; r < INNER_REPEATS; r++) {
    buf.set(template);
    const out = sin(buf);
    checksum += out[out.length - 1];
  }
}

const result = wallClockAbGate(runLoop, runSin, {
  ...gate,
  fullWarmupPairs: 4,
  warmup: { minPairs: 8, maxPairs: 24 },
});

reportGate(gate, result, { checksum });
