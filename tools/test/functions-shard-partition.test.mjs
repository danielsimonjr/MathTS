import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './workspaces.mjs';

/**
 * `functions` is the only package the Node vitest runner shards, into `FUNCTION_SHARDS = 4`
 * runs of `vitest run --shard=k/4`. Sharding only preserves "every test file runs exactly
 * once" if the four shards PARTITION the collected file set.
 *
 * These tests pin that property against the real `functions/tests` tree, using the same
 * rule vitest applies (`BaseSequencer.shard` in vitest 5: sort the spec paths by the hex
 * SHA-1 of the path relative to the config root, then cut four contiguous ranges whose
 * sizes differ by at most one). A file added later is picked up by the same walk, so a new
 * file that a hand-written list forgot would fail here.
 *
 * They read the tree, they do not run it: no vitest process starts.
 */

const FUNCTION_SHARDS = 4;
const FUNCTIONS_DIR = join(repoRoot, 'functions');

/**
 * Every test file vitest would collect for `functions`, relative to the package root.
 * `functions/vitest.config.ts` includes `tests/**\/*.test.ts` and excludes
 * `**\/*.browser.test.ts` and `node_modules/**`.
 * @returns {string[]} slash-separated paths such as `tests/algebra.test.ts`
 */
function collectedSpecs() {
  /** @type {string[]} */
  const specs = [];
  /** @param {string} dir absolute directory */
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!entry.name.endsWith('.test.ts') || entry.name.endsWith('.browser.test.ts')) continue;
      specs.push(
        abs
          .slice(FUNCTIONS_DIR.length + 1)
          .split('\\')
          .join('/')
      );
    }
  };
  walk(join(FUNCTIONS_DIR, 'tests'));
  return specs.sort();
}

/**
 * Reimplements vitest 5's `BaseSequencer.calculateShardRange`.
 * @param {number} filesCount
 * @param {number} index 1-based shard index
 * @param {number} count
 * @returns {[number, number]}
 */
function calculateShardRange(filesCount, index, count) {
  const baseShardSize = Math.floor(filesCount / count);
  const remainder = filesCount % count;
  if (remainder >= index) {
    const shardSize = baseShardSize + 1;
    return [shardSize * (index - 1), shardSize * index];
  }
  const start = remainder * (baseShardSize + 1) + (index - remainder - 1) * baseShardSize;
  return [start, start + baseShardSize];
}

/** The specs of shard `index` of `count`, assigned the way vitest 5 assigns them. */
function shardSpecs(specs, index, count) {
  const hashed = specs
    .map((spec) => ({ spec, hash: createHash('sha1').update(`/${spec}`).digest('hex') }))
    .sort((a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));
  const [start, end] = calculateShardRange(hashed.length, index, count);
  return hashed.slice(start, end).map((entry) => entry.spec);
}

test('the four functions shards partition every test file exactly once', () => {
  const specs = collectedSpecs();
  assert.ok(specs.length > 0, 'the fixture walk must find the functions test files');

  /** @type {Map<string, number[]>} */
  const assignments = new Map();
  for (let shard = 1; shard <= FUNCTION_SHARDS; shard++) {
    for (const spec of shardSpecs(specs, shard, FUNCTION_SHARDS)) {
      assignments.set(spec, [...(assignments.get(spec) ?? []), shard]);
    }
  }

  const duplicated = [...assignments].filter(([, shards]) => shards.length > 1);
  assert.deepEqual(duplicated, [], 'no test file may run in more than one shard');

  const missing = specs.filter((spec) => !assignments.has(spec));
  assert.deepEqual(missing, [], 'every collected test file must run in some shard');

  // The shard sizes are balanced to within one file, which is what makes the split useful.
  const sizes = [];
  for (let shard = 1; shard <= FUNCTION_SHARDS; shard++) {
    sizes.push(shardSpecs(specs, shard, FUNCTION_SHARDS).length);
  }
  assert.ok(
    Math.max(...sizes) - Math.min(...sizes) <= 1,
    `shard sizes must differ by at most one file, got ${sizes.join(', ')}`
  );
});
