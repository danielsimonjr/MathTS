/**
 * Unit tests and G26 gate self-tests for wall-clock-perf-gate.mjs
 *
 *   node --test tools/test/wall-clock-perf-gate.test.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  abbaTimedRatio,
  gatePasses,
  median,
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
      if (!gate.needs.every((p) => existsSync(join(repoRoot, p)))) {
        return;
      }
      const line = execFileSync(process.execPath, [scriptPath], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...process.env, PERF_GATE_CANDIDATE_TIME_SCALE: '3' },
      }).trim();
      const { ratio } = JSON.parse(line);
      assert.ok(Number.isFinite(ratio));
      assert.equal(gatePasses(ratio, gate.limit), false);
      assert.ok(ratio >= gate.limit * 0.85, `ratio ${ratio} should reflect ~3× slowdown`);
    });
  }
});
