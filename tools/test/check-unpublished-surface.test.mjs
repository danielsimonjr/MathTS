// Unit tests for the unpublished-surface check (#1573). Every fixture uses a fake
// registry layout under a temp root — no network: `CHECK_SURFACE_OFFLINE=1` guards
// the script's network call, and `CHECK_SURFACE_REGISTRY_DIR` points it at tarballs
// built in the fixture instead of `npm pack`.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { changesetNames, run } from './check-unpublished-surface.mjs';
import { ciStepProblem } from './ci-step.mjs';

const NAME = '@danielsimonjr/mathts-fake-a';

/**
 * Build a fake checkout: one workspace package whose `dist/index.js` exports the given
 * names, plus a `.changeset/` holding the given change files, and a registry dir holding
 * a published tarball at the same version that exports `tarballExports`.
 * @param {{ builtExports: string[], tarballExports: string[], changesets?: string[] }} spec
 * @returns {{ root: string, registryDir: string, dispose: () => void }}
 */
function makeFixture({ builtExports, tarballExports, changesets = [] }) {
  const root = mkdtempSync(join(tmpdir(), 'check-surface-root-'));
  const registryDir = mkdtempSync(join(tmpdir(), 'check-surface-registry-'));
  const pkgDir = join(root, 'fake-a');
  mkdirSync(join(pkgDir, 'dist'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ workspaces: ['fake-a'] }, null, 2));
  writeFileSync(
    join(pkgDir, 'package.json'),
    JSON.stringify(
      { name: NAME, version: '1.2.3', private: false, type: 'module', exports: './dist/index.js' },
      null,
      2
    )
  );
  const render = (names) => names.map((n) => `export const ${n} = 1;\n`).join('');
  writeFileSync(join(pkgDir, 'dist', 'index.js'), render(builtExports));

  mkdirSync(join(root, '.changeset'));
  changesets.forEach((name, index) => {
    writeFileSync(
      join(root, '.changeset', `change-${index}-${name.replaceAll('/', '-')}.md`),
      `---\n'${NAME}': patch\n---\n\nFixture change.\n`
    );
  });

  const packSrc = mkdtempSync(join(tmpdir(), 'check-surface-packsrc-'));
  mkdirSync(join(packSrc, 'package', 'dist'), { recursive: true });
  writeFileSync(
    join(packSrc, 'package', 'package.json'),
    JSON.stringify(
      { name: NAME, version: '1.2.3', type: 'module', exports: './dist/index.js' },
      null,
      2
    )
  );
  writeFileSync(join(packSrc, 'package', 'dist', 'index.js'), render(tarballExports));
  execFileSync('tar', ['-czf', join(registryDir, 'mathts-fake-a-1.2.3.tgz'), '-C', packSrc, '.']);
  rmSync(packSrc, { recursive: true, force: true });

  return {
    root,
    registryDir,
    dispose: () => {
      rmSync(root, { recursive: true, force: true });
      rmSync(registryDir, { recursive: true, force: true });
    },
  };
}

test('CI runs the unpublished-surface check after the build', () => {
  assert.equal(
    ciStepProblem('node tools/test/check-unpublished-surface.mjs'),
    null,
    'ci.yml must run the unpublished-surface check as a failing gate'
  );
});

test('drifted exports without a changeset fail, naming the package and the exports', async () => {
  const fixture = makeFixture({ builtExports: ['a', 'b'], tarballExports: ['a'] });
  try {
    process.env.CHECK_SURFACE_OFFLINE = '1';
    process.env.CHECK_SURFACE_REGISTRY_DIR = fixture.registryDir;
    const { failures, skipped } = await run(fixture.root);
    assert.equal(failures.length, 1);
    assert.ok(failures[0].includes(NAME), `failure names the package: ${failures[0]}`);
    assert.ok(failures[0].includes('b'), `failure names the drifted export: ${failures[0]}`);
    assert.ok(failures[0].includes('changeset'), `failure asks for a changeset: ${failures[0]}`);
    assert.equal(skipped.length, 0);
  } finally {
    delete process.env.CHECK_SURFACE_OFFLINE;
    delete process.env.CHECK_SURFACE_REGISTRY_DIR;
    fixture.dispose();
  }
});

test('drifted exports with a changeset naming the package pass', async () => {
  const fixture = makeFixture({
    builtExports: ['a', 'b'],
    tarballExports: ['a'],
    changesets: [NAME],
  });
  try {
    process.env.CHECK_SURFACE_OFFLINE = '1';
    process.env.CHECK_SURFACE_REGISTRY_DIR = fixture.registryDir;
    const { failures } = await run(fixture.root);
    assert.deepEqual(failures, []);
  } finally {
    delete process.env.CHECK_SURFACE_OFFLINE;
    delete process.env.CHECK_SURFACE_REGISTRY_DIR;
    fixture.dispose();
  }
});

test('no drift passes with no changeset at all', async () => {
  const fixture = makeFixture({ builtExports: ['a', 'b'], tarballExports: ['a', 'b'] });
  try {
    process.env.CHECK_SURFACE_OFFLINE = '1';
    process.env.CHECK_SURFACE_REGISTRY_DIR = fixture.registryDir;
    const { failures } = await run(fixture.root);
    assert.deepEqual(failures, []);
  } finally {
    delete process.env.CHECK_SURFACE_OFFLINE;
    delete process.env.CHECK_SURFACE_REGISTRY_DIR;
    fixture.dispose();
  }
});

test('changesetNames reads the pending changeset files of this checkout', () => {
  const names = changesetNames(join(import.meta.dirname, '..', '..'));
  const config = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8')
  );
  assert.ok(typeof config.name === 'string');
  // The real checkout has changesets from the parity groups; every collected name must
  // be a plausible package name.
  for (const name of names) assert.match(name, /^(@[\w-]+\/)?[\w-]+$/);
});
