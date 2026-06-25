/**
 * Verifies the elementwise WASM dispatch (abs/sin/cos/tan/exp/log) produces
 * results matching JS Math.* to <1e-12, for arrays above the threshold (wasm
 * path) and below it (JS path). Guards the T3 wiring against regressions.
 */
import * as fns from '../dist/index.js';

const score = (a, b) => (Math.abs(b) > 1e-12 ? Math.abs(a - b) / Math.abs(b) : Math.abs(a - b));
const OPS = [
  ['abs', Math.abs, (i) => (i % 2 ? -1 : 1) * (0.5 + (i % 50) * 0.01)],
  ['sin', Math.sin, (i) => (i % 97) * 0.03],
  ['cos', Math.cos, (i) => (i % 97) * 0.03],
  ['tan', Math.tan, (i) => (i % 50) * 0.02],
  ['exp', Math.exp, (i) => ((i % 40) - 20) * 0.1],
  ['log', Math.log, (i) => 0.5 + (i % 100) * 0.05],
];

let pass = 0, fail = 0;
const fails = [];
for (const n of [2048, 512]) {
  // 2048 >= 1024 exercises the wasm path; 512 < 1024 exercises the JS path.
  for (const [op, jsFn, gen] of OPS) {
    const fn = fns[op];
    if (typeof fn !== 'function') { fail++; fails.push(`${op} [MISSING EXPORT]`); continue; }
    const input = new Float64Array(n);
    for (let i = 0; i < n; i++) input[i] = gen(i);
    const out = await fn(input); // Float64Array overload returns a Promise
    let maxScore = 0;
    for (let i = 0; i < n; i++) maxScore = Math.max(maxScore, score(out[i], jsFn(input[i])));
    if (maxScore <= 1e-12) pass++;
    else { fail++; fails.push(`${op} n=${n}: worst rel ${maxScore.toExponential(2)}`); }
  }
}

console.log('Elementwise WASM dispatch vs JS Math.* (wasm path n=2048, JS path n=512)');
console.log(`${pass + fail} checks: ${pass} PASS, ${fail} FAIL`);
if (fails.length) { console.log('\nFAIL:'); fails.forEach((f) => console.log('  X ' + f)); }
process.exit(fail === 0 ? 0 : 1);
