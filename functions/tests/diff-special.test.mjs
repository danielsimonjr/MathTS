/**
 * Differential audit of the @danielsimonjr/mathts-functions special-function
 * surface vs mpmath goldens (golden/gen_special_goldens.py).
 *
 * This is the user-facing JS/TS implementation (functions -> compat -> math-mcp),
 * independent of the mathts-wasm kernels. Run: node tests/diff-special.test.mjs
 * (requires `npm run build` first — imports the built dist).
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fns from '../dist/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(path.join(here, 'golden', 'special.golden.json'), 'utf-8'));
const TARGET = golden.target_rel;
const FAIL = golden.hard_fail_rel;

function score(actual, expected) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
    return actual === expected ? 0 : Infinity;
  }
  const denom = Math.abs(expected) > 1e-12 ? Math.abs(expected) : 1;
  return Math.abs(actual - expected) / denom;
}

const rows = [];
for (const rec of golden.records) {
  const fn = fns[rec.name];
  if (typeof fn !== 'function') {
    rows.push({ label: `${rec.name} [MISSING EXPORT]`, score: Infinity });
    continue;
  }
  let actual;
  try {
    actual = fn(...rec.args);
    if (actual && typeof actual.then === 'function') actual = NaN; // unexpected async for scalars
  } catch {
    actual = NaN;
  }
  rows.push({ label: `${rec.name}(${rec.args.join(',')})`, score: score(actual, rec.expected), actual, expected: rec.expected });
}

const tier = (s) => (s <= TARGET ? 'PASS' : s <= FAIL ? 'WEAK' : 'FAIL');
const pass = rows.filter((r) => tier(r.score) === 'PASS').length;
const weak = rows.filter((r) => tier(r.score) === 'WEAK');
const fail = rows.filter((r) => tier(r.score) === 'FAIL');

console.log('mathts-functions special functions vs mpmath');
console.log('============================================');
console.log(`target rel <= ${TARGET}, hard-fail > ${FAIL}`);
console.log(`${rows.length} checks: ${pass} PASS, ${weak.length} WEAK, ${fail.length} FAIL`);

// group worst offenders by function name
const byFn = new Map();
for (const r of [...weak, ...fail]) {
  const name = r.label.split('(')[0];
  const cur = byFn.get(name) ?? { worst: 0, n: 0 };
  cur.worst = Math.max(cur.worst, r.score);
  cur.n += 1;
  byFn.set(name, cur);
}
if (byFn.size) {
  console.log('\nfunctions with WEAK/FAIL cases (worst score):');
  for (const [name, d] of [...byFn.entries()].sort((a, b) => b[1].worst - a[1].worst)) {
    console.log(`  ${tier(d.worst) === 'FAIL' ? 'X' : '~'} ${name.padEnd(22)} worst=${d.worst.toExponential(2)}  (${d.n} cases)`);
  }
}
if (fail.length) {
  console.log('\nFAIL detail:');
  for (const r of fail.slice(0, 40)) console.log(`  X ${r.label}  got ${r.actual} want ${r.expected}`);
}

process.exit(fail.length === 0 ? 0 : 1);
