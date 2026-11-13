/**
 * Tests of `makeScratch` (consumer-env.mjs): the scratch folder of the packed-consumer tools.
 * Each case runs the helper in a child process under a throwaway `MATHTS_SCRATCH_ROOT`, so the
 * test never touches the folders of a real run. Run with `node --test` (never `bun run`).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

const ENV_MODULE = pathToFileURL(join(import.meta.dirname, 'consumer-env.mjs')).href;
const PREFIX = 'mathts-scratch-test-';

/** Run `body` after `makeScratch(PREFIX)` in a child process; returns its result. */
function runChild(root, body, env = {}) {
  const script = [
    `import { makeScratch } from ${JSON.stringify(ENV_MODULE)};`,
    `const dir = makeScratch(${JSON.stringify(PREFIX)});`,
    'console.log(dir);',
    body,
  ].join('\n');
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    env: { ...process.env, MATHTS_SCRATCH_ROOT: root, ...env },
  });
}

describe('makeScratch', () => {
  /** @type {string} */
  let root;
  before(() => {
    root = mkdtempSync(join(tmpdir(), 'mathts-scratch-root-'));
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  it('removes the folder when the process exits normally', () => {
    const result = runChild(root, '');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(result.stdout.trim()), false);
  });

  it('removes the folder after an uncaught error', () => {
    const result = runChild(root, 'throw new Error("boom");');
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(result.stdout.trim().split(/\r?\n/)[0]), false);
  });

  it('removes the folder on process.exit()', () => {
    const result = runChild(root, 'process.exit(3);');
    assert.equal(result.status, 3);
    assert.equal(existsSync(result.stdout.trim()), false);
  });

  it('sweeps a folder of the same prefix that is older than the stale limit, and keeps a fresh one', () => {
    const old = join(root, `${PREFIX}old`);
    const fresh = join(root, `${PREFIX}fresh`);
    const other = join(root, 'unrelated-old');
    for (const dir of [old, fresh, other]) mkdirSync(dir);
    const tenHoursAgo = new Date(Date.now() - 10 * 3_600_000);
    utimesSync(old, tenHoursAgo, tenHoursAgo);
    utimesSync(other, tenHoursAgo, tenHoursAgo);
    const result = runChild(root, '', { MATHTS_SCRATCH_STALE_HOURS: '6' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(old), false, 'stale folder of the same prefix is removed');
    assert.equal(existsSync(fresh), true, 'fresh folder is kept');
    assert.equal(existsSync(other), true, 'a folder of another prefix is never touched');
  });

  it('fails loudly on a stale limit that is not a number', () => {
    const result = runChild(root, '', { MATHTS_SCRATCH_STALE_HOURS: 'six' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /MATHTS_SCRATCH_STALE_HOURS/);
  });
});
