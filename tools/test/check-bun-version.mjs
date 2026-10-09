// Fails when the Bun on PATH is not the version pinned in package.json `packageManager`.
// Bun does not enforce that field itself, so CI runs this right after the Bun setup step.
// Usage: node tools/test/check-bun-version.mjs   (also works under bun)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const match = /^bun@(\d+\.\d+\.\d+)$/.exec(pkg.packageManager ?? '');
if (!match) {
  console.error(`package.json packageManager must be "bun@<x.y.z>", got: ${pkg.packageManager}`);
  process.exit(1);
}
const pinned = match[1];

let actual;
try {
  actual = execFileSync('bun', ['--version'], { encoding: 'utf8' }).trim();
} catch (error) {
  console.error(`Cannot run \`bun --version\`: ${error.message}`);
  process.exit(1);
}

if (actual !== pinned) {
  console.error(`Bun version mismatch: package.json pins ${pinned}, found ${actual}.`);
  process.exit(1);
}
console.log(`Bun ${actual} matches the packageManager pin.`);
