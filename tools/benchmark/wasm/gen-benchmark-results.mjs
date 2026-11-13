#!/usr/bin/env node
/**
 * Render the measured tables of `docs/BENCHMARK_RESULTS.md` from a recorded measurement.
 *
 * The document holds two kinds of text. Prose is fixed. Each measured table sits between a
 * pair of markers, `<!-- bench:begin NAME -->` and `<!-- bench:end NAME -->`, and this script
 * writes everything between them from `docs/benchmarks/wasm-public-call.json`:
 *
 *   policy       the dispatch bands that `wasmDispatchPolicy()` returned during the run
 *   public-call  the elementwise calls, timed through the public API with the tier off and
 *                on, with the shipped policy: what a consumer gets after `loadWasm()`
 *   kernel-call  the same calls with the dispatch policy overridden, so the AS kernel runs at
 *                every size: what the kernel can do
 *
 * Modes:
 *   --render    rewrite the document from the recorded measurement
 *   --check     exit 1 when the document differs from the render (a hand-edited cell, or a
 *               measurement that was recorded without a render)
 *   --measure   run both passes of `tools/benchmark/wasm/run-node.mjs opt-in`, record the
 *               result, then render. Needs `bun run build` first.
 *
 * Options (every value has one default in CONFIG; a flag or an environment variable
 * WASM_BENCH_<NAME> overrides it):
 *   --doc FILE    the document            --data FILE   the recorded measurement
 *   --ops a,b     calls to measure        --sizes a,b   input lengths to measure
 *
 * The same renderer runs under `--check`, so a re-measured table changes only the cells
 * that hold measured values.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

/** The one place that names the document, the record, and what `--measure` times. */
export const CONFIG = {
  doc: join(repoRoot, 'docs', 'BENCHMARK_RESULTS.md'),
  data: join(repoRoot, 'docs', 'benchmarks', 'wasm-public-call.json'),
  runner: join(here, 'run-node.mjs'),
  ops: ['sin', 'cos', 'tan', 'exp', 'log', 'abs'],
  sizes: [16_384, 131_072, 1_048_576],
};

const BEGIN = (name) => `<!-- bench:begin ${name} -->`;
const END = (name) => `<!-- bench:end ${name} -->`;

/** 1048576 -> "1_048_576", the spelling `policy.ts` uses. */
export function grouped(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '_');
}

/** The band of one policy entry as text. */
export function bandText(band) {
  return band.max === undefined
    ? `n ≥ ${grouped(band.min)}`
    : `${grouped(band.min)} ≤ n < ${grouped(band.max)}`;
}

const ms = (x) => x.toFixed(3);
const ratio = (x) => x.toFixed(2);

/** A GitHub table from rows of cells. `prettier` aligns the columns when the file is formatted. */
function table(header, rows) {
  const line = (cells) => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}

/** The text of the `policy` block. */
export function renderPolicy(data) {
  const keys = Object.keys(data.policy).sort();
  return [
    `Rendered from \`wasmDispatchPolicy()\` as it was during the measurement (${data.measuredAt},`,
    `Node ${data.meta.node.replace(/^v/, '')}, ${data.meta.platform} ${data.meta.arch}). The authority is`,
    '`functions/src/wasm/policy.ts`; a kernel with no row stays on JavaScript after `loadWasm()`.',
    '',
    table(
      ['Policy key (AS export)', 'Band (`min` ≤ n, optional `max`)'],
      keys.map((k) => [`\`${k}\``, bandText(data.policy[k])])
    ),
  ].join('\n');
}

const relDiff = (x) => (x === 0 ? '0' : x.toExponential(1));

/** One line that names when, where and how a block was measured. */
function measuredLine(data) {
  const node = data.meta.node.replace(/^v/, '');
  return `Measured ${data.measuredAt} on Node ${node} (V8), ${data.meta.platform} ${data.meta.arch}.`;
}

/**
 * The table of one pass. Each pass has its own unloaded column: the two passes run in separate
 * processes, so a ratio is only meaningful against the unloaded time of the same pass.
 */
function passTable(rows, { withRan }) {
  const header = ['Call', 'n', 'Unloaded (ms)', 'Loaded (ms)', 'Ratio', 'Max rel. diff'];
  if (withRan) header.push('WASM ran');
  return table(
    header,
    rows.map((r) => {
      const cells = [
        `\`${r.name}\``,
        grouped(r.n),
        ms(r.unloadedMs),
        ms(r.loadedMs),
        ratio(r.ratio),
        relDiff(r.relDiff),
      ];
      if (withRan) cells.push(r.kernels.length > 0 ? 'yes' : 'no (JavaScript path)');
      return cells;
    })
  );
}

/** The text of the `public-call` block: the call a consumer makes after `loadWasm()`. */
export function renderPublicCall(data) {
  return [measuredLine(data), '', passTable(data.runs.public, { withRan: true })].join('\n');
}

/** The text of the `kernel-call` block: the same calls with the dispatch policy overridden. */
export function renderKernelCall(data) {
  return [measuredLine(data), '', passTable(data.runs.kernel, { withRan: false })].join('\n');
}

const RENDERERS = {
  policy: renderPolicy,
  'public-call': renderPublicCall,
  'kernel-call': renderKernelCall,
};

/** Replace the text between each marker pair with its render. Throws when a marker is missing. */
export function applyBlocks(doc, data) {
  let out = doc;
  for (const [name, render] of Object.entries(RENDERERS)) {
    const begin = out.indexOf(BEGIN(name));
    const end = out.indexOf(END(name));
    if (begin < 0 || end < begin) {
      throw new Error(`BENCHMARK_RESULTS: marker pair "${name}" is missing`);
    }
    out = `${out.slice(0, begin + BEGIN(name).length)}\n\n${render(data)}\n\n${out.slice(end)}`;
  }
  return out;
}

async function format(text, file) {
  const prettier = await import('prettier');
  const options = (await prettier.resolveConfig(file)) ?? {};
  return prettier.format(text, { ...options, filepath: file });
}

/** The document that `--render` writes. */
export async function renderDocument(doc, data, file = CONFIG.doc) {
  return format(applyBlocks(doc, data), file);
}

/** Run one pass of the opt-in bench and return the JSON rows it printed. */
function runPass(config, flags, marker) {
  const args = [
    config.runner,
    'opt-in',
    ...config.ops,
    `--sizes=${config.sizes.join(',')}`,
    ...flags,
  ];
  const run = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    cwd: repoRoot,
  });
  if (run.status !== 0) {
    throw new Error(`opt-in bench failed (exit ${run.status}): ${run.stderr || run.stdout}`);
  }
  const line = run.stdout.split('\n').find((l) => l.startsWith(`${marker} `));
  if (!line) throw new Error(`opt-in bench printed no ${marker} line`);
  return JSON.parse(line.slice(marker.length + 1));
}

/** Both passes, as the record that the renderer reads. */
export function measure(config) {
  const kernel = runPass(config, [], 'OPT_IN_JSON');
  const published = runPass(config, ['--public'], 'PUBLIC_CALL_JSON');
  return {
    measuredAt: new Date().toISOString().slice(0, 10),
    meta: published.meta,
    policy: published.policy,
    runs: { kernel, public: published.rows },
  };
}

function parseArgs(argv) {
  const env = (k) => process.env[`WASM_BENCH_${k}`];
  const o = { mode: null, doc: env('DOC') ?? CONFIG.doc, data: env('DATA') ?? CONFIG.data };
  o.ops = (env('OPS') ?? CONFIG.ops.join(',')).split(',').filter(Boolean);
  o.sizes = (env('SIZES') ?? CONFIG.sizes.join(',')).split(',').filter(Boolean).map(Number);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--render' || a === '--check' || a === '--measure') o.mode = a.slice(2);
    else if (a === '--doc') o.doc = resolve(next());
    else if (a === '--data') o.data = resolve(next());
    else if (a === '--ops') o.ops = next().split(',').filter(Boolean);
    else if (a === '--sizes') o.sizes = next().split(',').filter(Boolean).map(Number);
    else throw new Error(`unknown argument ${a}`);
  }
  if (!o.mode) throw new Error('give one of --render, --check, --measure');
  return o;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.mode === 'measure') {
    const data = measure({ ...CONFIG, ops: o.ops, sizes: o.sizes });
    // The record is formatted as the repo formats JSON, so `format:check` accepts it.
    writeFileSync(o.data, await format(JSON.stringify(data, null, 2), o.data));
    console.log(`recorded ${data.runs.public.length} public rows in ${o.data}`);
  }
  const data = JSON.parse(readFileSync(o.data, 'utf8'));
  const doc = readFileSync(o.doc, 'utf8');
  const rendered = await renderDocument(doc, data, o.doc);
  if (o.mode === 'check') {
    if (rendered !== doc) {
      console.error(
        `${o.doc} differs from its render of ${o.data}. Run: node tools/benchmark/wasm/gen-benchmark-results.mjs --render`
      );
      process.exit(1);
    }
    console.log('BENCHMARK_RESULTS.md matches its recorded measurement');
    return;
  }
  writeFileSync(o.doc, rendered);
  console.log(`wrote ${o.doc}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
}
