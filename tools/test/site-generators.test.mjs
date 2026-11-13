import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { UNCATEGORIZED, parseReferenceIndex } from '../reference-index.mjs';
import { packageIdentity, repositoryUrl } from '../site-config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const NODE = process.execPath;
const LANDING = join(REPO, 'tools', 'generate-landing-site.mjs');
const API = join(REPO, 'tools', 'generate-api-index.mjs');

const scratch = () => mkdtempSync(join(tmpdir(), 'site-gen-'));

function run(script, args) {
  return spawnSync(NODE, [script, ...args], { cwd: REPO, encoding: 'utf8' });
}

const REFERENCE_TEXT = () => readFileSync(join(REPO, 'docs', 'reference', 'functions.md'), 'utf8');

/** The export count and the category count, counted here without the module under test. */
function countsFromReference(referenceText) {
  const indexText = referenceText.split('## Complete export index')[1] ?? '';
  const exports = indexText.match(/\((\d+) exports\)/);
  assert.ok(exports, 'reference index has no "(N exports)" header');
  const section = indexText.split('### Functions by category')[1]?.split(/\n### /)[0] ?? '';
  const labels = [...section.matchAll(/^\*\*(.+?)\*\* \(\d+\): /gm)].map((m) => m[1]);
  return {
    exports: Number(exports[1]),
    groups: labels.length,
    categories: labels.filter((l) => l !== 'Other exports (uncategorized)').length,
  };
}

const statValue = (html, label) =>
  html.match(
    new RegExp(`<div class="stat-value">([^<]*)</div><div class="stat-label">${label}</div>`)
  )?.[1];

test('landing shows the package version, the export count and the category count', () => {
  const out = scratch();
  try {
    const r = run(LANDING, [`--out=${out}`]);
    assert.equal(r.status, 0, r.stderr);
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    const { version } = packageIdentity(join(REPO, 'functions', 'package.json'));
    const counts = countsFromReference(REFERENCE_TEXT());
    assert.equal(statValue(html, 'functions Version'), `v${version}`);
    assert.equal(statValue(html, 'Exports'), counts.exports.toLocaleString('en-US'));
    assert.equal(statValue(html, 'Categories'), String(counts.categories));
    // One card per group: the categories and the catch-all group.
    assert.equal(html.match(/class="cat-card"/g)?.length, counts.groups);
    assert.doesNotMatch(html, /Tests Passing/, 'the site must not show a test count');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('the landing hero, the README and getting-started give one category count', () => {
  const out = scratch();
  try {
    assert.equal(run(LANDING, [`--out=${out}`]).status, 0);
    const hero = statValue(readFileSync(join(out, 'index.html'), 'utf8'), 'Categories');
    const readme = readFileSync(join(REPO, 'README.md'), 'utf8');
    assert.equal(readme.match(/\*\*[\d,]+ exports\*\* in\n(\d+) categories/)?.[1], hero);
    assert.equal(readme.match(/\| [\d,]+ exports in (\d+) categories;/)?.[1], hero);
    const guide = readFileSync(join(REPO, 'docs', 'getting-started.md'), 'utf8');
    assert.equal(guide.match(/<!-- fn:categories -->(\d+)<!-- \/fn -->/)?.[1], hero);
    const exports = statValue(readFileSync(join(out, 'index.html'), 'utf8'), 'Exports');
    for (const m of guide.matchAll(/<!-- fn:exports -->([\d,]+)<!-- \/fn -->/g)) {
      assert.equal(m[1], exports);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('landing takes its version, count and links from its inputs, not from literals', () => {
  const dir = scratch();
  try {
    const versionFile = join(dir, 'package.json');
    const repoFile = join(dir, 'repo.json');
    const reference = join(dir, 'functions.md');
    writeFileSync(versionFile, JSON.stringify({ name: '@scope/pkg', version: '9.9.9' }));
    writeFileSync(
      repoFile,
      JSON.stringify({ repository: { type: 'git', url: 'git+https://example.test/org/repo.git' } })
    );
    writeFileSync(
      reference,
      [
        '## Arithmetic',
        '',
        '| Signature | Description |',
        '| --- | --- |',
        '| `add(a, b)` | Adds two values. |',
        '',
        '## Complete export index',
        '',
        '**Total (42 exports)**',
        '',
        '### Functions by category',
        '',
        '**Arithmetic** (2): `add`, `sub`',
        '',
        `**${UNCATEGORIZED}** (1): \`odd\``,
        '',
        '### Other',
        '',
      ].join('\n')
    );
    const out = join(dir, 'site');
    const r = run(LANDING, [
      `--out=${out}`,
      `--reference=${reference}`,
      `--version-file=${versionFile}`,
      `--repo-package=${repoFile}`,
      '--ref=dev',
    ]);
    assert.equal(r.status, 0, r.stderr);
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    assert.equal(statValue(html, 'functions Version'), 'v9.9.9');
    assert.equal(statValue(html, 'Exports'), '42');
    assert.equal(statValue(html, 'Categories'), '1', 'the catch-all group is not a category');
    assert.equal(html.match(/class="cat-card"/g)?.length, 2, 'the catch-all group has a card');
    assert.ok(html.includes('npm install @scope/pkg'));
    assert.ok(html.includes('href="https://www.npmjs.com/package/@scope/pkg"'));
    assert.ok(html.includes('href="https://example.test/org/repo#readme"'));
    assert.ok(
      html.includes('href="https://example.test/org/repo/blob/dev/docs/migration-guide.md"')
    );
    assert.doesNotMatch(
      html,
      /github\.com\/danielsimonjr/,
      'no repository or package literal in the pages'
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('landing fails when the reference has no export index', () => {
  const dir = scratch();
  try {
    const reference = join(dir, 'functions.md');
    writeFileSync(reference, '# No index here\n');
    const r = run(LANDING, [`--out=${join(dir, 'site')}`, `--reference=${reference}`]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /no "\(N exports\)" header/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('landing fails when the package file has no name or no semver version', () => {
  const dir = scratch();
  try {
    for (const [pkg, message] of [
      [{ version: '1.0.0' }, /no name/],
      [{ name: 'x', version: 'latest' }, /no semver version/],
    ]) {
      const versionFile = join(dir, 'package.json');
      writeFileSync(versionFile, JSON.stringify(pkg));
      const r = run(LANDING, [`--out=${join(dir, 'site')}`, `--version-file=${versionFile}`]);
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, message);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('reference-index counts the named categories and leaves out the catch-all group', () => {
  const text = [
    '## Complete export index',
    '(7 exports)',
    '### Functions by category',
    '**A** (1): `a`',
    `**${UNCATEGORIZED}** (2): \`x\`, \`y\``,
    '**B** (1): `b`',
    '### Constants & values (3)',
  ].join('\n');
  const parsed = parseReferenceIndex(text);
  assert.equal(parsed.exportTotal, 7);
  assert.equal(parsed.categoryCount, 2);
  assert.deepEqual([...parsed.domains.keys()], ['A', UNCATEGORIZED, 'B']);
  assert.deepEqual(parsed.domains.get(UNCATEGORIZED), ['x', 'y']);
  // Only the catch-all group: no category, so the index is not usable.
  assert.throws(
    () =>
      parseReferenceIndex(
        `## Complete export index\n(1 exports)\n### Functions by category\n**${UNCATEGORIZED}** (1): \`x\`\n`,
        'ref.md'
      ),
    /ref\.md has no "\(N exports\)" header or no "### Functions by category" block/
  );
});

test('the generated reference writes the catch-all label that the readers match', () => {
  const generator = readFileSync(join(REPO, 'tools', 'generate-functions-reference.mjs'), 'utf8');
  assert.match(generator, /import \{ UNCATEGORIZED as OTHER \} from '\.\/reference-index\.mjs'/);
  assert.doesNotMatch(generator, /'Other exports \(uncategorized\)'/, 'the label is defined once');
});

test('site-config normalizes the repository URL and rejects what it cannot use', () => {
  const dir = scratch();
  try {
    const file = join(dir, 'package.json');
    const url = (repository) => {
      writeFileSync(file, JSON.stringify({ repository }));
      return repositoryUrl(file);
    };
    assert.equal(url({ url: 'git+https://h.test/o/r.git' }), 'https://h.test/o/r');
    assert.equal(url({ url: 'https://h.test/o/r' }), 'https://h.test/o/r');
    assert.equal(url('https://h.test/o/r.git'), 'https://h.test/o/r');
    for (const bad of [undefined, { url: 'git@h.test:o/r.git' }, { url: 'https://h.test/o' }]) {
      assert.throws(() => url(bad), /site-config/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('api index lists every package page with an absolute GitHub link from package.json', () => {
  const out = scratch();
  try {
    const r = run(API, [`--out=${out}`]);
    assert.equal(r.status, 0, r.stderr);
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    const base = repositoryUrl(join(REPO, 'package.json'));
    const pages = readdirSync(join(REPO, 'docs', 'api')).filter(
      (f) => f.endsWith('.md') && f !== 'README.md'
    );
    assert.ok(pages.length > 0);
    for (const page of pages) {
      assert.ok(
        html.includes(`href="${base}/blob/main/docs/api/${page}"`),
        `${page} is not linked`
      );
    }
    assert.ok(html.includes(`href="${base}#readme"`));
    assert.ok(html.includes(`href="${base}/tree/main/docs/api"`));
    assert.doesNotMatch(html, /href="\.{1,2}\/[^"]*\.md"/, 'no relative link to a page');
    assert.match(html, /<title>MathTS API Index<\/title>/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('api index takes the repository URL and the branch from its inputs', () => {
  const dir = scratch();
  try {
    const repoFile = join(dir, 'repo.json');
    writeFileSync(repoFile, JSON.stringify({ repository: 'https://example.test/org/repo' }));
    const out = join(dir, 'site');
    const r = run(API, [`--out=${out}`, `--repo-package=${repoFile}`, '--ref=dev']);
    assert.equal(r.status, 0, r.stderr);
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    assert.ok(html.includes('href="https://example.test/org/repo/blob/dev/docs/api/core.md"'));
    assert.ok(html.includes('href="https://example.test/org/repo/tree/dev/docs/api"'));
    assert.doesNotMatch(html, /github\.com\/danielsimonjr/, 'no repository literal in the page');

    writeFileSync(repoFile, JSON.stringify({ name: 'no-repository' }));
    const bad = run(API, [`--out=${out}`, `--repo-package=${repoFile}`]);
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /no "repository" field/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('api index fails without --out, on an empty directory and outside the repository', () => {
  const dir = scratch();
  try {
    const none = run(API, []);
    assert.notEqual(none.status, 0);
    assert.match(none.stderr, /--out=<dir> is required/);

    mkdirSync(join(dir, 'api'));
    const empty = run(API, [`--out=${join(dir, 'site')}`, `--api-dir=${join(dir, 'api')}`]);
    assert.notEqual(empty.status, 0);
    assert.match(empty.stderr, /no package pages/);

    writeFileSync(join(dir, 'api', 'core.md'), '# Core\n\nText.\n');
    const outside = run(API, [`--out=${join(dir, 'site')}`, `--api-dir=${join(dir, 'api')}`]);
    assert.notEqual(outside.status, 0);
    assert.match(outside.stderr, /is outside the repository/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('site-config prints the package name and version for a workflow step output', () => {
  const r = run(join(REPO, 'tools', 'site-config.mjs'), []);
  assert.equal(r.status, 0, r.stderr);
  const { name, version } = packageIdentity(join(REPO, 'functions', 'package.json'));
  assert.equal(r.stdout, `package=${name}\nversion=${version}\n`);
});
