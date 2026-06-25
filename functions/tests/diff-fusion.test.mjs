/**
 * Verifies fuseUnaryChain (Tier-3 op-fusion) matches a sequential scalar pass,
 * for arrays above threshold (WASM fused path) and below it (JS fallback).
 */
import { fuseUnaryChain } from '../dist/index.js';

const JS = {
  sin: Math.sin, exp: Math.exp, log1p: Math.log1p, tanh: Math.tanh,
  abs: Math.abs, atan: Math.atan, log2: Math.log2,
};
const CHAINS = [
  ['sin', 'exp', 'log1p', 'tanh'],
  ['abs', 'atan'],
  ['exp', 'log2', 'sin'],
];

const seq = (chain, xs) => {
  const r = Float64Array.from(xs);
  for (const op of chain) for (let i = 0; i < r.length; i++) r[i] = JS[op](r[i]);
  return r;
};

let pass = 0, fail = 0;
const fails = [];
for (const n of [2048, 512]) {
  const input = new Float64Array(n);
  for (let i = 0; i < n; i++) input[i] = (i % 100) * 0.01;
  for (const chain of CHAINS) {
    const got = fuseUnaryChain(chain, input);
    const want = seq(chain, input);
    let maxrel = 0;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(got[i] - want[i]) / (Math.abs(want[i]) > 1e-12 ? Math.abs(want[i]) : 1);
      maxrel = Math.max(maxrel, d);
    }
    // also assert fuseUnaryChain did NOT mutate the input
    const mutated = input.some((v, i) => v !== (i % 100) * 0.01);
    if (maxrel <= 1e-12 && !mutated) pass++;
    else { fail++; fails.push(`[${chain.join('->')}] n=${n}: rel ${maxrel.toExponential(2)}${mutated ? ' MUTATED INPUT' : ''}`); }
  }
}

console.log('Op-fusion fuseUnaryChain vs sequential scalar (fused n=2048, JS n=512)');
console.log(`${pass + fail} checks: ${pass} PASS, ${fail} FAIL`);
if (fails.length) { console.log('\nFAIL:'); fails.forEach((f) => console.log('  X ' + f)); }
process.exit(fail === 0 ? 0 : 1);
