/**
 * Tests for the generator of `docs/BENCHMARK_RESULTS.md`.
 *
 *   node --test tools/test/gen-benchmark-results.test.mjs
 *
 * The first group runs the renderer on a small fixture. The second group reads the committed
 * document and the committed record: the document must be the render of the record, so no
 * measured cell can be typed by hand.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CONFIG,
  applyBlocks,
  bandText,
  grouped,
  renderDocument,
} from '../benchmark/wasm/gen-benchmark-results.mjs';

const NL = String.fromCharCode(10);

const generator = fileURLToPath(
  new URL('../benchmark/wasm/gen-benchmark-results.mjs', import.meta.url)
);

const FIXTURE_DOC = [
  '# Fixture',
  '',
  'Prose before.',
  '',
  '<!-- bench:begin policy -->',
  'stale policy text',
  '<!-- bench:end policy -->',
  '',
  'Prose between.',
  '',
  '<!-- bench:begin public-call -->',
  'stale call text',
  '<!-- bench:end public-call -->',
  '',
  'Prose of the kernel table.',
  '',
  '<!-- bench:begin kernel-call -->',
  'stale kernel text',
  '<!-- bench:end kernel-call -->',
  '',
  'Prose after.',
  '',
].join('\n');

/** A record in which the kernel and the public call disagree about `sin`, as in the issue. */
function fixtureData(overrides = {}) {
  const row = (name, n, unloadedMs, loadedMs, kernels) => ({
    name,
    n,
    unloadedMs,
    loadedMs,
    ratio: loadedMs / unloadedMs,
    kernels,
    relDiff: 0,
  });
  return {
    measuredAt: '2026-01-02',
    meta: { node: 'v99.0.0', platform: 'testos', arch: 'x99' },
    policy: {
      array_sin_ptr: { min: 16_384, max: 65_536 },
      array_abs_ptr: { min: 1_024 },
    },
    runs: {
      kernel: [row('sin', 1_048_576, 10, 3.2, ['array_sin_ptr'])],
      public: [
        row('sin', 1_048_576, 10, 10.1, []),
        row('sin', 16_384, 0.2, 0.15, ['array_sin_ptr']),
      ],
    },
    ...overrides,
  };
}

/** The text between the markers of one block. */
function blockOf(doc, name) {
  const begin = `<!-- bench:begin ${name} -->`;
  const from = doc.indexOf(begin) + begin.length;
  return doc.slice(from, doc.indexOf(`<!-- bench:end ${name} -->`));
}

/** The cells of the first table row of `text` that starts with `prefix`. */
function cellsOf(text, prefix) {
  const row = text.split(NL).find((l) => l.startsWith(prefix));
  assert.ok(row, `no row that starts with ${prefix}`);
  return row.split('|').map((c) => c.trim());
}

describe('text helpers', () => {
  test('grouped() spells numbers as policy.ts does', () => {
    assert.equal(grouped(1_048_576), '1_048_576');
    assert.equal(grouped(1_024), '1_024');
    assert.equal(grouped(512), '512');
  });

  test('bandText() reads an open and a closed band', () => {
    assert.equal(bandText({ min: 1_024 }), 'n ≥ 1_024');
    assert.equal(bandText({ min: 16_384, max: 65_536 }), '16_384 ≤ n < 65_536');
  });
});

describe('applyBlocks()', () => {
  test('writes only between the markers and leaves the prose byte for byte', () => {
    const out = applyBlocks(FIXTURE_DOC, fixtureData());
    for (const prose of [
      '# Fixture',
      'Prose before.',
      'Prose between.',
      'Prose of the kernel table.',
      'Prose after.',
    ]) {
      assert.ok(out.includes(prose), prose);
    }
    assert.ok(!out.includes('stale'));
    assert.ok(out.startsWith('# Fixture\n\nProse before.\n\n<!-- bench:begin policy -->'));
    assert.ok(out.endsWith('<!-- bench:end kernel-call -->\n\nProse after.\n'));
  });

  test('a changed measurement changes only the lines of the measured table', () => {
    const base = applyBlocks(FIXTURE_DOC, fixtureData()).split('\n');
    const changed = fixtureData();
    changed.runs.public[0] = { ...changed.runs.public[0], loadedMs: 9.5, ratio: 0.95 };
    const next = applyBlocks(FIXTURE_DOC, changed).split('\n');
    assert.equal(next.length, base.length);
    const differing = base.map((l, i) => (l === next[i] ? -1 : i)).filter((i) => i >= 0);
    assert.equal(differing.length, 1);
    assert.match(next[differing[0]], /9\.500/);
    assert.match(next[differing[0]], /0\.95/);
  });

  test('the kernel ratio and the public ratio of one call stay in their own tables', () => {
    const out = applyBlocks(FIXTURE_DOC, fixtureData());
    const pub = cellsOf(blockOf(out, 'public-call'), '| `sin` | 1_048_576 |');
    const ker = cellsOf(blockOf(out, 'kernel-call'), '| `sin` | 1_048_576 |');
    // ['', call, n, unloaded, loaded, ratio, max rel. diff, (ran), '']
    assert.equal(pub[5], '1.01');
    assert.equal(pub[7], 'no (JavaScript path)');
    assert.equal(ker[5], '0.32');
    assert.equal(ker.length, 8, 'the kernel table has no WASM-ran column');
  });

  test('a pass without rows renders a table head and no number', () => {
    const data = fixtureData();
    data.runs.kernel = [];
    const out = applyBlocks(FIXTURE_DOC, data);
    assert.ok(!blockOf(out, 'kernel-call').includes('0.32'));
    assert.ok(blockOf(out, 'kernel-call').includes('| Call'));
  });

  test('a missing marker is an error, not a silent skip', () => {
    assert.throws(
      () => applyBlocks(FIXTURE_DOC.replace('<!-- bench:end policy -->', ''), fixtureData()),
      /marker pair "policy" is missing/
    );
  });
});

describe('--check', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bench-results-'));
  const docPath = join(dir, 'doc.md');
  const dataPath = join(dir, 'data.json');
  const run = (mode) =>
    spawnSync(process.execPath, [generator, mode, '--doc', docPath, '--data', dataPath], {
      encoding: 'utf8',
    });

  test('passes after --render, fails after one cell is typed by hand', async () => {
    writeFileSync(dataPath, JSON.stringify(fixtureData()));
    writeFileSync(docPath, FIXTURE_DOC);
    assert.equal(run('--render').status, 0);
    assert.equal(run('--check').status, 0);

    const doc = readFileSync(docPath, 'utf8');
    writeFileSync(docPath, doc.replace('1.01', '0.32'));
    const failed = run('--check');
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /differs from its render/);

    // --render restores the measured text.
    assert.equal(run('--render').status, 0);
    assert.equal(readFileSync(docPath, 'utf8'), doc);
  });

  after(() => rmSync(dir, { recursive: true, force: true }));
});

describe('the committed document', () => {
  const committed = () => ({
    doc: readFileSync(CONFIG.doc, 'utf8'),
    data: JSON.parse(readFileSync(CONFIG.data, 'utf8')),
  });

  test('is the render of the committed record, byte for byte', async () => {
    const { doc, data } = committed();
    assert.equal(await renderDocument(doc, data), doc);
  });

  test('its sin row at the largest size is the one the public call measured', () => {
    const { doc, data } = committed();
    const publicRows = data.runs.public.filter((r) => r.name === 'sin');
    const largest = publicRows.reduce((a, b) => (b.n > a.n ? b : a));
    const row = doc.split(NL).find((l) => l.startsWith(`| \`sin\` | ${grouped(largest.n)} |`));
    assert.ok(row, 'the sin row of the largest size');
    assert.ok(row.includes(largest.ratio.toFixed(2)));
  });

  test('every elementwise call of the record has both a kernel and a public row', () => {
    const { data } = committed();
    const key = (r) => `${r.name}@${r.n}`;
    const kernel = new Set(data.runs.kernel.map(key));
    for (const r of data.runs.public) assert.ok(kernel.has(key(r)), `no kernel row for ${key(r)}`);
  });

  test('no table of the live-dispatch section sits outside the markers', () => {
    const { doc } = committed();
    const start = doc.indexOf('## Live dispatch');
    const end = doc.indexOf(`${NL}---${NL}`, start);
    const section = doc.slice(start, end);
    const outside = section.replace(/<!-- bench:begin (\S+) -->[\s\S]*?<!-- bench:end \1 -->/g, '');
    assert.ok(!/^\|/m.test(outside), 'a table row of the section is hand-typed');
  });
});
