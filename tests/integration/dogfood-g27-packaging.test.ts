import { describe, it, expect } from 'vitest';
import { buildSync } from 'esbuild';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '../..');

function neutralMinBytes(importLine: string, outfile: string): number {
  const entry = join(REPO, 'tools/test/fixtures/g27-eval-size.mjs');
  writeFileSync(entry, `${importLine}\n`);
  buildSync({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'neutral',
    outfile,
    absWorkingDir: REPO,
    logLevel: 'silent',
    conditions: ['browser', 'import', 'default'],
    mainFields: ['browser', 'module', 'main'],
    external: ['workerpool', 'workerpool/wasm'],
  });
  return statSync(outfile).size;
}

describe('G27 packaging (#707 #708 #736 #791 #792)', () => {
  it('#708 neutral esbuild bundles matrix and functions evaluate without Node builtin resolve errors', () => {
    execFileSync('node', ['tools/test/browser-bundle-neutral.mjs'], {
      cwd: REPO,
      stdio: 'pipe',
    });
  });

  it('#707 evaluate subpath minifies smaller than the main barrel named import', () => {
    const sub = neutralMinBytes(
      "import { evaluate } from '@danielsimonjr/mathts-functions/evaluate';",
      '/tmp/g27-eval-subpath.js'
    );
    const barrel = neutralMinBytes(
      "import { evaluate } from '@danielsimonjr/mathts-functions';",
      '/tmp/g27-eval-barrel.js'
    );
    expect(sub).toBeLessThan(barrel);
    expect(barrel - sub).toBeGreaterThan(10_000);
  });

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
