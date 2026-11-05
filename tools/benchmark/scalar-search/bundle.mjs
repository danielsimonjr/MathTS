/**
 * esbuild bundle for the Node scalar-search bench (one dist tree, no `src/` paths).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

/**
 * @param {string} repoRoot
 * @param {string} outfile
 */
export async function buildScalarSearchBundle(repoRoot, outfile) {
  const scalarBatchDist = join(repoRoot, 'functions/dist/scalar-batch-parallel.js');
  await build({
    entryPoints: [join(repoRoot, 'tools/benchmark/scalar-search/bench.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    external: [
      '@danielsimonjr/mathts-core',
      '@danielsimonjr/mathts-expression',
      '@danielsimonjr/mathts-functions',
      '@danielsimonjr/mathts-parallel',
      scalarBatchDist,
      '../../../functions/dist/scalar-batch-parallel.js',
    ],
    define: {
      __PKG_VERSION__: JSON.stringify(
        JSON.parse(readFileSync(join(repoRoot, 'core', 'package.json'), 'utf8')).version
      ),
    },
    outfile,
    logLevel: 'silent',
  });
}
