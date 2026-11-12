/**
 * Unit tests and G26 gate self-tests for wall-clock-perf-gate.mjs
 *
 *   node --test tools/test/wall-clock-perf-gate.test.mjs
 */
import assert from 'node:assert/strict';
import { execIsolatedPerfGate, isolatedPerfGateChildEnv } from './perf-gate-spawn.mjs';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  abbaTimedRatio,
  gatePasses,
  median,
  measuredCandidateInjectionFactor,
  symmetricWarmup,
  trimmedMean,
  wallClockAbRatio,
} from './wall-clock-perf-gate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

function busyMs(ms) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    /* spin */
  }
}

describe('wall-clock-perf-gate statistics', () => {
  test('median and trimmedMean', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.ok(trimmedMean([2, 3, 4, 5, 6]) === 4);
  });

  test('~3× slowdown fails a 1.2 gate', () => {
    const base = () => busyMs(8);
    const slow = () => busyMs(24);
    symmetricWarmup(base, slow, { minPairs: 6, maxPairs: 20 });
    const { ratio } = abbaTimedRatio(base, slow, { samplePairs: 12, gcBetween: false });
    assert.ok(ratio >= 2.5, `expected ~3×, got ${ratio}`);
    assert.equal(gatePasses(ratio, 1.2), false);
  });

  test('matched arms pass a 1.15 gate', () => {
    const fn = () => busyMs(6);
    const { ratio } = wallClockAbRatio(fn, fn, {
      warmup: { minPairs: 4, maxPairs: 12 },
      sample: { samplePairs: 10, gcBetween: false },
    });
    assert.ok(ratio < 1.15, `expected ~1.0, got ${ratio}`);
    assert.equal(gatePasses(ratio, 1.15), true);
  });

  test('PERF_GATE_CANDIDATE_TIME_SCALE applies to the same ABBA samples', () => {
    const prev = process.env.PERF_GATE_CANDIDATE_TIME_SCALE;
    process.env.PERF_GATE_CANDIDATE_TIME_SCALE = '3';
    try {
      const fn = () => busyMs(5);
      const { candidateInjectionFactor } = wallClockAbRatio(fn, fn, {
        skipSymmetricWarmup: true,
        fullWarmupPairs: 2,
        sample: { samplePairs: 12, gcBetween: false },
      });
      assert.ok(
        candidateInjectionFactor >= 2.5,
        `expected injected scale on sampled candidate ms, got ${candidateInjectionFactor}`
      );
      assert.ok(
        Math.abs(candidateInjectionFactor - 3) < 0.01,
        `expected ~3.0 injection factor, got ${candidateInjectionFactor}`
      );
    } finally {
      if (prev === undefined) delete process.env.PERF_GATE_CANDIDATE_TIME_SCALE;
      else process.env.PERF_GATE_CANDIDATE_TIME_SCALE = prev;
    }
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
      assert.equal(env.NODE_V8_COVERAGE, undefined);
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
});

const G26_GATES = [
  {
    name: 'compat-add',
    script: 'compat/tests/helpers/compat-add-perf-gate.mjs',
    limit: 2.0,
    needs: ['compat/dist/index.js'],
  },
  {
    name: 'sin-f64',
    script: 'functions/tests/helpers/sin-f64-perf-gate.mjs',
    limit: 1.2,
    needs: ['functions/dist/index.js'],
  },
  {
    name: 'lusolve',
    script: 'functions/tests/helpers/lusolve-perf-gate.mjs',
    limit: 1.2,
    needs: ['functions/dist/index.js'],
  },
  {
    name: 'gemm',
    script: 'matrix/tests/helpers/gemm-perf-gate.mjs',
    limit: 1.15,
    needs: ['matrix/dist/index.js'],
  },
];

describe('G26 isolated gates fail under injected 3× candidate slowdown', () => {
  for (const gate of G26_GATES) {
    test(gate.name, () => {
      const scriptPath = join(repoRoot, gate.script);
      const missing = gate.needs.filter((p) => !existsSync(join(repoRoot, p)));
      assert.equal(
        missing.length,
        0,
        `built dist required for ${gate.name}: ${missing.join(', ')}`
      );
      const line = execIsolatedPerfGate(process.execPath, scriptPath, {
        cwd: repoRoot,
        extraEnv: { PERF_GATE_CANDIDATE_TIME_SCALE: '3' },
      });
      const payload = JSON.parse(line);
      const { ratio, candidateInjectionFactor } = payload;
      assert.ok(Number.isFinite(ratio), `${gate.name} ratio ${ratio}`);
      assert.ok(
        Number.isFinite(candidateInjectionFactor),
        `${gate.name} candidateInjectionFactor ${candidateInjectionFactor}`
      );
      assert.ok(
        candidateInjectionFactor >= 2.5,
        `${gate.name} 3× injection factor ${candidateInjectionFactor} (same ABBA pass)`
      );
      assert.equal(gatePasses(ratio, gate.limit), false);
    });
  }
});
