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
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { browserBundleProblems, loadProblems, minifiedBundleSize } from './consumer-checks.mjs';
import {
  entrySpecifiers,
  installInto,
  installedVersion,
  makeScratch,
  packWorkspace,
  publicPackages,
  readEntryPolicy,
  runTsc,
} from './consumer-env.mjs';
import { extractFences, fenceProblems } from './readme-fences.mjs';

const VITE = process.env.MATHTS_CONSUMER_VITE ?? 'vite@6';
const packages = publicPackages();
const policy = readEntryPolicy();
const work = makeScratch('mathts-packed-');
const consumer = join(work, 'consumer');

/** Write a strict no-Node tsconfig and an index.ts that imports every types-bearing entry. */
function writeStrictProject() {
  const specifiers = entrySpecifiers(packages, { types: true }).filter(
    (s) => !(s in policy.nodeOnly)
  );
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
      files: ['index.ts', 'gpu-use.ts'],
    })
  );
  writeFileSync(
    join(dir, 'index.ts'),
    specifiers.map((s, i) => `import * as m${i} from '${s}';`).join('\n') + '\n'
  );
  // A consumer without the DOM lib and without @webgpu/types calls members of the GPU handles.
  writeFileSync(
    join(dir, 'gpu-use.ts'),
    [
      "import { GPUContext, getGpuDevice, type GPUBuffer, type GPUDevice } from '@danielsimonjr/mathts-gpu';",
      '',
      'export async function useDevice(): Promise<number> {',
      '  const device: GPUDevice | null = await getGpuDevice();',
      '  if (device === null) return 0;',
      '  const buffer: GPUBuffer = device.createBuffer({ size: 16, usage: 0x80 | 0x4 });',
      '  device.queue.writeBuffer(buffer, 0, new Float32Array(4));',
      '  const encoder = device.createCommandEncoder();',
      '  encoder.beginComputePass().end();',
      '  device.queue.submit([encoder.finish()]);',
      '  await device.queue.onSubmittedWorkDone();',
      '  buffer.destroy();',
      '  return new GPUContext().getDevice().limits.maxBufferSize;',
      '}',
      '',
    ].join('\n')
  );
  return dir;
}

/**
 * A consumer that has the WebGPU global types: a real adapter and a real device are the handle
 * types of the package (no cast), so every member of the real type stays available.
 * TypeScript 7 declares the types in its DOM lib; TypeScript 5 needs `@webgpu/types`
 * (`webgpuTypes: true`). Both libs together declare each type twice, so a project uses one.
 */
function writeWebgpuProject(name, { webgpuTypes }) {
  const dir = join(consumer, name);
  mkdirSync(dir, { recursive: true });
  if (webgpuTypes)
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        target: 'ES2022',
        lib: ['ES2022', 'DOM'],
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        types: webgpuTypes ? ['@webgpu/types'] : [],
      },
      files: ['index.ts'],
    })
  );
  writeFileSync(
    join(dir, 'index.ts'),
    [
      "import { GPUContext, getGpuDevice } from '@danielsimonjr/mathts-gpu';",
      "import type { GPUDevice as PackageDevice } from '@danielsimonjr/mathts-gpu';",
      '',
      '// `GPUAdapter` and `GPUDevice` below are the global WebGPU types (0x80 is STORAGE, 0x4 is TEXTURE_BINDING).',
      'export async function useRealHandles(adapter: GPUAdapter, device: GPUDevice): Promise<number> {',
      '  const packageDevice: PackageDevice = device;',
      '  const buffer = packageDevice.createBuffer({ size: 16, usage: 0x80 });',
      '  packageDevice.queue.writeBuffer(buffer, 0, new Float32Array(4));',
      '  void adapter.limits.maxBufferSize;',
      '  const owned = await getGpuDevice();',
      '  if (owned !== null) {',
      '    // The package device is the global type: members beyond the shape need no cast.',
      '    const real: GPUDevice = owned;',
      "    real.createTexture({ size: [1, 1], format: 'rgba8unorm', usage: 0x4 });",
      '  }',
      '  return new GPUContext().getQueue().label.length;',
      '}',
      '',
    ].join('\n')
  );
  return dir;
}

/** Vite production build of a page that uses ComputePool. */
function viteBuild(name, { topLevelAwait, target }) {
  const proj = join(consumer, name);
  mkdirSync(join(proj, 'src'), { recursive: true });
  writeFileSync(
    join(proj, 'index.html'),
    '<!doctype html><script type="module" src="/src/main.js"></script>'
  );
  const body = [
    "import { ComputePool } from '@danielsimonjr/mathts-parallel';",
    'const pool = new ComputePool();',
    'const x = new Float64Array(65536);',
    topLevelAwait ? 'await pool.sin(x);' : 'export async function go() { await pool.sin(x); }',
  ];
  writeFileSync(join(proj, 'src', 'main.js'), body.join('\n') + '\n');
  if (target)
    writeFileSync(
      join(proj, 'vite.config.js'),
      `export default { build: { target: '${target}' } };\n`
    );
  const out = execFileSync(
    process.execPath,
    [join(consumer, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'],
    {
      cwd: proj,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
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
  /** @type {string[]} */
  let webgpuDirs = [];
  before(
    () => {
      const tgz = packWorkspace(packages, join(work, 'tarballs'));
      strictDir = writeStrictProject();
      mkdirSync(consumer, { recursive: true });
      writeFileSync(
        join(consumer, 'package.json'),
        JSON.stringify({ private: true, type: 'module' })
      );
      installInto(consumer, [
        `typescript@${installedVersion('typescript')}`,
        `esbuild@${installedVersion('esbuild')}`,
        '@types/node@22',
        VITE,
        ...tgz,
      ]);
      // TypeScript 7 (the repository compiler): the DOM lib declares WebGPU.
      const ts7 = writeWebgpuProject('webgpu-ts7', { webgpuTypes: false });
      // TypeScript 5: the types come from @webgpu/types, installed beside its own compiler.
      const ts5 = writeWebgpuProject('webgpu-ts5', { webgpuTypes: true });
      installInto(ts5, ['typescript@5.9', `@webgpu/types@${installedVersion('@webgpu/types')}`]);
      webgpuDirs = [ts7, ts5];
      installInto(strictDir, [`typescript@${installedVersion('typescript')}`, ...tgz]);
    },
    { timeout: 600_000 }
  );

  const specifiers = () => entrySpecifiers(packages, { types: false });

  it('#886 #890 strict tsc with no @types/node, DOM or WebGPU lib passes for every public package', () => {
    assert.deepEqual(runTsc(strictDir), []);
  });

  it('#890 the GPU handle types are the WebGPU globals when the consumer has them (TypeScript 7 DOM lib, TypeScript 5 with @webgpu/types)', () => {
    for (const dir of webgpuDirs) assert.deepEqual(runTsc(dir), [], dir);
  });

  it('#888 every package entry loads by import() and by require()', () => {
    assert.deepEqual(loadProblems(consumer, specifiers(), policy), []);
  });

  it('#893 the browser bundle of every browser-facing entry (compat included) has no Node builtin', () => {
    assert.deepEqual(
      browserBundleProblems(
        consumer,
        specifiers().filter((s) => !(s in policy.notBrowserFacing))
      ).problems,
      []
    );
  });

  it('#905 the tensor README shows the JSON import attribute and the fence runs', () => {
    const readme = readFileSync(
      join(consumer, 'node_modules', '@danielsimonjr', 'mathts-tensor', 'README.md'),
      'utf8'
    );
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
    const three = size(
      "import { evaluate, parse, compileExpr } from '@danielsimonjr/mathts-functions/evaluate';"
    );
    const expr = size("import { evaluate } from '@danielsimonjr/mathts-expression';");
    assert.ok(Math.abs(barrel - sub) / barrel < 0.05, `sub ${sub} barrel ${barrel}`);
    assert.ok(three - sub < 1024, `three names ${three}, one name ${sub}`);
    assert.ok(expr < 400_000, `expression evaluate ${expr}`);
    assert.ok(sub > 800_000, `functions/evaluate ${sub}`);
  });
});
