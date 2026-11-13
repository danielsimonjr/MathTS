/**
 * Unit tests and gate self-tests for wall-clock-perf-gate.mjs and
 * run-wall-clock-gates.mjs.
 *
 *   node --test tools/test/wall-clock-perf-gate.test.mjs
 *
 * The statistics tests feed fixed numbers, so no clock decides them. The last
 * two groups time real code: an injected slowdown must fail (3x, or the
 * `selfTestScale` of a gate whose real ratio is far below its limit), and an A/A
 * control must measure a ratio of about 1 and, when the limit is above 1, pass.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execIsolatedPerfGate, isolatedPerfGateChildEnv } from './perf-gate-spawn.mjs';
import { runGate } from './run-wall-clock-gates.mjs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, test } from 'node:test';
import {
  aaControl,
  decideGate,
  loadGateConfig,
  loadGateList,
  measuredCandidateInjectionFactor,
  median,
  medianBounds,
  sequentialDecision,
  symmetricWarmup,
  wallClockAbGate,
} from './wall-clock-perf-gate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

function busyMs(ms) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    /* spin */
  }
}

/** Run `fn` with env vars set, then restore them. */
function withEnv(vars, fn) {
  const prev = {};
  for (const k of Object.keys(vars)) prev[k] = process.env[k];
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/** A scripted sampler: returns the next values of `series`, repeating the last one. */
function scripted(series) {
  let at = 0;
  const calls = [];
  const take = (count) => {
    calls.push(count);
    const out = [];
    for (let i = 0; i < count; i++) out.push(series[Math.min(at++, series.length - 1)]);
    return out;
  };
  return { take, calls };
}

const PARAMS = { limit: 1.2, alpha: 0.01, initialRounds: 16, blockRounds: 8, maxRounds: 64 };

describe('wall-clock-perf-gate statistics', () => {
  test('median', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.ok(Number.isNaN(median([])));
  });

  test('measuredCandidateInjectionFactor is exact for uniform scale', () => {
    assert.equal(measuredCandidateInjectionFactor([30, 60], [10, 20]), 3);
  });

  test('isolatedPerfGateChildEnv strips coverage and vitest worker state', () => {
    process.env.NODE_V8_COVERAGE = '/tmp/cov';
    process.env.NODE_V8_COVERAGE_DIR = '/tmp/cov-dir';
    process.env.VITEST = 'true';
    process.env.VITEST_WORKER_ID = '7';
    process.env.UNRELATED = 'keep';
    try {
      const env = isolatedPerfGateChildEnv();
      // An own, empty key: Node adds the parent's value to a child whose env lacks the key.
      assert.equal(env.NODE_V8_COVERAGE, '');
      assert.equal(env.NODE_V8_COVERAGE_DIR, undefined);
      assert.equal(env.VITEST, undefined);
      assert.equal(env.VITEST_WORKER_ID, undefined);
      assert.equal(env.UNRELATED, 'keep');
    } finally {
      delete process.env.NODE_V8_COVERAGE;
      delete process.env.NODE_V8_COVERAGE_DIR;
      delete process.env.VITEST;
      delete process.env.VITEST_WORKER_ID;
      delete process.env.UNRELATED;
    }
  });

  test('medianBounds returns the exact sign-test order statistics', () => {
    const xs = Array.from({ length: 16 }, (_, i) => i + 1);
    // P(Binomial(16, 1/2) <= 2) = 0.0021 <= 0.01 < P(<= 3) = 0.0106, so rank 3.
    assert.deepEqual(medianBounds(xs, 0.01), { lower: 3, upper: 14 });
    // n = 9: P(<= 0) = 0.0020 <= 0.01 < P(<= 1) = 0.0195, so rank 1.
    assert.deepEqual(medianBounds([5, 1, 9, 3, 7, 2, 8, 4, 6], 0.01), { lower: 1, upper: 9 });
    // n = 4 cannot reach alpha = 0.01, so the interval is unbounded.
    assert.deepEqual(medianBounds([1, 2, 3, 4], 0.01), { lower: -Infinity, upper: Infinity });
  });

  test('medianBounds ignores a single outlier and rejects bad input', () => {
    const base = Array.from({ length: 16 }, (_, i) => 1 + i / 100);
    const spiked = [...base.slice(0, 15), 1e9];
    assert.equal(medianBounds(spiked, 0.01).lower, medianBounds(base, 0.01).lower);
    assert.throws(() => medianBounds(base, 0), RangeError);
    assert.throws(() => medianBounds(base, 0.5), RangeError);
    assert.throws(() => medianBounds(new Array(1001).fill(1), 0.01), RangeError);
  });

  test('medianBounds holds its confidence level on seeded noise', () => {
    // Skewed noise with true median 1: exp(N(0, 0.4)) from a seeded LCG.
    let seed = 12345;
    const uniform = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed + 0.5) / 4294967296;
    };
    const normal = () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
    let lowerAbove = 0;
    let upperBelow = 0;
    const trials = 4000;
    for (let t = 0; t < trials; t++) {
      const xs = Array.from({ length: 16 }, () => Math.exp(0.4 * normal()));
      const { lower, upper } = medianBounds(xs, 0.01);
      if (lower > 1) lowerAbove++;
      if (upper < 1) upperBelow++;
    }
    // Expected 0.0021 per side (an exact binomial tail); allow 3x.
    assert.ok(lowerAbove / trials < 0.0063, `lower bound above the true median: ${lowerAbove}`);
    assert.ok(upperBelow / trials < 0.0063, `upper bound below the true median: ${upperBelow}`);
  });
});

describe('decideGate', () => {
  const at = (v, n = 16) => new Array(n).fill(v);

  test('fails early only when the lower bound reaches the limit', () => {
    const d = decideGate(at(1.5), { limit: 1.2, alpha: 0.01, final: false });
    assert.equal(d.verdict, 'fail');
    assert.equal(d.conclusive, true);
    // Half of the rounds sit far above the limit (median 1.2), but the lower bound is the
    // 3rd smallest round, 1.0: a look that is not final asks for more rounds.
    const mixed = [...at(1.0, 8), ...at(1.4, 8)];
    assert.equal(decideGate(mixed, { limit: 1.2, alpha: 0.01, final: false }).verdict, 'continue');
  });

  test('passes only when the upper bound stays below the limit', () => {
    const d = decideGate(at(1.0), { limit: 1.2, alpha: 0.01, final: false });
    assert.equal(d.verdict, 'pass');
    assert.equal(d.conclusive, true);
  });

  test('at the final look the median decides when the interval holds the limit', () => {
    const p = { limit: 1.2, alpha: 0.01, final: true };
    // 34 of 64 rounds at 1.4: the median is 1.4, the lower bound (23rd smallest) is 1.0.
    const above = decideGate([...at(1.0, 30), ...at(1.4, 34)], p);
    assert.equal(above.verdict, 'fail');
    assert.equal(above.conclusive, false);
    assert.equal(above.ratio, 1.4);
    assert.ok(above.lower < p.limit);
    // 30 of 64 rounds at 1.4: the median is 1.0, the upper bound (23rd largest) is 1.4.
    const below = decideGate([...at(1.0, 34), ...at(1.4, 30)], p);
    assert.equal(below.verdict, 'pass');
    assert.equal(below.conclusive, false);
    assert.equal(below.ratio, 1.0);
    assert.ok(below.upper >= p.limit);
    // A median exactly at the limit is a fail: the limit is exclusive.
    const edge = decideGate([...at(1.0, 32), ...at(1.4, 32)], p);
    assert.equal(edge.ratio, 1.2);
    assert.equal(edge.verdict, 'fail');
  });

  test('refuses a sample with too few usable rounds', () => {
    assert.throws(
      () => decideGate([NaN, NaN, NaN, 1, 1, 1], { limit: 1.2, alpha: 0.01, final: false }),
      /too coarse/
    );
  });
});

describe('sequential rule on seeded noise', () => {
  // Per-round ratios ~ N(mu, sd) from a seeded LCG. The shipped rule must pass a correct
  // build (true ratio far below the limit) in every trial, and fail a build that is 25%
  // over the limit almost always, also when the noise is twice the measured one.
  function seeded(seed) {
    let state = seed;
    const uniform = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return (state + 0.5) / 4294967296;
    };
    return () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
  }
  function failRate(mu, sd, trials, seed) {
    const normal = seeded(seed);
    let fails = 0;
    for (let t = 0; t < trials; t++) {
      const take = (count) => Array.from({ length: count }, () => mu + sd * normal());
      if (sequentialDecision(take, PARAMS).verdict === 'fail') fails++;
    }
    return fails / trials;
  }

  test('a correct build never fails, at the measured noise and at twice that', () => {
    assert.equal(failRate(1.05, 0.13, 400, 1), 0);
    assert.equal(failRate(1.05, 0.26, 400, 2), 0);
  });

  test('a true ratio of 1.5 against the limit 1.2 fails almost always', () => {
    const rate = failRate(1.5, 0.13, 400, 3);
    assert.ok(rate >= 0.99, `caught ${rate}`);
  });

  test('a true ratio of 1.25 against the limit 1.2 is caught at the cap', () => {
    // About 1 run in 3 ends the 64 rounds inside the 99% interval, because the noise of
    // the median (about 0.02) is as large as the 0.05 overshoot. The median decides those runs.
    const rate = failRate(1.25, 0.13, 400, 4);
    assert.ok(rate >= 0.97, `caught ${rate}`);
  });
});

describe('sequentialDecision', () => {
  test('a clear regression fails at the first look', () => {
    const s = scripted([1.5]);
    const d = sequentialDecision(s.take, PARAMS);
    assert.equal(d.verdict, 'fail');
    assert.equal(d.rounds, 16);
    assert.deepEqual(s.calls, [16]);
  });

  test('a clear pass stops at the first look', () => {
    const s = scripted([1.02]);
    const d = sequentialDecision(s.take, PARAMS);
    assert.equal(d.verdict, 'pass');
    assert.equal(d.conclusive, true);
    assert.equal(d.rounds, 16);
  });

  test('a burst that spans the limit gets more rounds, then passes', () => {
    // The first look sees 6 slow rounds of 16 (a noisy phase), then the machine settles.
    const series = [...new Array(10).fill(1.04), ...new Array(6).fill(1.4), 1.04];
    const s = scripted(series);
    const d = sequentialDecision(s.take, PARAMS);
    assert.equal(d.verdict, 'pass');
    assert.ok(d.rounds > 16, `expected extra rounds, got ${d.rounds}`);
    assert.ok(d.ratio < 1.2);
  });

  test('every round feeds the estimate: none is dropped or repeated, and the median decides at the cap', () => {
    // 6 of every 15 rounds at 1.4, the rest at 1.0 (median 1.0), or 8 of every 15 (median 1.4):
    // the interval holds the limit at every look, so the gate walks to the cap.
    const walk = (highCount) => {
      const series = Array.from({ length: 200 }, (_, i) => (i % 15 < highCount ? 1.4 : 1.0));
      const s = scripted(series);
      const d = sequentialDecision(s.take, { ...PARAMS, discard: 3 });
      assert.equal(d.conclusive, false);
      assert.equal(d.rounds, 64);
      assert.deepEqual(d.roundRatios, series.slice(3, 3 + 64));
      assert.equal(
        s.calls.reduce((a, b) => a + b, 0),
        3 + 64
      );
      return d;
    };
    assert.equal(walk(6).verdict, 'pass');
    assert.equal(walk(8).verdict, 'fail');
  });

  test('rejects bad parameters', () => {
    const s = scripted([1]);
    assert.throws(() => sequentialDecision(s.take, { ...PARAMS, limit: 0 }), RangeError);
    assert.throws(() => sequentialDecision(s.take, { ...PARAMS, maxRounds: 8 }), RangeError);
    assert.throws(() => sequentialDecision(s.take, { ...PARAMS, blockRounds: 0 }), RangeError);
    assert.throws(() => sequentialDecision(s.take, { ...PARAMS, discard: -1 }), RangeError);
  });
});

describe('gate list', () => {
  test('the shipped list is valid and every script and built output path is named', () => {
    const gates = loadGateList();
    assert.ok(gates.length >= 6);
    for (const g of gates) {
      assert.ok(existsSync(join(repoRoot, g.script)), `${g.name}: ${g.script} missing`);
      assert.ok(g.needs.length > 0, `${g.name}: needs is empty`);
    }
    assert.equal(loadGateConfig('lusolve').limit, 1.2);
  });

  test('a missing or malformed list fails loudly', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wcg-'));
    try {
      assert.throws(() => loadGateList(join(dir, 'absent.json')), /unreadable/);
      const bad = join(dir, 'bad.json');
      writeFileSync(bad, JSON.stringify({ gates: [{ name: 'x', script: 'x.mjs', needs: [] }] }));
      assert.throws(() => loadGateList(bad), /limit must be a positive number/);
      const dup = join(dir, 'dup.json');
      const g = { name: 'x', script: 'x.mjs', needs: [], limit: 1, alpha: 0.01 };
      const rounds = { initialRounds: 16, blockRounds: 8, maxRounds: 64, timeoutMs: 1000 };
      writeFileSync(
        dup,
        JSON.stringify({ defaults: { ...rounds, gcBetween: false }, gates: [g, g] })
      );
      assert.throws(() => loadGateList(dup), /duplicate name/);
      const noGc = join(dir, 'no-gc.json');
      writeFileSync(noGc, JSON.stringify({ defaults: rounds, gates: [g] }));
      assert.throws(() => loadGateList(noGc), /gcBetween must be true or false/);
      assert.throws(() => loadGateConfig('nope'), /not in/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('an unknown key or a bad optional value in the list fails loudly', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wcg-'));
    try {
      const good = {
        name: 'x',
        script: 'x.mjs',
        needs: [],
        limit: 1.2,
        alpha: 0.01,
        initialRounds: 16,
        blockRounds: 8,
        maxRounds: 64,
        timeoutMs: 1000,
        gcBetween: false,
      };
      const load = (gate, defaults) => {
        const file = join(dir, 'list.json');
        writeFileSync(file, JSON.stringify({ defaults, gates: [gate] }));
        return loadGateList(file);
      };
      assert.equal(load(good)[0].name, 'x');
      assert.equal(load({ ...good, discard: 4, selfTestScale: 8 })[0].selfTestScale, 8);
      // A misspelled key is rejected, in a gate and in the defaults.
      assert.throws(() => load({ ...good, selfTestScal: 8 }), /unknown key "selfTestScal"/);
      assert.throws(() => load({ ...good, gcBetwen: true }), /unknown key "gcBetwen"/);
      assert.throws(() => load(good, { maxRound: 9 }), /unknown key "maxRound"/);
      assert.throws(() => load({ ...good, discard: -1 }), /discard must be an integer >= 0/);
      assert.throws(
        () => load({ ...good, selfTestScale: 1 }),
        /selfTestScale must be a number greater than 1/
      );
      assert.throws(() => load({ ...good, selfTestScale: '8' }), /selfTestScale must be a number/);
      assert.throws(() => load({ ...good, alpha: 0.7 }), /alpha must be in \(0, 0.5\)/);
      assert.throws(() => load({ ...good, maxRounds: 8 }), /maxRounds must be >= initialRounds/);
      assert.throws(() => load({ ...good, blockRounds: 2.5 }), /blockRounds must be an integer/);
      assert.throws(() => load({ ...good, needs: 'a.js' }), /needs must be an array/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('PERF_GATE_AA is read as a switch', () => {
    assert.equal(withEnv({ PERF_GATE_AA: '1' }, aaControl), true);
    assert.equal(withEnv({ PERF_GATE_AA: '0' }, aaControl), false);
    assert.equal(withEnv({ PERF_GATE_AA: '' }, aaControl), false);
  });
});

describe('wallClockAbGate on real timers', () => {
  const small = { limit: 1.15, alpha: 0.01, initialRounds: 12, blockRounds: 4, maxRounds: 20 };

  test('matched arms pass', () => {
    const fn = () => busyMs(4);
    const r = withEnv({ PERF_GATE_CANDIDATE_TIME_SCALE: '', PERF_GATE_AA: '' }, () =>
      wallClockAbGate(fn, fn, {
        ...small,
        fullWarmupPairs: 2,
        warmup: { minPairs: 4, maxPairs: 8 },
      })
    );
    assert.equal(r.verdict, 'pass');
    assert.ok(r.ratio < 1.15, `expected ~1.0, got ${r.ratio}`);
  });

  test('a ~3x slowdown fails at the first look', () => {
    const base = () => busyMs(4);
    const slow = () => busyMs(12);
    const r = withEnv({ PERF_GATE_CANDIDATE_TIME_SCALE: '', PERF_GATE_AA: '' }, () =>
      wallClockAbGate(base, slow, {
        ...small,
        fullWarmupPairs: 2,
        warmup: { minPairs: 4, maxPairs: 8 },
      })
    );
    assert.equal(r.verdict, 'fail');
    assert.ok(r.ratio >= 2.5, `expected ~3x, got ${r.ratio}`);
    assert.equal(r.rounds, 12);
  });

  test('PERF_GATE_CANDIDATE_TIME_SCALE scales the sampled candidate times', () => {
    const fn = () => busyMs(4);
    const r = withEnv({ PERF_GATE_CANDIDATE_TIME_SCALE: '3', PERF_GATE_AA: '' }, () =>
      wallClockAbGate(fn, fn, { ...small, skipSymmetricWarmup: true, fullWarmupPairs: 2 })
    );
    assert.ok(Math.abs(r.candidateInjectionFactor - 3) < 0.01, `got ${r.candidateInjectionFactor}`);
    assert.equal(r.verdict, 'fail');
  });

  test('PERF_GATE_AA times the baseline function as both arms', () => {
    const base = () => busyMs(4);
    const slow = () => busyMs(12);
    const r = withEnv({ PERF_GATE_CANDIDATE_TIME_SCALE: '', PERF_GATE_AA: '1' }, () =>
      wallClockAbGate(base, slow, { ...small, skipSymmetricWarmup: true, fullWarmupPairs: 2 })
    );
    assert.equal(r.aa, true);
    assert.equal(r.verdict, 'pass');
    assert.ok(r.ratio < 1.15, `A/A ratio ${r.ratio}`);
  });

  test('symmetricWarmup runs both arms equally often, at least minPairs times', () => {
    let a = 0;
    let b = 0;
    symmetricWarmup(
      () => {
        a++;
        busyMs(1);
      },
      () => {
        b++;
        busyMs(1);
      },
      { minPairs: 4, maxPairs: 8 }
    );
    assert.equal(a, b);
    assert.ok(a >= 4, `warmup ran ${a} pairs`);
  });

  test('gcBetween collects once per round', () => {
    const fn = () => busyMs(1);
    const savedGc = globalThis.gc;
    let calls = 0;
    globalThis.gc = () => {
      calls++;
    };
    try {
      const r = withEnv({ PERF_GATE_CANDIDATE_TIME_SCALE: '', PERF_GATE_AA: '' }, () =>
        wallClockAbGate(fn, fn, {
          ...small,
          skipSymmetricWarmup: true,
          fullWarmupPairs: 0,
          gcBetween: true,
        })
      );
      assert.equal(calls, r.rounds);
    } finally {
      if (savedGc === undefined) delete globalThis.gc;
      else globalThis.gc = savedGc;
    }
  });

  test('gcBetween without --expose-gc is an error, not a silent no-op', () => {
    const fn = () => busyMs(1);
    const savedGc = globalThis.gc;
    delete globalThis.gc;
    try {
      assert.throws(
        () =>
          wallClockAbGate(fn, fn, {
            ...small,
            skipSymmetricWarmup: true,
            fullWarmupPairs: 0,
            gcBetween: true,
          }),
        /--expose-gc/
      );
    } finally {
      if (savedGc !== undefined) globalThis.gc = savedGc;
    }
  });
});

// The self-tests run each real gate script with fewer rounds than the shipped list asks for, to
// keep the run short. The injected slowdown is far above the limit and an A/A run is far below
// it, so the first look decides; the reduced `maxRounds` only shortens the walk of a run that
// does not decide there.
const gatesInList = loadGateList();
const selfTestDir = mkdtempSync(join(tmpdir(), 'wcg-selftest-'));
const selfTestConfig = join(selfTestDir, 'wall-clock-gates.json');
writeFileSync(
  selfTestConfig,
  JSON.stringify({
    gates: gatesInList.map((g) => ({ ...g, initialRounds: 8, blockRounds: 4, maxRounds: 16 })),
  })
);
after(() => rmSync(selfTestDir, { recursive: true, force: true }));

// The runner starts every gate through the shared spawn helper: the child gets --expose-gc (so
// gcBetween can collect between rounds) and none of the coverage or vitest state of its parent.
// The probe gate reports what its own process sees.
const spawnProbeScript = join(selfTestDir, 'spawn-probe-gate.mjs');
writeFileSync(
  spawnProbeScript,
  [
    'console.log(JSON.stringify({',
    "  gate: 'spawn-probe',",
    "  verdict: 'pass',",
    '  gc: typeof globalThis.gc,',
    '  coverage: process.env.NODE_V8_COVERAGE || null,',
    "  vitest: Object.keys(process.env).filter((k) => k.startsWith('VITEST')),",
    '  kept: process.env.PERF_GATE_SPAWN_PROBE ?? null,',
    '}));',
    '',
  ].join('\n')
);

describe('runner spawn point', () => {
  test('a gate child has gc exposed and no coverage or vitest state, and keeps other env', () => {
    const gate = {
      name: 'spawn-probe',
      script: relative(repoRoot, spawnProbeScript),
      needs: [],
      timeoutMs: 60_000,
    };
    const covDir = join(selfTestDir, 'cov');
    const res = withEnv(
      {
        NODE_V8_COVERAGE: covDir,
        VITEST_WORKER_ID: '3',
        VITEST_POOL_ID: '3',
        PERF_GATE_SPAWN_PROBE: 'kept',
      },
      () => runGate(gate, process.execPath)
    );
    assert.equal(res.error, undefined, res.error);
    assert.equal(res.gc, 'function');
    assert.equal(res.coverage, null);
    // The effect, not only the variable: a child with coverage on writes into its directory.
    assert.equal(existsSync(covDir), false, 'the gate child wrote V8 coverage');
    assert.deepEqual(res.vitest, []);
    assert.equal(res.kept, 'kept');
  });
});

describe('runner arguments', () => {
  const runner = join(__dirname, 'run-wall-clock-gates.mjs');
  const run = (...args) => spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8' });

  test('an empty or missing value, an unknown gate or an unknown flag exits 2 before any gate runs', () => {
    for (const args of [
      ['--only'],
      ['--only', ''],
      ['--only', ','],
      ['--config'],
      ['--only', 'nope'],
      ['--bogus'],
    ]) {
      const r = run(...args);
      assert.equal(r.status, 2, `${args.join(' ')}: exit ${r.status}, stdout ${r.stdout}`);
      assert.doesNotMatch(r.stdout, /passed/, `${args.join(' ')} must not report a verdict`);
      assert.match(r.stderr, /run-wall-clock-gates:/);
    }
  });

  test('--list names every gate of the list and runs none', () => {
    const r = run('--list');
    assert.equal(r.status, 0, r.stderr);
    const listed = r.stdout
      .trim()
      .split('\n')
      .map((line) => line.split('\t')[0]);
    assert.deepEqual(
      listed,
      gatesInList.map((g) => g.name)
    );
  });
});

function runGateScript(gate, env) {
  const missing = gate.needs.filter((p) => !existsSync(join(repoRoot, p)));
  assert.equal(missing.length, 0, `built dist required for ${gate.name}: ${missing.join(', ')}`);
  const line = execIsolatedPerfGate(process.execPath, join(repoRoot, gate.script), {
    cwd: repoRoot,
    extraEnv: { PERF_GATE_CONFIG: selfTestConfig, ...env },
  });
  const payload = JSON.parse(line.split('\n').pop());
  assert.equal(payload.gate, gate.name);
  assert.equal(payload.limit, gate.limit);
  assert.ok(Number.isFinite(payload.ratio), `${gate.name} ratio ${payload.ratio}`);
  return payload;
}

describe('isolated gates fail under an injected candidate slowdown', () => {
  for (const gate of gatesInList) {
    test(gate.name, () => {
      const scale = gate.selfTestScale ?? 3;
      const payload = runGateScript(gate, {
        PERF_GATE_CANDIDATE_TIME_SCALE: String(scale),
        PERF_GATE_AA: '',
      });
      assert.ok(
        payload.candidateInjectionFactor >= scale * 0.99,
        `${gate.name} injection factor ${payload.candidateInjectionFactor} (same ABBA pass)`
      );
      assert.equal(payload.verdict, 'fail', `${gate.name} must fail at ${scale}x`);
    });
  }
});

// A/A: the candidate arm runs the baseline function, so the true ratio is 1. Every gate must
// measure a ratio of about 1. A gate whose limit is above 1 must also pass. A limit below 1
// (median against sort: the candidate is meant to be far faster) cannot pass an A/A run by
// design, so only the ratio is checked for it.
describe('isolated gates measure a ratio of about 1 under the A/A control', () => {
  for (const gate of gatesInList) {
    test(gate.name, () => {
      const payload = runGateScript(gate, {
        PERF_GATE_CANDIDATE_TIME_SCALE: '',
        PERF_GATE_AA: '1',
      });
      assert.equal(payload.aa, true);
      assert.ok(
        payload.ratio > 0.5 && payload.ratio < 2,
        `${gate.name} A/A ratio ${payload.ratio}`
      );
      if (gate.limit > 1) {
        assert.equal(payload.verdict, 'pass', `${gate.name} A/A ratio ${payload.ratio}`);
      }
    });
  }
});
