#!/usr/bin/env node
/**
 * Build an isolated base package tree under node_modules/.perf-base for A/B benchmarks.
 *
 *   node tools/benchmark/ab/make-base.mjs [--ref <git-ref>] [--control]
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { repoRoot, workspaceDirs } from '../../test/workspaces.mjs';
import { perfBaseDir, perfControlDir } from './util.mjs';

const argv = process.argv.slice(2);
let ref = null;
let control = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--ref') ref = argv[++i];
  else if (argv[i] === '--control') control = true;
}

function git(args) {
  const r = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status ?? 1);
  }
  return (r.stdout || '').trim();
}

if (!ref) {
  ref = git(['merge-base', 'HEAD', 'origin/main']);
  if (!ref) ref = 'HEAD';
}

const worktree = join(tmpdir(), `mathts-perf-base-${process.pid}`);
if (existsSync(worktree)) rmSync(worktree, { recursive: true, force: true });

console.error(`make-base: worktree at ${ref} → ${worktree}`);
git(['worktree', 'add', '--detach', worktree, ref]);

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run('bun', ['install', '--frozen-lockfile'], worktree);
run('bun', ['run', 'build'], worktree);

function copyTreeTo(destRoot) {
  mkdirSync(destRoot, { recursive: true });
  for (const rel of workspaceDirs(worktree)) {
    const srcPkg = join(worktree, rel);
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

git(['worktree', 'remove', worktree, '--force']);
console.error(`make-base: wrote ${perfBaseDir(repoRoot)} (ref ${ref})`);
