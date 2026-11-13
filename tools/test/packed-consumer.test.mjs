/**
 * Packed-consumer regression tests (dogfood #886 #888 #890 #893 #905 #912 #914 #916 #930).
 *
 * Each test replays the report through the package NAME in a temporary consumer that installs
 * tarballs of the built workspace (never the source tree). Run `bun run build` first.
 * Run with `node --test tools/test/packed-consumer.test.mjs` (never `bun run`).
 * The consumer-side tools (typescript, esbuild, vite) install in the temp folder only.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { browserBundleProblems, loadProblems, minifiedBundleSize } from './consumer-checks.mjs';
import {
  entrySpecifiers,
  installInto,
  installedVersion,
  packWorkspace,
  publicPackages,
  readEntryPolicy,
  runTsc,
  shell,
} from './consumer-env.mjs';
import { extractFences, fenceProblems } from './readme-fences.mjs';

const VITE = process.env.MATHTS_CONSUMER_VITE ?? 'vite@6';
const packages = publicPackages();
const policy = readEntryPolicy();
const work = mkdtempSync(join(tmpdir(), 'mathts-packed-'));
const consumer = join(work, 'consumer');

/** Write a strict no-Node tsconfig and an index.ts that imports every types-bearing entry. */
function writeStrictProject() {
  const specifiers = entrySpecifiers(packages, { types: true }).filter((s) => !(s in policy.nodeOnly));
  const dir = join(work, 'strict');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        target: 'ES2022',
        lib: ['ES2022'],
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        types: [],
      },
      files: ['index.ts'],
    })
  );
  writeFileSync(join(dir, 'index.ts'), specifiers.map((s, i) => `import * as m${i} from '${s}';`).join('\n') + '\n');
  return dir;
}

/** Vite production build of a page that uses ComputePool. */
function viteBuild(name, { topLevelAwait, target }) {
  const proj = join(consumer, name);
  mkdirSync(join(proj, 'src'), { recursive: true });
  writeFileSync(join(proj, 'index.html'), '<!doctype html><script type="module" src="/src/main.js"></script>');
  const body = [
    "import { ComputePool } from '@danielsimonjr/mathts-parallel';",
    'const pool = new ComputePool();',
    'const x = new Float64Array(65536);',
    topLevelAwait ? 'await pool.sin(x);' : 'export async function go() { await pool.sin(x); }',
  ];
  writeFileSync(join(proj, 'src', 'main.js'), body.join('\n') + '\n');
  if (target) writeFileSync(join(proj, 'vite.config.js'), `export default { build: { target: '${target}' } };\n`);
  const out = execFileSync(process.execPath, [join(consumer, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], {
    cwd: proj,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const dist = join(proj, 'dist', 'assets');
  const js = readdirSync(dist)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(dist, f), 'utf8'))
    .join('\n');
  return { out, js };
}

describe('packed consumer', () => {
  /** @type {string} */
  let strictDir;
  before(() => {
    const tgz = packWorkspace(packages, join(work, 'tarballs'));
    strictDir = writeStrictProject();
    mkdirSync(consumer, { recursive: true });
    writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    installInto(consumer, [
      `typescript@${installedVersion('typescript')}`,
      `esbuild@${installedVersion('esbuild')}`,
      '@types/node@22',
      VITE,
      ...tgz,
    ]);
    installInto(strictDir, [`typescript@${installedVersion('typescript')}`, ...tgz]);
  }, { timeout: 600_000 });
  after(() => rmSync(work, { recursive: true, force: true }));

  const specifiers = () => entrySpecifiers(packages, { types: false });

  it('#886 #890 strict tsc with no @types/node, DOM or WebGPU lib passes for every public package', () => {
    assert.deepEqual(runTsc(strictDir), []);
  });

  it('#888 every package entry loads by import() and by require()', () => {
    assert.deepEqual(loadProblems(consumer, specifiers(), policy), []);
  });

  it('#893 the browser bundle of every browser-facing entry (compat included) has no Node builtin', () => {
    assert.deepEqual(browserBundleProblems(consumer, specifiers().filter((s) => !(s in policy.notBrowserFacing))).problems, []);
  });

  it('#905 the tensor README shows the JSON import attribute and the fence runs', () => {
    const readme = readFileSync(join(consumer, 'node_modules', '@danielsimonjr', 'mathts-tensor', 'README.md'), 'utf8');
    assert.match(readme, /with \{ type: 'json' \}/);
    assert.deepEqual(fenceProblems(consumer, ['@danielsimonjr/mathts-tensor']).problems, []);
  });

  it('#912 Vite builds ComputePool; the consumer own top-level await needs build.target es2022', () => {
    const ok = viteBuild('vite-tla-es2022', { topLevelAwait: true, target: 'es2022' });
    assert.doesNotMatch(ok.js, /from\s*["'](node:|worker_threads|os["']|child_process)/);
    const bare = /from\s*["']workerpool["']/.exec(ok.js);
    assert.equal(bare && ok.js.slice(Math.max(0, bare.index - 100), bare.index + 40), null);
    viteBuild('vite-async', { topLevelAwait: false });
    assert.throws(() => viteBuild('vite-tla-default', { topLevelAwait: true }), /Top-level await/);
  });

  it('#914 #916 every code fence of every README carries a runtime tag and runs or type-checks', () => {
    const names = packages.map(({ pkg }) => pkg.name);
    assert.deepEqual(fenceProblems(consumer, names).problems, []);
  });

  it('#914 #916 an untagged code fence is a finding (fence parser)', () => {
    const fences = extractFences('```ts\nconst a = 1;\n```\n```ts node\nconst b = 2;\n```\n');
    assert.deepEqual(
      fences.map((f) => f.tag),
      [null, 'node']
    );
  });

  it('#930 evaluate needs the whole table: subpath within 5% of the barrel; expression is far smaller', () => {
    const size = (line) => minifiedBundleSize(consumer, line, { platform: 'node' });
    const sub = size("import { evaluate } from '@danielsimonjr/mathts-functions/evaluate';");
    const barrel = size("import { evaluate } from '@danielsimonjr/mathts-functions';");
    const expr = size("import { evaluate } from '@danielsimonjr/mathts-expression';");
    assert.ok(Math.abs(barrel - sub) / barrel < 0.05, `sub ${sub} barrel ${barrel}`);
    assert.ok(expr < 400_000, `expression evaluate ${expr}`);
    assert.ok(sub > 800_000, `functions/evaluate ${sub}`);
  });
});

void shell;
