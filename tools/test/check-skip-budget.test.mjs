import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSuites, ROOT_SUITE } from './check-skip-budget.mjs';

/** suite -> notRun for the suites that printed a summary. */
const summarized = (log) =>
  Object.fromEntries(
    [...parseSuites(log)].filter(([, s]) => s.summarized).map(([name, s]) => [name, s.notRun])
  );

const ROOT_RUN = [
  ' RUN  v5.0.0 /repo',
  ' Test Files  6 passed (6)',
  '      Tests  124 passed (124)',
];

test('terminal output: turbo prefixes every line with the task', () => {
  const log = [
    '@x/a:build: ESM Build success in 51ms',
    '@x/a:test: $ vitest run',
    '@x/a:test:       Tests  4950 passed | 53 skipped (5003)',
    '@x/b:test: $ bun test --isolate',
    '@x/b:test:  933 pass',
    '@x/b:test:  4 skip',
    '@x/b:test:  1 todo',
    '@x/b:test: Ran 938 tests across 52 files. [12.00s]',
    ...ROOT_RUN,
  ].join('\n');
  assert.deepEqual(summarized(log), { '@x/a': 53, '@x/b': 5, [ROOT_SUITE]: 0 });
});

test('GitHub Actions output: turbo wraps each task in a group, without prefixes', () => {
  // `tee` captures turbo's `::group::` commands; the downloaded job log shows `##[group]`.
  for (const [open, close] of [
    ['::group::', '::endgroup::'],
    ['##[group]', '##[endgroup]'],
  ]) {
    const log = [
      `${open}@x/a:build`,
      'cache hit, replaying logs 1e7f91c7684f5bba',
      '      Tests  1 passed | 9 skipped (10)', // not a test task: ignored
      close,
      `${open}@x/a:test`,
      '$ vitest run',
      '      Tests  4950 passed | 53 skipped (5003)',
      close,
      `${open}@x/b:test`,
      '$ bun test --isolate',
      ' 933 pass',
      ' 4 skip',
      ' 1 todo',
      'Ran 938 tests across 52 files. [12.00s]',
      close,
      ...ROOT_RUN,
    ].join('\n');
    assert.deepEqual(summarized(log), { '@x/a': 53, '@x/b': 5, [ROOT_SUITE]: 0 }, open);
  }
});

test('a package that printed no summary is reported unsummarized, not folded into root', () => {
  const log = ['::group::@x/a:test', '$ vitest run', 'Error: boom', '::endgroup::', ...ROOT_RUN];
  const suites = parseSuites(log.join('\n'));
  assert.equal(suites.get('@x/a')?.summarized ?? false, false);
  assert.deepEqual(summarized(log.join('\n')), { [ROOT_SUITE]: 0 });
});

test('ANSI colour escapes are stripped before matching', () => {
  const log =
    '::group::@x/a:test\n\x1b[2m      Tests \x1b[22m \x1b[32m7 passed\x1b[39m | \x1b[33m2 skipped\x1b[39m (9)\n::endgroup::';
  assert.deepEqual(summarized(log), { '@x/a': 2 });
});
