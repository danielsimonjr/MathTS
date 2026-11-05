/**
 * Unit tests for the scalar-search benchmark harness helpers (SR-11).
 *
 *   node --test tools/test/scalar-search-harness.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  buildScalarSearchBundle,
  assertBundleRelativeImportsResolve,
} from '../benchmark/scalar-search/bundle.mjs';
import pinnedFixture from '../benchmark/scalar-search/pinned-rows.json' with { type: 'json' };
import { measurePair, median, nodeBinary, parseArgs } from '../benchmark/scalar-search/lib.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Matches `functions/tests/scalar-search.test.ts` PINNED_ROWS — do not edit the test copy. */
const TEST_PINNED_ROWS = [
  { complexity: 1, loss: 4.870097681877825, key: '{"k":"s","v":"x"}' },
  {
    complexity: 5,
    loss: 6.317050217590134e-32,
    key: '{"k":"*","a":[{"k":"+","a":[{"k":"n","v":"1"},{"k":"s","v":"x"}]},{"k":"s","v":"x"}]}',
  },
  {
    complexity: 7,
    loss: 0,
    key: '{"k":"+","a":[{"k":"^","b":{"k":"s","v":"x"},"e":{"k":"n","v":"2"}},{"k":"s","v":"x"}]}',
  },
];

describe('median()', () => {
  test('odd and even sample counts', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.equal(median([5]), 5);
  });

  test('empty input is NaN, input order does not matter, input not mutated', () => {
    assert.ok(Number.isNaN(median([])));
    assert.equal(median([9, 1]), 5);
    const input = [3, 1];
    median(input);
    assert.deepEqual(input, [3, 1]);
  });
});

describe('parseArgs()', () => {
  test('defaults to node unless --engine bun is passed', () => {
    assert.deepEqual(parseArgs([], { node: true }), { reps: 5, engine: 'node' });
    assert.deepEqual(parseArgs([], { bun: true }), { reps: 5, engine: 'node' });
    assert.deepEqual(parseArgs([], {}), { reps: 5, engine: 'node' });
  });

  test('--reps accepts an integer >= 2 and rejects the rest', () => {
    assert.equal(parseArgs(['--reps', '12']).reps, 12);
    assert.equal(parseArgs(['--reps', '2']).reps, 2);
    assert.throws(() => parseArgs(['--reps']), /--reps needs a number/);
    assert.throws(() => parseArgs(['--reps', '1']), /integer >= 2/);
    assert.throws(() => parseArgs(['--reps', '2.5']), /integer >= 2/);
    assert.throws(() => parseArgs(['--reps', 'abc']), /integer >= 2/);
  });

  test('--engine accepts node and bun, rejects anything else', () => {
    assert.equal(parseArgs(['--engine', 'bun']).engine, 'bun');
    assert.equal(parseArgs(['--engine', 'node']).engine, 'node');
    assert.throws(() => parseArgs(['--engine', 'deno']), /must be "node" or "bun"/);
    assert.throws(() => parseArgs(['--engine']), /must be "node" or "bun"/);
  });

  test('unknown flags are errors; --reps and --engine compose', () => {
    assert.throws(() => parseArgs(['--quick']), /unknown argument --quick/);
    const parsed = parseArgs(['--reps', '9', '--engine', 'bun']);
    assert.deepEqual(parsed, { reps: 9, engine: 'bun' });
  });

  test('--help is recognized', () => {
    assert.equal(parseArgs(['--help']).help, true);
  });
});

describe('pinned-rows.json', () => {
  test('matches the seed-7 contract in functions/tests/scalar-search.test.ts', () => {
    assert.deepEqual(pinnedFixture.rows, TEST_PINNED_ROWS);
    assert.equal(pinnedFixture.expectedEvaluations, 120);
    assert.equal(pinnedFixture.expectedSeed, 7);
    assert.equal(pinnedFixture.expectedStopReason, 'max-evaluations');
    assert.deepEqual(
      pinnedFixture.progressEvaluations,
      Array.from({ length: 15 }, (_, i) => 8 * (i + 1))
    );
  });
});

describe('measurePair()', () => {
  const slowMs = 12;
  const fastMs = 1;

  async function timeFn(fn) {
    const t0 = performance.now();
    await fn();
    return performance.now() - t0;
  }

  function sleep(ms) {
    return () => new Promise((resolve) => setTimeout(resolve, ms));
  }

  test('records each sample in the lane of the thunk that ran (even reps)', async () => {
    const { aMs, bMs } = await measurePair(sleep(fastMs), sleep(slowMs), 4, timeFn, 0);
    assert.ok(aMs < bMs / 2, `fast lane ${aMs} should sit well below slow lane ${bMs}`);
  });

  test('records each sample in the lane of the thunk that ran (odd reps)', async () => {
    const { aMs, bMs } = await measurePair(sleep(fastMs), sleep(slowMs), 5, timeFn, 0);
    assert.ok(aMs < bMs / 2, `fast lane ${aMs} should sit well below slow lane ${bMs}`);
  });
});

describe('node bundle', () => {
  test('resolves workspace packages to dist (no core/src paths in the bundle)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'scalar-search-bundle-'));
    const outfile = join(dir, 'scalar-search.mjs');
    await buildScalarSearchBundle(repoRoot, outfile);
    const text = readFileSync(outfile, 'utf8');
    assert.ok(!text.includes('core/src'), 'bundle must not embed core/src sources');
    assert.ok(!text.includes('functions/src'), 'bundle must not embed functions/src sources');
  });

  test('every relative import in the production bundle path resolves on disk', async () => {
    const outfile = join(repoRoot, 'functions', '.bench', 'scalar-search.mjs');
    await buildScalarSearchBundle(repoRoot, outfile);
    assertBundleRelativeImportsResolve(outfile);
    const text = readFileSync(outfile, 'utf8');
    assert.match(text, /from\s+['"]\.\.\/dist\/scalar-batch-parallel\.js['"]/);
  });
});

describe('nodeBinary()', () => {
  test('PERF_NODE wins over everything', () => {
    assert.equal(nodeBinaryWithEnv({ PERF_NODE: '/opt/node/bin/node' }), '/opt/node/bin/node');
  });

  test('on Node the current executable is a real node', () => {
    if (process.versions.bun) return;
    assert.equal(nodeBinaryWithEnv({}), process.execPath);
  });
});

/** Calls nodeBinary() with a patched environment. */
function nodeBinaryWithEnv(env) {
  const savedPath = process.env.PATH;
  const savedPerf = process.env.PERF_NODE;
  try {
    process.env.PATH = env.PATH ?? savedPath;
    if (env.PERF_NODE === undefined) delete process.env.PERF_NODE;
    else process.env.PERF_NODE = env.PERF_NODE;
    return nodeBinary();
  } finally {
    process.env.PATH = savedPath;
    if (savedPerf === undefined) delete process.env.PERF_NODE;
    else process.env.PERF_NODE = savedPerf;
  }
}
