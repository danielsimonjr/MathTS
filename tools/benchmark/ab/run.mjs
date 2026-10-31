#!/usr/bin/env node
/**
 * Phase 7 base-against-head benchmark runner.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { preflightEntryPackage } from './preflight.mjs';
import { geometricMean, median, perfBaseDir } from './util.mjs';
import { repoRoot } from '../../test/workspaces.mjs';

const abDir = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv.slice(2);

let runs = 5;
let control = false;
let jsonOut = false;
let engines = ['node', 'bun'];
const caseFiles = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--runs') runs = Number(argv[++i]);
  else if (a === '--control') control = true;
  else if (a === '--json') jsonOut = true;
  else if (a === '--engine') engines = [argv[++i]];
  else if (a === '--cases') caseFiles.push(resolve(argv[++i]));
  else if (a.endsWith('.mjs')) caseFiles.push(resolve(a));
}

if (caseFiles.length === 0) {
  for (const f of readdirSync(join(abDir, 'cases'))) {
    if (f.endsWith('.mjs')) caseFiles.push(join(abDir, 'cases', f));
  }
}

if (!existsSync(join(perfBaseDir(repoRoot), 'REF'))) {
  console.error('Missing base tree. Run: node tools/benchmark/ab/make-base.mjs');
  process.exit(2);
}

/** @type {{ entry: string, cases: { name: string, kind: string }[] }[]} */
const specs = [];
for (const cf of caseFiles) {
  let spec;
  try {
    spec = await import(pathToFileURL(cf).href);
  } catch (e) {
    console.error(`Failed to load case file ${cf}: ${e}`);
    process.exit(1);
  }
  specs.push({ file: cf, ...spec });
  if (!control) {
    const err = preflightEntryPackage(spec.entry);
    if (err) {
      console.error(err);
      process.exit(2);
    }
  }
}

const SINGLE_TREE_LN = 0.18;

/**
 * @param {'node' | 'bun'} engine
 * @param {Record<string, string>} env
 */
function spawnChild(engine, env) {
  const childPath = join(abDir, 'child.mjs');
  if (engine === 'bun') {
    return spawnSync('bun', ['--tsconfig-override=tsconfig.base.json', childPath], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      encoding: 'utf8',
    });
  }
  return spawnSync(process.execPath, [childPath], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

function parseChild(out) {
  const line = (out.stdout || '').trim().split('\n').filter(Boolean).pop();
  try {
    return JSON.parse(line || '{}');
  } catch {
    return { ok: false, error: out.stderr || out.stdout || 'invalid json' };
  }
}

/**
 * @param {'node'|'bun'} engine
 * @param {string} caseFile
 * @param {{ name: string, kind: string }} caseDef
 */
function runDualCase(engine, caseFile, caseDef) {
  const ratios = { 'base-first': [], 'head-first': [] };
  const aaRatios = [];
  for (const order of ['base-first', 'head-first']) {
    for (let r = 0; r < runs; r++) {
      const proc = spawnChild(engine, {
        PERF_REPO_ROOT: repoRoot,
        PERF_CASE_FILE: caseFile,
        PERF_CASE_NAME: caseDef.name,
        PERF_ORDER: order,
        PERF_MODE: 'dual',
        PERF_CONTROL: control ? '1' : '0',
      });
      const res = parseChild(proc);
      if (!res.ok) return { fail: res.error || 'child failed' };
      ratios[order].push(res.ratio);
      if (res.aaRatio != null) aaRatios.push(res.aaRatio);
    }
  }
  const rBf = geometricMean(ratios['base-first']);
  const rHf = geometricMean(ratios['head-first']);
  const perRunGeo = [];
  for (let r = 0; r < runs; r++) {
    perRunGeo.push(geometricMean([ratios['base-first'][r], ratios['head-first'][r]]));
  }
  const caseRatio = median(perRunGeo);
  const skew = Math.abs(Math.log(rBf / rHf));
  let effectiveRatio = caseRatio;
  if (skew > SINGLE_TREE_LN) {
    const baseMedians = [];
    const headMedians = [];
    for (let i = 0; i < 10; i++) {
      const b = spawnChild(engine, {
        PERF_REPO_ROOT: repoRoot,
        PERF_CASE_FILE: caseFile,
        PERF_CASE_NAME: caseDef.name,
        PERF_MODE: 'single-base',
      });
      const rb = parseChild(b);
      if (rb.ok && rb.medUs) baseMedians.push(rb.medUs);
      const h = spawnChild(engine, {
        PERF_REPO_ROOT: repoRoot,
        PERF_CASE_FILE: caseFile,
        PERF_CASE_NAME: caseDef.name,
        PERF_MODE: 'single-head',
      });
      const rh = parseChild(h);
      if (rh.ok && rh.medUs) headMedians.push(rh.medUs);
    }
    if (baseMedians.length && headMedians.length) {
      baseMedians.sort((a, b) => a - b);
      headMedians.sort((a, b) => a - b);
      const mb = baseMedians[Math.floor(baseMedians.length / 2)];
      const mh = headMedians[Math.floor(headMedians.length / 2)];
      effectiveRatio = Math.max(caseRatio, mh / mb);
    }
  }
  return {
    ratio: effectiveRatio,
    rBf,
    rHf,
    aaMedian: aaRatios.length ? median(aaRatios) : null,
    min: Math.min(...perRunGeo),
    max: Math.max(...perRunGeo),
  };
}

/** @type {Array<{ case: string, kind: string, engine: string, ratio: number, min: number, max: number, aaMedian: number | null }>} */
const allResults = [];

for (const { file, cases } of specs) {
  for (const c of cases) {
    for (const engine of engines) {
      const row = runDualCase(engine, file, c);
      if (row.fail) {
        console.error(`${c.name} (${engine}): ${row.fail}`);
        process.exit(1);
      }
      allResults.push({
        case: c.name,
        kind: c.kind,
        engine,
        ratio: row.ratio,
        min: row.min,
        max: row.max,
        aaMedian: row.aaMedian,
      });
    }
  }
}

let failed = false;
const lines = ['| Case | Kind | Engine | Ratio | min–max | A/A |', '| --- | --- | --- | ---: | --- | ---: |'];

for (const row of allResults) {
  let fail = null;
  if (control) {
    if (row.aaMedian != null && (row.aaMedian < 0.98 || row.aaMedian > 1.02)) fail = 'control';
  } else {
    if (row.ratio > 1.02) fail = 'slow';
    if (row.kind === 'gain' && row.ratio > 0.95) fail = fail || 'gain';
  }
  if (fail) failed = true;
  const aa = row.aaMedian != null ? row.aaMedian.toFixed(3) : '—';
  lines.push(
    `| ${row.case} | ${row.kind} | ${row.engine} | ${row.ratio.toFixed(3)} | ${row.min.toFixed(3)}–${row.max.toFixed(3)} | ${aa} |`
  );
}

const md = lines.join('\n');
if (jsonOut) console.log(JSON.stringify({ results: allResults, markdown: md }, null, 2));
else console.log(md);

if (failed) {
  console.error('Gate failed');
  process.exit(1);
}
