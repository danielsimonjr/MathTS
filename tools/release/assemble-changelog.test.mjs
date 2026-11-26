import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeFragments, pendingFragments, splitUnreleased } from './assemble-changelog.mjs';

const CHANGELOG = [
  '# Changelog',
  '',
  'Intro text.',
  '',
  '## [Unreleased]',
  '',
  '### Fixed',
  '',
  '- **Older bullet.**',
  '',
  '## [1.0.0] - 2026-01-01',
  '',
  '- Released.',
  '',
].join('\n');

const FRAGMENT_A = '### Added\n\n- **Newest thing.**\n';
const FRAGMENT_B = '### Fixed\n\n- **Middle thing.**\n';

test('splitUnreleased isolates the Unreleased body', () => {
  const { before, body, after } = splitUnreleased(CHANGELOG);
  assert.match(before, /## \[Unreleased]\n$/);
  assert.match(body, /Older bullet/);
  assert.doesNotMatch(body, /Released\./);
  assert.match(after, /## \[1\.0\.0]/);
});

test('splitUnreleased throws when the heading is missing', () => {
  assert.throws(() => splitUnreleased('# Changelog\n\nno sections\n'), /Unreleased/);
});

test('fragments merge newest first, above the existing content', () => {
  const merged = mergeFragments(CHANGELOG, [FRAGMENT_A, FRAGMENT_B]);
  const at = (needle) => merged.indexOf(needle);
  assert.ok(at('## [Unreleased]') < at('Newest thing'));
  assert.ok(at('Newest thing') < at('Middle thing'));
  assert.ok(at('Middle thing') < at('Older bullet'));
  assert.ok(at('Older bullet') < at('## [1.0.0]'));
  assert.match(merged, /^# Changelog/);
  assert.match(merged, /Intro text\./);
});

test('the merged section stays valid markdown with one blank line between blocks', () => {
  const merged = mergeFragments(CHANGELOG, [FRAGMENT_A, FRAGMENT_B]);
  assert.ok(!/\n{4,}/.test(merged), 'no triple blank lines');
  assert.ok(merged.endsWith('- Released.\n\n') || merged.endsWith('- Released.\n'));
});

test('mergeFragments with no fragments is the identity', () => {
  assert.equal(mergeFragments(CHANGELOG, []), CHANGELOG);
});

test('pendingFragments sorts newest first and never lists the README', async () => {
  const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'fragments-'));
  try {
    for (const name of ['README.md', '2026-11-24-older.md', '2026-11-25-newer.md', 'notes.txt']) {
      writeFileSync(join(dir, name), 'x\n');
    }
    assert.deepEqual(pendingFragments(dir), ['2026-11-25-newer.md', '2026-11-24-older.md']);
    assert.deepEqual(pendingFragments(join(dir, 'missing')), []);
    mkdirSync(join(dir, 'sub'), { recursive: true });
  } finally {
    const { rmSync } = await import('node:fs');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the CLI merges a fixture changelog, deletes the fragments, and --check reports pending', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } =
    await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const script = new URL('./assemble-changelog.mjs', import.meta.url).pathname;
  const root = mkdtempSync(join(tmpdir(), 'assemble-cli-'));
  try {
    const fragments = join(root, 'fragments');
    mkdirSync(fragments);
    writeFileSync(join(root, 'CHANGELOG.md'), CHANGELOG);
    writeFileSync(join(fragments, '2026-11-24-old.md'), FRAGMENT_B);
    writeFileSync(join(fragments, '2026-11-25-new.md'), FRAGMENT_A);
    const run = (...flags) =>
      spawnSync(process.execPath, [script, '--root', root, '--fragments', fragments, ...flags], {
        encoding: 'utf8',
      });
    assert.equal(run('--check').status, 1, 'pending fragments fail --check');
    assert.equal(run().status, 0, 'the merge succeeds');
    const text = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
    assert.ok(text.indexOf('Newest thing') < text.indexOf('Middle thing'));
    assert.ok(text.indexOf('Middle thing') < text.indexOf('Older bullet'));
    assert.ok(text.indexOf('Older bullet') < text.indexOf('## [1.0.0]'));
    assert.deepEqual(
      readdirSync(fragments).filter((name) => name.endsWith('.md')),
      [],
      'consumed fragments are deleted'
    );
    assert.equal(run('--check').status, 0, 'no pending fragments after the merge');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
