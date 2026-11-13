#!/usr/bin/env node
/**
 * Run every wall-clock perf gate, one at a time, each in its own Node process.
 *
 *   node tools/test/run-wall-clock-gates.mjs [--only name,name] [--list] [--config path]
 *
 * The gate list (names, scripts, limits, round counts) is
 * tools/test/wall-clock-gates.json; `--config` or PERF_GATE_CONFIG selects
 * another file. PERF_NODE selects the Node binary of the gate processes, as it does
 * for tools/benchmark/ab (default: the Node that runs this script). PERF_GATE_CANDIDATE_TIME_SCALE and
 * PERF_GATE_AA reach the gates through the environment.
 *
 * Run it with plain `node`: under `bun run` the name `node` resolves to Bun,
 * and a gate would then time Bun, not Node.
 *
 * Every gate process starts through tools/test/perf-gate-spawn.mjs: it has
 * `--expose-gc` (a gate with `gcBetween` collects between rounds) and it has no
 * V8 coverage or vitest worker state from the parent environment.
 *
 * Exit code 0: every gate passed. Exit code 1: a gate failed, crashed or
 * printed no verdict. All gates run before the exit, so one report lists them.
 * Exit code 2: a bad argument or an unreadable gate list; no gate ran.
 *
 * Each result line shows the median ratio, its confidence bounds, the headroom
 * (limit / median: the slowdown of the candidate that brings the median to the
 * limit) and the rounds taken.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERF_GATE_NODE_FLAGS, isolatedPerfGateChildEnv } from './perf-gate-spawn.mjs';
import { loadGateList } from './wall-clock-perf-gate.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
  const out = { only: null, list: false, config: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') out.list = true;
    else if (a === '--only') {
      out.only = (argv[++i] ?? '').split(',').filter(Boolean);
      if (out.only.length === 0)
        throw new Error('--only needs a comma-separated list of gate names');
    } else if (a === '--config') {
      out.config = argv[++i];
      if (!out.config) throw new Error('--config needs the path of a gate list');
    } else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

function fmt(x) {
  return Number.isFinite(x) ? x.toFixed(3) : String(x);
}

/**
 * Run one gate process and read its verdict.
 * @param {ReturnType<typeof loadGateList>[number]} gate
 * @param {string} nodeBin
 */
export function runGate(gate, nodeBin) {
  const missing = gate.needs.filter((p) => !existsSync(join(repoRoot, p)));
  if (missing.length > 0) {
    return { gate: gate.name, error: `built output required: ${missing.join(', ')}` };
  }
  const t0 = performance.now();
  const r = spawnSync(nodeBin, [...PERF_GATE_NODE_FLAGS, join(repoRoot, gate.script)], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: isolatedPerfGateChildEnv(),
    timeout: gate.timeoutMs,
    maxBuffer: 1 << 24,
  });
  const seconds = (performance.now() - t0) / 1000;
  if (r.error || r.status !== 0) {
    const why = r.error ? r.error.message : `exit ${r.status}`;
    return { gate: gate.name, seconds, error: `${why}: ${(r.stderr ?? '').trim().slice(-600)}` };
  }
  const line = r.stdout.trim().split('\n').pop() ?? '';
  let payload;
  try {
    payload = JSON.parse(line);
  } catch {
    return { gate: gate.name, seconds, error: `no JSON verdict line, got: ${line.slice(0, 200)}` };
  }
  if (payload.verdict !== 'pass' && payload.verdict !== 'fail') {
    return { gate: gate.name, seconds, error: `bad verdict ${JSON.stringify(payload.verdict)}` };
  }
  if ('checksum' in payload && !Number.isFinite(payload.checksum)) {
    return { gate: gate.name, seconds, error: `checksum is not finite: ${payload.checksum}` };
  }
  return { ...payload, seconds };
}

function main() {
  if (process.versions.bun) {
    console.error('run-wall-clock-gates: run with Node, not Bun (a gate would time Bun).');
    process.exit(2);
  }
  const args = parseArgs(process.argv.slice(2));
  if (args.config) process.env.PERF_GATE_CONFIG = resolve(args.config);
  const gates = loadGateList();
  if (args.list) {
    for (const g of gates) console.log(`${g.name}\tlimit ${g.limit}\t${g.script}`);
    return;
  }
  const selected = args.only ? gates.filter((g) => args.only.includes(g.name)) : gates;
  if (args.only) {
    const unknown = args.only.filter((n) => !gates.some((g) => g.name === n));
    if (unknown.length > 0) throw new Error(`unknown gate: ${unknown.join(', ')}`);
  }
  const nodeBin = process.env.PERF_NODE || process.execPath;
  const ci = process.env.GITHUB_ACTIONS === 'true';
  console.log(`[wall-clock-gates] node ${process.version} (${nodeBin})`);
  const scale = process.env.PERF_GATE_CANDIDATE_TIME_SCALE;
  if (scale) console.log(`[wall-clock-gates] PERF_GATE_CANDIDATE_TIME_SCALE=${scale}`);
  if (process.env.PERF_GATE_AA)
    console.log('[wall-clock-gates] PERF_GATE_AA=' + process.env.PERF_GATE_AA);

  let failed = 0;
  for (const gate of selected) {
    const res = runGate(gate, nodeBin);
    if (res.error) {
      failed++;
      console.log(`FAIL  ${gate.name}  crashed: ${res.error}`);
      if (ci)
        console.log(`::error title=wall-clock gate ${gate.name}::${res.error.split('\n')[0]}`);
      continue;
    }
    const bound = `median ${fmt(res.ratio)}  [${fmt(res.lower)}, ${fmt(res.upper)}]`;
    const tag = res.verdict === 'pass' ? 'pass' : 'FAIL';
    // limit / median: the slowdown of the candidate that brings the median to the limit.
    const headroom =
      Number.isFinite(res.ratio) && res.ratio > 0
        ? `  headroom ${fmt(res.limit / res.ratio)}x`
        : '';
    const note = res.conclusive
      ? ''
      : res.verdict === 'fail'
        ? '  (at the round cap: the interval holds the limit, the median is at or above it)'
        : '  (at the round cap: the interval holds the limit, the median is below it)';
    console.log(
      `${tag}  ${gate.name}  limit ${res.limit}  ${bound}${headroom}  rounds ${res.rounds}  ${res.seconds.toFixed(1)} s${note}`
    );
    if (res.verdict === 'fail') {
      failed++;
      if (ci) {
        const why = res.conclusive
          ? `lower bound ${fmt(res.lower)} >= limit ${res.limit}`
          : `at the round cap (${res.rounds}), median >= limit ${res.limit}`;
        console.log(
          `::error title=wall-clock gate ${gate.name}::median ratio ${fmt(res.ratio)}, ${why}`
        );
      }
    }
  }
  console.log(`[wall-clock-gates] ${selected.length - failed} of ${selected.length} passed`);
  if (failed > 0) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error(`run-wall-clock-gates: ${e.message}`);
    process.exit(2);
  }
}
