// Benchmark of Unit.readings and Unit.parse (median of 9 runs).
// Usage: node tools/benchmark/unit-readings/bench.mjs <core dist index.js> <units.json>
// <units.json> is data/units.json of universal-physics-tensor. The script uses its `units[].symbols`.
// The token set: every pair of symbols, then 20,000 products of 2 to 3 factors (mulberry32,
// seed 20261108). A factor has the prefix k, M, G, m, c, u or n (p = 0.3) and the power 2 or 3 (p = 0.2).
// Set PARSE_ONLY=1 to skip the readings run.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [distPath, unitsPath] = process.argv.slice(2);
const { Unit } = await import(pathToFileURL(distPath).href);
const table = JSON.parse(readFileSync(unitsPath, 'utf8'));
const symbols = [...new Set(table.units.flatMap((u) => u.symbols))];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261108);
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const PREFIXES = ['k', 'M', 'G', 'm', 'c', 'u', 'n'];
const factor = () =>
  (rnd() < 0.3 ? pick(PREFIXES) : '') + pick(symbols) + (rnd() < 0.2 ? pick(['2', '3']) : '');

const tokens = new Set();
for (const a of symbols) for (const b of symbols) tokens.add(a + b);
for (let i = 0; i < 20000; i++) {
  const n = 2 + Math.floor(rnd() * 2);
  let t = '';
  for (let j = 0; j < n; j++) t += factor();
  tokens.add(t);
}
const tokenList = [...tokens];

const exprs = [];
while (exprs.length < 1000) {
  const e = `${pick(['1', '2.5', '10'])} ${factor()}*${factor()}/${factor()}^2`.replace(/(\d)\^2$/, '$1');
  try {
    Unit.parse(e);
    exprs.push(e);
  } catch {
    /* keep only expressions that parse */
  }
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
function time(fn) {
  fn();
  const runs = [];
  for (let r = 0; r < 9; r++) {
    const t0 = process.hrtime.bigint();
    fn();
    runs.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  return median(runs);
}

let sink = 0;
const readingsMs = process.env.PARSE_ONLY ? 0 : time(() => {
  for (const t of tokenList) sink += Unit.readings(t).length;
});
const parseMs = time(() => {
  for (let k = 0; k < 10; k++) for (const e of exprs) sink += Unit.parse(e).units.length;
});
// Cold: 10,000 distinct expressions, each parsed once per run (a new numeric value keeps
// every run distinct, and the unit strings are distinct within a run).
const distinct = [];
const seen = new Set();
while (distinct.length < 10000) {
  const u = `${factor()}*${factor()}/${factor()}`;
  if (seen.has(u)) continue;
  seen.add(u);
  try {
    Unit.parse('1 ' + u);
    distinct.push(u);
  } catch {
    /* keep only units that parse */
  }
}
let run = 0;
const coldMs = time(() => {
  run++;
  for (const u of distinct) sink += Unit.parse(run + ' ' + u).units.length;
});
console.log('cold10000Ms', coldMs.toFixed(1));
console.log(
  JSON.stringify({
    tokens: tokenList.length,
    readingsMs: +readingsMs.toFixed(1),
    usPerToken: +((readingsMs * 1000) / tokenList.length).toFixed(2),
    parse10x1000Ms: +parseMs.toFixed(1),
    sink,
  })
);
