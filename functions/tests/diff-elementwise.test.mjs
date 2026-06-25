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
  // Tier-1 extended transcendentals (domain-safe generators)
  ['atan', Math.atan, (i) => -5 + (i % 100) * 0.1],
  ['sinh', Math.sinh, (i) => -3 + (i % 60) * 0.1],
  ['tanh', Math.tanh, (i) => -5 + (i % 100) * 0.1],
  ['atanh', Math.atanh, (i) => -0.99 + (i % 199) * 0.01],
  ['expm1', Math.expm1, (i) => -2 + (i % 40) * 0.1],
  ['log1p', Math.log1p, (i) => (i % 100) * 0.05],
  ['log2', Math.log2, (i) => 0.1 + (i % 100) * 0.1],
  ['log10', Math.log10, (i) => 0.1 + (i % 100) * 0.1],
  ['sec', (x) => 1 / Math.cos(x), (i) => -1.4 + (i % 280) * 0.01],
  ['csc', (x) => 1 / Math.sin(x), (i) => 0.1 + (i % 280) * 0.01],
  ['cot', (x) => 1 / Math.tan(x), (i) => 0.1 + (i % 130) * 0.01],
  // Tier-2 special: reference is the package's own erfc scalar (number overload)
  ['erfc', (x) => fns.erfc(x), (i) => -3 + (i % 120) * 0.05],
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
