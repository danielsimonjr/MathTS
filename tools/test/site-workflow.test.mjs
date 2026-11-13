/**
 * Tests of the Site workflow (.github/workflows/site.yml).
 *
 * Part 1 reads the workflow and pins its structure: triggers, the dispatch guard,
 * permissions, the order of the deploy steps, and the call chain from release.yml.
 * Part 2 runs the `run:` text of the deploy steps in bash, against a local bare
 * repository and stub `npm` and `curl` programs, so each check is shown to fail on bad input.
 *
 * The bash tests need a POSIX bash. On Windows they need Git Bash (MSYS), not WSL bash.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { load } from 'js-yaml';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOWS = join(REPO, '.github', 'workflows');
const read = (name) => load(readFileSync(join(WORKFLOWS, name), 'utf8'));

const site = read('site.yml');
const publish = read('publish.yml');
const release = read('release.yml');

const GUARD =
  "github.event_name != 'workflow_dispatch' || github.ref == format('refs/heads/{0}', github.event.repository.default_branch)";

const stepIndex = (job, name) => site.jobs[job].steps.findIndex((s) => s.name === name);
function runOf(job, name) {
  const found = site.jobs[job].steps.find((s) => s.name === name);
  assert.ok(found, `no step named "${name}" in job ${job}`);
  assert.equal(typeof found.run, 'string', `step "${name}" has no run text`);
  return found.run;
}

const ALLOW = 'Accept only the allowed files';
const NPM = 'Check the site version is the version on npm';
const PUSH = 'Copy the site onto gh-pages and push';
const LIVE = 'Check the live site';

// ---------------------------------------------------------------------------
// Part 1: structure
// ---------------------------------------------------------------------------

test('site.yml triggers only by call and by dispatch, never by push', () => {
  assert.deepEqual(Object.keys(site.on).sort(), ['workflow_call', 'workflow_dispatch']);
});

test('both jobs run a dispatch only on the default branch, and a call on every event', () => {
  assert.equal(site.jobs.build.if, GUARD);
  assert.equal(site.jobs.deploy.if, GUARD);
  // The guard has the dispatch case only. A release or push call (a tag ref, a branch ref)
  // passes through the first operand.
  assert.match(GUARD, /^github\.event_name != 'workflow_dispatch' \|\|/);
});

test('only the deploy job can write, and it runs no repository code', () => {
  assert.deepEqual(site.permissions, { contents: 'read' });
  assert.equal(site.jobs.build.permissions, undefined);
  assert.deepEqual(site.jobs.deploy.permissions, { contents: 'write' });
  const uses = site.jobs.deploy.steps.map((s) => s.uses ?? '');
  assert.ok(
    uses.filter((u) => u.startsWith('actions/checkout')).length === 1,
    'deploy checks out gh-pages only'
  );
  const checkout = site.jobs.deploy.steps.find((s) =>
    (s.uses ?? '').startsWith('actions/checkout')
  );
  assert.equal(checkout.with.ref, 'gh-pages');
  for (const s of site.jobs.deploy.steps) {
    assert.doesNotMatch(
      s.run ?? '',
      /\bbun\b|\bnode\b|npm (ci|install|run)/,
      `deploy step "${s.name}"`
    );
  }
});

test('no run block interpolates an expression', () => {
  for (const [jobName, job] of Object.entries(site.jobs)) {
    for (const s of job.steps) {
      assert.doesNotMatch(
        s.run ?? '',
        /\$\{\{/,
        `${jobName}: "${s.name}" has an expression in run`
      );
    }
  }
});

test('every action is pinned to a full commit SHA', () => {
  for (const job of Object.values(site.jobs)) {
    for (const s of job.steps) {
      if (s.uses) assert.match(s.uses, /@[0-9a-f]{40}$/, s.uses);
    }
  }
});

test('the deploy checks come in order: allowlist, npm version, push, live site', () => {
  const order = [ALLOW, NPM, PUSH, LIVE].map((n) => stepIndex('deploy', n));
  assert.ok(
    order.every((i) => i >= 0),
    `a step is missing: ${order}`
  );
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order
  );
  assert.ok(stepIndex('deploy', 'Download the site') < order[0]);
});

test('the wait bounds and the site URL are workflow settings, not literals in the steps', () => {
  assert.match(site.env.SITE_URL, /^https:\/\//);
  assert.match(site.env.WAIT_ATTEMPTS, /^\d+$/);
  assert.match(site.env.WAIT_SECONDS, /^\d+$/);
  for (const s of site.jobs.deploy.steps) {
    assert.doesNotMatch(s.run ?? '', /danielsimonjr\.com/, `"${s.name}" holds the site URL`);
  }
});

test('release.yml grants the write that publish.yml passes to the site job', () => {
  assert.deepEqual(release.jobs.publish.permissions, { contents: 'write' });
  assert.equal(release.jobs.publish.uses, './.github/workflows/publish.yml');
  assert.deepEqual(publish.jobs.publish.permissions, { contents: 'read' });
  assert.deepEqual(publish.jobs.site.permissions, { contents: 'write' });
  assert.equal(publish.jobs.site.uses, './.github/workflows/site.yml');
  assert.equal(publish.jobs.site.needs, 'publish');
});

// ---------------------------------------------------------------------------
// Part 2: the deploy steps in bash
// ---------------------------------------------------------------------------

/** A POSIX bash, or null (Windows without Git Bash, where `bash` may be WSL). */
function findBash() {
  const probe = spawnSync('bash', ['-c', 'uname -s'], { encoding: 'utf8' });
  if (probe.status !== 0) return null;
  const kernel = probe.stdout.trim();
  if (process.platform === 'win32') return /^(MINGW|MSYS|CYGWIN)/.test(kernel) ? 'bash' : null;
  return 'bash';
}
const BASH = findBash();
const bashTest = (name, fn) =>
  test(name, { skip: BASH ? false : 'needs a POSIX bash (Git Bash on Windows)' }, fn);

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'site-wf-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  return { dir, bin, done: () => rmSync(dir, { recursive: true, force: true }) };
}

function writeStub(bin, name, body) {
  const file = join(bin, name);
  writeFileSync(file, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(file, 0o755);
}

// Windows names the variable `Path`. A second key `PATH` in one environment is ambiguous.
const PATH_KEY = Object.keys(process.env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';

/** Run the text of one workflow step, as GitHub runs it: `bash -e` on a script file. */
function runStep(sb, text, env = {}) {
  const script = join(sb.dir, `step-${Math.random().toString(36).slice(2)}.sh`);
  writeFileSync(script, text);
  return spawnSync(BASH, ['--noprofile', '--norc', '-e', script], {
    cwd: sb.dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      [PATH_KEY]: `${sb.bin}${delimiter}${process.env[PATH_KEY]}`,
      WAIT_ATTEMPTS: '3',
      WAIT_SECONDS: '0',
      GITHUB_SHA: '0123456789abcdef0123456789abcdef01234567',
      GITHUB_RUN_ID: '42',
      ...env,
    },
  });
}

const PAGE = (v) => `<html><body><div class="stat-value">v${v}</div></body></html>\n`;
const API = '<html><head><title>MathTS API Index</title></head><body></body></html>\n';

/** Lay out a site artifact in <dir>/site-out. */
function writeSite(dir, { version = '1.2.3', extra = {} } = {}) {
  const root = join(dir, 'site-out');
  mkdirSync(join(root, 'functions'), { recursive: true });
  mkdirSync(join(root, 'api'));
  writeFileSync(join(root, 'index.html'), PAGE(version));
  writeFileSync(join(root, 'api', 'index.html'), API);
  writeFileSync(join(root, 'functions', 'algebra.html'), '<html></html>\n');
  writeFileSync(join(root, 'functions', 'type-checking-and-utilities.html'), '<html></html>\n');
  for (const [rel, body] of Object.entries(extra)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return root;
}

bashTest('allowlist: accepts the three kinds of file', () => {
  const sb = sandbox();
  try {
    writeSite(sb.dir);
    const r = runStep(sb, runOf('deploy', ALLOW));
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    sb.done();
  }
});

for (const [label, rel, pattern] of [
  ['a script at the top', 'evil.js', /unexpected file: \.\/evil\.js/],
  ['a workflow file', '.github/workflows/x.yml', /unexpected directory: \.\/\.github/],
  ['a CNAME', 'CNAME', /unexpected file: \.\/CNAME/],
  ['a script in functions', 'functions/run.js', /unexpected file: \.\/functions\/run\.js/],
  ['a nested page', 'functions/deep/page.html', /unexpected directory: \.\/functions\/deep/],
  // Not "Algebra.html": on a case-insensitive disk that name is the page that is already there.
  ['an upper-case slug', 'functions/Zeta.html', /unexpected file: \.\/functions\/Zeta\.html/],
  ['a second api file', 'api/extra.html', /unexpected file: \.\/api\/extra\.html/],
]) {
  bashTest(`allowlist: rejects ${label}`, () => {
    const sb = sandbox();
    try {
      writeSite(sb.dir, { extra: { [rel]: 'x' } });
      const r = runStep(sb, runOf('deploy', ALLOW));
      assert.notEqual(r.status, 0, 'a rogue file must fail the step');
      assert.match(r.stdout + r.stderr, pattern);
    } finally {
      sb.done();
    }
  });
}

bashTest('allowlist: rejects a link', (t) => {
  const sb = sandbox();
  try {
    const root = writeSite(sb.dir);
    try {
      symlinkSync(join(root, 'index.html'), join(root, 'functions', 'link.html'));
    } catch (err) {
      t.skip(`cannot create a symlink here: ${err.code}`);
      return;
    }
    const r = runStep(sb, runOf('deploy', ALLOW));
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /link in the site artifact|unexpected/);
  } finally {
    sb.done();
  }
});

bashTest('allowlist: rejects a site without the API index or without a function page', () => {
  for (const [rel, pattern] of [
    ['api/index.html', /index\.html or api\/index\.html is missing/],
    ['functions/algebra.html', /no function page|unexpected/],
  ]) {
    const sb = sandbox();
    try {
      const root = writeSite(sb.dir);
      rmSync(join(root, rel));
      if (rel.startsWith('functions/'))
        rmSync(join(root, 'functions', 'type-checking-and-utilities.html'));
      const r = runStep(sb, runOf('deploy', ALLOW));
      assert.notEqual(r.status, 0, `${rel} removed`);
      assert.match(r.stdout + r.stderr, pattern);
    } finally {
      sb.done();
    }
  }
});

/** A stub npm that answers `view` from a list: one answer per call, the last one repeats. */
function stubNpm(sb, answers) {
  writeFileSync(join(sb.dir, 'npm-answers'), answers.join('\n'));
  writeStub(
    sb.bin,
    'npm',
    [
      'n=$(cat "${NPM_COUNTER}" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "${NPM_COUNTER}"',
      'line=$(sed -n "${n}p" "${NPM_ANSWERS}"); [ -n "$line" ] || line=$(tail -n 1 "${NPM_ANSWERS}")',
      '[ "$line" = "FAIL" ] && exit 1',
      'echo "$line"',
    ].join('\n')
  );
  return { NPM_ANSWERS: join(sb.dir, 'npm-answers'), NPM_COUNTER: join(sb.dir, 'npm-counter') };
}
const calls = (sb) => Number(readFileSync(join(sb.dir, 'npm-counter'), 'utf8'));
const ID = { SITE_PACKAGE: '@scope/pkg', SITE_VERSION: '1.2.3' };

bashTest('npm check: passes when npm has the site version', () => {
  const sb = sandbox();
  try {
    writeSite(sb.dir);
    const r = runStep(sb, runOf('deploy', NPM), { ...ID, ...stubNpm(sb, ['1.2.3']) });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(calls(sb), 1);
  } finally {
    sb.done();
  }
});

bashTest('npm check: waits through registry lag, then passes', () => {
  const sb = sandbox();
  try {
    writeSite(sb.dir);
    const r = runStep(sb, runOf('deploy', NPM), {
      ...ID,
      ...stubNpm(sb, ['1.2.2', 'FAIL', '1.2.3']),
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(calls(sb), 3);
  } finally {
    sb.done();
  }
});

bashTest('npm check: fails after the bounded tries when the site is ahead of npm', () => {
  const sb = sandbox();
  try {
    writeSite(sb.dir);
    const r = runStep(sb, runOf('deploy', NPM), { ...ID, ...stubNpm(sb, ['1.2.2']) });
    assert.notEqual(r.status, 0);
    assert.equal(calls(sb), 3, 'exactly WAIT_ATTEMPTS tries');
    assert.match(r.stdout + r.stderr, /latest version of @scope\/pkg on npm is '1\.2\.2'/);
  } finally {
    sb.done();
  }
});

bashTest(
  'npm check: fails when npm is ahead of the site, and when the registry is unreadable',
  () => {
    for (const answer of ['1.3.0', 'FAIL']) {
      const sb = sandbox();
      try {
        writeSite(sb.dir);
        const r = runStep(sb, runOf('deploy', NPM), { ...ID, ...stubNpm(sb, [answer]) });
        assert.notEqual(r.status, 0, answer);
      } finally {
        sb.done();
      }
    }
  }
);

bashTest('npm check: fails when the artifact does not show the version of the build', () => {
  const sb = sandbox();
  try {
    writeSite(sb.dir, { version: '1.2.2' });
    const r = runStep(sb, runOf('deploy', NPM), { ...ID, ...stubNpm(sb, ['1.2.3']) });
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /does not show v1\.2\.3/);
  } finally {
    sb.done();
  }
});

bashTest('npm check: refuses a version or a package name that is not well formed', () => {
  for (const bad of [
    { SITE_VERSION: '1.2.3; echo pwned' },
    { SITE_VERSION: '' },
    { SITE_PACKAGE: '@scope/pkg; echo pwned' },
    { SITE_PACKAGE: '' },
  ]) {
    const sb = sandbox();
    try {
      writeSite(sb.dir);
      const r = runStep(sb, runOf('deploy', NPM), { ...ID, ...bad, ...stubNpm(sb, ['1.2.3']) });
      assert.notEqual(r.status, 0, JSON.stringify(bad));
      assert.match(r.stdout + r.stderr, /bad (version|package name)/);
    } finally {
      sb.done();
    }
  }
});

/** A bare origin with a gh-pages branch, and a checkout of it in <dir>/pages. */
function pagesRepo(sb) {
  const git = (cwd, ...args) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout;
  };
  const origin = join(sb.dir, 'origin.git');
  git(sb.dir, 'init', '--bare', '-q', '-b', 'gh-pages', origin);
  const seed = join(sb.dir, 'seed');
  git(sb.dir, 'clone', '-q', origin, seed);
  git(seed, 'config', 'user.name', 'seed');
  git(seed, 'config', 'user.email', 'seed@example.test');
  git(seed, 'config', 'core.autocrlf', 'false');
  writeFileSync(join(seed, '.nojekyll'), '');
  writeFileSync(join(seed, 'index.html'), 'old\n');
  mkdirSync(join(seed, 'functions'));
  writeFileSync(join(seed, 'functions', 'gone.html'), 'old\n');
  git(seed, 'add', '--all');
  git(seed, 'commit', '-q', '-m', 'seed');
  git(seed, 'push', '-q', 'origin', 'gh-pages');
  git(sb.dir, 'clone', '-q', '--branch', 'gh-pages', origin, join(sb.dir, 'pages'));
  git(join(sb.dir, 'pages'), 'config', 'core.autocrlf', 'false');
  return {
    tree: () =>
      git(sb.dir, '--git-dir', origin, 'ls-tree', '-r', '--name-only', 'gh-pages')
        .trim()
        .split('\n'),
    count: () => Number(git(sb.dir, '--git-dir', origin, 'rev-list', '--count', 'gh-pages').trim()),
  };
}

bashTest('push: replaces the generated paths, keeps .nojekyll, copies only the named files', () => {
  const sb = sandbox();
  try {
    // Files that the allowlist step would reject. The copy step must not carry them either.
    writeSite(sb.dir, { extra: { 'evil.js': 'x', 'functions/run.js': 'x', CNAME: 'x' } });
    const repo = pagesRepo(sb);
    const r = runStep(sb, runOf('deploy', PUSH));
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.deepEqual(repo.tree(), [
      '.nojekyll',
      'api/index.html',
      'functions/algebra.html',
      'functions/type-checking-and-utilities.html',
      'index.html',
    ]);
    assert.equal(repo.count(), 2);
  } finally {
    sb.done();
  }
});

bashTest('push: an unchanged site pushes nothing and succeeds', () => {
  const sb = sandbox();
  try {
    writeSite(sb.dir);
    const repo = pagesRepo(sb);
    assert.equal(runStep(sb, runOf('deploy', PUSH)).status, 0);
    const before = repo.count();
    const again = runStep(sb, runOf('deploy', PUSH));
    assert.equal(again.status, 0, again.stdout + again.stderr);
    assert.match(again.stdout, /nothing to push/);
    assert.equal(repo.count(), before);
  } finally {
    sb.done();
  }
});

bashTest('push: fails when gh-pages moved (the push is not forced)', () => {
  const sb = sandbox();
  try {
    writeSite(sb.dir);
    const repo = pagesRepo(sb);
    // Another writer pushes to gh-pages after the checkout.
    const other = join(sb.dir, 'other');
    const run = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8' });
    run(sb.dir, 'clone', '-q', '--branch', 'gh-pages', join(sb.dir, 'origin.git'), other);
    writeFileSync(join(other, 'other.txt'), 'x');
    run(other, 'add', '--all');
    run(
      other,
      '-c',
      'user.name=o',
      '-c',
      'user.email=o@example.test',
      'commit',
      '-q',
      '-m',
      'other'
    );
    assert.equal(run(other, 'push', '-q', 'origin', 'gh-pages').status, 0);
    const before = repo.count();
    const r = runStep(sb, runOf('deploy', PUSH));
    assert.notEqual(r.status, 0, 'a stale push must fail');
    assert.equal(repo.count(), before, 'nothing was overwritten');
  } finally {
    sb.done();
  }
});

/**
 * A stub curl. It maps the URL path to a file of a "live site" folder. The first
 * `lag` calls answer 404, which stands for a Pages build that is not done yet.
 */
function stubCurl(sb, live, lag) {
  const notFound = 'echo "curl: (22) The requested URL returned error: 404" >&2; exit 22';
  writeStub(
    sb.bin,
    'curl',
    [
      'url="${@: -1}"',
      'n=$(cat "${CURL_COUNTER}" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "${CURL_COUNTER}"',
      `[ "$n" -gt "\${CURL_LAG}" ] || { ${notFound}; }`,
      // Drop the scheme and host, then the query, then the first path segment (the site folder).
      'path="${url#*//*/}"; path="${path%%\\?*}"; path="${path#*/}"',
      'file="${CURL_ROOT}/${path}index.html"',
      `[ -f "$file" ] || { ${notFound}; }`,
      'cat "$file"',
    ].join('\n')
  );
  return { CURL_ROOT: live, CURL_LAG: String(lag), CURL_COUNTER: join(sb.dir, 'curl-counter') };
}
const LIVE_ENV = { SITE_URL: 'https://example.test/MathTS/', ...ID };

function writeLive(sb, { version = '1.2.3', title = 'MathTS API Index', api = true } = {}) {
  const live = join(sb.dir, 'live');
  mkdirSync(join(live, 'api'), { recursive: true });
  writeFileSync(join(live, 'index.html'), PAGE(version));
  if (api) writeFileSync(join(live, 'api', 'index.html'), API.replace('MathTS API Index', title));
  return live;
}

bashTest('live check: passes when the root shows the version and /api/ shows the title', () => {
  const sb = sandbox();
  try {
    writeSite(sb.dir);
    const live = writeLive(sb);
    const r = runStep(sb, runOf('deploy', LIVE), { ...LIVE_ENV, ...stubCurl(sb, live, 0) });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /shows v1\.2\.3 and .*\/api\/ shows 'MathTS API Index'/);
  } finally {
    sb.done();
  }
});

bashTest('live check: waits for the Pages build, within the bound', () => {
  const sb = sandbox();
  try {
    writeSite(sb.dir);
    const live = writeLive(sb);
    // 2 calls per attempt, so a lag of 2 calls is one failed attempt.
    const r = runStep(sb, runOf('deploy', LIVE), { ...LIVE_ENV, ...stubCurl(sb, live, 2) });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Attempt 1 of 3/);
  } finally {
    sb.done();
  }
});

bashTest('live check: fails when the root still shows the old version', () => {
  const sb = sandbox();
  try {
    writeSite(sb.dir);
    const live = writeLive(sb, { version: '1.2.2' });
    const r = runStep(sb, runOf('deploy', LIVE), { ...LIVE_ENV, ...stubCurl(sb, live, 0) });
    assert.notEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /does not show v1\.2\.3/);
    assert.match(r.stdout, /Attempt 3 of 3/);
  } finally {
    sb.done();
  }
});

bashTest('live check: fails when /api/ is missing or has another title', () => {
  for (const options of [{ api: false }, { title: 'Something else' }]) {
    const sb = sandbox();
    try {
      writeSite(sb.dir);
      const live = writeLive(sb, options);
      const r = runStep(sb, runOf('deploy', LIVE), { ...LIVE_ENV, ...stubCurl(sb, live, 0) });
      assert.notEqual(r.status, 0, JSON.stringify(options));
      assert.match(r.stdout + r.stderr, /'MathTS API Index' page at \/api\//);
    } finally {
      sb.done();
    }
  }
});

bashTest('live check: the base URL comes from SITE_URL', () => {
  const sb = sandbox();
  try {
    writeSite(sb.dir);
    const live = writeLive(sb);
    const r = runStep(sb, runOf('deploy', LIVE), {
      ...LIVE_ENV,
      SITE_URL: 'https://other.test/Docs',
      ...stubCurl(sb, live, 0),
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /https:\/\/other\.test\/Docs\/ shows v1\.2\.3/);
  } finally {
    sb.done();
  }
});
