/**
 * Challenger review of G21 (#1573): `tools/test/check-unpublished-surface.mjs`.
 *
 * Every test here is a property the check claims — "a package whose built export
 * surface differs from the published tarball must not pass silently" — exercised on
 * an edge the implementation does not handle. Each DEFECT test FAILS against the G21
 * head (`ed0598c6`), so a finding is reproducible locally instead of only in CI.
 *
 *  1. A published SUBPATH (`./evaluate`, `./internal`, `./render`, `./worker`, ...) is
 *     never compared: only `exports['.']` is read, so a subpath that appears,
 *     disappears or changes shape passes.  [P1: the "surface" is only the root entry]
 *  2. A changeset whose BODY prose mentions a package exempts that package. The live
 *     `.changeset/g05-matrix-parity.md` already does this for `matrix` and `functions`
 *     (its frontmatter names only `compat`), so the gate is already bypassed for two
 *     packages.  [P1: silent pass on real drift]
 *  3. Malformed / commented / frontmatter-less changeset files exempt packages, because
 *     `changesetNames` scans the whole file instead of the YAML frontmatter.  [P1]
 *  4. `npm pack` returning ETARGET (an existing package whose HEAD version is not on
 *     the registry yet) throws instead of skipping. The step runs on a push to `main`
 *     (where `github.head_ref` is empty), so it hard-fails every package between the
 *     version-PR merge and the end of Publish.  [P1: false failure]
 *  5. If the build produced no entry for any package the run reports success (empty
 *     `failures`), so a broken/absent `dist/` is indistinguishable from a clean tree.
 *     [P2: vacuous green]
 *  6. One unimportable package aborts the whole run, hiding every later package's
 *     drift behind one opaque error.  [P2]
 *
 * Properties that DO hold and are pinned so a fix cannot regress them: a removed
 * export is caught (`extra`), a 404 for a never-published package skips, a 5xx /
 * network error fails loudly rather than passing, and `.changeset/README.md` is ignored.
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  changesetNames,
  extractChangesetFrontmatter,
  run,
} from './check-unpublished-surface.mjs';

const NAME = '@danielsimonjr/mathts-fake-a';
const VERSION = '1.2.3';

/**
 * Build a fake checkout plus a fake registry tarball.
 * @param {{
 *   built?: string[],
 *   published?: string[],
 *   builtExports?: object,
 *   publishedExports?: object,
 *   builtSub?: Record<string, string[]>,
 *   publishedSub?: Record<string, string[]>,
 *   changesets?: string[],
 * }} spec
 * @returns {{ root: string, registryDir: string, dispose: () => void }}
 */
function makeFixture(spec) {
  const root = mkdtempSync(join(tmpdir(), 'g21-challenger-root-'));
  const registryDir = mkdtempSync(join(tmpdir(), 'g21-challenger-registry-'));
  const render = (names) => (names ?? []).map((n) => `export const ${n} = 1;\n`).join('');

  const builtExports = spec.builtExports ?? { '.': './dist/index.js' };
  const publishedExports = spec.publishedExports ?? { '.': './dist/index.js' };

  const pkgDir = join(root, 'fake-a');
  mkdirSync(join(pkgDir, 'dist'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ workspaces: ['fake-a'] }, null, 2));
  writeFileSync(
    join(pkgDir, 'package.json'),
    JSON.stringify(
      { name: NAME, version: VERSION, private: false, type: 'module', exports: builtExports },
      null,
      2
    )
  );
  writeFileSync(join(pkgDir, 'dist', 'index.js'), render(spec.built));
  for (const [sub, names] of Object.entries(spec.builtSub ?? {})) {
    writeFileSync(join(pkgDir, 'dist', `${sub}.js`), render(names));
  }

  mkdirSync(join(root, '.changeset'));
  (spec.changesets ?? []).forEach((text, index) => {
    writeFileSync(join(root, '.changeset', `change-${index}.md`), text);
  });

  const packSrc = mkdtempSync(join(tmpdir(), 'g21-challenger-packsrc-'));
  mkdirSync(join(packSrc, 'package', 'dist'), { recursive: true });
  writeFileSync(
    join(packSrc, 'package', 'package.json'),
    JSON.stringify(
      { name: NAME, version: VERSION, type: 'module', exports: publishedExports },
      null,
      2
    )
  );
  writeFileSync(join(packSrc, 'package', 'dist', 'index.js'), render(spec.published));
  for (const [sub, names] of Object.entries(spec.publishedSub ?? {})) {
    writeFileSync(join(packSrc, 'package', 'dist', `${sub}.js`), render(names));
  }
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

/**
 * Run the check against a fixture in offline mode with a fake registry.
 * @param {{ root: string, registryDir: string }} fixture
 */
async function runFixture(fixture) {
  process.env.CHECK_SURFACE_OFFLINE = '1';
  process.env.CHECK_SURFACE_REGISTRY_DIR = fixture.registryDir;
  try {
    return await run(fixture.root);
  } finally {
    delete process.env.CHECK_SURFACE_OFFLINE;
    delete process.env.CHECK_SURFACE_REGISTRY_DIR;
  }
}

test('DEFECT: a published subpath that HEAD removed is not detected', async () => {
  // Published: `.` -> dist/index.js and `./evaluate` -> dist/evaluate.js, exactly the
  // shape of the real `functions` package. HEAD dropped `./evaluate` from `exports`, so
  // a consumer import of `@danielsimonjr/mathts-functions/evaluate` breaks at the same
  // published version. Only `exports['.']` is read.
  const fixture = makeFixture({
    built: ['a'],
    published: ['a'],
    builtExports: { '.': './dist/index.js' },
    publishedExports: { '.': './dist/index.js', './evaluate': { import: './dist/evaluate.js' } },
    publishedSub: { evaluate: ['evaluate'] },
  });
  try {
    const { failures } = await runFixture(fixture);
    assert.equal(
      failures.length,
      1,
      'a subpath that exists in the published tarball but not on HEAD is a real break for ' +
        `consumers and must be reported; got ${JSON.stringify(failures)}`
    );
  } finally {
    fixture.dispose();
  }
});

test('DEFECT: a subpath export whose names drifted is not detected', async () => {
  // Both manifests name `./sub`, but the tarball's sub entry exports `x` while HEAD's
  // exports `x, y` — the same drift the root entry catches, on a subpath.
  const fixture = makeFixture({
    built: ['a'],
    published: ['a'],
    builtExports: { '.': './dist/index.js', './sub': { import: './dist/sub.js' } },
    publishedExports: { '.': './dist/index.js', './sub': { import: './dist/sub.js' } },
    builtSub: { sub: ['x', 'y'] },
    publishedSub: { sub: ['x'] },
  });
  try {
    const { failures } = await runFixture(fixture);
    assert.equal(
      failures.length,
      1,
      `subpath export drift must be reported; got ${JSON.stringify(failures)}`
    );
  } finally {
    fixture.dispose();
  }
});

test('DEFECT: prose in a changeset body exempts a package it does not version', async () => {
  // This is the live shape of `.changeset/g05-matrix-parity.md`: frontmatter names only
  // `compat`, and the body says "The native Francis-QR `schur` of
  // `@danielsimonjr/mathts-matrix` ... are unchanged." A `matrix` drift is then silently
  // exempted because `changesetNames` regex-scans the whole file.
  const fixture = makeFixture({
    built: ['a', 'b'],
    published: ['a'],
    changesets: [
      "---\n'@danielsimonjr/mathts-other': patch\n---\n\n" +
        'The native `@danielsimonjr/mathts-fake-a` behavior is unchanged.\n',
    ],
  });
  try {
    const { failures } = await runFixture(fixture);
    assert.equal(
      failures.length,
      1,
      'a package named only in a changeset BODY is not being versioned by that changeset; ' +
        `the drift must still fail; got ${JSON.stringify(failures)}`
    );
  } finally {
    fixture.dispose();
  }
});

test('DEFECT: a commented-out changeset frontmatter line exempts a package', async () => {
  const fixture = makeFixture({
    built: ['a', 'b'],
    published: ['a'],
    changesets: ["---\n# '@danielsimonjr/mathts-fake-a': patch\n---\n\nx\n"],
  });
  try {
    const { failures } = await runFixture(fixture);
    assert.equal(failures.length, 1, 'a commented frontmatter line must not exempt a package');
  } finally {
    fixture.dispose();
  }
});

test('DEFECT: a changeset with no frontmatter at all exempts a package', async () => {
  const fixture = makeFixture({
    built: ['a', 'b'],
    published: ['a'],
    changesets: ['This note mentions @danielsimonjr/mathts-fake-a in passing.\n'],
  });
  try {
    const { failures } = await runFixture(fixture);
    assert.equal(
      failures.length,
      1,
      'a .md file that changesets would reject must not count as a pending changeset'
    );
  } finally {
    fixture.dispose();
  }
});

/**
 * Put a fake `npm` on PATH that fails with the given stderr, so the ETARGET path can be
 * exercised without touching the registry.
 * @param {string} stderr
 * @returns {{ dir: string, dispose: () => void }}
 */
function fakeNpm(stderr) {
  const dir = mkdtempSync(join(tmpdir(), 'g21-challenger-npm-'));
  const file = join(dir, 'npm');
  writeFileSync(file, `#!/bin/sh\ncat >&2 <<'STDERR'\n${stderr}\nSTDERR\nexit 1\n`);
  chmodSync(file, 0o755);
  return { dir, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}

/**
 * Run the check online (no registry dir) against a fixture with `npm` shimmed.
 * @param {string} stderr
 * @returns {Promise<{ failures?: string[], skipped?: string[], error?: string }>}
 */
async function runWithFakeNpm(stderr) {
  const shim = fakeNpm(stderr);
  const oldPath = process.env.PATH;
  delete process.env.CHECK_SURFACE_REGISTRY_DIR;
  delete process.env.CHECK_SURFACE_OFFLINE;
  process.env.PATH = `${shim.dir}:${oldPath}`;
  const fixture = makeFixture({ built: ['a'], published: ['a'] });
  try {
    return await run(fixture.root);
  } catch (error) {
    return { error: String(error?.message ?? error) };
  } finally {
    process.env.PATH = oldPath;
    shim.dispose();
    fixture.dispose();
  }
}

test('DEFECT: ETARGET (existing package, version not published yet) crashes the check', async () => {
  // `npm pack <name>@<version>` returns ETARGET, not E404, when the package exists but
  // that version is not on the registry — the state of every package on the push that
  // merges the version PR, before Publish completes. `github.head_ref` is empty on a
  // `push` event, so the CI step runs there and this throw turns the whole job red.
  const result = await runWithFakeNpm(
    'npm error code ETARGET\n' +
      `npm error notarget No matching version found for ${NAME}@${VERSION}.`
  );
  assert.equal(
    result.error,
    undefined,
    'a not-yet-published version is the same "nothing to compare" case as E404 and must ' +
      `not throw; got ${result.error}`
  );
  assert.deepEqual(result.failures, []);
});

test('a 5xx / network failure fails loudly instead of passing', async () => {
  const result = await runWithFakeNpm('npm error code E500\nnpm error 500 Internal Server Error');
  assert.ok(
    typeof result.error === 'string' && result.error.length > 0,
    'a transient registry error must not be treated as "no drift"'
  );
});

test('a 404 for a never-published package skips (property held)', async () => {
  const result = await runWithFakeNpm(
    'npm error code E404\n' + `npm error 404  '${NAME}@${VERSION}' is not in this registry.`
  );
  assert.equal(result.error, undefined, `E404 must skip; got ${result.error}`);
  assert.deepEqual(result.failures, []);
});

test('DEFECT: zero compared packages reports success (vacuous green)', async () => {
  // A checkout whose workspaces list is empty — or, in CI, a build that emitted no entry
  // for any package (`skip: no built entry` for all 24) — prints the success line and
  // exits 0. Nothing asserts that any comparison happened.
  const root = mkdtempSync(join(tmpdir(), 'g21-challenger-empty-'));
  mkdirSync(join(root, '.changeset'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ workspaces: [] }, null, 2));
  process.env.CHECK_SURFACE_OFFLINE = '1';
  try {
    const { failures } = await run(root);
    assert.ok(
      failures.length > 0,
      'a run that compared zero packages must not be reported as a pass; otherwise a ' +
        'broken `dist/` is indistinguishable from a clean tree'
    );
  } finally {
    delete process.env.CHECK_SURFACE_OFFLINE;
    rmSync(root, { recursive: true, force: true });
  }
});

test('DEFECT: one unimportable package hides drift in every later package', async () => {
  // `collectExports` throws out of `run`, so the first package whose entry fails to import
  // stops the loop: packages after it are never compared, and the report is one opaque
  // module error instead of a list of drifted packages.
  const root = mkdtempSync(join(tmpdir(), 'g21-challenger-throw-'));
  const registryDir = mkdtempSync(join(tmpdir(), 'g21-challenger-throw-reg-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ workspaces: ['a-bad', 'b-good'] }));
  mkdirSync(join(root, '.changeset'));
  const writePkg = (dir, name, body) => {
    mkdirSync(join(root, dir, 'dist'), { recursive: true });
    writeFileSync(
      join(root, dir, 'package.json'),
      JSON.stringify({ name, version: VERSION, type: 'module', exports: './dist/index.js' })
    );
    writeFileSync(join(root, dir, 'dist', 'index.js'), body);
  };
  writePkg('a-bad', '@danielsimonjr/mathts-bad', 'throw new Error("boom: cannot import")\n');
  writePkg('b-good', '@danielsimonjr/mathts-good', 'export const a = 1;\n');
  for (const [unscoped, name, body] of [
    ['mathts-bad', '@danielsimonjr/mathts-bad', 'export const a = 1;\n'],
    ['mathts-good', '@danielsimonjr/mathts-good', 'export const a = 1;\nexport const b = 2;\n'],
  ]) {
    const packSrc = mkdtempSync(join(tmpdir(), 'g21-challenger-throw-p-'));
    mkdirSync(join(packSrc, 'package', 'dist'), { recursive: true });
    writeFileSync(
      join(packSrc, 'package', 'package.json'),
      JSON.stringify({ name, version: VERSION, type: 'module', exports: './dist/index.js' })
    );
    writeFileSync(join(packSrc, 'package', 'dist', 'index.js'), body);
    execFileSync('tar', [
      '-czf',
      join(registryDir, `${unscoped}-${VERSION}.tgz`),
      '-C',
      packSrc,
      '.',
    ]);
    rmSync(packSrc, { recursive: true, force: true });
  }
  process.env.CHECK_SURFACE_OFFLINE = '1';
  process.env.CHECK_SURFACE_REGISTRY_DIR = registryDir;
  try {
    let result;
    try {
      result = await run(root);
    } catch (error) {
      assert.fail(
        'one package that fails to import must be reported and skipped, not thrown out of ' +
          '`run`, or every package after it goes unchecked: ' +
          String(error?.message ?? error).split('\n')[0]
      );
    }
    assert.ok(
      result.failures.some((line) => line.includes('mathts-good')),
      'the drifted package after the unimportable one must still be reported: ' +
        JSON.stringify(result.failures)
    );
  } finally {
    delete process.env.CHECK_SURFACE_OFFLINE;
    delete process.env.CHECK_SURFACE_REGISTRY_DIR;
    rmSync(root, { recursive: true, force: true });
    rmSync(registryDir, { recursive: true, force: true });
  }
});

test('a REMOVED export is caught (property held)', async () => {
  // The published tarball has `a, b`; HEAD has only `a`. This is the "removals too?"
  // question — the `extra` list does cover it.
  const fixture = makeFixture({ built: ['a'], published: ['a', 'b'] });
  try {
    const { failures } = await runFixture(fixture);
    assert.equal(failures.length, 1);
    assert.ok(/in the tarball but not on HEAD/.test(failures[0]), failures[0]);
  } finally {
    fixture.dispose();
  }
});

test('DEFECT: the check runs on push to main, where ETARGET is guaranteed', () => {
  // The step's `if:` has no `github.event_name` clause, and `docs_only` is always `false`
  // on a non-PR event (see the `Classify changed paths` step), so on the push that merges
  // the version PR the step runs before Publish creates those tarballs. Every package then
  // hits ETARGET (defect 4) and the required Compile & Lint check goes red for that push.
  // The step must be limited to pull requests (or to events where HEAD versions are
  // already published).
  const text = readFileSync(
    join(import.meta.dirname, '..', '..', '.github', 'workflows', 'ci.yml'),
    'utf8'
  ).replace(/\r/g, '');
  const lines = text.split('\n');
  const at = lines.findIndex(
    (line) =>
      line.trim().replace(/^run:\s+/, '') === 'node tools/test/check-unpublished-surface.mjs'
  );
  assert.ok(at >= 0, 'the step must exist');
  let first = at;
  while (first > 0 && !/^ {6}- name:/.test(lines[first] ?? '')) first--;
  const block = lines.slice(first, at).join('\n');
  assert.match(
    block,
    /github\.event_name\s*==\s*'pull_request'/,
    'the step must not run on a push to main, where the bumped versions are not on the ' +
      `registry yet (it would hard-fail on ETARGET); step block was:\n${block}`
  );
});

test('DEFECT: the unit test is not run by any CI step', () => {
  // Every other `tools/test/*.test.mjs` sibling runs in Compile & Lint (`node --test
  // tools/test/<name>.test.mjs`), which is what pins the gate's own behavior. This one
  // is referenced nowhere in `.github/`, so the check can rot — the exact "gate stayed
  // green for months" failure mode the repo's own testing notes warn about.
  const ci = readFileSync(
    join(import.meta.dirname, '..', '..', '.github', 'workflows', 'ci.yml'),
    'utf8'
  ).replace(/\r/g, '');
  assert.match(
    ci,
    /check-unpublished-surface\.test\.mjs/,
    'compile & lint must run `node --test tools/test/check-unpublished-surface.test.mjs`'
  );
});

test('worker entries skip when both sides fail; a non-worker both-fail is drift', async () => {
  const boom = 'throw new Error("needs Worker")\n';
  const workerFixture = makeFixture({
    built: ['a'],
    published: ['a'],
    builtExports: { '.': './dist/index.js', './worker': { import: './dist/worker.js' } },
    publishedExports: { '.': './dist/index.js', './worker': { import: './dist/worker.js' } },
    builtSub: { worker: [] },
    publishedSub: { worker: [] },
  });
  writeFileSync(join(workerFixture.root, 'fake-a', 'dist', 'worker.js'), boom);
  const packSrc = mkdtempSync(join(tmpdir(), 'g21-worker-pack-'));
  mkdirSync(join(packSrc, 'package', 'dist'), { recursive: true });
  writeFileSync(
    join(packSrc, 'package', 'package.json'),
    JSON.stringify({
      name: NAME,
      version: VERSION,
      type: 'module',
      exports: { '.': './dist/index.js', './worker': { import: './dist/worker.js' } },
    })
  );
  writeFileSync(join(packSrc, 'package', 'dist', 'index.js'), 'export const a = 1;\n');
  writeFileSync(join(packSrc, 'package', 'dist', 'worker.js'), boom);
  execFileSync('tar', [
    '-czf',
    join(workerFixture.registryDir, 'mathts-fake-a-1.2.3.tgz'),
    '-C',
    packSrc,
    '.',
  ]);
  rmSync(packSrc, { recursive: true, force: true });
  try {
    const { failures } = await runFixture(workerFixture);
    assert.deepEqual(failures, [], `worker both-fail must skip; got ${JSON.stringify(failures)}`);
  } finally {
    workerFixture.dispose();
  }

  const evaluateFixture = makeFixture({
    built: ['a'],
    published: ['a'],
    builtExports: { '.': './dist/index.js', './evaluate': { import: './dist/evaluate.js' } },
    publishedExports: { '.': './dist/index.js', './evaluate': { import: './dist/evaluate.js' } },
    builtSub: { evaluate: [] },
    publishedSub: { evaluate: [] },
  });
  writeFileSync(join(evaluateFixture.root, 'fake-a', 'dist', 'evaluate.js'), boom);
  const packSrc2 = mkdtempSync(join(tmpdir(), 'g21-eval-pack-'));
  mkdirSync(join(packSrc2, 'package', 'dist'), { recursive: true });
  writeFileSync(
    join(packSrc2, 'package', 'package.json'),
    JSON.stringify({
      name: NAME,
      version: VERSION,
      type: 'module',
      exports: { '.': './dist/index.js', './evaluate': { import: './dist/evaluate.js' } },
    })
  );
  writeFileSync(join(packSrc2, 'package', 'dist', 'index.js'), 'export const a = 1;\n');
  writeFileSync(join(packSrc2, 'package', 'dist', 'evaluate.js'), boom);
  execFileSync('tar', [
    '-czf',
    join(evaluateFixture.registryDir, 'mathts-fake-a-1.2.3.tgz'),
    '-C',
    packSrc2,
    '.',
  ]);
  rmSync(packSrc2, { recursive: true, force: true });
  try {
    const { failures } = await runFixture(evaluateFixture);
    assert.equal(
      failures.length,
      1,
      'a non-worker subpath that fails to import on both sides is not a worker skip: ' +
        JSON.stringify(failures)
    );
    assert.match(failures[0], /\.\/evaluate/);
  } finally {
    evaluateFixture.dispose();
  }
});

test('one-sided import failure is reported even on a worker subpath', async () => {
  const fixture = makeFixture({
    built: ['a'],
    published: ['a'],
    builtExports: { '.': './dist/index.js', './worker': { import: './dist/worker.js' } },
    publishedExports: { '.': './dist/index.js', './worker': { import: './dist/worker.js' } },
    builtSub: { worker: ['w'] },
    publishedSub: { worker: [] },
  });
  writeFileSync(
    join(fixture.root, 'fake-a', 'dist', 'worker.js'),
    'throw new Error("built worker boom")\n'
  );
  const packSrc = mkdtempSync(join(tmpdir(), 'g21-oneside-pack-'));
  mkdirSync(join(packSrc, 'package', 'dist'), { recursive: true });
  writeFileSync(
    join(packSrc, 'package', 'package.json'),
    JSON.stringify({
      name: NAME,
      version: VERSION,
      type: 'module',
      exports: { '.': './dist/index.js', './worker': { import: './dist/worker.js' } },
    })
  );
  writeFileSync(join(packSrc, 'package', 'dist', 'index.js'), 'export const a = 1;\n');
  writeFileSync(join(packSrc, 'package', 'dist', 'worker.js'), 'export const w = 1;\n');
  execFileSync('tar', [
    '-czf',
    join(fixture.registryDir, 'mathts-fake-a-1.2.3.tgz'),
    '-C',
    packSrc,
    '.',
  ]);
  rmSync(packSrc, { recursive: true, force: true });
  try {
    const { failures } = await runFixture(fixture);
    assert.equal(
      failures.length,
      1,
      `only the built worker failed; must report, not skip: ${JSON.stringify(failures)}`
    );
    assert.match(failures[0], /failed to import built entry/);
  } finally {
    fixture.dispose();
  }
});

test('compared === 0 fails when any skip is not a registry miss', async () => {
  const root = mkdtempSync(join(tmpdir(), 'g21-mixed-skip-'));
  const registryDir = mkdtempSync(join(tmpdir(), 'g21-mixed-skip-reg-'));
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ workspaces: ['no-dist', 'unpublished'] })
  );
  mkdirSync(join(root, '.changeset'));
  mkdirSync(join(root, 'no-dist'));
  writeFileSync(
    join(root, 'no-dist', 'package.json'),
    JSON.stringify({
      name: '@danielsimonjr/mathts-no-dist',
      version: VERSION,
      type: 'module',
      exports: './dist/index.js',
    })
  );
  mkdirSync(join(root, 'unpublished', 'dist'), { recursive: true });
  writeFileSync(
    join(root, 'unpublished', 'package.json'),
    JSON.stringify({
      name: '@danielsimonjr/mathts-unpublished',
      version: VERSION,
      type: 'module',
      exports: './dist/index.js',
    })
  );
  writeFileSync(join(root, 'unpublished', 'dist', 'index.js'), 'export const a = 1;\n');
  process.env.CHECK_SURFACE_OFFLINE = '1';
  process.env.CHECK_SURFACE_REGISTRY_DIR = registryDir;
  try {
    const { failures, compared } = await run(root);
    assert.equal(compared, 0);
    assert.ok(
      failures.length > 0,
      'one registry-unavailable skip must not hide a "no built entry" skip when nothing compared: ' +
        JSON.stringify(failures)
    );
  } finally {
    delete process.env.CHECK_SURFACE_OFFLINE;
    delete process.env.CHECK_SURFACE_REGISTRY_DIR;
    rmSync(root, { recursive: true, force: true });
    rmSync(registryDir, { recursive: true, force: true });
  }
});

test('extractChangesetFrontmatter handles CRLF, quotes, comments, empty, and prose', () => {
  assert.equal(
    extractChangesetFrontmatter("---\r\n'@danielsimonjr/mathts-core': patch\r\n---\r\n\nbody\r\n"),
    "'@danielsimonjr/mathts-core': patch"
  );
  assert.equal(
    extractChangesetFrontmatter('---\n"@danielsimonjr/mathts-core": minor\n---\n\n'),
    '"@danielsimonjr/mathts-core": minor'
  );
  const withComment = extractChangesetFrontmatter(
    "---\n# not a package\n'@danielsimonjr/mathts-functions': patch\n---\n"
  );
  assert.equal(withComment, "# not a package\n'@danielsimonjr/mathts-functions': patch");
  assert.equal(extractChangesetFrontmatter('---\n---\n\nempty frontmatter\n'), '');
  assert.equal(
    extractChangesetFrontmatter('No frontmatter, just a note about @danielsimonjr/mathts-core.\n'),
    null
  );

  const root = mkdtempSync(join(tmpdir(), 'g21-fm-names-'));
  mkdirSync(join(root, '.changeset'));
  writeFileSync(
    join(root, '.changeset', 'quoted.md'),
    '---\r\n"@danielsimonjr/mathts-core": patch\r\n---\r\n\nbody\n'
  );
  writeFileSync(
    join(root, '.changeset', 'unquoted.md'),
    '---\nmathts-functions: minor\n---\n\nbody\n'
  );
  writeFileSync(join(root, '.changeset', 'empty.md'), '---\n---\n\nempty\n');
  writeFileSync(join(root, '.changeset', 'prose.md'), 'mentions @danielsimonjr/mathts-compat\n');
  try {
    const names = changesetNames(root);
    assert.ok(names.has('@danielsimonjr/mathts-core'), [...names].join(','));
    assert.ok(names.has('@danielsimonjr/mathts-functions'), [...names].join(','));
    assert.equal(names.has('@danielsimonjr/mathts-compat'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('README.md in .changeset/ never exempts anything (property held)', async () => {
  const fixture = makeFixture({ built: ['a', 'b'], published: ['a'], changesets: [] });
  writeFileSync(
    join(fixture.root, '.changeset', 'README.md'),
    "---\n'@danielsimonjr/mathts-fake-a': patch\n---\n\nx\n"
  );
  try {
    const { failures } = await runFixture(fixture);
    assert.equal(failures.length, 1, 'the .changeset/README.md is not a pending changeset');
  } finally {
    fixture.dispose();
  }
});
