#!/usr/bin/env node
/**
 * Node smoke test of the BUILT dist of every published package.
 *
 * For each non-private workspace package, this script imports the package by NAME, so Node
 * resolves the entry through that package's `exports` field, exactly as a consumer's Node does.
 * It then calls one representative function and checks the result. Any import error, runtime
 * error or wrong result fails the run (exit 1).
 *
 * Run it with `node` (never `bun`): it refuses to run when `typeof Bun !== 'undefined'`.
 * CI runs it in the `Test (20.x)` and `Test (22.x)` matrix legs after `bun run build`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

if (typeof globalThis.Bun !== 'undefined') {
  console.error('smoke-dist-node: this script must run on Node, not Bun.');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) throw new Error(`check failed: ${message}`);
}

/** One representative call per published package, keyed by the package directory. */
const CHECKS = {
  'packages/typed-function': (m) => {
    const typed = m.create();
    const double = typed('double', { number: (x) => x * 2 });
    assert(double(21) === 42, 'typed double(21) === 42');
  },
  'packages/workerpool': (m) => {
    const caps = m.getCapabilities();
    assert(typeof caps === 'object' && caps !== null, 'getCapabilities() returns an object');
  },
  core: (m) => assert(String(new m.Complex(1, 2)) === '1 + 2i', 'String(new Complex(1, 2))'),
  matrix: (m) => {
    const sum = m.add(m.DenseMatrix.fromArray([[1, 2]]), m.DenseMatrix.fromArray([[3, 4]]));
    assert(JSON.stringify(sum.toArray()) === '[[4,6]]', 'add([[1,2]], [[3,4]]) === [[4,6]]');
  },
  tensor: (m) => {
    const t = new m.Tensor([3], new Float64Array([1, 2, 3]), [m.idx(3, 'i')]);
    assert(t.sum().toNested() === 6, 'Tensor([1,2,3]).sum() === 6');
  },
  autograd: (m) => assert(m.derivative((x) => x.mul(x), 3) === 6, 'd/dx x^2 at 3 === 6'),
  functions: (m) => assert(m.add(2, 3) === 5 && m.sqrt(16) === 4, 'add(2,3) and sqrt(16)'),
  expression: (m) => assert(m.createParse.isFactory === true, 'createParse is a factory'),
  parser: (m) => assert(m.createParse.isFactory === true, 'createParse is a factory'),
  units: (m) => assert(m.isUnit(m.Unit.parse('5 cm')), "Unit.parse('5 cm') is a Unit"),
  numbers: (m) =>
    assert(String(new m.Fraction(1, 3).add(new m.Fraction(1, 6))) === '1/2', '1/3 + 1/6 === 1/2'),
  ast: (m) => assert(m.createConstantNode.isFactory === true, 'createConstantNode is a factory'),
  evaluator: (m) => assert(typeof m.createEvaluate((e) => e, {}) === 'function', 'createEvaluate'),
  linalg: (m) => assert(Math.abs(m.normFro([[3, 4]]) - 5) < 1e-12, 'normFro([[3,4]]) === 5'),
  arithmetic: (m) => assert(m.gcd(12, 18) === 6, 'gcd(12, 18) === 6'),
  trigonometry: (m) => assert(Math.abs(m.sin(Math.PI / 2) - 1) < 1e-12, 'sin(pi/2) === 1'),
  statistics: (m) => assert(m.mean([1, 2, 3, 4]) === 2.5, 'mean([1,2,3,4]) === 2.5'),
  signal: (m) => {
    const out = m.convolve([1, 1], [1, 1]);
    assert(JSON.stringify(Array.from(out)) === '[1,2,1]', 'convolve([1,1],[1,1])');
  },
  parallel: (m) => {
    const result = m.chunkArray([1, 2, 3, 4], { minChunkSize: 1, maxChunks: 2 });
    assert(result.numChunks === 2, 'chunkArray splits 4 items into 2 chunks');
  },
  workbook: (m) => {
    const result = m.parseWorkbook(['cells:', '  - id: c1', '    code: "1 + 1"', ''].join('\n'));
    assert(result.success && result.workbook.cells[0].content === '1 + 1', 'parseWorkbook');
  },
  assembly: (m) => assert(m.add_f64(2, 3) === 5, 'wasm add_f64(2, 3) === 5'),
  compat: (m) => assert(m.add(2, 3) === 5, 'add(2, 3) === 5'),
  gpu: (m) => assert(m.hasWebGPU() === false, 'hasWebGPU() is false on Node'),
  plot: (m) => assert(m.line([0, 1], [0, 1]).startsWith('<svg'), 'line() renders SVG'),
};

const dirs = workspaceDirs();

let failed = 0;
let passed = 0;
console.log(`smoke-dist-node: node ${process.version}, typeof Bun=${typeof globalThis.Bun}`);
for (const dir of dirs) {
  const pkg = JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'));
  if (pkg.private) continue;
  const check = CHECKS[dir];
  if (!check) {
    console.error(`FAIL ${pkg.name}: no smoke check defined for ${dir}`);
    failed++;
    continue;
  }
  try {
    const mod = await import(pkg.name);
    await check(mod);
    console.log(`ok   ${pkg.name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL ${pkg.name}: ${err && err.stack ? err.stack : err}`);
    failed++;
  }
}
console.log(`smoke-dist-node: ${passed} passed, ${failed} failed (node ${process.version})`);
// Worker pools and timers in some packages keep the event loop alive; exit explicitly.
process.exit(failed > 0 ? 1 : 0);
