// Post-build step for @danielsimonjr/mathts-workerpool.
//
// The published declarations must be self-contained: a consumer with `skipLibCheck: false`
// and no `@types/node` has to load them. They therefore name no type of the `workerpool`
// package (its own `.d.ts` files import `child_process` and `worker_threads`) and no
// DOM or Node global. `src/pool-types.ts` holds the pool types instead.
//
// This script runs strictly AFTER `tsc -p tsconfig.dts.json` and fails the build when a
// declaration file still imports `workerpool`, has a triple-slash path reference, or names
// the DOM `Transferable`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'dist');
if (!existsSync(path.join(dist, 'index.d.ts'))) {
  throw new Error(
    `postbuild: expected ${dist}/index.d.ts to exist (run after the tsc declaration step)`
  );
}

const forbidden = [
  [/from\s+['"]workerpool['"]|import\(['"]workerpool['"]\)/, "imports 'workerpool'"],
  [/reference\s+path=/, 'has a triple-slash path reference'],
  [/(?<![\w.])Transferable\b/, "names the DOM 'Transferable'"],
];
const problems = [];
for (const name of readdirSync(dist).filter((f) => f.endsWith('.d.ts'))) {
  const text = readFileSync(path.join(dist, name), 'utf8');
  // Ignore comment lines, which may quote the names above.
  const code = text
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
    .join('\n');
  for (const [re, what] of forbidden) if (re.test(code)) problems.push(`${name} ${what}`);
}
if (problems.length > 0) {
  throw new Error(
    `postbuild: published declarations are not self-contained:\n${problems.join('\n')}`
  );
}
