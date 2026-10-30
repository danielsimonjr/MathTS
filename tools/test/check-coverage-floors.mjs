#!/usr/bin/env node
/**
 * Per-package line-coverage floors from each workspace package's coverage/lcov.info.
 *
 *   bun run test:coverage
 *   node tools/test/check-coverage-floors.mjs
 *   node tools/test/check-coverage-floors.mjs --write
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

const FLOORS_PATH = join(repoRoot, 'tools/test/coverage-floors.json');
const writeMode = process.argv.includes('--write');

const NOTE =
  'Line hits / line found from coverage/lcov.info after bun run test:coverage. Integer floor is the measured percent rounded down, minus 1. Bun and vitest numbers are not comparable across packages. assembly has no test:coverage script (AssemblyScript; covered by test:wasm and tests/wasm/, not this gate).';

/**
 * @param {string} lcovText
 * @returns {{ lf: number, lh: number }}
 */
export function parseLcovLineTotals(lcovText) {
  let lf = 0;
  let lh = 0;
  for (const line of lcovText.split(/\r?\n/)) {
    if (line.startsWith('LF:')) lf += Number(line.slice(3));
    else if (line.startsWith('LH:')) lh += Number(line.slice(3));
  }
  return { lf, lh };
}

/**
 * @param {{ lf: number, lh: number }} totals
 * @returns {number | null} percent, or null when LF is 0
 */
export function linePercentFromTotals({ lf, lh }) {
  if (lf === 0) return null;
  return (100 * lh) / lf;
}

/** @param {number} measuredPercent */
export function floorFromMeasured(measuredPercent) {
  return Math.max(0, Math.floor(measuredPercent) - 1);
}

/**
 * @param {string} lcovPath
 * @param {number} floor
 * @returns {{ ok: boolean, message?: string, measured?: number }}
 */
export function checkLcovAgainstFloor(lcovPath, floor) {
  if (!existsSync(lcovPath)) {
    return { ok: false, message: `missing ${lcovPath}` };
  }
  const totals = parseLcovLineTotals(readFileSync(lcovPath, 'utf8'));
  const measured = linePercentFromTotals(totals);
  if (measured === null) {
    return { ok: false, message: `LF:0 in ${lcovPath} (coverage did not measure lines)` };
  }
  if (measured < floor) {
    return {
      ok: false,
      message: `${lcovPath}: ${measured.toFixed(2)}% < floor ${floor}`,
      measured,
    };
  }
  return { ok: true, measured };
}

function runnerForScript(script) {
  return script.includes('vitest') ? 'vitest' : 'bun';
}

/** Packages with a test:coverage script, keyed by workspace directory. */
export function packagesWithCoverageScript() {
  /** @type {Record<string, { runner: 'bun' | 'vitest', lcovRel: string }>} */
  const out = {};
  for (const dir of workspaceDirs()) {
    const pkgPath = join(repoRoot, dir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const script = pkg.scripts?.['test:coverage'];
    if (!script) continue;
    out[dir] = {
      runner: runnerForScript(script),
      lcovRel: join(dir, 'coverage/lcov.info'),
    };
  }
  return out;
}

/** @param {string} dir workspace directory relative to repo root */
export function packageFloorKey(dir) {
  return dir.includes('/') ? dir.split('/').pop() : dir;
}

/**
 * @returns {{ note: string, packages: Record<string, { runner: string, floor: number }>, measured: Record<string, number> }}
 */
export function measureFloors() {
  const packages = packagesWithCoverageScript();
  /** @type {Record<string, { runner: string, floor: number }>} */
  const entries = {};
  /** @type {Record<string, number>} */
  const measured = {};
  for (const [dir, meta] of Object.entries(packages)) {
    const lcovPath = join(repoRoot, meta.lcovRel);
    const check = checkLcovAgainstFloor(lcovPath, 0);
    const pct = check.measured;
    if (pct === undefined) {
      throw new Error(check.message ?? `no measurement for ${dir}`);
    }
    const key = packageFloorKey(dir);
    entries[key] = {
      runner: meta.runner,
      floor: floorFromMeasured(pct),
    };
    measured[key] = Math.round(pct * 100) / 100;
  }
  return { note: NOTE, packages: entries, measured };
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

function main() {
  if (writeMode) {
    const { note, packages, measured } = measureFloors();
    writeFileSync(FLOORS_PATH, `${JSON.stringify({ note, packages }, null, 2)}\n`);
    console.log(`Wrote ${FLOORS_PATH}`);
    for (const [name, row] of Object.entries(packages)) {
      console.log(`  ${name}: ${measured[name]}% → floor ${row.floor} (${row.runner})`);
    }
    return;
  }

  const floors = JSON.parse(readFileSync(FLOORS_PATH, 'utf8'));
  const live = packagesWithCoverageScript();
  let failed = false;

  for (const dir of Object.keys(live)) {
    const key = packageFloorKey(dir);
    if (!floors.packages?.[key]) {
      console.error(`FAIL: ${key} has test:coverage but no entry in coverage-floors.json`);
      failed = true;
    }
  }

  for (const [name, row] of Object.entries(floors.packages ?? {})) {
    const dir = Object.keys(live).find((d) => packageFloorKey(d) === name);
    if (!dir) {
      console.error(`FAIL: coverage-floors.json lists ${name} but no package has test:coverage`);
      failed = true;
      continue;
    }
    const lcovPath = join(repoRoot, live[dir].lcovRel);
    const result = checkLcovAgainstFloor(lcovPath, row.floor);
    if (!result.ok) {
      console.error(`FAIL: ${name}: ${result.message}`);
      failed = true;
    }
  }

  if (failed) {
    console.error('Run bun run test:coverage, then node tools/test/check-coverage-floors.mjs --write');
    process.exit(1);
  }
  console.log('OK: per-package coverage meets committed floors.');
}

if (isMain) main();
