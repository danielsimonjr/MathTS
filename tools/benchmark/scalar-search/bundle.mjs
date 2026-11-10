/**
 * esbuild bundle for the Node scalar-search bench (one dist tree, no `src/` paths).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { build } from 'esbuild';

/**
 * Import path for `functions/dist/scalar-batch-parallel.js` that resolves from `outfile`.
 * @param {string} outfile
 * @param {string} scalarBatchDist
 */
export function scalarBatchImportFromBundle(outfile, scalarBatchDist) {
  let rel = relative(dirname(outfile), scalarBatchDist).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

/**
 * Bundles the scalar search benchmark with esbuild, with the MathTS packages kept external.
 * @param {string} repoRoot
 * @param {string} outfile
 */
export async function buildScalarSearchBundle(repoRoot, outfile) {
  const scalarBatchDist = join(repoRoot, 'functions/dist/scalar-batch-parallel.js');
  const scalarBatchImport = scalarBatchImportFromBundle(outfile, scalarBatchDist);
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
    ],
    define: {
      __PKG_VERSION__: JSON.stringify(
        JSON.parse(readFileSync(join(repoRoot, 'core', 'package.json'), 'utf8')).version
      ),
    },
    plugins: [
      {
        name: 'external-scalar-batch-dist',
        setup(buildApi) {
          buildApi.onResolve({ filter: /scalar-batch-parallel\.js$/ }, (args) => {
            if (!args.path.replace(/\\/g, '/').includes('functions/dist/scalar-batch-parallel')) {
              return;
            }
            return { path: scalarBatchImport, external: true };
          });
        },
      },
    ],
    outfile,
    logLevel: 'silent',
  });
}

/**
 * Every relative import in an ESM bundle must resolve on disk from the bundle directory.
 * @param {string} bundlePath
 */
export function assertBundleRelativeImportsResolve(bundlePath) {
  const source = readFileSync(bundlePath, 'utf8');
  const dir = dirname(bundlePath);
  const specifiers = new Set();
  for (const match of source.matchAll(/\bfrom\s+['"](\.[^'"]+)['"]/g)) {
    specifiers.add(match[1]);
  }
  for (const match of source.matchAll(/\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
    specifiers.add(match[1]);
  }
  for (const spec of specifiers) {
    const target = join(dir, spec);
    if (!existsSync(target)) {
      throw new Error(`bundle import ${spec} from ${bundlePath} does not resolve (${target})`);
    }
  }
}
