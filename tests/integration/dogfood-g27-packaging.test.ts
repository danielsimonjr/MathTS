import { describe, it, expect } from 'vitest';
import { buildSync } from 'esbuild';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '../..');

/**
 * Minified bundle size of one import line. The entry is esbuild stdin that
 * resolves from the repository root, and the bundle goes to a new temporary
 * folder, so the test writes no file in the repository.
 */
function bundledBytes(importLine: string, outfile: string, platform: 'neutral' | 'node'): number {
  buildSync({
    stdin: {
      contents: `${importLine}\nexport { evaluate };\n`,
      resolveDir: REPO,
      sourcefile: 'g27-eval-size.mjs',
      loader: 'js',
    },
    bundle: true,
    minify: true,
    format: 'esm',
    platform,
    outfile,
    absWorkingDir: REPO,
    logLevel: 'silent',
    conditions:
      platform === 'neutral' ? ['browser', 'import', 'default'] : ['node', 'import', 'default'],
  });
  const bundled = readFileSync(outfile, 'utf8');
  if (platform === 'neutral') {
    expect(bundled).not.toMatch(
      /(?:from|import)\s*["'](?:node:|fs|crypto|util|path|os|module|worker_threads)["']/
    );
  }
  return statSync(outfile).size;
}

describe('G27 packaging (#707 #708 #736 #791 #792)', () => {
  it('#708 neutral esbuild bundles matrix and functions evaluate without Node builtin resolve errors', () => {
    execFileSync('node', ['tools/test/browser-bundle-neutral.mjs'], {
      cwd: REPO,
      stdio: 'pipe',
    });
    // Four esbuild bundles of the package graphs: several seconds on Windows.
  }, 120_000);

  it('#930 evaluate subpath is not a size saving: within 5% of the barrel, and far above mathts-expression', () => {
    const out = mkdtempSync(join(tmpdir(), 'mathts-g27-'));
    try {
      sizesAreOrdered(out);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
    // Four minified bundles of the functions graph: about 15 s on Windows.
  }, 120_000);

  function sizesAreOrdered(out: string): void {
    for (const platform of ['node', 'neutral'] as const) {
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
      // `evaluate` resolves any function name, so both entries carry the whole
      // function table. The README withdraws the #707 size claim on this evidence.
      expect(Math.abs(barrel - sub) / barrel, platform).toBeLessThan(0.05);
      expect(sub, platform).toBeGreaterThan(800_000);
    }
  }

  it('#736 documents ESM-only consumption', () => {
    const readme = readFileSync(join(REPO, 'compat/README.md'), 'utf8');
    expect(readme).toMatch(/ESM only/i);
    expect(readme).toMatch(/import\(/);
  });

  it('#791 package READMEs use GitHub blob links for API docs', () => {
    for (const pkg of ['autograd', 'compat', 'expression', 'plot'] as const) {
      const readme = readFileSync(join(REPO, pkg, 'README.md'), 'utf8');
      expect(readme).toMatch(
        /https:\/\/github\.com\/danielsimonjr\/MathTS\/blob\/main\/docs\/api\//
      );
      expect(readme).not.toMatch(/`docs\/api\/[^`]+\.md`/);
    }
  });

  it('#792 README function stats match functions/package.json', () => {
    execFileSync('node', ['tools/sync-readme-functions-stats.mjs', '--check'], {
      cwd: REPO,
      stdio: 'pipe',
    });
    const { version } = JSON.parse(readFileSync(join(REPO, 'functions/package.json'), 'utf8')) as {
      version: string;
    };
    const readme = readFileSync(join(REPO, 'README.md'), 'utf8');
    expect(readme).toContain(`@danielsimonjr/mathts-functions\` ${version}`);
  });
});
