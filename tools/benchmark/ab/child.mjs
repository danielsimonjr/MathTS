#!/usr/bin/env node
/**
 * One fresh-process A/B timing child. Invoked by run.mjs; prints one JSON line to stdout.
 */
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { packageDotEntry } from '../../package-dot-entry.mjs';
import { same } from './same.mjs';
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
 * @param {() => unknown} fn
 * @param {number} reps
 */
function timeBatch(fn, reps) {
  const t0 = performance.now();
  let last;
  for (let i = 0; i < reps; i++) last = fn();
  const ms = performance.now() - t0;
  return { perCallUs: (ms * 1000) / reps, last };
}

/** @param {() => unknown} fn */
function calibrateReps(fn) {
  let reps = 1;
  for (let i = 0; i < 12; i++) {
    const t0 = performance.now();
    for (let j = 0; j < reps; j++) fn();
    const ms = performance.now() - t0;
    if (ms >= 20 && ms <= 40) return reps;
    if (ms < 1) reps *= 4;
    else reps = Math.max(1, Math.round((reps * 25) / Math.max(ms, 0.01)));
  }
  return Math.max(1, reps);
}

/**
 * @param {() => unknown} baseFn
 * @param {() => unknown} headFn
 * @param {number} reps
 */
function timeAbba(baseFn, headFn, reps) {
  for (let i = 0; i < 5; i++) {
    timeBatch(baseFn, reps);
    timeBatch(headFn, reps);
  }
  const baseSamples = [];
  const headSamples = [];
  for (let r = 0; r < 8; r++) {
    baseSamples.push(timeBatch(baseFn, reps).perCallUs);
    headSamples.push(timeBatch(headFn, reps).perCallUs);
    headSamples.push(timeBatch(headFn, reps).perCallUs);
    baseSamples.push(timeBatch(baseFn, reps).perCallUs);
  }
  baseSamples.sort((x, y) => x - y);
  headSamples.sort((x, y) => x - y);
  const medBase = baseSamples[Math.floor(baseSamples.length / 2)];
  const medHead = headSamples[Math.floor(headSamples.length / 2)];
  return { medBaseUs: medBase, medHeadUs: medHead, ratio: medHead / medBase };
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

  const spec = await import(pathToFileURL(resolve(caseFile)).href);
  const entry = spec.entry;
  const caseDef = spec.cases.find((c) => c.name === caseName);
  if (!caseDef) throw new Error(`case ${caseName} not found`);

  if (mode === 'single-base' || mode === 'single-head') {
    const which = mode === 'single-base' ? 'base' : 'head';
    const ns = await loadNs(entry, which);
    const thunk = caseDef.make(ns);
    const reps = calibrateReps(thunk);
    const { medBaseUs } = timeAbba(thunk, thunk, reps);
    console.log(JSON.stringify({ ok: true, medUs: medBaseUs, mode }));
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

  const baseThunk = caseDef.make(baseNs);
  const headThunk = caseDef.make(headNs);

  let baseResult;
  let headResult;
  try {
    baseResult = baseThunk();
    headResult = headThunk();
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: String(e) }));
    return;
  }

  const equal = caseDef.compare
    ? caseDef.compare(baseResult, headResult)
    : same(baseResult, headResult);
  if (!equal) {
    console.log(JSON.stringify({ ok: false, error: 'results differ', equal: false }));
    return;
  }

  const reps = calibrateReps(baseThunk);
  const { medBaseUs, medHeadUs, ratio } = timeAbba(baseThunk, headThunk, reps);

  let aaRatio = null;
  if (control) {
    const head2 = caseDef.make(headNs);
    aaRatio = timeAbba(baseThunk, head2, reps).ratio;
  }

  console.log(
    JSON.stringify({
      ok: true,
      equal: true,
      medBaseUs,
      medHeadUs,
      ratio,
      aaRatio,
      order,
    })
  );
}

main().catch((e) => {
  console.log(JSON.stringify({ ok: false, error: String(e) }));
});
