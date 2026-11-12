/**
 * Isolated Node gate for #735: create(all).add(1,2) vs mathjs.
 * stdout: one JSON line { ratio, mathTsMs, mjMs, parity }.
 */
import { create, all } from '../../dist/index.js';
import { create as mjCreate, all as mjAll } from 'mathjs';
import {
  candidateTimeScale,
  gatePasses,
  median,
} from '../../../tools/test/wall-clock-perf-gate.mjs';

const mt = create(all);
const mj = mjCreate(mjAll);
// 5_000 adds finish inside the performance.now() quantum. A million calls
// puts each sample in the millisecond range. Bound stays < 2.0.
const n = 1_000_000;
const slowScale = candidateTimeScale();

function timeLoop(body, arm) {
  const t0 = performance.now();
  for (let i = 0; i < n; i++) body();
  let dt = performance.now() - t0;
  if (arm === 'candidate') dt *= slowScale;
  return dt;
}

for (let w = 0; w < 50; w++) {
  mj.add(1, 2);
  mt.add(1, 2);
}

const mjTimes = [];
const mtTimes = [];
const roundRatios = [];
for (let r = 0; r < 16; r++) {
  let mjMs;
  let mtMs;
  if (r % 2 === 0) {
    mjMs = timeLoop(() => mj.add(1, 2), 'baseline');
    mtMs = timeLoop(() => mt.add(1, 2), 'candidate');
  } else {
    mtMs = timeLoop(() => mt.add(1, 2), 'candidate');
    mjMs = timeLoop(() => mj.add(1, 2), 'baseline');
  }
  mjTimes.push(mjMs);
  mtTimes.push(mtMs);
  if (mjMs > 0) roundRatios.push(mtMs / mjMs);
}

const ratio = median(roundRatios);
process.stdout.write(
  JSON.stringify({
    ratio,
    mathTsMs: median(mtTimes),
    mjMs: median(mjTimes),
    parity: mt.add(1, 2),
    gateWouldPass: gatePasses(ratio, 2.0),
  }) + '\n'
);
