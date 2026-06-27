#!/usr/bin/env node
/**
 * MathTS Workbook CLI
 *
 * Command handlers are pure functions returning `{ stdout, stderr, exitCode }`
 * (no direct console / process.exit) so they can be unit-tested. The thin
 * `main()` at the bottom wires them to the real streams, and only runs when
 * this file is the process entry point.
 */

import { readFileSync, writeFileSync, renameSync, lstatSync, realpathSync, unlinkSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseWorkbook, serializeWorkbook, stripOutputs } from './parser';
import { createExecutor } from './executor';
import { buildDependencyGraph, detectCycles, toMermaid } from './graph';
import { formatResult } from './formatter';
import { VERSION } from './index';
import { SCHEMA_VERSION } from './contract';
import type { CellResult, Workbook, ParseResult } from './types';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const HELP = `
mtsw - MathTS Workbook CLI

Usage:
  mtsw run <file> [-c <id>] [-v] [--json] [--write]
                                            Execute a workbook (or one cell + its
                                            deps with -c/--cell). -v: events,
                                            --json: machine output, --write: persist
                                            outputs back to the file.
  mtsw describe <file> [--json]             Structured document model (cells, graph)
  mtsw validate <file> [--json]             Validate structure (ids, deps, cycles)
  mtsw graph <file> [-f mermaid]            Print the dependency graph
  mtsw strip <file> [-w|--write]            Strip outputs (stdout, or -w to rewrite)
  mtsw new <name> [-t basic] [--force]      Scaffold a new <name>.mtsw
  mtsw capabilities [--json]                Engine version + feature flags
  mtsw templates [--json]                   List scaffold templates

Options:
  -h, --help     Show this help
  -V, --version  Show version

Notes:
  --json output is a single envelope on stdout: { schemaVersion, command, ok,
  data, problems }. The envelope is emitted even on failure; exit code mirrors
  'ok' (GUI clients should read 'ok', not the exit code).
  Writes (run --write, strip -w, new) are atomic but drop YAML comments / key
  order. Dependency scope is direct-only (non-transitive); cell ids must be
  valid identifiers ([A-Za-z_][A-Za-z0-9_]*).
`.trimStart();

/**
 * Build the unified --json envelope as a string. Uses a cycle- and BigInt-safe
 * replacer so it can NEVER throw — a workbook with a circular value (YAML
 * anchors/aliases) or a BigInt must still produce a valid envelope, preserving
 * the "envelope always emitted" contract.
 */
function jsonEnvelope(command: string, ok: boolean, data: unknown, problems: string[] = []): string {
  const seen = new WeakSet<object>();
  const replacer = (_key: string, value: unknown): unknown => {
    if (typeof value === 'bigint') return `${value}n`;
    if (value !== null && typeof value === 'object') {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  };
  return JSON.stringify(
    { schemaVersion: SCHEMA_VERSION, command, ok, data, problems: problems ?? [] },
    replacer,
    2
  );
}

/** The dispatchable commands (advertised by `capabilities`; a test guards drift). */
const COMMAND_NAMES = [
  'run', 'describe', 'validate', 'graph', 'strip', 'new', 'capabilities', 'templates',
] as const;

/** Flags that consume the following argument as their value. */
const VALUE_FLAGS = new Set(['-f', '--format', '-t', '--template', '-c', '--cell']);

/**
 * First argument that is neither a flag nor the value of a value-flag, so the
 * filename is found regardless of where flags appear (`graph -f mermaid file`
 * and `graph file -f mermaid` both work).
 */
function firstPositional(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (VALUE_FLAGS.has(arg)) {
      i++; // skip this flag's value
      continue;
    }
    if (!arg.startsWith('-')) return arg;
  }
  return undefined;
}

function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function readFile(file: string): { content?: string; error?: string } {
  try {
    return { content: readFileSync(file, 'utf-8') };
  } catch (error) {
    return { error: `Cannot read file '${file}': ${error instanceof Error ? error.message : String(error)}` };
  }
}

let atomicWriteCounter = 0;

/**
 * Write `content` to `file` atomically: write a uniquely-named sibling temp
 * file (exclusive create, so a pre-planted symlink can't be hijacked), then
 * rename over the target (atomic on the same filesystem; replaces a symlink
 * rather than writing through it). On any failure the temp file is removed, so
 * a crashed write can never leave a truncated notebook or a temp corpse.
 */
function writeFileAtomic(file: string, content: string): void {
  const tmp = `${file}.${process.pid}.${atomicWriteCounter++}.tmp`;
  writeFileSync(tmp, content, { encoding: 'utf-8', flag: 'wx' });
  try {
    renameSync(tmp, file);
  } catch (error) {
    try {
      unlinkSync(tmp);
    } catch {
      // best-effort cleanup
    }
    throw error;
  }
}

/** Scaffold template for `mtsw new`. `<NAME>` is replaced with the bare name. */
const BASIC_TEMPLATE = `version: "1.0"
metadata:
  title: "<NAME>"
runtime:
  engine: mathts
  execution: reactive
cells:
  - markdown: |
      # <NAME>

      A new MathTS workbook. Edit the cells, then run:
      mtsw run <NAME>.mtsw
    id: intro

  - code: "1 + 1"
    id: example

  - test: "example == 2"
    id: checkExample
    depends_on: [example]
`;

function bullets(items: string[]): string {
  return items.map((item) => `  - ${item}`).join('\n');
}

function statusMark(status: CellResult['status']): string {
  return status === 'success' || status === 'pass' ? '✓' : '✗';
}

function humanCellLine(cell: CellResult): string {
  const mark = statusMark(cell.status);
  const body =
    cell.status === 'error' || cell.status === 'fail'
      ? (cell.error ?? '(failed)')
      : formatResult(cell.output);
  return `${mark} ${cell.id} (${cell.type}): ${body}`;
}

function failureSummary(cells: CellResult[]): string {
  const failures = cells.filter((c) => c.status === 'error' || c.status === 'fail');
  if (failures.length === 0) return '';
  return `${failures.length} cell(s) failed:\n${bullets(failures.map((c) => `${c.id}: ${c.error ?? '(failed)'}`))}`;
}

function errMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Write a run's results back onto the workbook cells (for `run --write`). */
function applyResults(workbook: Workbook, results: CellResult[]): void {
  for (const result of results) {
    const cell = workbook.cells.find((c) => c.id === result.id);
    if (!cell) continue;
    cell.output = result.output;
    cell.error = result.error;
  }
}

/**
 * Cell results in --json shape. `output` is the raw value (same convention as
 * `describe`, so the GUI sees one type for the field); `null` when absent. The
 * envelope's cycle/BigInt-safe replacer keeps even exotic live values safe.
 */
function jsonCells(cells: CellResult[]): unknown[] {
  return cells.map((c) => ({
    id: c.id,
    type: c.type,
    status: c.status,
    output: c.output ?? null,
    error: c.error ?? null,
  }));
}

/** Failed/errored cells as a problems[] list for the envelope. */
function failureList(cells: CellResult[]): string[] {
  return cells
    .filter((c) => c.status === 'error' || c.status === 'fail')
    .map((c) => `${c.id}: ${c.error ?? '(failed)'}`);
}

export async function runCommand(args: string[]): Promise<CommandResult> {
  const json = args.includes('--json');
  const fail = (problems: string[], data: unknown = null): CommandResult =>
    json
      ? { stdout: jsonEnvelope('run', false, data, problems), stderr: '', exitCode: 1 }
      : { stdout: '', stderr: problems.join('\n'), exitCode: 1 };

  const file = firstPositional(args);
  if (!file) {
    return json ? fail(['Usage: mtsw run <file> [-c <id>] [-v] [--json] [--write]']) : {
      stdout: '', stderr: 'Usage: mtsw run <file> [-c <id>] [-v] [--json] [--write]', exitCode: 1,
    };
  }

  const read = readFile(file);
  if (read.error) return fail([read.error]);

  const parsed = parseWorkbook(read.content!);
  if (!parsed.success) {
    const problems = parsed.errors ?? [];
    return json ? fail(problems, { cells: [] }) : {
      stdout: '', stderr: `Parse errors:\n${bullets(problems)}`, exitCode: 1,
    };
  }

  const cellId = flagValue(args, '-c') ?? flagValue(args, '--cell');
  if (cellId !== undefined && !parsed.workbook!.cells.some((c) => c.id === cellId)) {
    return json ? fail([`No such cell: '${cellId}'`], { cells: [] }) : {
      stdout: '', stderr: `No such cell: '${cellId}'`, exitCode: 1,
    };
  }

  const verbose = args.includes('-v') || args.includes('--verbose');
  const executor = createExecutor(parsed.workbook!);
  const events: string[] = [];
  if (verbose) {
    executor.on((event) => events.push(`[${event.type}] ${event.cellId ?? ''}`.trimEnd()));
  }

  const report = await executor.runReport(cellId !== undefined ? { only: cellId } : {});
  const problems = report.ok ? [] : failureList(report.cells);
  const humanFailures = report.ok ? '' : failureSummary(report.cells);

  if (args.includes('--write')) {
    applyResults(parsed.workbook!, report.cells);
    try {
      writeFileAtomic(file, serializeWorkbook(parsed.workbook!));
    } catch (error) {
      return fail([`Failed to write '${file}': ${errMessage(error)}`], { cells: jsonCells(report.cells) });
    }
    if (json) {
      const stdout = jsonEnvelope('run', report.ok, { cells: jsonCells(report.cells), written: file }, problems);
      return { stdout, stderr: '', exitCode: report.ok ? 0 : 1 };
    }
    // Keep stdout clean for pipelines; confirmation + any failures to stderr.
    return {
      stdout: '',
      stderr: [`Updated ${file}`, humanFailures].filter(Boolean).join('\n'),
      exitCode: report.ok ? 0 : 1,
    };
  }

  if (json) {
    const stdout = jsonEnvelope('run', report.ok, { cells: jsonCells(report.cells) }, problems);
    return { stdout, stderr: '', exitCode: report.ok ? 0 : 1 };
  }

  const body = report.cells.map(humanCellLine).join('\n');
  const stdout = verbose && events.length > 0 ? `${events.join('\n')}\n\n${body}` : body;
  return { stdout, stderr: humanFailures, exitCode: report.ok ? 0 : 1 };
}

/** Parse errors + dependency cycles — the canonical "problems" set. */
function computeProblems(parsed: ParseResult): string[] {
  const problems: string[] = [...(parsed.errors ?? [])];
  if (parsed.success && parsed.workbook) {
    const graph = buildDependencyGraph(parsed.workbook.cells);
    for (const cycle of detectCycles(graph)) {
      problems.push(`Dependency cycle: ${cycle.join(' -> ')}`);
    }
  }
  return problems;
}

export function validateCommand(args: string[]): CommandResult {
  const json = args.includes('--json');
  const file = firstPositional(args);
  if (!file) {
    return json
      ? { stdout: jsonEnvelope('validate', false, null, ['Usage: mtsw validate <file>']), stderr: '', exitCode: 1 }
      : { stdout: '', stderr: 'Usage: mtsw validate <file>', exitCode: 1 };
  }

  const read = readFile(file);
  if (read.error) {
    return json
      ? { stdout: jsonEnvelope('validate', false, null, [read.error]), stderr: '', exitCode: 1 }
      : { stdout: '', stderr: read.error, exitCode: 1 };
  }

  const parsed = parseWorkbook(read.content!);
  const problems = computeProblems(parsed);
  const ok = problems.length === 0;
  const cellCount = parsed.workbook ? parsed.workbook.cells.length : 0;

  if (json) {
    return { stdout: jsonEnvelope('validate', ok, { cellCount }, problems), stderr: '', exitCode: ok ? 0 : 1 };
  }
  if (ok) {
    return { stdout: `OK: '${file}' is valid (${cellCount} cell(s))`, stderr: '', exitCode: 0 };
  }
  return { stdout: '', stderr: `Invalid workbook:\n${bullets(problems)}`, exitCode: 1 };
}

export function describeCommand(args: string[]): CommandResult {
  const json = args.includes('--json');
  const file = firstPositional(args);
  if (!file) {
    return json
      ? { stdout: jsonEnvelope('describe', false, null, ['Usage: mtsw describe <file>']), stderr: '', exitCode: 1 }
      : { stdout: '', stderr: 'Usage: mtsw describe <file>', exitCode: 1 };
  }

  const read = readFile(file);
  if (read.error) {
    return json
      ? { stdout: jsonEnvelope('describe', false, null, [read.error]), stderr: '', exitCode: 1 }
      : { stdout: '', stderr: read.error, exitCode: 1 };
  }

  const parsed = parseWorkbook(read.content!);
  const problems = computeProblems(parsed);
  const ok = parsed.success && problems.length === 0;
  const wb = parsed.workbook;

  const cells = (wb?.cells ?? []).map((c) => ({
    id: c.id,
    type: c.type,
    content: c.content,
    dependsOn: c.dependsOn ?? [],
    metadata: c.metadata ?? {},
    output: c.output ?? null,
    error: c.error ?? null,
  }));

  const graph = wb ? buildDependencyGraph(wb.cells) : undefined;
  const edges = graph
    ? [...graph.nodes].flatMap(([id, node]) => node.dependencies.map((dep) => ({ from: dep, to: id })))
    : [];
  const cycles = graph ? detectCycles(graph) : [];

  const data = {
    version: wb?.version ?? '1.0',
    metadata: wb?.metadata ?? {},
    runtime: wb?.runtime ?? { engine: 'mathts', execution: 'reactive' },
    cells,
    graph: { edges, cycles },
  };

  if (json) {
    return { stdout: jsonEnvelope('describe', ok, data, problems), stderr: '', exitCode: ok ? 0 : 1 };
  }

  if (!parsed.success) {
    return { stdout: '', stderr: `Parse errors:\n${bullets(problems)}`, exitCode: 1 };
  }
  const byType = cells.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] ?? 0) + 1;
    return acc;
  }, {});
  const summary = [
    `${data.metadata.title ?? '(untitled)'} — ${cells.length} cell(s)`,
    ...Object.entries(byType).map(([t, n]) => `  ${t}: ${n}`),
    problems.length ? `${problems.length} problem(s)` : 'no problems',
  ].join('\n');
  return { stdout: summary, stderr: '', exitCode: ok ? 0 : 1 };
}

export function capabilitiesCommand(args: string[]): CommandResult {
  const data = {
    name: 'mtsw',
    version: VERSION,
    cellTypes: {
      supported: ['code', 'markdown', 'data', 'test'],
      deferred: ['tensor', 'equation', 'visualization', 'export'],
    },
    commands: [...COMMAND_NAMES],
    features: { json: true, write: true, runCell: true, incremental: false, serve: false },
  };
  if (args.includes('--json')) {
    return { stdout: jsonEnvelope('capabilities', true, data, []), stderr: '', exitCode: 0 };
  }
  const lines = [
    `mtsw ${data.version} (schema ${SCHEMA_VERSION.major}.${SCHEMA_VERSION.minor})`,
    `supported cells: ${data.cellTypes.supported.join(', ')}`,
    `deferred cells: ${data.cellTypes.deferred.join(', ')}`,
    `commands: ${data.commands.join(', ')}`,
  ];
  return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
}

export function templatesCommand(args: string[]): CommandResult {
  const templates = Object.entries(TEMPLATES).map(([name, t]) => ({ name, description: t.description }));
  if (args.includes('--json')) {
    return { stdout: jsonEnvelope('templates', true, { templates }, []), stderr: '', exitCode: 0 };
  }
  return { stdout: templates.map((t) => `${t.name} - ${t.description}`).join('\n'), stderr: '', exitCode: 0 };
}

export function graphCommand(args: string[]): CommandResult {
  // graph is human-only; structured graph data lives in `describe --json`.
  // Answer a mistaken `--json` with a parseable envelope, not surprise text.
  if (args.includes('--json')) {
    return {
      stdout: jsonEnvelope('graph', false, null, ['graph has no --json output; use `describe --json` for structured graph data']),
      stderr: '',
      exitCode: 1,
    };
  }

  const file = firstPositional(args);
  if (!file) {
    return { stdout: '', stderr: 'Usage: mtsw graph <file> [-f mermaid]', exitCode: 1 };
  }

  const read = readFile(file);
  if (read.error) return { stdout: '', stderr: read.error, exitCode: 1 };

  const parsed = parseWorkbook(read.content!);
  if (!parsed.success) {
    return { stdout: '', stderr: `Parse errors:\n${bullets(parsed.errors ?? [])}`, exitCode: 1 };
  }

  const graph = buildDependencyGraph(parsed.workbook!.cells);

  if (flagValue(args, '-f') === 'mermaid' || flagValue(args, '--format') === 'mermaid') {
    return { stdout: toMermaid(graph), stderr: '', exitCode: 0 };
  }

  const lines = [...graph.nodes].map(([id, node]) => `${id}: [${node.dependencies.join(', ')}]`);
  return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
}

export function stripCommand(args: string[]): CommandResult {
  const file = firstPositional(args);
  if (!file) {
    return { stdout: '', stderr: 'Usage: mtsw strip <file> [-w|--write]', exitCode: 1 };
  }

  const read = readFile(file);
  if (read.error) return { stdout: '', stderr: read.error, exitCode: 1 };

  const parsed = parseWorkbook(read.content!);
  if (!parsed.success) {
    return { stdout: '', stderr: `Parse errors:\n${bullets(parsed.errors ?? [])}`, exitCode: 1 };
  }

  const yaml = serializeWorkbook(stripOutputs(parsed.workbook!));

  if (args.includes('-w') || args.includes('--write')) {
    try {
      writeFileAtomic(file, yaml);
    } catch (error) {
      return { stdout: '', stderr: `Failed to write '${file}': ${errMessage(error)}`, exitCode: 1 };
    }
    return { stdout: '', stderr: `Stripped outputs -> ${file}`, exitCode: 0 };
  }

  return { stdout: yaml, stderr: '', exitCode: 0 };
}

const TEMPLATES: Record<string, { content: string; description: string }> = {
  basic: { content: BASIC_TEMPLATE, description: 'Markdown intro + a code cell + a passing test cell' },
};

/** Windows reserved device names (case-insensitive), which cannot be filenames. */
const RESERVED_DEVICE_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  ...Array.from({ length: 9 }, (_unused, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_unused, i) => `LPT${i + 1}`),
]);

export function newCommand(args: string[]): CommandResult {
  const name = firstPositional(args);
  if (!name) {
    return { stdout: '', stderr: 'Usage: mtsw new <name> [-t basic] [--force]', exitCode: 1 };
  }

  // Path-traversal guard: a bare name only (no separators/colons/control chars,
  // not absolute). Colons matter on Windows where `C:foo` is drive-relative and
  // escapes isAbsolute().
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    return {
      stdout: '',
      stderr: `Invalid name '${name}': must be a bare filename (no path separators, colons, or control characters)`,
      exitCode: 1,
    };
  }

  const templateName = flagValue(args, '-t') ?? flagValue(args, '--template') ?? 'basic';
  const template = TEMPLATES[templateName];
  if (!template) {
    return {
      stdout: '',
      stderr: `Unknown template '${templateName}'. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      exitCode: 1,
    };
  }

  const bare = name.endsWith('.mtsw') ? name.slice(0, -'.mtsw'.length) : name;
  if (bare === '' || bare === '.' || bare === '..' || RESERVED_DEVICE_NAMES.has(bare.toUpperCase())) {
    return { stdout: '', stderr: `Invalid name '${name}'`, exitCode: 1 };
  }
  const target = `${bare}.mtsw`;
  const content = template.content.replace(/<NAME>/g, bare);
  const force = args.includes('--force');

  try {
    if (force) {
      // Refuse to clobber a symlink even with --force.
      try {
        if (lstatSync(target).isSymbolicLink()) {
          return { stdout: '', stderr: `Refusing to overwrite symlink '${target}'`, exitCode: 1 };
        }
      } catch {
        // target doesn't exist — fine
      }
      writeFileAtomic(target, content);
    } else {
      // Exclusive create: fails (incl. on an existing symlink) if the path exists.
      writeFileSync(target, content, { encoding: 'utf-8', flag: 'wx' });
    }
  } catch (error) {
    const e = error as NodeJS.ErrnoException;
    if (e.code === 'EEXIST') {
      return { stdout: '', stderr: `File '${target}' already exists (use --force to overwrite)`, exitCode: 1 };
    }
    return { stdout: '', stderr: `Failed to create '${target}': ${errMessage(error)}`, exitCode: 1 };
  }

  return { stdout: `Created ${target}`, stderr: '', exitCode: 0 };
}

/**
 * Route argv to a command handler. Pure — returns a CommandResult.
 */
export async function dispatch(argv: string[]): Promise<CommandResult> {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    return { stdout: HELP, stderr: '', exitCode: 0 };
  }
  if (argv.includes('-V') || argv.includes('--version')) {
    return { stdout: `mtsw version ${VERSION}`, stderr: '', exitCode: 0 };
  }

  const [command, ...rest] = argv;
  try {
    switch (command) {
      case 'run':
        return await runCommand(rest);
      case 'validate':
        return validateCommand(rest);
      case 'graph':
        return graphCommand(rest);
      case 'describe':
        return describeCommand(rest);
      case 'strip':
        return stripCommand(rest);
      case 'new':
        return newCommand(rest);
      case 'capabilities':
        return capabilitiesCommand(rest);
      case 'templates':
        return templatesCommand(rest);
      default:
        return { stdout: '', stderr: `Unknown command: ${command}\n${HELP}`, exitCode: 1 };
    }
  } catch (error) {
    // Defense-in-depth: handlers shouldn't throw, but if one does, still honor
    // the envelope contract when --json was requested.
    const message = error instanceof Error ? error.message : String(error);
    if (rest.includes('--json')) {
      return { stdout: jsonEnvelope(command, false, null, [`Internal error: ${message}`]), stderr: '', exitCode: 1 };
    }
    return { stdout: '', stderr: `Internal error: ${message}`, exitCode: 1 };
  }
}

async function main(): Promise<void> {
  const result = await dispatch(process.argv.slice(2));
  if (result.stdout) process.stdout.write(`${result.stdout}\n`);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  process.exit(result.exitCode);
}

/**
 * True when this module is the process entry point. Resolves argv[1] through
 * `realpathSync` first, so a symlinked bin (npm's POSIX `.bin/mtsw` shim) still
 * matches `import.meta.url` (which is always the real path).
 */
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return import.meta.url === pathToFileURL(entry).href;
  }
}

// Only run when invoked as the entry point (not when imported by tests).
if (isEntryPoint()) {
  void main();
}
