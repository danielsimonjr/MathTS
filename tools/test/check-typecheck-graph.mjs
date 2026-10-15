// Fails when `turbo run typecheck` can run before a build whose output it reads.
//
// A package's `typecheck` script compiles its tests, and those tests import the package by
// name (`@scope/pkg`), which resolves to its own `dist/`. `tsc -p tsconfig.test.json` in
// `expression` also pulls in `../functions/src`, and that code imports the `dist/` of `matrix`
// and `functions`. When `typecheck` declares only `^build` (the packages it depends on), the
// package's own `build` is free to clean and rewrite `dist/` while `tsc` reads it, and the run
// fails with TS7016 or TS2307. This gate reads the resolved task graph, so it also catches an
// override such as `<pkg>#typecheck` that drops the edge.
//
// Usage: node tools/test/check-typecheck-graph.mjs   (needs `bun install`; builds nothing)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

/**
 * Builds that a package's typecheck reads without the package.json graph showing it.
 * Key: the typecheck task. Value: the build tasks it must wait for.
 */
export const CROSS_PACKAGE_EDGES = {
  // tests/helpers/bootstrap.ts imports ../../../functions/src, which imports the built
  // declarations of matrix and functions.
  '@danielsimonjr/mathts-expression#typecheck': [
    '@danielsimonjr/mathts-matrix#build',
    '@danielsimonjr/mathts-functions#build',
  ],
};

/**
 * Read the name and script names of every workspace package.
 * @returns {{name: string, scripts: Record<string, string>}[]}
 */
export function readWorkspacePackages() {
  return workspaceDirs().map((dir) => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'));
    return { name: pkg.name, scripts: pkg.scripts ?? {} };
  });
}

/**
 * Compare the typecheck task graph with what the packages read.
 * @param {{taskId: string, dependencies: string[]}[]} tasks  `tasks` of `turbo run typecheck --dry=json`
 * @param {{name: string, scripts: Record<string, string>}[]} packages
 * @param {Record<string, string[]>} [crossEdges]  extra edges to require, by typecheck task
 * @returns {string[]} one message per missing edge or missing task; empty when the graph is sound
 */
export function findMissingEdges(tasks, packages, crossEdges = CROSS_PACKAGE_EDGES) {
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

  for (const [typecheck, builds] of Object.entries(crossEdges)) {
    const edges = deps.get(typecheck);
    if (!edges) {
      const note = `${typecheck} is not in the task graph`;
      if (!problems.includes(note)) problems.push(note);
      continue;
    }
    for (const build of builds) {
      if (!edges.has(build)) problems.push(`${typecheck} does not wait for ${build}`);
    }
  }
  return problems;
}

/** Ask Turbo for the typecheck graph without running anything. */
function readTypecheckGraph() {
  const turbo = join(repoRoot, 'node_modules', 'turbo', 'bin', 'turbo');
  const out = execFileSync(process.execPath, [turbo, 'run', 'typecheck', '--dry=json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out).tasks;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = findMissingEdges(readTypecheckGraph(), readWorkspacePackages());
  if (problems.length > 0) {
    console.error('turbo typecheck can race the builds it reads:');
    for (const p of problems) console.error(`  ${p}`);
    console.error('Declare the edge in turbo.json (`typecheck` or `<pkg>#typecheck` dependsOn).');
    process.exit(1);
  }
  console.log('Every typecheck task waits for the builds it reads.');
}
