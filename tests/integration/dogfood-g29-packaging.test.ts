import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { workspaceDirs } = require(join(REPO, 'tools/test/workspaces.mjs')) as {
  workspaceDirs: (root?: string) => string[];
};

const PUBLIC_DIRS = workspaceDirs(REPO).filter((dir) => {
  const pkg = JSON.parse(readFileSync(join(REPO, dir, 'package.json'), 'utf8'));
  return !pkg.private;
});

describe('G29 packaging (#789 #790 #741 #740 #696 #697)', () => {
  it('sync-package-packaging check passes', () => {
    execFileSync('node', ['tools/sync-package-packaging.mjs', '--check'], {
      cwd: REPO,
      stdio: 'pipe',
    });
  });

  it('#789 #790 #696 #741 packed tarballs include LICENSE and manifest fields', () => {
    for (const dir of PUBLIC_DIRS) {
      const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
        cwd: join(REPO, dir),
        encoding: 'utf8',
      });
      const [entry] = JSON.parse(out) as { filename: string; files: { path: string }[] }[];
      const manifest = JSON.parse(readFileSync(join(REPO, dir, 'package.json'), 'utf8')) as {
        homepage?: string;
        bugs?: { url?: string };
        sideEffects?: boolean;
        exports?: Record<string, unknown>;
      };
      expect(manifest.homepage, dir).toMatch(/^https:\/\/github\.com\/danielsimonjr\/MathTS/);
      expect(manifest.bugs?.url, dir).toBe('https://github.com/danielsimonjr/MathTS/issues');
      expect(manifest.exports?.['./package.json'], dir).toBe('./package.json');
      expect(typeof manifest.sideEffects, dir).toBe('boolean');
      expect(entry.filename).toMatch(/\.tgz$/);
      expect(entry.files.some((f) => f.path === 'LICENSE')).toBe(true);
    }
  }, 120_000);

  it('#740 core dist ships index.js.map after build', () => {
    const mapPath = join(REPO, 'core/dist/index.js.map');
    if (!existsSync(mapPath)) {
      execFileSync('npx', ['turbo', 'build', '--filter=@danielsimonjr/mathts-core'], {
        cwd: REPO,
        stdio: 'pipe',
      });
    }
    expect(existsSync(mapPath)).toBe(true);
    const js = readFileSync(join(REPO, 'core/dist/index.js'), 'utf8');
    expect(js).toMatch(/sourceMappingURL=/);
  });

  it('#697 consumer typecheck without @types/node', () => {
    execFileSync('node', ['tools/test/consumer-typecheck-no-node.mjs', '--skip-build'], {
      cwd: REPO,
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_OPTIONS: '',
        PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`,
      },
    });
  }, 120_000);
});
