import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Root vitest imports package SOURCE (not dist), but `__PKG_VERSION__` is
 * normally injected at build time via each package's tsup `define`. Per-package
 * vitest configs mirror that define; this plugin does the same for the root
 * suites (`tests/integration`, `tests/wasm`), which import package SOURCE that
 * carries VERSION-bearing modules, so they do not fail with ReferenceError.
 */
const pkgVersionCache = new Map<string, string>();

function pkgVersionForFile(filePath: string): string | null {
  let dir = dirname(filePath);
  for (let depth = 0; depth < 12; depth++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      if (!pkgVersionCache.has(pkgPath)) {
        const { version } = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
        pkgVersionCache.set(pkgPath, version);
      }
      return pkgVersionCache.get(pkgPath)!;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function pkgVersionDefinePlugin(): Plugin {
  return {
    name: 'mathts-pkg-version-define',
    enforce: 'pre',
    transform(code, id) {
      if (!code.includes('__PKG_VERSION__')) return;
      if (id.includes('node_modules')) return;
      const version = pkgVersionForFile(id);
      if (!version) return;
      // Drop the ambient declare — it becomes invalid once the identifier is
      // replaced with a string literal. The export site keeps the real value.
      let next = code.replace(/declare const __PKG_VERSION__: string;\r?\n?/g, '');
      next = next.replace(/\b__PKG_VERSION__\b/g, JSON.stringify(version));
      if (next === code) return;
      return { code: next, map: null };
    },
  };
}

export default defineConfig({
  plugins: [pkgVersionDefinePlugin()],
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/*.browser.test.ts', 'node_modules/**'],
    // ROOT-LEVEL suites only. Each package runs its OWN runner through
    // `turbo run test` (`bun test` for most, vitest for `functions` and `plot`);
    // `bun run test` runs that and then this config. The former glob over every
    // `*/tests` directory ran all packages a second time, under vitest, whatever
    // runner the package declares, and it made a CLI filter such as
    // `vitest run tests/wasm/` also pick up `matrix/tests/wasm/**`.
    include: [
      'tests/integration/**/*.test.ts',
      'tests/wasm/**/*.test.ts',
      // NOTE: `tests/benchmark/**` is deliberately NOT here — see `vitest.config.bench.ts`.
      // Those are WALL-CLOCK assertions ("100 ops under 200ms"). Run inside the
      // concurrent gate, alongside ~8,900 other tests, they measure machine contention
      // rather than the code: `DenseMatrix transpose 100x100` passes at ~100ms in
      // isolation and fails at ~212ms here. Widening the threshold would just hide
      // that. They now run in isolation via `npm run test:bench`, where the numbers
      // mean something.
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'core/src/**',
        'matrix/src/**',
        'functions/src/**',
        'gpu/src/**',
        'parallel/src/**',
        'workbook/src/**',
        'compat/src/**',
        'expression/src/**',
        'tensor/src/**',
        'autograd/src/**',
        'plot/src/**',
        'packages/typed-function/src/**',
        'packages/workerpool/src/**',
      ],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/*.config.*', '**/index.ts'],
    },
  },
});
