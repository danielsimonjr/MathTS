// Check a Changesets version PR against the source tree that backs each existing tag.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

const tags = new Set(git(['tag', '--list']).split('\n'));
const failures = [];
for (const dir of workspaceDirs()) {
  const pkg = JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'));
  if (pkg.private) continue;
  const tag = `${pkg.name}@${pkg.version}`;
  if (!tags.has(tag)) continue;
  const sourcePaths = ['src', 'types', 'package.json', 'asconfig.json', 'tsdown.config.ts'].map(
    (p) => join(dir, p)
  );
  const changed = git(['diff', '--name-only', tag, 'HEAD', '--', ...sourcePaths]);
  if (changed) failures.push(`${tag} already exists but its package sources differ:\n${changed}`);
}
if (failures.length) {
  console.error(failures.join('\n\n'));
  console.error('Add a changeset for each changed package and regenerate the version PR.');
  process.exitCode = 1;
}
