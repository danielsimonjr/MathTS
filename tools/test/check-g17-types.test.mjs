// Tests of tools/test/check-g17-types.mjs, the G17 type-fixture check (#1185).
//
// The check runs tsc on the fixture folder of `functions` with skipLibCheck: false. It needs the
// built dist of ten packages, so these tests run it on a scratch folder instead. The real
// fixtures run in the Compile & Lint step of ci.yml, and case 4 pins that step. This file holds
// no time limit: a wall-clock assertion on a tsc run was the cause of #1185.
//
// Usage: node --test tools/test/check-g17-types.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeScratch } from './consumer-env.mjs';
import { repoRoot } from './workspaces.mjs';

const script = fileURLToPath(new URL('./check-g17-types.mjs', import.meta.url));
const ciWorkflow = join(repoRoot, '.github', 'workflows', 'ci.yml');

/**
 * Run the check script and capture what it prints.
 * @param {string[]} args  command-line arguments of the script
 * @returns {{status: number|null, output: string}} exit code and stdout plus stderr
 */
function runCheck(args) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/**
 * Write a scratch fixture folder: one tsconfig and one source file.
 * @param {string} source  text of `fixture.ts`
 * @returns {string} the folder path
 */
function makeFixture(source) {
  const dir = makeScratch('mathts-g17-');
  const config = {
    compilerOptions: {
      strict: true,
      noEmit: true,
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      types: [],
    },
    files: ['fixture.ts'],
  };
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(config));
  writeFileSync(join(dir, 'fixture.ts'), source);
  return dir;
}

test('case 1: a type error in the fixtures fails the check and names the config and the code', () => {
  const dir = makeFixture('export const x: number = "s";\n');
  const { status, output } = runCheck([`--fixture-dir=${dir}`, '--config=tsconfig.json']);
  assert.equal(status, 1, output);
  assert.match(output, /TS2322/);
  assert.match(output, /tsconfig\.json/);
});

test('case 2: correct fixtures pass the check', () => {
  const dir = makeFixture('export const x: number = 1;\n');
  const { status, output } = runCheck([`--fixture-dir=${dir}`, '--config=tsconfig.json']);
  assert.equal(status, 0, output);
});

test('case 3: a config file that does not exist is an error that names it', () => {
  const dir = makeFixture('export const x: number = 1;\n');
  const { status, output } = runCheck([`--fixture-dir=${dir}`, '--config=absent.json']);
  assert.equal(status, 1, output);
  assert.match(output, /absent\.json/);
});

test('control: an unknown argument and a missing folder are errors, not defaults', () => {
  const unknown = runCheck(['--no-such-flag']);
  assert.equal(unknown.status, 1, unknown.output);
  assert.match(unknown.output, /--no-such-flag/);
  const dir = makeFixture('export const x: number = 1;\n');
  const missing = runCheck([`--fixture-dir=${join(dir, 'absent-folder')}`]);
  assert.equal(missing.status, 1, missing.output);
  assert.match(missing.output, /absent-folder/);
});

test('control: --config replaces the default list, it does not add to it', () => {
  // The scratch folder holds no tsconfig.node16.json. If the default list were still in force,
  // this run would fail with "missing config" for that file.
  const dir = makeFixture('export const x: number = 1;\n');
  const { status, output } = runCheck([`--fixture-dir=${dir}`, '--config=tsconfig.json']);
  assert.equal(status, 0, output);
  assert.doesNotMatch(output, /tsconfig\.node16\.json/);
});

test('case 4: ci.yml runs the check in job compile, after the development build', () => {
  const lines = readFileSync(ciWorkflow, 'utf8').split('\n');
  const find = (needle) => lines.findIndex((line) => line.includes(needle));
  const devBuild = find('name: Build (development dist for the packaging checks)');
  const run = find('node tools/test/check-g17-types.mjs');
  const selfTest = find('node --test tools/test/check-g17-types.test.mjs');
  const nextJob = find('  benchmark-baseline:');
  assert.ok(devBuild >= 0, 'the development build step is missing from ci.yml');
  assert.ok(run >= 0, 'ci.yml does not run tools/test/check-g17-types.mjs');
  assert.ok(selfTest >= 0, 'ci.yml does not run tools/test/check-g17-types.test.mjs');
  assert.ok(nextJob >= 0, 'the job after compile is missing from ci.yml');
  // The fixtures read the .d.ts files that the development build writes; the production build
  // (minified JS) runs earlier and the step above restores the development build.
  assert.ok(run > devBuild, 'the G17 check must run after the development build');
  assert.ok(selfTest > devBuild, 'the G17 tool test must run after the development build');
  assert.ok(run < nextJob && selfTest < nextJob, 'the G17 check must stay inside job compile');
  const header = (index) => {
    for (let i = index; i >= 0; i--)
      if (/^ {2}[a-z][a-z0-9-]*:\s*$/.test(lines[i])) return lines[i];
    return undefined;
  };
  assert.equal(header(run)?.trim(), 'compile:');
  assert.equal(header(devBuild)?.trim(), 'compile:');
});
