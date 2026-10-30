import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spellFingerprint } from '../benchmarks/sprint-baseline.mjs';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..');
const script = join(repoRoot, 'tools', 'benchmarks', 'sprint-baseline.mjs');
const baselinePath = join(repoRoot, 'docs', 'benchmarks', 'core-sprint-baseline.json');

test('spellFingerprint handles -0 and NaN', () => {
  assert.equal(spellFingerprint(-0), '-0');
  assert.equal(spellFingerprint(Number.NaN), 'NaN');
  assert.equal(spellFingerprint(1.5), '1.5');
});

test('--check exits 0 against committed baseline when build exists', () => {
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  } catch {
    return;
  }
  if (!baseline.fingerprints || Object.keys(baseline.fingerprints).length < 5) {
    return;
  }
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
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  } catch {
    return;
  }
  const names = Object.keys(baseline.fingerprints);
  if (names.length === 0) return;
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
