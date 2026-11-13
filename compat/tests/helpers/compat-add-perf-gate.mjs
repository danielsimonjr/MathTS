/**
 * Isolated Node gate for #735: create(all).add(1,2) vs mathjs.
 * Limit and round counts: tools/test/wall-clock-gates.json ("compat-add").
 * stdout: one JSON line, see reportGate.
 */
import { create, all } from '../../dist/index.js';
import { create as mjCreate, all as mjAll } from 'mathjs';
import {
  loadGateConfig,
  reportGate,
  wallClockAbGate,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

const gate = loadGateConfig('compat-add');
const mt = create(all);
const mj = mjCreate(mjAll);
// 5_000 adds finish inside the performance.now() quantum. A million calls
// puts each sample in the millisecond range.
const n = 1_000_000;

// Both arms run through this one loop, so the `body()` call site is the same for the two libraries.
const loop = (body) => () => {
  for (let i = 0; i < n; i++) body();
};

const result = wallClockAbGate(
  loop(() => mj.add(1, 2)),
  loop(() => mt.add(1, 2)),
  { ...gate, skipSymmetricWarmup: true, fullWarmupPairs: 4 }
);

reportGate(gate, result, { parity: mt.add(1, 2) });
