#!/usr/bin/env node
/**
 * Strict consumer typecheck of EVERY packed public package with no Node, DOM or WebGPU types.
 *
 * The consumer installs the tarballs and TypeScript only (no `@types/node`), compiles with
 * `lib: ["ES2022"]` (no DOM), `types: []`, `strict`, `skipLibCheck: false` and NodeNext, and
 * imports every entry point that declares types. A published `.d.ts` that names a Node, DOM,
 * workerpool or WebGPU global then fails with TS2304, TS2307, TS2503 or TS2591.
 * Regression gate for dogfood #886, #890, #697 and #726.
 *
 * Entries in `consumer-entries.json` `nodeOnly` are Node runtimes and are skipped; each carries
 * its reason. Options: `--skip-build` (use the existing dist folders), `--keep`.
 *
 * Run it with `node` (never `bun run`): `[run] bun = true` would put it on Bun.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  entrySpecifiers,
  installInto,
  installedVersion,
  packWorkspace,
  publicPackages,
  readEntryPolicy,
  run,
  runTsc,
} from './consumer-env.mjs';
import { MATHTS_WORKSPACE_PREFIX, repoRoot } from './workspaces.mjs';

const skipBuild = process.argv.includes('--skip-build');
const keep = process.argv.includes('--keep');

const packages = publicPackages();
const policy = readEntryPolicy();
if (!skipBuild) run('bun', ['run', 'build'], repoRoot);

const work = mkdtempSync(join(tmpdir(), 'mathts-no-node-'));
const consumer = join(work, 'consumer');

/**
 * Fails when any `@danielsimonjr/mathts-*` dependency would have come from the npm registry.
 * @param {string} consumerDir temporary consumer project root (holds `package-lock.json`)
 * @param {Set<string>} packedNames workspace package names installed as local tarballs
 */
function assertMathtsInstalledFromTarballs(consumerDir, packedNames) {
  const lock = JSON.parse(readFileSync(join(consumerDir, 'package-lock.json'), 'utf8'));
  const problems = [];
  /** @type {Map<string, string>} */
  const installed = new Map();
  for (const [pkgPath, meta] of Object.entries(lock.packages ?? {})) {
    if (pkgPath === '' || meta === undefined) continue;
    const scoped = /^node_modules\/(@danielsimonjr\/mathts-[^/]+)$/.exec(pkgPath);
    const name = typeof meta.name === 'string' ? meta.name : scoped?.[1];
    if (!name?.startsWith(MATHTS_WORKSPACE_PREFIX)) continue;
    installed.set(name, meta.resolved ?? '');
  }
  for (const name of packedNames) {
    const resolved = installed.get(name);
    if (resolved === undefined) problems.push(`${name}: not present in package-lock after install`);
    else if (!resolved.startsWith('file:')) problems.push(`${name}: expected file: tarball (got ${resolved})`);
  }
  for (const [name, resolved] of installed) {
    if (!resolved.startsWith('file:')) problems.push(`${name}: resolved from registry (${resolved})`);
  }
  if (problems.length > 0) {
    throw new Error(`consumer-typecheck-no-node: workspace packages must come from tarballs:\n${problems.join('\n')}`);
  }
}

let exitCode = 1;
try {
  const tgz = packWorkspace(packages, join(work, 'tarballs'));
  const specifiers = entrySpecifiers(packages, { types: true }).filter((s) => !(s in policy.nodeOnly));

  mkdirSync(consumer);
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({ name: 'mathts-consumer-no-node', private: true, type: 'module' }, null, 2)
  );
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify(
      {
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
      },
      null,
      2
    )
  );
  writeFileSync(
    join(consumer, 'index.ts'),
    specifiers.map((s, i) => `import * as m${i} from '${s}';`).join('\n') +
      `\nexport const all = [${specifiers.map((_, i) => `m${i}`).join(', ')}];\n`
  );

  installInto(consumer, [`typescript@${installedVersion('typescript')}`, ...tgz]);
  assertMathtsInstalledFromTarballs(consumer, new Set(packages.map(({ pkg }) => pkg.name)));

  const diagnostics = runTsc(consumer);
  console.log(
    `consumer-typecheck-no-node: ${packages.length} packages, ${specifiers.length} entry points, no @types/node, lib ES2022`
  );
  if (diagnostics.length > 0) {
    console.error(diagnostics.join('\n'));
    console.error(`consumer-typecheck-no-node: FAIL (${diagnostics.length} errors)`);
  } else {
    console.log('consumer-typecheck-no-node: PASS');
    exitCode = 0;
  }
} finally {
  if (keep) console.log(`consumer-typecheck-no-node: kept ${work}`);
  else rmSync(work, { recursive: true, force: true });
}
process.exit(exitCode);
