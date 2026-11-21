// Packaging checks that start heavy child processes: npm pack of every public package (#789 #790
// #696 #741), four minified esbuild bundles of the functions graph (#930) and the README stats
// check (#792). They run as a step of the Compile & Lint job after the development build, not in
// the root vitest pool, where a wall-clock limit measures the load of the other processes (#1185).
//
// Usage: node --test tools/test/packaging-gates.test.mjs   (after `bun run build`)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSync } from 'esbuild';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

const PUBLIC_DIRS = workspaceDirs().filter(
  (dir) => !JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8')).private
);

/** Packages whose own module evaluation does not register or mutate globals. */
const SIDE_EFFECT_FREE = new Set([
  'parser',
  'ast',
  'evaluator',
  'units',
  'numbers',
  'linalg',
  'arithmetic',
  'trigonometry',
  'statistics',
  'signal',
  'gpu',
]);

test('#789 #790 #696 #741 packed tarballs include LICENSE and manifest fields', () => {
  for (const dir of PUBLIC_DIRS) {
    const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
      cwd: join(repoRoot, dir),
      encoding: 'utf8',
      // npm is npm.cmd on Windows; a .cmd file runs only through a shell.
      shell: process.platform === 'win32',
    });
    const [entry] = JSON.parse(out);
    const full = JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'));
    assert.match(full.homepage ?? '', /^https:\/\/github\.com\/danielsimonjr\/MathTS/, dir);
    assert.equal(full.bugs?.url, 'https://github.com/danielsimonjr/MathTS/issues', dir);
    assert.equal(full.repository?.directory, dir, dir);
    assert.equal(full.exports?.['./package.json'], './package.json', dir);
    const base = dir.split('/').pop() ?? dir;
    assert.equal(full.sideEffects, !SIDE_EFFECT_FREE.has(base), dir);
    assert.match(entry.filename, /\.tgz$/, dir);
    const packed = new Set(entry.files.map((f) => f.path));
    assert.ok(packed.has('LICENSE'), `${dir} packs no LICENSE`);
    for (const js of [...packed].filter((p) => p.endsWith('.js'))) {
      assert.ok(packed.has(`${js}.map`), `${dir} ${js} has no packed map`);
    }
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { createRequire } from 'node:module';
         const req = createRequire(import.meta.url);
         const meta = req(${JSON.stringify(`${full.name}/package.json`)});
         if (typeof meta.version !== 'string') process.exit(1);`,
      ],
      { cwd: repoRoot, stdio: 'pipe' }
    );
  }
});

/**
 * Bundle one import line of `evaluate` with esbuild, minified, into `outfile`.
 * @param {string} importLine  the import statement of the entry
 * @param {string} outfile  absolute path of the bundle
 * @param {'neutral' | 'node'} platform  esbuild platform
 * @returns {number} the size of the bundle in bytes
 */
function bundledBytes(importLine, outfile, platform) {
  buildSync({
    stdin: {
      contents: `${importLine}\nexport { evaluate };\n`,
      resolveDir: repoRoot,
      sourcefile: 'g27-eval-size.mjs',
      loader: 'js',
    },
    bundle: true,
    minify: true,
    format: 'esm',
    platform,
    outfile,
    absWorkingDir: repoRoot,
    logLevel: 'silent',
    conditions:
      platform === 'neutral' ? ['browser', 'import', 'default'] : ['node', 'import', 'default'],
  });
  if (platform === 'neutral') {
    assert.doesNotMatch(
      readFileSync(outfile, 'utf8'),
      /(?:from|import)\s*["'](?:node:|fs|crypto|util|path|os|module|worker_threads)["']/
    );
  }
  return statSync(outfile).size;
}

test('#930 evaluate subpath is not a size saving: within 5% of the barrel, and far above mathts-expression', () => {
  const out = mkdtempSync(join(tmpdir(), 'mathts-g27-'));
  try {
    for (const platform of ['node', 'neutral']) {
      const sub = bundledBytes(
        "import { evaluate } from '@danielsimonjr/mathts-functions/evaluate';",
        join(out, `g27-eval-subpath-${platform}.js`),
        platform
      );
      const barrel = bundledBytes(
        "import { evaluate } from '@danielsimonjr/mathts-functions';",
        join(out, `g27-eval-barrel-${platform}.js`),
        platform
      );
      // `evaluate` resolves any function name, so both entries carry the whole function table.
      // The README withdraws the #707 size claim on this evidence.
      assert.ok(Math.abs(barrel - sub) / barrel < 0.05, `${platform}: ${sub} vs ${barrel}`);
      assert.ok(sub > 800_000, `${platform}: ${sub}`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('#792 README function stats match functions/package.json', () => {
  execFileSync(process.execPath, ['tools/sync-readme-functions-stats.mjs', '--check'], {
    cwd: repoRoot,
    stdio: 'pipe',
  });
  const { version } = JSON.parse(readFileSync(join(repoRoot, 'functions/package.json'), 'utf8'));
  const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
  assert.ok(readme.includes(`@danielsimonjr/mathts-functions\` ${version}`));
});
