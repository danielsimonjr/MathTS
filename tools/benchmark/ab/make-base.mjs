#!/usr/bin/env node
/**
 * Build an isolated base package tree under node_modules/.perf-base for A/B benchmarks.
 *
 *   node tools/benchmark/ab/make-base.mjs [--ref <git-ref> | --workspace] [--control]
 *
 * The default ref is the merge base of HEAD and origin/main. A pull request stacked on another
 * branch gates against its own base, so pass that: `--ref origin/<base-branch>`.
 *
 * `--workspace` snapshots the workspace's own built `dist/` directories as the base instead of
 * building a ref in a worktree. Use it at the tip of a parent branch, after `bun run build`, to
 * gate the pull request stacked on it: the snapshot is exactly the parent, and it costs a copy
 * instead of an install and a full build. It refuses when a `src/` is newer than its `dist/`,
 * and when the working tree differs from HEAD, so the recorded commit is what was copied.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { repoRoot, workspaceDirs } from '../../test/workspaces.mjs';
import { preflightWorkspace } from './preflight.mjs';
import { perfBaseDir, perfControlDir } from './util.mjs';

const argv = process.argv.slice(2);
let ref = null;
let control = false;
let fromWorkspace = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--ref') ref = argv[++i];
  else if (argv[i] === '--control') control = true;
  else if (argv[i] === '--workspace') fromWorkspace = true;
}

function git(args) {
  const r = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status ?? 1);
  }
  return (r.stdout || '').trim();
}

if (fromWorkspace && ref) {
  console.error('--ref and --workspace exclude each other');
  process.exit(2);
}

if (!ref) {
  ref = fromWorkspace ? git(['rev-parse', 'HEAD']) : git(['merge-base', 'HEAD', 'origin/main']);
  if (!ref) ref = 'HEAD';
}

const worktree = join(tmpdir(), `mathts-perf-base-${process.pid}`);

function removeWorktree() {
  if (fromWorkspace) return;
  spawnSync('git', ['worktree', 'remove', worktree, '--force'], { cwd: repoRoot });
  rmSync(worktree, { recursive: true, force: true });
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'inherit' });
  if (r.status !== 0) {
    removeWorktree();
    process.exit(r.status ?? 1);
  }
}

let treeRoot = worktree;
if (fromWorkspace) {
  treeRoot = repoRoot;
  const stale = preflightWorkspace(repoRoot);
  if (stale) {
    console.error(`make-base --workspace: ${stale}`);
    process.exit(2);
  }
  const dirty = git(['status', '--porcelain', '--untracked-files=no']);
  if (dirty) {
    console.error(`make-base --workspace: the working tree differs from HEAD:\n${dirty}`);
    process.exit(2);
  }
  console.error(`make-base: workspace snapshot of ${ref}`);
} else {
  if (existsSync(worktree)) rmSync(worktree, { recursive: true, force: true });
  console.error(`make-base: worktree at ${ref} → ${worktree}`);
  git(['worktree', 'add', '--detach', worktree, ref]);
  run('bun', ['install', '--frozen-lockfile'], worktree);
  run('bun', ['run', 'build'], worktree);
}

function copyTreeTo(destRoot) {
  mkdirSync(destRoot, { recursive: true });
  for (const rel of workspaceDirs(treeRoot)) {
    const srcPkg = join(treeRoot, rel);
    const name = JSON.parse(readFileSync(join(srcPkg, 'package.json'), 'utf8')).name;
    const destPkg = join(destRoot, name);
    mkdirSync(destPkg, { recursive: true });
    cpSync(join(srcPkg, 'package.json'), join(destPkg, 'package.json'));
    const dist = join(srcPkg, 'dist');
    if (existsSync(dist)) {
      cpSync(dist, join(destPkg, 'dist'), { recursive: true });
    }
  }
}

const baseDest = join(perfBaseDir(repoRoot), 'node_modules');
rmSync(perfBaseDir(repoRoot), { recursive: true, force: true });
mkdirSync(baseDest, { recursive: true });
copyTreeTo(baseDest);
writeFileSync(join(perfBaseDir(repoRoot), 'REF'), `${ref}\n`);

if (control) {
  const ctrlDest = join(perfControlDir(repoRoot), 'node_modules');
  rmSync(perfControlDir(repoRoot), { recursive: true, force: true });
  mkdirSync(ctrlDest, { recursive: true });
  copyTreeTo(ctrlDest);
  writeFileSync(join(perfControlDir(repoRoot), 'REF'), `${ref}\n`);
}

removeWorktree();
console.error(`make-base: wrote ${perfBaseDir(repoRoot)} (ref ${ref})`);
