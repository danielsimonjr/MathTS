/**
 * Isolated Node gate for #889: create(all).sin(0.5) vs mathjs.
 * Limit and round counts: tools/test/wall-clock-gates.json ("compat-sin").
 * stdout: one JSON line, see reportGate.
 */
import { create, all } from '../../dist/index.js';
import { create as mjCreate, all as mjAll } from 'mathjs';
import {
  loadGateConfig,
  reportGate,
  wallClockAbGate,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

const gate = loadGateConfig('compat-sin');
const mt = create(all);
const mj = mjCreate(mjAll);
// 5_000 calls finish inside the performance.now() quantum. A million calls
// puts each sample in the millisecond range.
const n = 1_000_000;

// Both arms run through this one loop, so the `body()` call site is the same for the two libraries.
const loop = (body) => () => {
  for (let i = 0; i < n; i++) body();
};

const result = wallClockAbGate(
  loop(() => mj.sin(0.5)),
  loop(() => mt.sin(0.5)),
  { ...gate, skipSymmetricWarmup: true, fullWarmupPairs: 4 }
);

reportGate(gate, result, { parity: mt.sin(0.5) === mj.sin(0.5) });
