/**
 * Unit tests for the scalar-search benchmark harness helpers (SR-11).
 *
 *   node --test tools/test/scalar-search-harness.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { median, nodeBinary, parseArgs } from '../benchmark/scalar-search/lib.mjs';

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
  test('defaults come from the detected runtime', () => {
    assert.deepEqual(parseArgs([], { node: true }), { reps: 5, engine: 'node' });
    assert.deepEqual(parseArgs([], { bun: true }), { reps: 5, engine: 'bun' });
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
