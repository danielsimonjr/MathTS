// Fails when `turbo run typecheck` or `turbo run test` can run before a build whose output it reads.
//
// A package's `typecheck` script compiles its tests, and those tests import the package by
// name (`@scope/pkg`), which resolves to its own `dist/`. `tsc -p tsconfig.test.json` in
// `expression` also pulls in `../functions/src`, and that code imports the `dist/` of `matrix`
// and `functions`. When `typecheck` declares only `^build` (the packages it depends on), the
// package's own `build` is free to clean and rewrite `dist/` while `tsc` reads it, and the run
// fails with TS7016 or TS2307. This gate reads the resolved task graph, so it also catches an
// override such as `<pkg>#typecheck` that drops the edge.
//
// The same holds for `test` and `test:coverage`: a test imports a workspace package by name, or
// reads its `dist/` by path, and that build must finish before the test starts (#1185). A
// hand-kept map of such reads misses every new one, so this gate derives them: it scans the
// `tests/` folder of each package for a quoted specifier of a workspace package (`import`,
// `import()`, `require`, a tsconfig `paths` key), for a path that holds `<workspace dir>/dist`,
// and for a relative string that resolves into the `src`, `dist` or `build` folder (or the root
// folder) of another workspace package. A test that imports `../../functions/src/x.js` runs the
// source of `functions`, and that source imports the `dist/` of its own dependencies, so the
// gate requires the build of the package itself: that build closure holds the builds of its
// dependencies. The gate requires the build of each package that it finds in the transitive
// closure of the task. The scan reads text, not the module graph. It cannot see a `dist` path
// that a test builds at run time from parts that are not one relative string. The root `tests/`
// folder is not a task: `bun run test` runs `vitest run` on it after `turbo run test` has ended,
// so its reads cannot race a build. A hit that is not a read is a defect of the scan rule, not a
// reason for an allowlist.
//
// Usage: node tools/test/check-typecheck-graph.mjs   (needs `bun install`; builds nothing)
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

/**
 * Read the name, folder and script names of every workspace package.
 * @returns {{name: string, dir: string, scripts: Record<string, string>, hasTestTsconfig: boolean}[]}
 *   `dir` is relative to the repository root; `hasTestTsconfig` tells that `<dir>/tsconfig.test.json`
 *   exists, which means that the typecheck of that package compiles its tests
 */
export function readWorkspacePackages() {
  return workspaceDirs().map((dir) => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'));
    return {
      name: pkg.name,
      dir,
      scripts: pkg.scripts ?? {},
      hasTestTsconfig: existsSync(join(repoRoot, dir, 'tsconfig.test.json')),
    };
  });
}

/**
 * Compare the typecheck task graph with what the packages read.
 * @param {{taskId: string, dependencies: string[]}[]} tasks  `tasks` of `turbo run typecheck --dry=json`
 * @param {{name: string, scripts: Record<string, string>}[]} packages
 * @returns {string[]} one message per missing edge or missing task; empty when the graph is sound
 */
export function findMissingEdges(tasks, packages) {
  const deps = new Map(tasks.map((t) => [t.taskId, new Set(t.dependencies)]));
  const problems = [];

  for (const { name, scripts } of packages) {
    if (!scripts.typecheck) continue;
    const typecheck = `${name}#typecheck`;
    const own = `${name}#build`;
    const edges = deps.get(typecheck);
    if (!edges) {
      problems.push(`${typecheck} is not in the task graph`);
    } else if (scripts.build && !edges.has(own)) {
      problems.push(`${typecheck} does not wait for ${own}`);
    }
  }

  return problems;
}

/** Folders that hold generated files, not tests. */
const SKIPPED_FOLDERS = new Set(['node_modules', 'dist', 'coverage']);

/** Files that can name a workspace package: code and tsconfig files. */
const SCANNED_FILE = /\.(?:ts|mts|mjs|js|json)$/;

/**
 * Escape a text for use inside a regular expression.
 * @param {string} text  the literal text
 * @returns {string} the text with every special character escaped
 */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find the workspace packages that a file text reads. A package is read when the text holds its
 * full name as a quoted specifier (`'@scope/name'` or `'@scope/name/sub'`, single or double
 * quote), or a path that holds `<workspace dir>/dist` after a quote or a path separator.
 * A name in a comment, in backticks or inside a longer word is not a read.
 * @param {string} text  content of a test file
 * @param {{name: string, dir: string}[]} packages  every workspace package
 * @returns {string[]} names of the packages that the text reads, in the order of `packages`
 */
export function workspaceInputs(text, packages) {
  const found = [];
  for (const { name, dir } of packages) {
    const specifier = new RegExp(`['"]${escapeRegExp(name)}(?:/[^'"\\s]*)?['"]`);
    const distPath = new RegExp(`(?:^|['"\`/\\\\])${escapeRegExp(dir)}/dist(?![\\w-])`, 'm');
    if (specifier.test(text) || distPath.test(text)) found.push(name);
  }
  return found;
}

/** Folders of a package that a relative path can read at run time or compile time. */
const READ_FOLDERS = new Set(['src', 'dist', 'build']);

/**
 * Find the workspace packages that a file reads through a relative string such as
 * `'../../functions/src/index.js'`. The string is resolved against the folder of the file. It is a
 * read when the result lies in the `src`, `dist` or `build` folder of a workspace package, or is
 * the folder of that package itself (a path that a test completes at run time). A path to the
 * `tests` folder or to a document of another package is not a read.
 * @param {string} text  content of a test file
 * @param {string} file  absolute path of that file
 * @param {{name: string, dir: string}[]} packages  every workspace package
 * @param {string} [root]  repository root; defaults to this checkout
 * @returns {string[]} names of the packages that the text reads, in the order of first use
 */
export function relativeInputs(text, file, packages, root = repoRoot) {
  const found = new Set();
  for (const [, , literal] of text.matchAll(/(['"`])(\.{1,2}\/[^'"`\n]*)\1/g)) {
    const path = relative(root, resolve(dirname(file), literal))
      .split(sep)
      .join('/');
    let owner;
    for (const pkg of packages) {
      const inside = path === pkg.dir || path.startsWith(`${pkg.dir}/`);
      if (inside && (!owner || pkg.dir.length > owner.dir.length)) owner = pkg;
    }
    if (!owner) continue;
    const folder = path.slice(owner.dir.length + 1).split('/')[0];
    if (folder === '' || READ_FOLDERS.has(folder)) found.add(owner.name);
  }
  return [...found];
}

/**
 * List the scanned files under a folder, depth first, in name order.
 * @param {string} folder  absolute path
 * @returns {Generator<string>} absolute file paths
 */
function* scannedFiles(folder) {
  const entries = readdirSync(folder, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIPPED_FOLDERS.has(entry.name)) yield* scannedFiles(join(folder, entry.name));
    } else if (SCANNED_FILE.test(entry.name)) {
      yield join(folder, entry.name);
    }
  }
}

/**
 * Read which workspace packages the tests of each package read.
 * @param {{name: string, dir: string}[]} packages  every workspace package
 * @param {string} [root]  repository root; defaults to this checkout (tests pass a fixture)
 * @returns {{name: string, inputs: Map<string, string>}[]} per package with at least one input:
 *   the packages that its `tests/` folder reads, each with the first file that reads it (a path
 *   relative to `root`, with `/`). A package never lists itself.
 */
export function readTestInputs(packages, root = repoRoot) {
  const found = [];
  for (const { name, dir } of packages) {
    const folder = join(root, dir, 'tests');
    if (!existsSync(folder)) continue;
    const inputs = new Map();
    for (const file of scannedFiles(folder)) {
      const text = readFileSync(file, 'utf8');
      const read = [
        ...workspaceInputs(text, packages),
        ...relativeInputs(text, file, packages, root),
      ];
      for (const input of read) {
        if (input !== name && !inputs.has(input)) {
          inputs.set(input, relative(root, file).split(sep).join('/'));
        }
      }
    }
    if (inputs.size > 0) found.push({ name, inputs });
  }
  return found;
}

/**
 * Collect every task that a task waits for, directly or through other tasks.
 * @param {string[]} direct  the `dependencies` of the task
 * @param {Map<string, string[]>} deps  `dependencies` by task id
 * @returns {Set<string>} the task ids of the transitive closure
 */
function closureOf(direct, deps) {
  const seen = new Set();
  const queue = [...direct];
  while (queue.length > 0) {
    const task = queue.pop();
    if (seen.has(task)) continue;
    seen.add(task);
    for (const next of deps.get(task) ?? []) queue.push(next);
  }
  return seen;
}

/**
 * Compare the test and typecheck task graph with the builds that the tests read.
 * @param {{taskId: string, dependencies: string[]}[]} tasks  `tasks` of `turbo run typecheck test test:coverage --dry=json`
 * @param {{name: string, scripts: Record<string, string>, hasTestTsconfig: boolean}[]} packages
 * @param {{name: string, inputs: Map<string, string>}[]} inputs  result of `readTestInputs`
 * @returns {string[]} one message per missing edge or missing task; empty when the graph is sound
 */
export function findMissingInputEdges(tasks, packages, inputs) {
  const deps = new Map(tasks.map((t) => [t.taskId, t.dependencies]));
  const byName = new Map(packages.map((p) => [p.name, p]));
  const reads = new Map(inputs.map((i) => [i.name, i.inputs]));
  const problems = [];

  for (const { name, scripts, hasTestTsconfig } of packages) {
    const owed = [];
    if (scripts.test) owed.push('test');
    if (scripts['test:coverage']) owed.push('test:coverage');
    if (scripts.typecheck && hasTestTsconfig) owed.push('typecheck');
    for (const script of owed) {
      const task = `${name}#${script}`;
      const direct = deps.get(task);
      if (!direct) {
        problems.push(`${task} is not in the task graph`);
        continue;
      }
      const closure = closureOf(direct, deps);
      for (const [input, file] of reads.get(name) ?? []) {
        if (!byName.get(input)?.scripts.build) continue;
        if (!closure.has(`${input}#build`)) {
          problems.push(`${task} does not wait for ${input}#build (read by ${file})`);
        }
      }
    }
  }
  return problems;
}

/** Ask Turbo for the typecheck, test and coverage graph without running anything. */
function readTaskGraph() {
  const turbo = join(repoRoot, 'node_modules', 'turbo', 'bin', 'turbo');
  const out = execFileSync(
    process.execPath,
    [turbo, 'run', 'typecheck', 'test', 'test:coverage', '--dry=json'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  return JSON.parse(out).tasks;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tasks = readTaskGraph();
  const packages = readWorkspacePackages();
  const problems = [
    ...findMissingEdges(tasks, packages),
    ...findMissingInputEdges(tasks, packages, readTestInputs(packages)),
  ];
  if (problems.length > 0) {
    console.error('turbo typecheck and test can race the builds they read:');
    for (const p of problems) console.error(`  ${p}`);
    console.error(
      'Declare the edge in turbo.json (`typecheck`, `test`, `test:coverage` or a `<pkg>#<task>` dependsOn).'
    );
    process.exit(1);
  }
  console.log('Every typecheck and test task waits for the builds it reads.');
}
