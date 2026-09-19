#!/usr/bin/env node
/**
 * Consumer type check of the PACKED public packages.
 *
 * This script checks the declarations that npm consumers really receive. It does these steps:
 *   1. Build the workspace (`bun run build`), unless `--skip-build` is given.
 *   2. `npm pack` every non-private workspace package into a temporary directory.
 *   3. Install all tarballs, plus the repository's TypeScript version, into a temporary
 *      consumer project.
 *   4. Import every public entry point (each `exports` subpath that has `types`) and run
 *      `tsc --noEmit` with `strict` and `skipLibCheck: false`.
 *
 * Any compiler error fails the run (exit 1), except the pre-existing errors in KNOWN_ERRORS. The monorepo's own `tsc` runs do not find these
 * errors: they read source, not the emitted `.d.ts`, and consumers with `skipLibCheck: false`
 * also check the emitted `.d.ts` against their own lib (for example TS2416 in core 0.15.0
 * `dist/map.d.ts`, where `keys()` returned `IterableIterator` but the TS >= 5.6 `Map` declares
 * `MapIterator`).
 *
 * Options:
 *   --module-resolution=<Bundler|NodeNext>  Consumer resolution mode. Default: Bundler.
 *   --packages=<dir,dir>                    Limit to these workspace directories.
 *   --skip-build                            Use the existing dist folders.
 *   --keep                                  Keep the temporary directory.
 *
 * Run it with `node` (never `bun run`): `[run] bun = true` would put it on Bun.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

/**
 * Pre-existing consumer errors, accepted by package and error code so that any NEW error fails.
 * Remove an entry when its cause is fixed; the script warns when an entry no longer matches.
 */
const KNOWN_ERRORS = [
  {
    pkg: '@danielsimonjr/mathts-matrix',
    code: 'TS7016',
    reason:
      "dist .d.ts imports 'typed-function', which is not a declared dependency (resolves to an untyped copy)",
  },
  {
    pkg: '@danielsimonjr/mathts-compat',
    code: 'TS7016',
    reason:
      "dist .d.ts imports 'typed-function', which is not a declared dependency (resolves to an untyped copy)",
  },
];

const args = process.argv.slice(2);
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const flag = (name) => args.includes(`--${name}`);

const resolution = option('module-resolution') ?? 'Bundler';
if (!['Bundler', 'NodeNext'].includes(resolution)) {
  console.error(`consumer-typecheck: unknown --module-resolution=${resolution}`);
  process.exit(2);
}
const onlyDirs = option('packages')?.split(',');

const isWindows = process.platform === 'win32';
/**
 * Run a command and stream its output.
 * @param {string} cmd - executable name.
 * @param {string[]} argv - arguments.
 * @param {string} cwd - working directory.
 */
function run(cmd, argv, cwd) {
  execFileSync(cmd, argv, { cwd, stdio: 'inherit', shell: isWindows });
}

const packages = workspaceDirs()
  .filter((dir) => !onlyDirs || onlyDirs.includes(dir))
  .map((dir) => ({
    dir,
    pkg: JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8')),
  }))
  .filter(({ pkg }) => !pkg.private);
if (packages.length === 0) {
  console.error('consumer-typecheck: no public packages selected');
  process.exit(2);
}

if (!flag('skip-build')) run('bun', ['run', 'build'], repoRoot);

const work = mkdtempSync(join(tmpdir(), 'mathts-consumer-'));
const tarballs = join(work, 'tarballs');
const consumer = join(work, 'consumer');
let exitCode = 1;
mkdirSync(tarballs);
try {
  for (const { dir } of packages) {
    run(
      'npm',
      ['pack', '--ignore-scripts', '--silent', '--pack-destination', tarballs],
      join(repoRoot, dir)
    );
  }
  const tgz = readdirSync(tarballs).filter((f) => f.endsWith('.tgz'));
  const installedVersion = (name) =>
    JSON.parse(readFileSync(join(repoRoot, 'node_modules', name, 'package.json'), 'utf8')).version;
  const tsVersion = installedVersion('typescript');
  // plot/render is a Node entry (it uses Buffer), so the consumer is a Node consumer.
  const nodeTypesVersion = installedVersion('@types/node');

  // Every public entry point that declares types.
  const specifiers = packages.flatMap(({ pkg }) => {
    const exp = pkg.exports ?? { '.': { types: pkg.types } };
    return Object.entries(exp)
      .filter(([, target]) => typeof target === 'object' && target !== null && target.types)
      .map(([sub]) => (sub === '.' ? pkg.name : `${pkg.name}/${sub.slice(2)}`));
  });

  const nodeNext = resolution === 'NodeNext';
  const files = {
    'package.json': JSON.stringify(
      { name: 'mathts-consumer', private: true, type: 'module' },
      null,
      2
    ),
    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          target: 'ES2022',
          lib: ['ESNext', 'DOM'],
          module: nodeNext ? 'NodeNext' : 'ESNext',
          moduleResolution: resolution,
          types: ['node'],
        },
        files: ['index.ts'],
      },
      null,
      2
    ),
    'index.ts':
      specifiers.map((s, i) => `import * as m${i} from '${s}';`).join('\n') +
      `\nexport const all = [${specifiers.map((_, i) => `m${i}`).join(', ')}];\n`,
  };
  mkdirSync(consumer);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(consumer, name), text);

  run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--loglevel=error',
      `typescript@${tsVersion}`,
      `@types/node@${nodeTypesVersion}`,
      ...tgz.map((f) => join(tarballs, f)),
    ],
    consumer
  );

  console.log(
    `consumer-typecheck: ${packages.length} packages, ${specifiers.length} entry points, ` +
      `moduleResolution ${resolution}, TypeScript ${tsVersion}`
  );
  let output = '';
  try {
    output = execFileSync('npx', ['--no-install', 'tsc', '-p', '.'], {
      cwd: consumer,
      encoding: 'utf8',
      shell: isWindows,
    });
  } catch (err) {
    output = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    if (!/error TS\d+/.test(output)) throw err; // tsc itself failed to run
  }
  // One diagnostic = a line with "error TSnnnn" plus its indented continuation lines.
  const diagnostics = output.split(/\r?\n(?=\S)/).filter((d) => /error TS\d+/.test(d));
  const hits = new Map(KNOWN_ERRORS.map((k) => [k, 0]));
  const unexpected = diagnostics.filter((d) => {
    const known = KNOWN_ERRORS.find(
      (k) => d.startsWith(`node_modules/${k.pkg}/`) && d.includes(`error ${k.code}:`)
    );
    if (known) hits.set(known, hits.get(known) + 1);
    return !known;
  });
  for (const [k, n] of hits) {
    if (n > 0) console.log(`consumer-typecheck: known ${k.code} x${n} in ${k.pkg} (${k.reason})`);
    else
      console.warn(
        `consumer-typecheck: WARNING known entry ${k.pkg} ${k.code} no longer matches; remove it`
      );
  }
  if (unexpected.length === 0) {
    console.log('consumer-typecheck: PASS (0 unexpected errors)');
    exitCode = 0;
  } else {
    console.error(unexpected.join('\n'));
    console.error(`consumer-typecheck: FAIL (${unexpected.length} unexpected errors)`);
  }
} finally {
  if (flag('keep')) console.log(`consumer-typecheck: kept ${work}`);
  else rmSync(work, { recursive: true, force: true });
}
process.exit(exitCode);
