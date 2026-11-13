import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const NODE = process.execPath;
const LANDING = join(REPO, 'tools', 'generate-landing-site.mjs');
const API = join(REPO, 'tools', 'generate-api-index.mjs');

const scratch = () => mkdtempSync(join(tmpdir(), 'site-gen-'));

function run(script, args) {
  return spawnSync(NODE, [script, ...args], { cwd: REPO, encoding: 'utf8' });
}

/** The export count the root README and the landing page both show. */
function exportCount(referenceText) {
  const indexText = referenceText.split('## Complete export index')[1] ?? '';
  const m = indexText.match(/\((\d+) exports\)/);
  assert.ok(m, 'reference index has no "(N exports)" header');
  return Number(m[1]);
}

test('landing shows the package version and the barrel export count', () => {
  const out = scratch();
  try {
    const r = run(LANDING, [`--out=${out}`]);
    assert.equal(r.status, 0, r.stderr);
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    const version = JSON.parse(
      readFileSync(join(REPO, 'functions', 'package.json'), 'utf8')
    ).version;
    const exports = exportCount(
      readFileSync(join(REPO, 'docs', 'reference', 'functions.md'), 'utf8')
    );
    assert.ok(
      html.includes(`<div class="stat-value">v${version}</div>`),
      `version ${version} missing`
    );
    assert.ok(
      html.includes(
        `<div class="stat-value">${exports.toLocaleString('en-US')}</div><div class="stat-label">Exports</div>`
      ),
      `export count ${exports} missing`
    );
    assert.doesNotMatch(html, /Tests Passing/, 'the site must not show a test count');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('landing takes its version and count from its inputs, not from literals', () => {
  const dir = scratch();
  try {
    const versionFile = join(dir, 'package.json');
    const reference = join(dir, 'functions.md');
    writeFileSync(versionFile, JSON.stringify({ version: '9.9.9' }));
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
        '### Other',
        '',
      ].join('\n')
    );
    const out = join(dir, 'site');
    const r = run(LANDING, [
      `--out=${out}`,
      `--reference=${reference}`,
      `--version-file=${versionFile}`,
    ]);
    assert.equal(r.status, 0, r.stderr);
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    assert.ok(html.includes('<div class="stat-value">v9.9.9</div>'));
    assert.ok(
      html.includes('<div class="stat-value">42</div><div class="stat-label">Exports</div>')
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

test('api index lists every package page with an absolute GitHub link', () => {
  const out = scratch();
  try {
    const r = run(API, [`--out=${out}`]);
    assert.equal(r.status, 0, r.stderr);
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    const pages = readdirSync(join(REPO, 'docs', 'api')).filter(
      (f) => f.endsWith('.md') && f !== 'README.md'
    );
    assert.ok(pages.length > 0);
    for (const page of pages) {
      assert.ok(
        html.includes(`href="https://github.com/danielsimonjr/MathTS/blob/main/docs/api/${page}"`),
        `${page} is not linked`
      );
    }
    assert.doesNotMatch(html, /href="\.{1,2}\/[^"]*\.md"/, 'no relative link to a page');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('api index fails without --out and on an empty directory', () => {
  const dir = scratch();
  try {
    const none = run(API, []);
    assert.notEqual(none.status, 0);
    assert.match(none.stderr, /--out=<dir> is required/);

    mkdirSync(join(dir, 'api'));
    const empty = run(API, [`--out=${join(dir, 'site')}`, `--api-dir=${join(dir, 'api')}`]);
    assert.notEqual(empty.status, 0);
    assert.match(empty.stderr, /no package pages/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
