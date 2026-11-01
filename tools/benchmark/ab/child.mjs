#!/usr/bin/env node
/**
 * One fresh-process A/B timing child. Invoked by run.mjs; prints one JSON line to stdout.
 *
 * Modes (`PERF_MODE`):
 *   dual         both trees in this process, imported in `PERF_ORDER` (base-first | head-first)
 *   single-base  the base tree alone     } the two single-tree estimates; run.mjs alternates
 *   single-head  the head tree alone     } processes of the two
 *
 * Each slot (base, head, and the A/A twin) gets its own copy of the timing code and of the case
 * module (`?slot=` imports), so no call site, and no type feedback behind it, is shared between
 * the two sides that are being compared. See `slot.mjs`.
 */
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { packageDotEntry } from '../../package-dot-entry.mjs';
import { checkResults } from './same.mjs';
import { treeModuleRoot } from './util.mjs';
import { repoRoot as defaultRepoRoot } from '../../test/workspaces.mjs';

const repoRoot = process.env.PERF_REPO_ROOT || defaultRepoRoot;

/**
 * @param {string} moduleRoot
 * @param {string} pkgName
 */
async function importFromTree(moduleRoot, pkgName) {
  const pkgDir = join(moduleRoot, pkgName);
  const { distPath } = packageDotEntry(pkgDir);
  return import(pathToFileURL(distPath).href);
}

/**
 * @param {string} entry package name
 * @param {'base' | 'head' | 'control'} which
 */
async function loadNs(entry, which) {
  if (which === 'head') return import(entry);
  const root = treeModuleRoot(repoRoot, which === 'control' ? 'control' : 'base');
  return importFromTree(root, entry);
}

/**
 * Everything one side needs: its own timing functions and its own instance of the case module.
 * @param {string} slot
 * @param {string} caseFile
 * @param {string} caseName
 * @param {unknown} ns the imported package namespace the case is built from
 */
async function loadSlot(slot, caseFile, caseName, ns) {
  const timer = await import(new URL(`./slot.mjs?slot=${slot}`, import.meta.url).href);
  const spec = await import(`${pathToFileURL(resolve(caseFile)).href}?slot=${slot}`);
  const caseDef = spec.cases.find((c) => c.name === caseName);
  if (!caseDef) throw new Error(`case ${caseName} not found`);
  const thunk = caseDef.make(ns);
  return { timer, caseDef, thunk };
}

/** Time budget for the timed part of one process, in milliseconds. */
const BUDGET_MS = 2500;

/**
 * Warm-up floor and cap, in milliseconds. JavaScriptCore tiers a hot loop up in steps over
 * about two seconds (a `prod` of 10,000 numbers reads 200 µs, then 120, then 89), and a process
 * that is timed in the middle of a step reads 110-260 µs for the same code (sd 26% between
 * processes; 3% once warm). V8 settles within a few hundred milliseconds.
 */
const WARM_MIN_MS = process.versions.bun ? 2000 : 400;
const WARM_MAX_MS = process.versions.bun ? 6000 : 2000;

/** @param {number[]} xs */
function medianOf(xs) {
  const s = [...xs].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

/** The last ten batches read the same, within 2%, as the ten before them. */
function settled(times) {
  if (times.length < 20) return false;
  const last = medianOf(times.slice(-10));
  const before = medianOf(times.slice(-20, -10));
  return Math.abs(last / before - 1) < 0.02;
}

/**
 * Run every slot until it has been warm for `WARM_MIN_MS` and its batch time has settled, or
 * for `WARM_MAX_MS`. A call that takes more than 100 ms is a few batches, not a few seconds.
 * @param {{ timer: { timeBatch: Function }, thunk: () => unknown }[]} slots
 * @param {number} reps
 * @param {number} batchMs
 */
function warmUp(slots, reps, batchMs) {
  if (batchMs > 100) {
    for (const slot of slots) slot.timer.timeBatch(slot.thunk, reps);
    return;
  }
  const history = slots.map(() => []);
  const t0 = performance.now();
  for (;;) {
    slots.forEach((slot, i) => history[i].push(slot.timer.timeBatch(slot.thunk, reps)));
    const elapsed = performance.now() - t0;
    if (elapsed >= WARM_MAX_MS) return;
    if (elapsed >= WARM_MIN_MS && history.every(settled)) return;
  }
}

/**
 * Batches per side. A batch of one or two calls takes about 25 ms or more, so it carries the
 * noise of a single call (collections, scheduling), and eight rounds leave the median of 16
 * samples ±5% for a 26 ms `median` of 100,000 numbers; those cases get more rounds. A call
 * that takes hundreds of milliseconds (the generic `qr` at 128×128) is steady, and the budget
 * caps its rounds.
 * @param {number} reps
 * @param {number} batchMs
 */
function roundsFor(reps, batchMs) {
  const wanted = reps <= 2 ? 16 : 8;
  return Math.max(2, Math.min(wanted, Math.floor(BUDGET_MS / (4 * batchMs))));
}

/**
 * One tree alone: median per-call time over a number of batches after warm-up. A process sits
 * ±3-5% from the next on the same code, so the gate takes its precision from the number of
 * processes, and each one only needs a steady median of its own.
 * @param {{ timer: { timeBatch: Function }, thunk: () => unknown }} only
 * @param {number} reps
 * @param {number} batchMs
 */
function timeSingle(only, reps, batchMs) {
  const samples = Math.max(5, Math.min(24, Math.floor(BUDGET_MS / batchMs)));
  warmUp([only], reps, batchMs);
  const times = [];
  for (let i = 0; i < samples; i++) times.push(only.timer.timeBatch(only.thunk, reps));
  times.sort((x, y) => x - y);
  return times[Math.floor(times.length / 2)];
}

/**
 * A B B A rounds after warm-up batches. Medians per call, in microseconds.
 * @param {{ timer: { timeBatch: Function }, thunk: () => unknown }} a
 * @param {{ timer: { timeBatch: Function }, thunk: () => unknown }} b
 * @param {number} reps
 * @param {number} rounds
 */
function timeAbba(a, b, reps, rounds) {
  const aSamples = [];
  const bSamples = [];
  for (let r = 0; r < rounds; r++) {
    aSamples.push(a.timer.timeBatch(a.thunk, reps));
    bSamples.push(b.timer.timeBatch(b.thunk, reps));
    bSamples.push(b.timer.timeBatch(b.thunk, reps));
    aSamples.push(a.timer.timeBatch(a.thunk, reps));
  }
  aSamples.sort((x, y) => x - y);
  bSamples.sort((x, y) => x - y);
  const medA = aSamples[Math.floor(aSamples.length / 2)];
  const medB = bSamples[Math.floor(bSamples.length / 2)];
  return { medAUs: medA, medBUs: medB, ratio: medB / medA };
}

async function main() {
  const caseFile = process.env.PERF_CASE_FILE;
  const caseName = process.env.PERF_CASE_NAME;
  const order = process.env.PERF_ORDER || 'base-first';
  const mode = process.env.PERF_MODE || 'dual';
  const control = process.env.PERF_CONTROL === '1';

  if (!caseFile || !caseName) {
    console.error('PERF_CASE_FILE and PERF_CASE_NAME required');
    process.exit(2);
  }

  const entry = (await import(pathToFileURL(resolve(caseFile)).href)).entry;

  if (mode === 'single-base' || mode === 'single-head') {
    const ns = await loadNs(entry, mode === 'single-base' ? 'base' : control ? 'control' : 'head');
    const only = await loadSlot('only', caseFile, caseName, ns);
    const { reps, batchMs } = only.timer.calibrateReps(only.thunk);
    console.log(JSON.stringify({ ok: true, medUs: timeSingle(only, reps, batchMs), mode }));
    return;
  }

  let baseNs;
  let headNs;
  if (order === 'base-first') {
    baseNs = await loadNs(entry, 'base');
    headNs = await loadNs(entry, control ? 'control' : 'head');
  } else {
    headNs = await loadNs(entry, control ? 'control' : 'head');
    baseNs = await loadNs(entry, 'base');
  }

  const base = await loadSlot('base', caseFile, caseName, baseNs);
  const head = await loadSlot('head', caseFile, caseName, headNs);

  // The tree that executes first in a process runs in a slower state on Bun (JavaScriptCore): two
  // identical trees read 0.66 for `prod` when the base always ran first. So the call order
  // follows `order` like the import order does, and run.mjs takes the geometric mean of both.
  const [first, second] = order === 'base-first' ? [base, head] : [head, base];

  let firstResult;
  let secondResult;
  try {
    firstResult = first.thunk();
    secondResult = second.thunk();
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: String(e) }));
    return;
  }
  const [baseResult, headResult] =
    order === 'base-first' ? [firstResult, secondResult] : [secondResult, firstResult];

  const checked = checkResults(baseResult, headResult, base.caseDef.compare);
  if (!checked.ok) {
    console.log(JSON.stringify({ ok: false, error: checked.reason, equal: false }));
    return;
  }

  const { reps, batchMs } = first.timer.calibrateReps(first.thunk);
  const secondCal = second.timer.calibrateReps(second.thunk);
  const slowMs = Math.max(batchMs, secondCal.batchMs);
  warmUp([first, second], reps, slowMs);
  const timed = timeAbba(first, second, reps, roundsFor(reps, slowMs));
  const medBaseUs = order === 'base-first' ? timed.medAUs : timed.medBUs;
  const medHeadUs = order === 'base-first' ? timed.medBUs : timed.medAUs;
  const ratio = medHeadUs / medBaseUs;

  // In-process A/A: the base tree against a twin of itself, each with its own slot. It measures
  // what this process and this case cannot tell apart, whatever the head does.
  let aaRatio = null;
  if (slowMs <= 200) {
    const twin = await loadSlot('twin', caseFile, caseName, baseNs);
    twin.timer.calibrateReps(twin.thunk);
    warmUp([twin], reps, slowMs);
    aaRatio = timeAbba(twin, base, reps, Math.max(2, roundsFor(reps, slowMs) / 2)).ratio;
  }

  console.log(
    JSON.stringify({ ok: true, equal: true, medBaseUs, medHeadUs, ratio, aaRatio, order })
  );
}

main().catch((e) => {
  console.log(JSON.stringify({ ok: false, error: String(e) }));
});
