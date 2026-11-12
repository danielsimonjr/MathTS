/**
 * Isolated Node gate for #735: create(all).add(1,2) vs mathjs.
 * stdout: one JSON line { ratio, mathTsMs, mjMs }.
 */
import { create, all } from '../../dist/index.js';
import { create as mjCreate, all as mjAll } from 'mathjs';

const mt = create(all);
const mj = mjCreate(mjAll);
const n = 5000;

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function timeLoop(fn) {
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn();
  return performance.now() - t0;
}

// Extra warmup under CI turbo contention (G26 #735 gate was ~2.05 at 12 ABBA rounds).
for (let w = 0; w < 50; w++) {
  mj.add(1, 2);
  mt.add(1, 2);
}

const ra = [];
const rb = [];
for (let r = 0; r < 16; r++) {
  if (r % 2 === 0) {
    ra.push(timeLoop(() => mj.add(1, 2)));
    rb.push(timeLoop(() => mt.add(1, 2)));
  } else {
    rb.push(timeLoop(() => mt.add(1, 2)));
    ra.push(timeLoop(() => mj.add(1, 2)));
  }
}

const ratio = median(rb) / median(ra);
process.stdout.write(
  JSON.stringify({
    ratio,
    mathTsMs: median(rb),
    mjMs: median(ra),
    parity: mt.add(1, 2),
  }) + '\n'
);
