import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `bun run prepush` runs the cheap CI gates locally, and AGENTS.md/CONTRIBUTING.md make it
 * "required before every push". Its last line claims `prepush: OK — all pre-push gates pass.`
 *
 * The code-docs gate is skipped when the `repo-tools` global binary is absent (a machine
 * without it gets an install hint). Skipping is defensible; reporting "all pre-push gates
 * pass" afterwards is not, because the one gate that never ran is exactly the one a push
 * would then discover in CI's Architecture docs job.
 *
 * This pins the reporting invariant: the success line may only be printed when every gate
 * actually ran and passed.
 *
 * The fixture is a throwaway repo with stubbed `bun` and gate scripts, so it takes ~100 ms.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_PREPUSH = join(HERE, '..', 'ci', 'prepush.mjs');

/**
 * Builds a throwaway repo whose gate scripts all exit 0, with no `repo-tools` on the PATH.
 * @returns {{ root: string, cleanup: () => void }}
 */
function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'prepush-report-'));
  mkdirSync(join(root, 'tools', 'ci'), { recursive: true });
  mkdirSync(join(root, 'tools', 'test'), { recursive: true });
  mkdirSync(join(root, 'core', 'dist'), { recursive: true });
  mkdirSync(join(root, 'stubbin'), { recursive: true });

  copyFileSync(REAL_PREPUSH, join(root, 'tools', 'ci', 'prepush.mjs'));

  // `prepush` refuses to start without a built dist; the gates below are stubs anyway.
  writeFileSync(join(root, 'core', 'dist', 'index.js'), 'export {};\n');
  writeFileSync(join(root, 'package.json'), '{"name":"fixture","private":true}\n');

  // The two gate scripts the fixture reaches are no-ops that pass.
  for (const script of ['check-code-docs.mjs', 'check-bundle-budget.mjs']) {
    writeFileSync(join(root, 'tools', 'test', script), 'process.exit(0);\n');
  }

  // `bun run <step>` is spawned by name, so a PATH entry shadows the real Bun.
  const bun = join(root, 'stubbin', 'bun');
  writeFileSync(bun, '#!/bin/sh\nexit 0\n');
  chmodSync(bun, 0o755);

  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('prepush does not claim every gate passed when a gate was skipped', () => {
  const { root, cleanup } = makeFixture();
  try {
    const result = spawnSync(process.execPath, [join(root, 'tools', 'ci', 'prepush.mjs')], {
      cwd: root,
      encoding: 'utf8',
      // `stubbin` first (the stub `bun`), then the real PATH for `node`.
      env: { ...process.env, PATH: `${join(root, 'stubbin')}:${process.env.PATH ?? ''}` },
    });
    const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    assert.match(out, /skipping the code-docs check/, 'the fixture must exercise the skip path');
    assert.doesNotMatch(
      out,
      /all pre-push gates pass/,
      'a skipped gate must not be reported as a passing gate; say which gate did not run'
    );
  } finally {
    cleanup();
  }
});
