import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot } from './workspaces.mjs';

/**
 * `functions` runs as one unsharded `vitest run` in `run-vitest-node.mjs`. These tests pin
 * that the runner does not pass `--shard` (which would split the suite) and that the
 * package still collects its full non-browser tests glob (every .test.ts except .browser).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_DIR = join(repoRoot, 'functions');

function collectedSpecs() {
  /** @type {string[]} */
  const specs = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!entry.name.endsWith('.test.ts')) continue;
      if (entry.name.endsWith('.browser.test.ts')) continue;
      specs.push(abs.slice(FUNCTIONS_DIR.length + 1).split('\\').join('/'));
    }
  };
  walk(join(FUNCTIONS_DIR, 'tests'));
  return specs;
}

test('the Node runner does not shard functions', () => {
  const src = readFileSync(join(HERE, 'run-vitest-node.mjs'), 'utf8');
  assert.doesNotMatch(src, /--shard=/);
  assert.match(src, /label: `vitest \$\{dir\}`/);
});

test('functions still collects every non-browser test file exactly once', () => {
  const specs = collectedSpecs();
  assert.ok(specs.length > 0, 'the walk must find the functions test files');
  assert.equal(new Set(specs).size, specs.length, 'the walk must not list a file twice');
  const browsers = specs.filter((s) => s.endsWith('.browser.test.ts'));
  assert.deepEqual(browsers, []);
});
