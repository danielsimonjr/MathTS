/**
 * Isolated Node gate for #735: create(all).add(1,2) vs mathjs.
 * stdout: one JSON line { ratio, mathTsMs, mjMs, parity }.
 */
import { create, all } from '../../dist/index.js';
import { create as mjCreate, all as mjAll } from 'mathjs';
import { candidateTimeScale, gatePasses, median } from '../../../tools/test/wall-clock-perf-gate.mjs';

const mt = create(all);
const mj = mjCreate(mjAll);
const n = 1_000_000;

const slowScale = candidateTimeScale();

function timeLoop(body, arm) {
  const t0 = performance.now();
  for (let i = 0; i < n; i++) body();
  let dt = performance.now() - t0;
  if (arm === 'candidate' && slowScale > 1) {
    const end = t0 + dt * slowScale;
    while (performance.now() < end) {
      /* synthetic slowdown for gate self-test */
    }
    dt *= slowScale;
  }
  return dt;
}

for (let w = 0; w < 50; w++) {
  mj.add(1, 2);
  mt.add(1, 2);
}

const mjTimes = [];
const mtTimes = [];
for (let r = 0; r < 16; r++) {
  if (r % 2 === 0) {
    mjTimes.push(timeLoop(() => mj.add(1, 2), 'baseline'));
    mtTimes.push(timeLoop(() => mt.add(1, 2), 'candidate'));
  } else {
    mtTimes.push(timeLoop(() => mt.add(1, 2), 'candidate'));
    mjTimes.push(timeLoop(() => mj.add(1, 2), 'baseline'));
  }
}

const ratio = median(mtTimes) / median(mjTimes);
process.stdout.write(
  JSON.stringify({
    ratio,
    mathTsMs: median(mtTimes),
    mjMs: median(mjTimes),
    parity: mt.add(1, 2),
    gateWouldPass: gatePasses(ratio, 2.0),
  }) + '\n'
);
