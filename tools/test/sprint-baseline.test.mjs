import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spellFingerprint } from '../benchmarks/sprint-baseline.mjs';
import { Fraction } from '@danielsimonjr/mathts-core';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const script = join(repoRoot, 'tools', 'benchmarks', 'sprint-baseline.mjs');
const baselinePath = join(repoRoot, 'docs', 'benchmarks', 'core-sprint-baseline.json');

test('spellFingerprint handles -0 and NaN', () => {
  assert.equal(spellFingerprint(-0), '-0');
  assert.equal(spellFingerprint(Number.NaN), 'NaN');
  assert.equal(spellFingerprint(1.5), '1.5');
});

test('spellFingerprint spells a Fraction from numerator and denominator', () => {
  assert.equal(spellFingerprint(new Fraction(355n, 113n)), '{"n":"355","d":"113"}');
});

test('committed baseline has two runs and a real fingerprint for every case', () => {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  assert.equal(baseline.runs.length, 2);
  for (const run of baseline.runs) {
    assert.ok(run.controlRatio >= 0.5 && run.controlRatio <= 2);
  }
  const names = Object.keys(baseline.fingerprints);
  assert.ok(names.length >= 25);
  for (const name of names) {
    assert.ok(!baseline.fingerprints[name].includes('undefined'), name);
  }
});

test('--check exits 0 against committed baseline when build exists', () => {
  const child = spawnSync(process.execPath, [script, '--check'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (child.error?.code === 'ETIMEDOUT') {
    assert.fail('sprint baseline --check timed out');
  }
  assert.equal(
    child.status,
    0,
    child.stderr || child.stdout || 'check failed — run build and refresh baseline'
  );
});

test('--check exits 1 when a fingerprint in the baseline is wrong', () => {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const names = Object.keys(baseline.fingerprints);
  assert.ok(names.length > 0);
  const tampered = structuredClone(baseline);
  tampered.fingerprints[names[0]] = 'tampered';
  const dir = mkdtempSync(join(tmpdir(), 'sprint-baseline-'));
  const badPath = join(dir, 'bad.json');
  writeFileSync(badPath, JSON.stringify(tampered));
  const child = spawnSync(process.execPath, [script, '--check', '--baseline', badPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 120_000,
  });
  assert.equal(child.status, 1);
});
