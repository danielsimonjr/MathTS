import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
        // npm is npm.cmd on Windows; a .cmd file runs only through a shell.
        shell: process.platform === 'win32',
      });
      const [entry] = JSON.parse(out) as { filename: string; files: { path: string }[] }[];
      const full = JSON.parse(readFileSync(join(REPO, dir, 'package.json'), 'utf8')) as {
        name: string;
        homepage?: string;
        bugs?: { url?: string };
        sideEffects?: boolean;
        repository?: { directory?: string };
        exports?: Record<string, unknown>;
      };
      expect(full.homepage, dir).toMatch(/^https:\/\/github\.com\/danielsimonjr\/MathTS/);
      expect(full.bugs?.url, dir).toBe('https://github.com/danielsimonjr/MathTS/issues');
      expect(full.repository?.directory, dir).toBe(dir);
      expect(full.exports?.['./package.json'], dir).toBe('./package.json');
      const base = dir.split('/').pop() ?? dir;
      expect(full.sideEffects, dir).toBe(SIDE_EFFECT_FREE.has(base) ? false : true);
      expect(entry.filename).toMatch(/\.tgz$/);
      const packed = new Set(entry.files.map((f) => f.path));
      expect(packed.has('LICENSE'), dir).toBe(true);
      const jsFiles = [...packed].filter((p) => p.endsWith('.js') && !p.endsWith('.d.ts'));
      for (const js of jsFiles) {
        expect(packed.has(`${js}.map`), `${dir} ${js}`).toBe(true);
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
        { cwd: REPO, stdio: 'pipe' }
      );
    }
  }, 180_000);

  it('#740 every shipped JS file has a map whose sources are relative', () => {
    for (const dir of PUBLIC_DIRS) {
      const roots = ['dist', 'build']
        .map((name) => join(REPO, dir, name))
        .filter((path) => existsSync(path));
      expect(roots.length, dir).toBeGreaterThan(0);
      const jsFiles: string[] = [];
      const walk = (path: string) => {
        for (const name of readdirSync(path)) {
          const child = join(path, name);
          if (statSync(child).isDirectory()) walk(child);
          else if (name.endsWith('.js')) jsFiles.push(child);
        }
      };
      for (const root of roots) walk(root);
      expect(jsFiles.length, dir).toBeGreaterThan(0);
      for (const js of jsFiles) {
        const text = readFileSync(js, 'utf8');
        expect(text, js).toMatch(/sourceMappingURL=/);
        const mapPath = `${js}.map`;
        expect(existsSync(mapPath), mapPath).toBe(true);
        const map = JSON.parse(readFileSync(mapPath, 'utf8')) as { sources?: string[] };
        expect(map.sources?.length, mapPath).toBeGreaterThan(0);
        for (const source of map.sources ?? []) {
          expect(source.startsWith('/'), `${mapPath} ${source}`).toBe(false);
          expect(source.includes('file:'), `${mapPath} ${source}`).toBe(false);
        }
      }
    }
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
