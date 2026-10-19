#!/usr/bin/env node
// Fail when a tag that the release script just created names a version that
// package.json does not hold at the tag target.
//
//   node check-new-tag-targets.mjs <packages.tsv> <new-tags.txt>
//
// <packages.tsv>  one public workspace package per line: name, version, directory (tab-separated).
// <new-tags.txt>  one tag per line, written `<package name>@<version>`.
//
// The version is read with `git show <tag>^{commit}:<directory>/package.json`, never from the
// working tree. A tag cut from uncommitted versions fails here before anything is pushed.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [packagesFile, tagsFile] = process.argv.slice(2);
if (!packagesFile || !tagsFile) {
  console.error('usage: node check-new-tag-targets.mjs <packages.tsv> <new-tags.txt>');
  process.exit(2);
}

const lines = (file) =>
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');

const directories = new Map();
for (const line of lines(packagesFile)) {
  const [name, , directory] = line.split('\t');
  if (name && directory) directories.set(name, directory.replaceAll('\\', '/'));
}

let failed = 0;
const fail = (message) => {
  console.error(`::error::${message}`);
  failed += 1;
};

const tags = lines(tagsFile);
for (const tag of tags) {
  const at = tag.lastIndexOf('@');
  const name = tag.slice(0, at);
  const version = tag.slice(at + 1);
  const directory = directories.get(name);
  if (at <= 0 || !directory) {
    fail(`Tag ${tag} names no public workspace package.`);
    continue;
  }
  let target;
  let held;
  try {
    target = execFileSync('git', ['rev-parse', `${tag}^{commit}`], { encoding: 'utf8' }).trim();
    const manifest = execFileSync('git', ['show', `${target}:${directory}/package.json`], {
      encoding: 'utf8',
    });
    held = JSON.parse(manifest).version;
  } catch (error) {
    fail(
      `Tag ${tag}: cannot read ${directory}/package.json at the tag target (${error.message.split('\n')[0]}).`
    );
    continue;
  }
  const report = `Tag ${tag} targets ${target.slice(0, 8)}, where ${directory}/package.json holds ${held}.`;
  if (held !== version) {
    fail(report);
    continue;
  }
  console.log(report);
}

if (failed > 0) process.exit(1);
console.log(`Checked ${tags.length} new tag(s).`);
