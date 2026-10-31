#!/usr/bin/env node
/**
 * Phase 7 base-against-head benchmark runner.
 *
 *   node tools/benchmark/ab/run.mjs [--runs 5] [--engine node|bun] [--control] [--json]
 *                                   [--pr P7-3] [--only <name substring>] [--cases <file.mjs> ...] [<file.mjs> ...]
 *
 * `--pr P7-n` keeps the cases tagged `pr: 'P7-n'` and the cases tagged `control: true`, which
 * is the gate of that pull request; the other pull requests' cases run unchanged code on both
 * sides, so they are left out.
 *
 * Run it with `node`, not through `bun run`: the `node` engine rows must run on Node.js.
 * Exit code 1 when the gate fails (see `gate.mjs`), 2 when the base tree or a dist is missing.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  PROCESSES_PER_RUN,
  RERUN_RUNS,
  estimate,
  failureOf,
  needsRerun,
  twoTreeRatio,
} from './gate.mjs';
import { preflightWorkspace } from './preflight.mjs';
import { median, nodeBinary, perfBaseDir } from './util.mjs';
import { repoRoot } from '../../test/workspaces.mjs';

const abDir = fileURLToPath(new URL('.', import.meta.url));
const argv = process.argv.slice(2);

let runs = 5;
let control = false;
let jsonOut = false;
let pr = null;
let only = null;
let engines = ['node', 'bun'];
const caseFiles = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--runs') runs = Number(argv[++i]);
  else if (a === '--control') control = true;
  else if (a === '--json') jsonOut = true;
  else if (a === '--pr') pr = argv[++i];
  else if (a === '--only') only = argv[++i];
  else if (a === '--engine') engines = [argv[++i]];
  else if (a === '--cases') caseFiles.push(resolve(argv[++i]));
  else if (a.endsWith('.mjs')) caseFiles.push(resolve(a));
  else {
    console.error(`unknown argument ${a}`);
    process.exit(2);
  }
}

if (!Number.isInteger(runs) || runs < 1) {
  console.error('--runs needs a positive integer');
  process.exit(2);
}

if (caseFiles.length === 0) {
  for (const f of readdirSync(join(abDir, 'cases')).sort()) {
    if (f.endsWith('.mjs') && f !== 'helpers.mjs') caseFiles.push(join(abDir, 'cases', f));
  }
}

if (!existsSync(join(perfBaseDir(repoRoot), 'REF'))) {
  console.error('Missing base tree. Run: node tools/benchmark/ab/make-base.mjs [--ref <ref>]');
  process.exit(2);
}

if (!control) {
  const err = preflightWorkspace();
  if (err) {
    console.error(err);
    process.exit(2);
  }
}

/** @type {{ file: string, cases: { name: string, kind: string }[] }[]} */
const specs = [];
for (const cf of caseFiles) {
  let spec;
  try {
    spec = await import(pathToFileURL(cf).href);
  } catch (e) {
    console.error(`Failed to load case file ${cf}: ${e}`);
    process.exit(1);
  }
  let cases = pr ? spec.cases.filter((c) => c.pr === pr || c.control === true) : spec.cases;
  if (only) cases = cases.filter((c) => c.name.includes(only));
  if (cases.length > 0) specs.push({ file: cf, ...spec, cases });
}
if (specs.length === 0) {
  console.error(pr ? `no case is tagged pr: '${pr}'` : 'no cases');
  process.exit(2);
}

const nodeExe = nodeBinary();

/**
 * @param {'node' | 'bun'} engine
 * @param {Record<string, string>} env
 */
function spawnChild(engine, env) {
  const childPath = join(abDir, 'child.mjs');
  const options = {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  };
  if (engine === 'bun') {
    return spawnSync('bun', ['--tsconfig-override=tsconfig.base.json', childPath], options);
  }
  return spawnSync(nodeExe, [childPath], options);
}

/** @param {import('node:child_process').SpawnSyncReturns<string>} out */
function parseChild(out) {
  const line = (out.stdout || '').trim().split('\n').filter(Boolean).pop();
  try {
    return JSON.parse(line || '{}');
  } catch {
    return { ok: false, error: out.stderr || out.stdout || 'invalid json' };
  }
}

/**
 * @param {string} caseFile
 * @param {string} caseName
 * @param {Record<string, string>} extra
 */
function childEnv(caseFile, caseName, extra) {
  return { PERF_REPO_ROOT: repoRoot, PERF_CASE_FILE: caseFile, PERF_CASE_NAME: caseName, ...extra };
}

/**
 * One measurement of a case on an engine.
 *
 * Two kinds of process. One process per import order loads both trees: it checks that the two
 * results are bit-identical and reports the A/A twin and the two-tree cross-check. The gate's
 * ratio comes from `nRuns` runs of single-tree processes, `PROCESSES_PER_RUN` per side per run,
 * alternating base, head, head, base so that drift falls on both (see `estimate` in gate.mjs).
 * @param {'node'|'bun'} engine
 * @param {string} caseFile
 * @param {{ name: string, kind: string }} caseDef
 * @param {number} nRuns
 */
function measure(engine, caseFile, caseDef, nRuns) {
  const dual = {};
  const aaRatios = [];
  for (const order of ['base-first', 'head-first']) {
    const res = parseChild(
      spawnChild(
        engine,
        childEnv(caseFile, caseDef.name, {
          PERF_ORDER: order,
          PERF_MODE: 'dual',
          PERF_CONTROL: control ? '1' : '0',
        })
      )
    );
    if (!res.ok) return { fail: res.error || 'child failed' };
    dual[order] = res.ratio;
    if (res.aaRatio != null) aaRatios.push(res.aaRatio);
  }

  const baseUs = [];
  const headUs = [];
  for (let i = 0; i < nRuns * PROCESSES_PER_RUN; i++) {
    const modes = i % 2 === 0 ? ['single-base', 'single-head'] : ['single-head', 'single-base'];
    for (const mode of modes) {
      const res = parseChild(
        spawnChild(
          engine,
          childEnv(caseFile, caseDef.name, { PERF_MODE: mode, PERF_CONTROL: control ? '1' : '0' })
        )
      );
      if (!res.ok || !res.medUs) return { fail: res.error || 'single-tree child failed' };
      (mode === 'single-base' ? baseUs : headUs).push(res.medUs);
    }
  }
  const est = estimate(baseUs, headUs);
  if (!est) return { fail: 'no single-tree samples' };
  return {
    ratio: est.ratio,
    min: est.min,
    max: est.max,
    twoTree: twoTreeRatio(dual['base-first'], dual['head-first']),
    aaMedian: aaRatios.length ? median(aaRatios) : null,
    runs: nRuns,
  };
}

/** @type {Array<Record<string, unknown>>} */
const allResults = [];

for (const { file, cases } of specs) {
  for (const c of cases) {
    for (const engine of engines) {
      let row = measure(engine, file, c, runs);
      if (!row.fail && needsRerun({ kind: c.kind, ratio: row.ratio }, control)) {
        process.stderr.write(
          `${c.name} (${engine}): ${row.ratio.toFixed(3)}, rerun with R = ${RERUN_RUNS}\n`
        );
        row = measure(engine, file, c, RERUN_RUNS);
      }
      if (row.fail) {
        allResults.push({ case: c.name, kind: c.kind, engine, fail: row.fail });
        process.stderr.write(`${c.name} (${engine}): FAIL ${row.fail}\n`);
        continue;
      }
      allResults.push({ case: c.name, kind: c.kind, engine, ...row });
      process.stderr.write(`${c.name} (${engine}): ${row.ratio.toFixed(3)}\n`);
    }
  }
}

let failed = false;
const lines = [
  '| Case | Kind | Engine | Ratio | min–max | Two-tree | A/A | Runs | Equal | Gate |',
  '| --- | --- | --- | ---: | --- | ---: | ---: | ---: | --- | --- |',
];

for (const row of allResults) {
  if (row.fail) {
    failed = true;
    lines.push(
      `| ${row.case} | ${row.kind} | ${row.engine} | — | — | — | — | — | no: ${row.fail} | FAIL |`
    );
    continue;
  }
  const reason = failureOf(row, control);
  if (reason) failed = true;
  const aa = row.aaMedian != null ? row.aaMedian.toFixed(3) : '—';
  lines.push(
    `| ${row.case} | ${row.kind} | ${row.engine} | ${row.ratio.toFixed(3)} | ${row.min.toFixed(3)}–${row.max.toFixed(3)} | ${row.twoTree.toFixed(3)} | ${aa} | ${row.runs} | yes | ${reason ? `FAIL (${reason})` : 'pass'} |`
  );
  row.gate = reason ?? 'pass';
}

const baseRef = readFileSync(join(perfBaseDir(repoRoot), 'REF'), 'utf8').trim();
const head = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).stdout.trim();
const nodeVersion = spawnSync(nodeExe, ['--version'], { encoding: 'utf8' }).stdout.trim();
const bunVersion = spawnSync('bun', ['--version'], { encoding: 'utf8' }).stdout.trim();
const header = `Base ${baseRef.slice(0, 9)}, head ${head.slice(0, 9)}, Node ${nodeVersion}, Bun ${bunVersion}, ${control ? "control (A/A') session, " : ''}R = ${runs}.`;

const md = `${header}\n\n${lines.join('\n')}`;
if (jsonOut) console.log(JSON.stringify({ header, results: allResults, markdown: md }, null, 2));
else console.log(md);

if (failed) {
  console.error('Gate failed');
  process.exit(1);
}
