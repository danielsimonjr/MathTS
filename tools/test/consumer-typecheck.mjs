#!/usr/bin/env node
/**
 * Consumer type check of the PACKED public packages.
 *
 * This script checks the declarations that npm consumers really receive. It does these steps:
 *   1. Build the workspace (`bun run build`), unless `--skip-build` is given.
 *   2. `npm pack` every non-private workspace package into a temporary directory.
 *   3. Install all tarballs, plus the repository's TypeScript version, into a temporary
 *      consumer project.
 *   4. Check the AssemblyScript binary each SHIPPED_WASM package must carry: present in
 *      the installed package, valid WebAssembly, and matching its SHA-384 manifest.
 *   5. Import every public entry point (each `exports` subpath that has `types`) and run
 *      `tsc --noEmit` with `strict` and `skipLibCheck: false`.
 *   6. In the same run, assert that every export which is a function at runtime is declared
 *      callable (or constructible). 131 `functions` exports (`det`, `inv`, `zeros`, ...)
 *      were once declared `unknown` or as their return value, so every consumer call
 *      needed a cast, and step 5 could not see it: an uncallable declaration is still a
 *      valid one.
 *
 * Any compiler error or shipped-wasm problem fails the run (exit 1), except the pre-existing
 * compiler errors in KNOWN_ERRORS. The monorepo's own `tsc` runs do not find these
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
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

/**
 * Pre-existing consumer errors, accepted by package and error code so that any NEW error fails.
 * Remove an entry when its cause is fixed; the script warns when an entry no longer matches.
 */
const KNOWN_ERRORS = [];

/**
 * Packages whose tarball must carry the AssemblyScript binary. `copy-wasm.mjs` fails
 * the build without it, but a publish from a machine with a stale cache could still
 * ship a dist that lacks it, and consumers would then silently run the JS fallback.
 * So the INSTALLED package is checked: the file exists, is valid WebAssembly, and its
 * SHA-384 matches the manifest beside it, which the loaders verify before instantiating.
 */
const SHIPPED_WASM = [
  { pkg: '@danielsimonjr/mathts-matrix', file: 'dist/wasm/mathts-as.wasm' },
  { pkg: '@danielsimonjr/mathts-functions', file: 'dist/wasm/mathts-as.wasm' },
];

/** Problems with the wasm shipped in the installed packages (empty when all are sound). */
function shippedWasmProblems(consumerDir, selectedNames) {
  const problems = [];
  for (const { pkg, file } of SHIPPED_WASM) {
    if (!selectedNames.has(pkg)) continue;
    const wasmPath = join(consumerDir, 'node_modules', pkg, file);
    if (!existsSync(wasmPath)) {
      problems.push(`${pkg}: ${file} is missing from the packed tarball`);
      continue;
    }
    const bytes = readFileSync(wasmPath);
    if (!WebAssembly.validate(bytes)) problems.push(`${pkg}: ${file} is not valid WebAssembly`);
    const manifestPath = join(dirname(wasmPath), 'wasm-manifest.json');
    if (!existsSync(manifestPath)) {
      problems.push(`${pkg}: no wasm-manifest.json beside ${file}`);
      continue;
    }
    const expected = JSON.parse(readFileSync(manifestPath, 'utf8'))[basename(file)];
    const actual = `sha384-${createHash('sha384').update(bytes).digest('base64')}`;
    if (expected !== actual) {
      problems.push(`${pkg}: manifest says ${expected ?? '(no entry)'} but ${file} is ${actual}`);
    }
  }
  return problems;
}

/**
 * Entry points the callability check cannot import: a worker script registers the
 * importing process as a pool worker (and throws outside a worker). They are still
 * type-checked by step 5.
 */
const WORKER_ENTRIES = new Set(['@danielsimonjr/mathts-workerpool/worker']);

/**
 * The exports of each entry point that are functions at runtime, read by importing the
 * installed packages in Node from the consumer directory.
 * @returns {Record<string, string[]>} specifier -> export names
 */
function runtimeFunctionExports(consumerDir, specifiers) {
  const script = [
    'const out = {};',
    'for (const s of JSON.parse(process.argv[1])) {',
    '  const m = await import(s);',
    "  out[s] = Object.keys(m).filter((k) => typeof m[k] === 'function');",
    '}',
    'console.log(JSON.stringify(out));',
    'process.exit(0);',
  ].join('\n');
  const json = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', script, JSON.stringify(specifiers)],
    { cwd: consumerDir, encoding: 'utf8' }
  );
  return JSON.parse(json.trim().split(/\r?\n/).pop());
}

/**
 * A module asserting, one line per export, that each runtime function is declared callable.
 * @returns {{ text: string, lineNames: Map<number, string> }}
 */
function callableAssertions(specifiers, functionsBySpecifier) {
  const lines = [
    '// Generated by consumer-typecheck: every runtime-function export must be callable.',
    'type IsCallable<T> = [T] extends [(...args: never[]) => unknown]',
    '  ? true',
    '  : [T] extends [abstract new (...args: never[]) => unknown]',
    '    ? true',
    '    : [T] extends [{ prototype: unknown }]',
    '      ? true // a class with a private constructor, such as core BigNumber',
    '      : false;',
  ];
  specifiers.forEach((s, i) => lines.push(`import type * as m${i} from '${s}';`));
  const lineNames = new Map();
  let n = 0;
  specifiers.forEach((s, i) => {
    for (const name of functionsBySpecifier[s]) {
      const key = /^[A-Za-z_$][\w$]*$/.test(name) ? `.${name}` : `[${JSON.stringify(name)}]`;
      lines.push(`export const c${n++}: true = null as unknown as IsCallable<typeof m${i}${key}>;`);
      lineNames.set(lines.length, `${s} export '${name}'`);
    }
  });
  return { text: `${lines.join('\n')}\n`, lineNames };
}

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
  // npm 10 cannot install the github: typed-function dependency; see the CI step comment.
  const npmVersion = execFileSync('npm', ['--version'], {
    encoding: 'utf8',
    shell: isWindows,
  }).trim();

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
        files: ['index.ts', 'callable.ts'],
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
      `moduleResolution ${resolution}, TypeScript ${tsVersion}, npm ${npmVersion}`
  );
  const selectedNames = new Set(packages.map(({ pkg }) => pkg.name));
  const wasmProblems = shippedWasmProblems(consumer, selectedNames);
  const wasmChecked = SHIPPED_WASM.filter(({ pkg }) => selectedNames.has(pkg)).length;
  if (wasmProblems.length > 0) {
    for (const problem of wasmProblems) console.error(`consumer-typecheck: ${problem}`);
  } else if (wasmChecked > 0) {
    console.log(`consumer-typecheck: shipped wasm OK in ${wasmChecked} package(s)`);
  }
  const importable = specifiers.filter((s) => !WORKER_ENTRIES.has(s));
  const functionsBySpecifier = runtimeFunctionExports(consumer, importable);
  const callable = callableAssertions(importable, functionsBySpecifier);
  writeFileSync(join(consumer, 'callable.ts'), callable.text);
  console.log(
    `consumer-typecheck: asserting ${callable.lineNames.size} runtime-function exports are callable`
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
  const diagnostics = output
    .split(/\r?\n(?=\S)/)
    .filter((d) => /error TS\d+/.test(d))
    .map((d) => {
      const line = Number(d.match(/^callable\.ts\((\d+),/)?.[1]);
      const name = callable.lineNames.get(line);
      return name ? `${d}\n  -> ${name} is a function at runtime but not callable in its .d.ts` : d;
    });
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
  if (unexpected.length === 0 && wasmProblems.length === 0) {
    console.log('consumer-typecheck: PASS (0 unexpected errors)');
    exitCode = 0;
  } else if (unexpected.length === 0) {
    console.error(`consumer-typecheck: FAIL (${wasmProblems.length} shipped-wasm problem(s))`);
  } else {
    console.error(unexpected.join('\n'));
    console.error(`consumer-typecheck: FAIL (${unexpected.length} unexpected errors)`);
  }
} finally {
  if (flag('keep')) console.log(`consumer-typecheck: kept ${work}`);
  else rmSync(work, { recursive: true, force: true });
}
process.exit(exitCode);
