#!/usr/bin/env node
/**
 * P6-5 speed gate: `Complex.tan/cot/tanh/coth` (one closed form, `createTanFamilyMethod`) against the
 * pre-P6-5 bodies.
 *
 *   bunx turbo build --filter=@danielsimonjr/mathts-core   # the bench imports core's dist
 *   node tools/benchmark/core/complex-tan-family.bench.mjs
 *   bun tools/benchmark/core/complex-tan-family.bench.mjs
 *
 * Rules from AGENTS.md "Benchmarking rules": the legacy bodies below allocate the same `Complex`
 * the shipped methods do; five warm-up reps; old and new are timed alternately (A B B A) so JIT
 * warm-up cannot favour one side; a first pass requires bit-identical output, so a dead or wrong
 * path fails the run instead of timing as fast. 10^6 random arguments, of which about 12% lie
 * past the |2 Im| (or |2 Re|) > 700 overflow branch. Exit code 1 when any method is slower than
 * the noise band (default 5%).
 *
 * Harness floor on JavaScriptCore: this two-way harness has no control row. On Bun, a `new` that is
 * the legacy body behind the same arrow wrapper (an A/A run, 2026-10-31) reads 1.01 to 1.05 against
 * `old` (Bun 1.4.2 and 1.4.4) and 1.00 on Node. Read a Bun result against that floor, and repeat a
 * run that exceeds the band before acting on it.
 */
import { Complex } from '../../../core/dist/index.js';

const N = 1_000_000;
const WARM = 5;
const ROUNDS = 9;
const NOISE = Number(process.env.BENCH_NOISE ?? 0.05);
const OVERFLOW = 700;

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

const rand = mulberry32(0x5eed);
const zs = new Array(N);
for (let i = 0; i < N; i++) {
  const k = rand();
  let re = (rand() - 0.5) * 10;
  let im = (rand() - 0.5) * 10;
  if (k > 0.88) {
    const big = (rand() < 0.5 ? -1 : 1) * (OVERFLOW / 2 + 1 + rand() * 300);
    if (rand() < 0.5) im = big;
    else re = big;
  } else if (k > 0.7) {
    im = (rand() - 0.5) * 700;
    re = (rand() - 0.5) * 700;
  }
  zs[i] = new Complex(re, im);
}

const legacy = {
  tan(z) {
    const x2 = z.re * 2;
    const y2 = z.im * 2;
    if (Math.abs(y2) > OVERFLOW) {
      return new Complex(2 * Math.sin(x2) * Math.exp(-Math.abs(y2)), Math.sign(y2));
    }
    const d = Math.cos(x2) + Math.cosh(y2);
    return new Complex(Math.sin(x2) / d, Math.sinh(y2) / d);
  },
  cot(z) {
    const x2 = z.re * 2;
    const y2 = z.im * 2;
    if (Math.abs(y2) > OVERFLOW) {
      return new Complex(2 * Math.sin(x2) * Math.exp(-Math.abs(y2)), -Math.sign(y2));
    }
    const d = Math.cosh(y2) - Math.cos(x2);
    return new Complex(Math.sin(x2) / d, -Math.sinh(y2) / d);
  },
  tanh(z) {
    const x2 = z.re * 2;
    const y2 = z.im * 2;
    if (Math.abs(x2) > OVERFLOW) {
      return new Complex(Math.sign(x2), 2 * Math.sin(y2) * Math.exp(-Math.abs(x2)));
    }
    const d = Math.cosh(x2) + Math.cos(y2);
    return new Complex(Math.sinh(x2) / d, Math.sin(y2) / d);
  },
  coth(z) {
    const x2 = z.re * 2;
    const y2 = z.im * 2;
    if (Math.abs(x2) > OVERFLOW) {
      return new Complex(Math.sign(x2), -2 * Math.sin(y2) * Math.exp(-Math.abs(x2)));
    }
    const d = Math.cosh(x2) - Math.cos(y2);
    return new Complex(Math.sinh(x2) / d, -Math.sin(y2) / d);
  },
};

const shipped = {
  tan: (z) => z.tan(),
  cot: (z) => z.cot(),
  tanh: (z) => z.tanh(),
  coth: (z) => z.coth(),
};

let sink = 0;
function pass(fn) {
  const t0 = performance.now();
  let acc = 0;
  for (let i = 0; i < N; i++) {
    const r = fn(zs[i]);
    acc += r.re - r.im;
  }
  const ms = performance.now() - t0;
  sink += acc;
  return ms;
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
}

let failed = false;
console.log(
  `runtime=${typeof Bun !== 'undefined' ? 'bun ' + Bun.version : 'node ' + process.version} N=${N} rounds=${ROUNDS} (ABBA) noise=${NOISE}`
);
for (const name of ['tan', 'cot', 'tanh', 'coth']) {
  for (let i = 0; i < N; i++) {
    const a = legacy[name](zs[i]);
    const b = shipped[name](zs[i]);
    if (!Object.is(a.re, b.re) || !Object.is(a.im, b.im)) {
      throw new Error(`${name} differs at (${zs[i].re}, ${zs[i].im})`);
    }
  }
  for (let r = 0; r < WARM; r++) {
    pass(legacy[name]);
    pass(shipped[name]);
  }
  const oldMs = [];
  const newMs = [];
  for (let r = 0; r < ROUNDS; r++) {
    oldMs.push(pass(legacy[name]));
    newMs.push(pass(shipped[name]));
    newMs.push(pass(shipped[name]));
    oldMs.push(pass(legacy[name]));
  }
  const o = median(oldMs);
  const n = median(newMs);
  const ratio = n / o;
  const slower = ratio > 1 + NOISE;
  failed ||= slower;
  console.log(
    `${name.padEnd(5)} old ${o.toFixed(1)} ms  new ${n.toFixed(1)} ms  new/old ${ratio.toFixed(3)}  ${slower ? 'SLOWER' : 'ok'}`
  );
}
if (!Number.isFinite(sink)) {
  console.log('(sink not finite; poles and overflow produce NaN/Infinity by design)');
}
process.exit(failed ? 1 : 0);
