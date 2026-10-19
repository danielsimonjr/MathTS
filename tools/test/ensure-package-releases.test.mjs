// Tests for .github/scripts/ensure-package-releases.sh and its workflow.
//
// Each test builds a throwaway git repo (a bare `origin`, a workspace with two public packages
// and one private package) and runs the REAL release script in it, with the repo's own pinned
// changesets CLI. Only `bunx` and `gh` are replaced by shims on PATH: `bunx` runs the pinned CLI
// from node_modules (no registry, no download), and `gh` keeps a state file, so "a rerun opens no
// second release" is a fact and not an absent call. "Nothing was pushed" is read from the refs of
// the bare origin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const releaseScript = join(repoRoot, '.github', 'scripts', 'ensure-package-releases.sh');
const targetCheck = join(repoRoot, '.github', 'scripts', 'check-new-tag-targets.mjs');
const releaseWorkflow = join(repoRoot, '.github', 'workflows', 'release.yml');
const changesetBin = join(repoRoot, 'node_modules', '@changesets', 'cli', 'bin.js');

const BOT = {
  name: 'github-actions[bot]',
  email: '41898282+github-actions[bot]@users.noreply.github.com',
};
const PERSON = { name: 'a-person', email: 'person@example.invalid' };

const A_TAG = (version) => `@fixture/a@${version}`;
const BASELINE_TAGS = [A_TAG('1.0.0'), '@fixture/b@2.0.0'];

const CHANGESET_CONFIG = {
  changelog: false,
  commit: false,
  fixed: [],
  linked: [],
  access: 'public',
  baseBranch: 'main',
  updateInternalDependencies: 'patch',
  ignore: [],
};

const BUNX_SHIM = `#!/usr/bin/env bash
# Stands in for \`bunx\`: runs the pinned changesets CLI. FAKE_WRONG_TAG makes it cut a tag that
# names a version which HEAD does not hold, the fault the release script must catch.
set -euo pipefail
[ "\${1:-}" = changeset ] || { echo "unexpected bunx $*" >&2; exit 97; }
shift
if [ -n "\${FAKE_WRONG_TAG:-}" ]; then
  git tag -a '@fixture/a@1.0.9' -m 'wrong tag' HEAD
  exit 0
fi
exec node "\${CHANGESET_BIN}" "$@"
`;

const GH_SHIM = `#!/usr/bin/env bash
# Stands in for \`gh\`: a release exists once \`release create\` has recorded it in GH_STATE.
set -euo pipefail
touch "\${GH_STATE}"
case "\${1:-} \${2:-}" in
  "release view") grep -qxF "release:\${3}" "\${GH_STATE}" ;;
  "release create") echo "release:\${3}" >> "\${GH_STATE}"; echo "create \${3}" >> "\${GH_STATE}.calls" ;;
  *) echo "unexpected gh $*" >&2; exit 96 ;;
esac
`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  return result;
}

/** One throwaway repo plus the helpers that act on it. Removed when the test ends. */
function makeFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'release-fixture-'));
  t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 3 }));

  const fixture = {
    root,
    origin: join(root, 'origin.git'),
    work: join(root, 'work'),
    shims: join(root, 'shims'),
    ghState: join(root, 'gh-state.txt'),
    // An empty global config and no system config: the fixture must not inherit hooks, signing or
    // line-ending rules from the machine that runs the test.
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: join(root, 'empty-gitconfig'),
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_TERMINAL_PROMPT: '0',
    },
  };
  writeFileSync(fixture.env.GIT_CONFIG_GLOBAL, '');

  const write = (relative, content) => {
    const file = join(fixture.work, relative);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`
    );
  };
  fixture.write = write;
  const as = (who) => ({
    ...fixture.env,
    GIT_AUTHOR_NAME: who.name,
    GIT_AUTHOR_EMAIL: who.email,
    GIT_COMMITTER_NAME: who.name,
    GIT_COMMITTER_EMAIL: who.email,
  });
  fixture.git = (cwd, args, who = PERSON) => {
    const result = run('git', args, { cwd, env: as(who) });
    assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
    return result.stdout.trim();
  };
  fixture.commit = (message) => {
    fixture.git(fixture.work, ['add', '-A']);
    fixture.git(fixture.work, ['commit', '-q', '-m', message]);
    return fixture.git(fixture.work, ['rev-parse', 'HEAD']);
  };
  fixture.tagAs = (who, tag, ref = 'HEAD') =>
    fixture.git(fixture.work, ['tag', '-a', tag, '-m', tag, ref], who);
  fixture.changesetVersion = () => {
    const result = run('node', [changesetBin, 'version'], { cwd: fixture.work, env: fixture.env });
    assert.equal(result.status, 0, `changeset version failed: ${result.stdout}${result.stderr}`);
  };
  fixture.addChangeset = (file, name) =>
    write(`.changeset/${file}`, `---\n'${name}': patch\n---\n\nA change to ${name}.\n`);
  fixture.remoteTags = () =>
    fixture
      .git(fixture.origin, ['for-each-ref', '--format=%(refname:strip=2)', 'refs/tags'])
      .split('\n')
      .filter(Boolean)
      .sort();
  fixture.remoteTagCommit = (tag) =>
    fixture.git(fixture.origin, ['rev-parse', `refs/tags/${tag}^{commit}`]);
  fixture.releases = () =>
    existsSync(`${fixture.ghState}.calls`)
      ? readFileSync(`${fixture.ghState}.calls`, 'utf8').split('\n').filter(Boolean)
      : [];

  fixture.git(root, ['init', '-q', '--bare', '-b', 'main', fixture.origin]);
  fixture.git(root, ['init', '-q', '-b', 'main', fixture.work]);
  fixture.git(fixture.work, ['remote', 'add', 'origin', fixture.origin]);
  write('package.json', { name: 'fixture', private: true, workspaces: ['packages/*'] });
  // The changesets CLI finds a Bun workspace only when the root holds a Bun lock file, as the real repo does.
  write('bun.lock', '');
  write('.changeset/config.json', CHANGESET_CONFIG);
  write('packages/a/package.json', { name: '@fixture/a', version: '1.0.0' });
  write('packages/b/package.json', { name: '@fixture/b', version: '2.0.0' });
  write('packages/c/package.json', { name: '@fixture/c', version: '0.0.1', private: true });
  fixture.initial = fixture.commit('chore: initial');
  for (const tag of BASELINE_TAGS) fixture.tagAs(BOT, tag);
  fixture.git(fixture.work, ['push', '-q', 'origin', 'main', '--tags']);
  // The baseline tags already have releases, as the real ones do.
  writeFileSync(fixture.ghState, `${BASELINE_TAGS.map((tag) => `release:${tag}`).join('\n')}\n`);

  fixture.runRelease = (beforeSha, extraEnv = {}) => {
    mkdirSync(fixture.shims, { recursive: true });
    for (const [name, body] of [
      ['bunx', BUNX_SHIM],
      ['gh', GH_SHIM],
    ]) {
      writeFileSync(join(fixture.shims, name), body);
      chmodSync(join(fixture.shims, name), 0o755);
    }
    const output = join(root, 'github-output.txt');
    writeFileSync(output, '');
    const result = run('bash', [releaseScript], {
      cwd: fixture.work,
      env: {
        ...fixture.env,
        ...extraEnv,
        PATH: `${fixture.shims}${delimiter}${process.env.PATH}`,
        CHANGESET_BIN: changesetBin,
        GH_STATE: fixture.ghState,
        GH_REPO: 'fixture/repo',
        GH_TOKEN: 'unused',
        BEFORE_SHA: beforeSha,
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: join(root, 'summary.md'),
      },
    });
    return { ...result, githubOutput: readFileSync(output, 'utf8') };
  };
  return fixture;
}

/** Commits a pending changeset for package a on top of the initial commit. */
function pushWithPendingChangeset(fixture) {
  fixture.addChangeset('x.md', '@fixture/a');
  return fixture.commit('feat(a): a change that needs a release');
}

const failure = (result) =>
  `exit ${result.status}\n--- stdout\n${result.stdout}\n--- stderr\n${result.stderr}`;

test('prerequisite: Node can run the pinned changesets CLI, and the CLI is the major the lock file pins', (t) => {
  const [major, minor] = process.versions.node.split('.').map(Number);
  assert.ok(
    major > 22 || (major === 22 && minor >= 11),
    `the changesets CLI needs Node 22.11 or later, this is ${process.version}`
  );
  assert.ok(
    existsSync(changesetBin),
    'node_modules/@changesets/cli is missing: run `bun install` first'
  );
  const cli = JSON.parse(readFileSync(join(dirname(changesetBin), 'package.json'), 'utf8'));
  const range = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).devDependencies[
    '@changesets/cli'
  ];
  assert.equal(cli.name, '@changesets/cli');
  assert.equal(cli.version.split('.')[0], range.replace(/^[^\d]*/, '').split('.')[0]);
  t.diagnostic(`changesets CLI ${cli.version} on Node ${process.version}`);
});

test('a push with a pending changeset creates no tag and no release', (t) => {
  const fixture = makeFixture(t);
  pushWithPendingChangeset(fixture);

  const result = fixture.runRelease(fixture.initial);

  assert.equal(result.status, 0, failure(result));
  assert.deepEqual(fixture.remoteTags(), BASELINE_TAGS.slice().sort());
  assert.deepEqual(fixture.releases(), []);
  assert.match(result.githubOutput, /^versions_bumped=false$/m);
  assert.match(result.stdout, /^HEAD=[0-9a-f]{40}$/m);
});

test('the push that merges the version PR tags the version commit and opens the release once', (t) => {
  const fixture = makeFixture(t);
  const feature = pushWithPendingChangeset(fixture);
  fixture.changesetVersion();
  const version = fixture.commit('chore: release packages');

  const first = fixture.runRelease(feature);

  assert.equal(first.status, 0, failure(first));
  assert.deepEqual(fixture.remoteTags(), [...BASELINE_TAGS, A_TAG('1.0.1')].sort());
  assert.equal(fixture.remoteTagCommit(A_TAG('1.0.1')), version);
  assert.equal(
    fixture.git(fixture.origin, [
      'for-each-ref',
      '--format=%(taggeremail)',
      `refs/tags/${A_TAG('1.0.1')}`,
    ]),
    `<${BOT.email}>`
  );
  assert.deepEqual(fixture.releases(), [`create ${A_TAG('1.0.1')}`]);
  assert.match(first.githubOutput, /^versions_bumped=true$/m);
  assert.match(
    first.stdout,
    /Tag @fixture\/a@1\.0\.1 targets [0-9a-f]{8}, where packages\/a\/package\.json holds 1\.0\.1\./
  );

  const second = fixture.runRelease(feature);

  assert.equal(second.status, 0, failure(second));
  assert.deepEqual(fixture.releases(), [`create ${A_TAG('1.0.1')}`]);
  assert.match(second.stdout, /GitHub release @fixture\/a@1\.0\.1 already exists\./);
  assert.deepEqual(fixture.remoteTags(), [...BASELINE_TAGS, A_TAG('1.0.1')].sort());
});

test('a version commit that still carries a pending changeset is tagged all the same', (t) => {
  const fixture = makeFixture(t);
  const feature = pushWithPendingChangeset(fixture);
  fixture.changesetVersion();
  // Another changeset reached main after the version PR was last refreshed, so the merge brings it in.
  fixture.addChangeset('y.md', '@fixture/b');
  const version = fixture.commit('chore: release packages');

  const result = fixture.runRelease(feature);

  assert.equal(result.status, 0, failure(result));
  assert.equal(fixture.remoteTagCommit(A_TAG('1.0.1')), version);
  assert.deepEqual(fixture.remoteTags(), [...BASELINE_TAGS, A_TAG('1.0.1')].sort());
  assert.deepEqual(fixture.releases(), [`create ${A_TAG('1.0.1')}`]);
});

test('a version that an earlier run never tagged goes on the commit that set it, not on HEAD', (t) => {
  const fixture = makeFixture(t);
  pushWithPendingChangeset(fixture);
  fixture.changesetVersion();
  const version = fixture.commit('chore: release packages');
  // The run for the version commit was cancelled (GitHub drops an older pending run of the same
  // concurrency group). The next push is an ordinary commit, and BEFORE_SHA is the version commit.
  fixture.write('notes.md', 'an ordinary later commit\n');
  const later = fixture.commit('docs: a later commit');
  assert.notEqual(later, version);

  const result = fixture.runRelease(version);

  assert.equal(result.status, 0, failure(result));
  assert.equal(fixture.remoteTagCommit(A_TAG('1.0.1')), version);
  assert.match(
    result.stdout,
    /Tag @fixture\/a@1\.0\.1: moving the new tag from [0-9a-f]{7,} to [0-9a-f]{8}, the commit that set 1\.0\.1\./
  );
  assert.deepEqual(fixture.remoteTags(), [...BASELINE_TAGS, A_TAG('1.0.1')].sort());
  assert.deepEqual(fixture.releases(), [`create ${A_TAG('1.0.1')}`]);
  // Written down, not fixed here: this push did not change a version, so versions_bumped is false
  // and the workflow does not call Publish. The tag and the release exist; npm needs Publish run by
  // hand (workflow_dispatch) for that version.
  assert.match(result.githubOutput, /^versions_bumped=false$/m);
});

test('a working tree whose versions are not committed is refused before any tag exists', (t) => {
  const fixture = makeFixture(t);
  const feature = pushWithPendingChangeset(fixture);
  fixture.changesetVersion(); // what the changesets action leaves behind: bumped, not committed

  const result = fixture.runRelease(feature);

  assert.notEqual(result.status, 0, failure(result));
  assert.match(result.stdout, /A package\.json differs from HEAD/);
  assert.deepEqual(fixture.remoteTags(), BASELINE_TAGS.slice().sort());
  assert.deepEqual(fixture.git(fixture.work, ['tag', '-l', A_TAG('1.0.1')]), '');
  assert.deepEqual(fixture.releases(), []);
});

test('a new tag whose version its commit does not hold stops the script before anything is pushed', (t) => {
  const fixture = makeFixture(t);
  const feature = pushWithPendingChangeset(fixture);
  fixture.changesetVersion();
  fixture.commit('chore: release packages');

  const result = fixture.runRelease(feature, { FAKE_WRONG_TAG: '1' });

  assert.notEqual(result.status, 0, failure(result));
  assert.match(
    result.stderr + result.stdout,
    /Tag @fixture\/a@1\.0\.9 targets [0-9a-f]{8}, where packages\/a\/package\.json holds 1\.0\.1\./
  );
  assert.deepEqual(fixture.remoteTags(), BASELINE_TAGS.slice().sort());
  assert.deepEqual(fixture.releases(), []);
});

test('check-new-tag-targets: a tag on the commit that holds its version passes, a tag on the commit before fails', (t) => {
  const fixture = makeFixture(t);
  const feature = pushWithPendingChangeset(fixture);
  fixture.changesetVersion();
  fixture.commit('chore: release packages');
  fixture.tagAs(BOT, '@fixture/a@1.0.1'); // on the version commit: right
  fixture.tagAs(BOT, '@fixture/b@9.9.9', feature); // names a version the commit does not hold: wrong
  const packages = join(fixture.root, 'packages.tsv');
  const tags = join(fixture.root, 'new-tags.txt');
  writeFileSync(packages, '@fixture/a\t1.0.1\tpackages/a\n@fixture/b\t2.0.0\tpackages\\b\n');
  const checkTargets = () =>
    run('node', [targetCheck, packages, tags], { cwd: fixture.work, env: fixture.env });

  writeFileSync(tags, '@fixture/a@1.0.1\n');
  const right = checkTargets();
  assert.equal(right.status, 0, failure(right));
  assert.match(right.stdout, /Checked 1 new tag\(s\)\./);

  writeFileSync(tags, '@fixture/a@1.0.1\n@fixture/b@9.9.9\n');
  const wrong = checkTargets();
  assert.equal(wrong.status, 1, failure(wrong));
  assert.match(
    wrong.stderr,
    /Tag @fixture\/b@9\.9\.9 targets [0-9a-f]{8}, where packages\/b\/package\.json holds 2\.0\.0\./
  );

  writeFileSync(tags, '@fixture/unknown@1.0.0\n');
  const unknown = checkTargets();
  assert.equal(unknown.status, 1, failure(unknown));
  assert.match(unknown.stderr, /names no public workspace package/);
});

test('release.yml runs the tag step before the changesets action', () => {
  const workflow = readFileSync(releaseWorkflow, 'utf8');
  // Only step keys of the `release` job count: a comment or another job that names an id does not.
  const job = workflow.match(/^ {2}release:\n(?:(?! {2}\S).*\n?)*/m)?.[0];
  assert.ok(job, 'the release job is missing');
  const tagStep = job.search(/^ {8}id: tags\s*$/m);
  const actionStep = job.search(/^ {8}id: changesets\s*$/m);
  assert.ok(tagStep > 0, 'the tag step (id: tags) is missing from the release job');
  assert.ok(
    actionStep > 0,
    'the changesets action step (id: changesets) is missing from the release job'
  );
  assert.ok(
    tagStep < actionStep,
    'the tag step must come first: the action leaves uncommitted versions in the working tree'
  );
  assert.match(
    job.slice(tagStep, actionStep),
    /run: bash \.github\/scripts\/ensure-package-releases\.sh/,
    'the step before the action must be the release script'
  );
});
