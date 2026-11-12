#!/usr/bin/env node
/**
 * Strict consumer typecheck of packed functions/matrix/linalg WITHOUT @types/node.
 * Regression gate for dogfood #697 (workerpool Node types leaking into consumers).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MATHTS_WORKSPACE_PREFIX,
  repoRoot,
  workspaceMathtsClosure,
  workspacePackageDirsByName,
} from './workspaces.mjs';

/** Workspace dirs reached from what the temporary consumer imports. */
const CONSUMER_SEED_DIRS = ['functions'];
const WORKERPOOL_VENDOR = 'workerpool';

const skipBuild = process.argv.includes('--skip-build');

const packDirs = workspaceMathtsClosure(CONSUMER_SEED_DIRS);

if (!skipBuild) {
  execFileSync('npx', ['turbo', 'build', ...packDirs.flatMap((d) => ['--filter', `./${d}`])], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

const nameByDir = new Map(
  [...workspacePackageDirsByName().entries()].map(([name, dir]) => [dir, name])
);

const work = mkdtempSync(join(tmpdir(), 'mathts-no-node-'));
const tarballs = join(work, 'tarballs');
const consumer = join(work, 'consumer');
mkdirSync(tarballs);

/**
 * Resolves the npm package name for a `package-lock.json` `packages` entry.
 * Lockfile v3 often omits `name`; derive it from `node_modules/@danielsimonjr/mathts-*` keys when needed.
 * @param {string} pkgPath - lock `packages` key (for example `node_modules/@danielsimonjr/mathts-core`)
 * @param {{ name?: string }} meta - lockfile row metadata
 * @returns {string | null} package name, or null when the row is not a direct mathts install path
 */
function lockEntryPackageName(pkgPath, meta) {
  if (typeof meta?.name === 'string') return meta.name;
  const scoped = /^node_modules\/(@danielsimonjr\/mathts-[^/]+)$/.exec(pkgPath);
  return scoped ? scoped[1] : null;
}

/**
 * Fails when any `@danielsimonjr/mathts-*` dependency would have come from the npm registry.
 * @param {string} consumerDir - temporary consumer project root (holds `package-lock.json`)
 * @param {Set<string>} packedNames - workspace package names installed as local tarballs
 * @returns {void}
 */
function assertMathtsInstalledFromTarballs(consumerDir, packedNames) {
  const lockPath = join(consumerDir, 'package-lock.json');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const problems = [];
  /** @type {Map<string, string>} name -> resolved */
  const installed = new Map();

  for (const [pkgPath, meta] of Object.entries(lock.packages ?? {})) {
    if (pkgPath === '' || meta === undefined) continue;
    const name = lockEntryPackageName(pkgPath, meta);
    if (name === null || !name.startsWith(MATHTS_WORKSPACE_PREFIX)) continue;
    installed.set(name, meta.resolved ?? '');
  }

  for (const name of packedNames) {
    const resolved = installed.get(name);
    if (resolved === undefined) {
      problems.push(`${name}: not present in package-lock after install`);
      continue;
    }
    if (!resolved.startsWith('file:')) {
      problems.push(`${name}: expected file: tarball (got ${resolved || '(missing resolved)'})`);
    }
  }

  for (const [name, resolved] of installed) {
    if (!resolved.startsWith('file:')) {
      problems.push(`${name}: workspace package resolved from registry (${resolved})`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `consumer-typecheck-no-node: workspace packages must not come from the registry:\n${problems.join('\n')}`
    );
  }
}

try {
  for (const dir of packDirs) {
    execFileSync(
      'npm',
      ['pack', '--ignore-scripts', '--silent', '--pack-destination', tarballs],
      { cwd: join(repoRoot, dir), stdio: 'inherit' }
    );
  }
  // Packed @danielsimonjr/mathts-* tarballs still depend on registry workerpool; ship the
  // patched fork the monorepo installs so #697 is tested against the same types consumers
  // receive once the workerpool fork release ships this patch.
  execFileSync(
    'npm',
    ['pack', '--ignore-scripts', '--silent', '--pack-destination', tarballs],
    { cwd: join(repoRoot, 'node_modules', WORKERPOOL_VENDOR), stdio: 'inherit' }
  );
  const tgz = readdirSync(tarballs).filter((f) => f.endsWith('.tgz'));
  const wpTgz = tgz.find((f) => /workerpool-10/.test(f));
  if (!wpTgz) throw new Error('consumer-typecheck-no-node: missing patched workerpool pack');
  const packedNames = new Set(
    packDirs.map((dir) => {
      const name = nameByDir.get(dir);
      if (name === undefined) throw new Error(`consumer-typecheck-no-node: no package name for ${dir}`);
      return name;
    })
  );
  const tsVersion = JSON.parse(
    readFileSync(join(repoRoot, 'node_modules/typescript/package.json'), 'utf8')
  ).version;

  mkdirSync(consumer);
  mkdirSync(join(consumer, 'src'));
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify(
      {
        name: 'mathts-consumer-no-node',
        private: true,
        type: 'module',
        overrides: { workerpool: `file:${join(tarballs, wpTgz)}` },
      },
      null,
      2
    )
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
          lib: ['ESNext', 'DOM'],
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
        },
        include: ['src'],
      },
      null,
      2
    )
  );
  writeFileSync(
    join(consumer, 'src', 'consumer.ts'),
    `import { det } from '@danielsimonjr/mathts-functions';\nconst d: number = det([[1, 2], [3, 4]]);\nexport { d };\n`
  );

  const mathtsTgz = tgz.filter((f) => f !== wpTgz).map((f) => join(tarballs, f));
  execFileSync(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--loglevel=error',
      `typescript@${tsVersion}`,
      ...mathtsTgz,
    ],
    { cwd: consumer, stdio: 'inherit' }
  );

  assertMathtsInstalledFromTarballs(consumer, packedNames);

  let output = '';
  try {
    execFileSync('npx', ['--no-install', 'tsc', '-p', '.'], { cwd: consumer, stdio: 'pipe' });
  } catch (err) {
    output = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    if (!/error TS\d+/.test(output)) throw err;
  }

  if (/error TS\d+/.test(output)) {
    console.error(output);
    console.error('consumer-typecheck-no-node: FAIL');
    process.exit(1);
  }
  console.log('consumer-typecheck-no-node: PASS');
} finally {
  rmSync(work, { recursive: true, force: true });
}
