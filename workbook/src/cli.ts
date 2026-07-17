#!/usr/bin/env node
/**
 * MathTS Workbook CLI
 *
 * Command handlers are pure functions returning `{ stdout, stderr, exitCode }`
 * (no direct console / process.exit) so they can be unit-tested. The thin
 * `main()` at the bottom wires them to the real streams, and only runs when
 * this file is the process entry point.
 */

import { readFileSync, writeFileSync, lstatSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { basename } from 'node:path';
import { createInterface } from 'node:readline';
import { writeFileAtomic } from './fs-atomic';
import { Session } from './session';
import { handleRequest, type JsonRpcRequest } from './rpc';
import { parseWorkbook, serializeWorkbook, stripOutputs, importWorkbook } from './parser';
import { createExecutor } from './executor';
import { buildDependencyGraph, detectCycles, toMermaid, toDOT } from './graph';
import { formatResult } from './formatter';
import { SCHEMA_VERSION, VERSION } from './contract';
import { describeData } from './doc';
import { capabilitiesInfo, listFunctions } from './introspect';
import { addCell, editCell, removeCell, moveCell, renameCell, setMetadata } from './edit';
import type { CellPosition } from './edit';
import type { CellResult, Workbook, ParseResult, CellType, RunResult } from './types';
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { toHTML } from './html';
import { toTeX } from './tex';
import { toPDF } from './pdf';
import { toIpynb } from './ipynb';
import { renderChart } from './svg';
import type { RenderDoc, RenderCell } from './html';
import { parseYamlHardened } from './yaml-safe';

/**
 * The wired expression parser. `parse` is a real runtime export of the
 * functions package, but its declared type (`Parameters<typeof createEvaluate>[0]`)
 * references an expression type that doesn't resolve cleanly across the package
 * boundary, so TS omits the named export. The runtime value is present (verified
 * by the export E2E), so we assert the call signature here.
 */
const parse = (mathFunctions as unknown as { parse: (expr: string) => unknown }).parse;

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
  mtsw graph <file> [-f mermaid|dot]        Print the dependency graph
  mtsw strip <file> [-w|--write]            Strip outputs (stdout, or -w to rewrite)
  mtsw new <name> [-t basic|empty|chart] [--empty] [-o <path>] [--force]
                                            Scaffold a new workbook (-o for any path)
  mtsw import [<file>] [-o out.mtsw] [--json]
                                            Build a .mtsw from a JSON/YAML doc
                                            ({metadata,cells:[{id,type,content,dependsOn}]};
                                            file or stdin; stdout if no -o)
  mtsw capabilities [--json]                Engine version + feature flags
  mtsw templates [--json]                   List scaffold templates
  mtsw cell <verb> <file> ...               Edit cells (atomic, in-place):
      cell add <file> --type <t> --id <id> [--content <s> | --content-file <p|->]
                                  [--depends-on a,b] [--before|--after <id> | --at <n>]
      cell edit <file> <id> [--content <s> | --content-file <p|->] [--type <t>] [--depends-on a,b]
      cell rm <file> <id> [--force]         (--force detaches dependents)
      cell move <file> <id> (--before|--after <id> | --at <n>)
      cell rename <file> <oldId> <newId>
      (any cell verb accepts --json and --dry-run)
  mtsw functions [--json]                    List functions/constants cells can call
  mtsw meta get <file> [--json]             Show workbook metadata
  mtsw meta set <file> [--title s] [--author s] [--description s] [--tags a,b]
  mtsw export <file> [--format html|tex|json|pdf|ipynb] [--fragment] [-o out] [--no-run]
                                            Render to a self-contained HTML or LaTeX
                                            document (MathML/TikZ equations + charts,
                                            no external deps), a Jupyter notebook
                                            (nbformat v4, default extension .ipynb), a
                                            PDF (requires -o), or emit the executed
                                            run report as JSON. --fragment (tex only)
                                            omits the preamble for \\input; --no-run is
                                            incompatible with --format json.
  mtsw serve [<file>]                        JSON-RPC over stdio (persistent session
                                            w/ streaming events + incremental run)

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
function jsonEnvelope(
  command: string,
  ok: boolean,
  data: unknown,
  problems: string[] = []
): string {
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

/** Flags that consume the following argument as their value. */
const VALUE_FLAGS = new Set([
  '-f',
  '--format',
  '-t',
  '--template',
  '-c',
  '--cell',
  '--id',
  '--content',
  '--content-file',
  '--depends-on',
  '--before',
  '--after',
  '--at',
  '--title',
  '--author',
  '--description',
  '--tags',
  '-o',
  '--output',
]);

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
    return {
      error: `Cannot read file '${file}': ${error instanceof Error ? error.message : String(error)}`,
    };
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
    return json
      ? fail(['Usage: mtsw run <file> [-c <id>] [-v] [--json] [--write]'])
      : {
          stdout: '',
          stderr: 'Usage: mtsw run <file> [-c <id>] [-v] [--json] [--write]',
          exitCode: 1,
        };
  }

  const read = readFile(file);
  if (read.error) return fail([read.error]);

  const parsed = parseWorkbook(read.content!);
  if (!parsed.success) {
    const problems = parsed.errors ?? [];
    return json
      ? fail(problems, { cells: [] })
      : {
          stdout: '',
          stderr: `Parse errors:\n${bullets(problems)}`,
          exitCode: 1,
        };
  }

  const cellId = flagValue(args, '-c') ?? flagValue(args, '--cell');
  if (cellId !== undefined && !parsed.workbook!.cells.some((c) => c.id === cellId)) {
    return json
      ? fail([`No such cell: '${cellId}'`], { cells: [] })
      : {
          stdout: '',
          stderr: `No such cell: '${cellId}'`,
          exitCode: 1,
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
      return fail([`Failed to write '${file}': ${errMessage(error)}`], {
        cells: jsonCells(report.cells),
      });
    }
    if (json) {
      const stdout = jsonEnvelope(
        'run',
        report.ok,
        { cells: jsonCells(report.cells), written: file },
        problems
      );
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
/** Validate `visualization` cells' chart specs (shape + data references). */
function validateChartSpecs(workbook: Workbook): string[] {
  const problems: string[] = [];
  const ids = new Set(workbook.cells.map((c) => c.id));
  for (const cell of workbook.cells) {
    if (cell.type !== 'visualization') continue;
    let spec: unknown;
    try {
      spec = parseYamlHardened(cell.content);
    } catch (error) {
      problems.push(`Cell "${cell.id}": invalid chart spec (${errMessage(error)})`);
      continue;
    }
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
      problems.push(`Cell "${cell.id}": chart spec must be a mapping with type/x/y`);
      continue;
    }
    const s = spec as Record<string, unknown>;
    if (s.type !== undefined && !['line', 'scatter', 'bar'].includes(String(s.type))) {
      problems.push(`Cell "${cell.id}": chart type must be line|scatter|bar`);
    }
    for (const axis of ['x', 'y'] as const) {
      const a = s[axis];
      if (!a || typeof a !== 'object') {
        problems.push(`Cell "${cell.id}": chart "${axis}" must be a mapping with a "data" field`);
        continue;
      }
      const data = (a as Record<string, unknown>).data;
      if (data === undefined) {
        problems.push(`Cell "${cell.id}": chart ${axis}.data is required`);
      } else if (typeof data === 'string' && !ids.has(data)) {
        problems.push(`Cell "${cell.id}": chart ${axis}.data references unknown cell "${data}"`);
      }
    }
  }
  return problems;
}

function computeProblems(parsed: ParseResult): string[] {
  const problems: string[] = [...(parsed.errors ?? [])];
  if (parsed.success && parsed.workbook) {
    const graph = buildDependencyGraph(parsed.workbook.cells);
    for (const cycle of detectCycles(graph)) {
      problems.push(`Dependency cycle: ${cycle.join(' -> ')}`);
    }
    problems.push(...validateChartSpecs(parsed.workbook));
  }
  return problems;
}

export function validateCommand(args: string[]): CommandResult {
  const json = args.includes('--json');
  const file = firstPositional(args);
  if (!file) {
    return json
      ? {
          stdout: jsonEnvelope('validate', false, null, ['Usage: mtsw validate <file>']),
          stderr: '',
          exitCode: 1,
        }
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
    return {
      stdout: jsonEnvelope('validate', ok, { cellCount }, problems),
      stderr: '',
      exitCode: ok ? 0 : 1,
    };
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
      ? {
          stdout: jsonEnvelope('describe', false, null, ['Usage: mtsw describe <file>']),
          stderr: '',
          exitCode: 1,
        }
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
  const data = describeData(parsed.workbook);
  const cells = data.cells;

  if (json) {
    return {
      stdout: jsonEnvelope('describe', ok, data, problems),
      stderr: '',
      exitCode: ok ? 0 : 1,
    };
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
  const data = capabilitiesInfo();
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
  const templates = Object.entries(TEMPLATES).map(([name, t]) => ({
    name,
    description: t.description,
  }));
  if (args.includes('--json')) {
    return { stdout: jsonEnvelope('templates', true, { templates }, []), stderr: '', exitCode: 0 };
  }
  return {
    stdout: templates.map((t) => `${t.name} - ${t.description}`).join('\n'),
    stderr: '',
    exitCode: 0,
  };
}

export function functionsCommand(args: string[]): CommandResult {
  const data = listFunctions();
  if (args.includes('--json')) {
    return { stdout: jsonEnvelope('functions', true, data, []), stderr: '', exitCode: 0 };
  }
  const lines = [
    `functions (${data.functions.length}): ${data.functions.join(', ')}`,
    `constants (${data.constants.length}): ${data.constants.join(', ')}`,
  ];
  return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
}

export function metaCommand(args: string[]): CommandResult {
  const json = args.includes('--json');
  const fail = (problems: string[]): CommandResult =>
    json
      ? { stdout: jsonEnvelope('meta', false, null, problems), stderr: '', exitCode: 1 }
      : { stdout: '', stderr: problems.join('\n'), exitCode: 1 };

  const verb = args[0];
  if (verb !== 'get' && verb !== 'set') return fail(['Usage: mtsw meta <get|set> <file> ...']);
  const vargs = args.slice(1);
  const file = positionals(vargs)[0];
  if (!file) return fail([`Usage: mtsw meta ${verb} <file> ...`]);

  const read = readFile(file);
  if (read.error) return fail([read.error]);
  const parsed = parseWorkbook(read.content!);
  if (!parsed.success) return fail(parsed.errors ?? ['Parse error']);
  const wb = parsed.workbook!;

  if (verb === 'get') {
    if (json)
      return { stdout: jsonEnvelope('meta', true, wb.metadata, []), stderr: '', exitCode: 0 };
    const lines = Object.entries(wb.metadata).map(
      ([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`
    );
    return { stdout: lines.join('\n') || '(no metadata)', stderr: '', exitCode: 0 };
  }

  const changes: { title?: string; author?: string; description?: string; tags?: string[] } = {};
  const title = flagValue(vargs, '--title');
  if (title !== undefined) changes.title = title;
  const author = flagValue(vargs, '--author');
  if (author !== undefined) changes.author = author;
  const description = flagValue(vargs, '--description');
  if (description !== undefined) changes.description = description;
  const tags = flagValue(vargs, '--tags');
  if (tags !== undefined)
    changes.tags = tags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  if (Object.keys(changes).length === 0) {
    return fail(['meta set requires at least one of --title/--author/--description/--tags']);
  }

  let next: Workbook;
  try {
    next = setMetadata(wb, changes);
  } catch (error) {
    return fail([errMessage(error)]);
  }
  try {
    writeFileAtomic(file, serializeWorkbook(next));
  } catch (error) {
    return fail([`Failed to write '${file}': ${errMessage(error)}`]);
  }
  if (json)
    return { stdout: jsonEnvelope('meta', true, next.metadata, []), stderr: '', exitCode: 0 };
  return { stdout: '', stderr: `Updated metadata in ${file}`, exitCode: 0 };
}

/** Map a workbook (+ optional run results) to the generic render document. */
function buildRenderDoc(
  workbook: Workbook,
  byId: Map<string, CellResult> | null,
  format: 'svg' | 'tikz' = 'svg'
): RenderDoc {
  // Resolve a chart data reference: a cell id -> that cell's output, or an inline array.
  const lookup = (ref: unknown): unknown => {
    if (typeof ref !== 'string') return ref;
    return byId?.get(ref)?.output ?? workbook.cells.find((c) => c.id === ref)?.output;
  };

  const cells = workbook.cells.map((c): RenderCell => {
    const rc: RenderCell = { type: c.type, content: c.content, id: c.id };
    if (c.type === 'markdown' || c.type === 'equation') return rc;
    if (c.type === 'visualization') {
      rc.type = 'chart';
      try {
        const spec = parseYamlHardened(c.content) as {
          type?: 'line' | 'scatter' | 'bar';
          title?: string;
          x?: { label?: string; data?: unknown };
          y?: { label?: string; data?: unknown };
        };
        const rendered = renderChart(
          { type: spec?.type, title: spec?.title, xLabel: spec?.x?.label, yLabel: spec?.y?.label },
          lookup(spec?.x?.data),
          lookup(spec?.y?.data),
          format
        );
        if (format === 'tikz') rc.chartTikz = rendered;
        else rc.chartSvg = rendered;
        // Diagnostic: flag data references that didn't resolve to a value, so an
        // empty chart explains itself instead of silently showing "no data".
        const unresolved: string[] = [];
        for (const ref of [spec?.x?.data, spec?.y?.data]) {
          if (typeof ref !== 'string') continue;
          if (byId) {
            const r = byId.get(ref);
            if (!r || r.status === 'error' || r.status === 'fail') unresolved.push(ref);
          } else if (workbook.cells.find((x) => x.id === ref)?.output === undefined) {
            unresolved.push(ref);
          }
        }
        if (unresolved.length > 0) {
          rc.note = `chart data did not resolve: ${unresolved.join(', ')}${byId ? '' : ' (try without --no-run)'}`;
        }
      } catch (error) {
        const placeholder = renderChart({}, [], [], format); // "no data" placeholder
        if (format === 'tikz') rc.chartTikz = placeholder;
        else rc.chartSvg = placeholder;
        rc.note = `invalid chart spec: ${errMessage(error)}`;
      }
      return rc;
    }

    const r = byId?.get(c.id);
    const status = r?.status;
    const output = r ? r.output : c.output;
    const error = r ? r.error : c.error;

    if (c.type === 'test') {
      if (status === 'error') rc.error = error ?? 'error';
      else if (status !== undefined) rc.passed = status === 'pass';
      else if (typeof output === 'boolean') rc.passed = output;
      // else: never run and no cached result → leave `passed` undefined (neutral badge)
      return rc;
    }
    if (status === 'error' || status === 'fail' || (status === undefined && error !== undefined)) {
      rc.error = error ?? 'error';
    } else if (output !== undefined) {
      rc.output = formatResult(output);
    }
    return rc;
  });

  return {
    title: workbook.metadata.title,
    author: workbook.metadata.author,
    description: workbook.metadata.description,
    tags: workbook.metadata.tags,
    cells,
  };
}

export async function exportCommand(args: string[]): Promise<CommandResult> {
  const json = args.includes('--json');
  const fail = (problems: string[]): CommandResult =>
    json
      ? { stdout: jsonEnvelope('export', false, null, problems), stderr: '', exitCode: 1 }
      : { stdout: '', stderr: problems.join('\n'), exitCode: 1 };

  const format = flagValue(args, '--format') ?? 'html';
  if (
    format !== 'html' &&
    format !== 'tex' &&
    format !== 'json' &&
    format !== 'pdf' &&
    format !== 'ipynb'
  ) {
    return fail([`Unknown format '${format}' (supported: html, tex, json, pdf, ipynb)`]);
  }

  const file = firstPositional(args);
  if (!file)
    return fail([
      'Usage: mtsw export <file> [--format html|tex|json|pdf|ipynb] [--fragment] [-o out] [--no-run]',
    ]);

  const read = readFile(file);
  if (read.error) return fail([read.error]);
  const parsed = parseWorkbook(read.content!);
  if (!parsed.success) return fail(parsed.errors ?? ['Parse error']);
  const workbook = parsed.workbook!;

  let byId: Map<string, CellResult> | null = null;
  let report: RunResult | null = null;
  if (!args.includes('--no-run')) {
    report = await createExecutor(workbook).runReport();
    // A whole-run failure (e.g. a dependency cycle) surfaces as a synthetic
    // '(workbook)' result that maps to no real cell — fail loudly rather than
    // emit a misleading "nothing ran" document with exit 0.
    const fatal = report.cells.find((r) => r.id === '(workbook)');
    if (fatal) return fail([fatal.error ?? 'workbook run failed']);
    byId = new Map(report.cells.map((r) => [r.id, r]));
  }

  if (format === 'json') {
    // Unlike html/tex (which can render a static, never-run document), the
    // json export IS the run report — there's nothing meaningful to emit
    // with --no-run.
    if (!report) {
      return fail(['--format json requires running the notebook (remove --no-run)']);
    }
    const payload = {
      ok: report.ok,
      cells: report.cells.map((c) => ({
        id: c.id,
        type: c.type,
        status: c.status,
        output: c.output === undefined ? undefined : formatResult(c.output),
        error: c.error,
      })),
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    const outPath = flagValue(args, '-o') ?? flagValue(args, '--output');
    if (outPath) {
      try {
        writeFileAtomic(outPath, jsonStr);
      } catch (error) {
        return fail([`Failed to write '${outPath}': ${errMessage(error)}`]);
      }
      if (json)
        return {
          stdout: jsonEnvelope(
            'export',
            true,
            { path: outPath, bytes: Buffer.byteLength(jsonStr) },
            []
          ),
          stderr: '',
          exitCode: 0,
        };
      return {
        stdout: '',
        stderr: `Exported ${file} -> ${outPath} (${Buffer.byteLength(jsonStr)} bytes)`,
        exitCode: 0,
      };
    }
    return { stdout: jsonStr, stderr: '', exitCode: 0 };
  }

  if (format === 'pdf') {
    const outPath = flagValue(args, '-o') ?? flagValue(args, '--output');
    if (!outPath) return fail(['--format pdf requires an output path: -o <file.pdf>']);
    try {
      await toPDF(buildRenderDoc(workbook, byId, 'tikz'), outPath, { parse });
    } catch (error) {
      return fail([`PDF export failed: ${errMessage(error)}`]);
    }
    return json
      ? { stdout: jsonEnvelope('export', true, { path: outPath }, []), stderr: '', exitCode: 0 }
      : { stdout: '', stderr: `Exported ${file} -> ${outPath}`, exitCode: 0 };
  }

  const fragment = args.includes('--fragment');
  const rendered =
    format === 'tex'
      ? toTeX(buildRenderDoc(workbook, byId, 'tikz'), { parse, fragment })
      : format === 'ipynb'
        ? toIpynb(buildRenderDoc(workbook, byId))
        : toHTML(buildRenderDoc(workbook, byId), { parse });
  const bytes = Buffer.byteLength(rendered, 'utf-8');
  const outPath = flagValue(args, '-o') ?? flagValue(args, '--output');

  if (outPath) {
    try {
      writeFileAtomic(outPath, rendered);
    } catch (error) {
      return fail([`Failed to write '${outPath}': ${errMessage(error)}`]);
    }
    if (json)
      return {
        stdout: jsonEnvelope('export', true, { path: outPath, bytes }, []),
        stderr: '',
        exitCode: 0,
      };
    return { stdout: '', stderr: `Exported ${file} -> ${outPath} (${bytes} bytes)`, exitCode: 0 };
  }
  if (json) return { stdout: jsonEnvelope('export', true, { bytes }, []), stderr: '', exitCode: 0 };
  return { stdout: rendered, stderr: '', exitCode: 0 };
}

/**
 * Run the JSON-RPC-over-stdio server loop until `shutdown`, stdin EOF, or a
 * termination signal. NDJSON via readline (chunked-input / CRLF safe). Events
 * for a run are flushed before that run's response (not mid-run in v1).
 */
export function runServer(
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout
): Promise<void> {
  const session = new Session();
  const rl = createInterface({ input, crlfDelay: Infinity });
  const write = (obj: unknown): void => {
    output.write(`${JSON.stringify(obj)}\n`);
  };

  return new Promise<void>((resolve) => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      process.removeListener('SIGINT', finish);
      process.removeListener('SIGTERM', finish);
      rl.close();
      resolve();
    };

    const processLine = async (line: string): Promise<void> => {
      if (done) return;
      const text = line.trim();
      if (!text) return;
      let request: unknown;
      try {
        request = JSON.parse(text);
      } catch {
        write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
        return;
      }
      if (Array.isArray(request)) {
        write({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32600, message: 'Batch requests are not supported' },
        });
        return;
      }
      try {
        const { response, events, shutdown } = await handleRequest(
          session,
          request as JsonRpcRequest
        );
        for (const event of events) write(event);
        write(response);
        if (shutdown) finish();
      } catch (error) {
        // Defense-in-depth: a handler should never throw, but never crash the loop.
        write({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32603, message: error instanceof Error ? error.message : String(error) },
        });
      }
    };

    // Serialize: requests are processed strictly in arrival order (readline can
    // emit lines faster than an async handler completes, so a chain prevents
    // a later request from racing ahead of an earlier one).
    let queue: Promise<void> = Promise.resolve();
    rl.on('line', (line) => {
      queue = queue.then(() => processLine(line));
    });

    // On stdin EOF, wait for queued requests to finish processing (and writing)
    // before resolving — otherwise the last responses are lost.
    rl.on('close', () => {
      void queue.then(finish);
    });
    process.once('SIGINT', finish);
    process.once('SIGTERM', finish);
  });
}

export async function serveCommand(): Promise<CommandResult> {
  await runServer();
  return { stdout: '', stderr: '', exitCode: 0 };
}

export function graphCommand(args: string[]): CommandResult {
  // graph is human-only; structured graph data lives in `describe --json`.
  // Answer a mistaken `--json` with a parseable envelope, not surprise text.
  if (args.includes('--json')) {
    return {
      stdout: jsonEnvelope('graph', false, null, [
        'graph has no --json output; use `describe --json` for structured graph data',
      ]),
      stderr: '',
      exitCode: 1,
    };
  }

  const file = firstPositional(args);
  if (!file) {
    return { stdout: '', stderr: 'Usage: mtsw graph <file> [-f mermaid|dot]', exitCode: 1 };
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

  if (flagValue(args, '-f') === 'dot' || flagValue(args, '--format') === 'dot') {
    return { stdout: toDOT(graph), stderr: '', exitCode: 0 };
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

const EMPTY_TEMPLATE = `version: "1.0"
metadata:
  title: "<NAME>"
runtime:
  engine: mathts
  execution: reactive
cells: []
`;

const CHART_TEMPLATE = `version: "1.0"
metadata:
  title: "<NAME>"
runtime:
  engine: mathts
  execution: reactive
cells:
  - data: "[1, 2, 3, 4]"
    id: xs

  - data: "[1, 4, 9, 16]"
    id: ys

  - visualization: |
      type: line
      title: "Sample chart"
      x: { label: "x", data: xs }
      y: { label: "y", data: ys }
    id: chart
    depends_on: [xs, ys]
`;

const TEMPLATES: Record<string, { content: string; description: string }> = {
  basic: {
    content: BASIC_TEMPLATE,
    description: 'Markdown intro + a code cell + a passing test cell',
  },
  empty: { content: EMPTY_TEMPLATE, description: 'A blank workbook (no cells)' },
  chart: {
    content: CHART_TEMPLATE,
    description: 'A line chart over two data cells (visualization example)',
  },
};

/** Windows reserved device names (case-insensitive), which cannot be filenames. */
const RESERVED_DEVICE_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  ...Array.from({ length: 9 }, (_unused, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_unused, i) => `LPT${i + 1}`),
]);

export function newCommand(args: string[]): CommandResult {
  const outPath = flagValue(args, '-o') ?? flagValue(args, '--output');
  const name = firstPositional(args);
  const templateName = args.includes('--empty')
    ? 'empty'
    : (flagValue(args, '-t') ?? flagValue(args, '--template') ?? 'basic');
  const template = TEMPLATES[templateName];
  if (!template) {
    return {
      stdout: '',
      stderr: `Unknown template '${templateName}'. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      exitCode: 1,
    };
  }

  let target: string;
  let bare: string;
  if (outPath) {
    // Explicit path (like `export -o`): the caller opts into any location.
    target = outPath.endsWith('.mtsw') ? outPath : `${outPath}.mtsw`;
    bare = basename(target).slice(0, -'.mtsw'.length);
  } else {
    if (!name) {
      return {
        stdout: '',
        stderr: 'Usage: mtsw new <name> [-t basic|empty|chart] [--empty] [-o <path>] [--force]',
        exitCode: 1,
      };
    }
    // Bare-name path-traversal guard (no separators/colons/control chars,
    // not absolute). Colons matter on Windows where `C:foo` is drive-relative.
    if (!/^[A-Za-z0-9._-]+$/.test(name)) {
      return {
        stdout: '',
        stderr: `Invalid name '${name}': must be a bare filename — or use -o <path> for an explicit location`,
        exitCode: 1,
      };
    }
    bare = name.endsWith('.mtsw') ? name.slice(0, -'.mtsw'.length) : name;
    if (
      bare === '' ||
      bare === '.' ||
      bare === '..' ||
      RESERVED_DEVICE_NAMES.has(bare.toUpperCase())
    ) {
      return { stdout: '', stderr: `Invalid name '${name}'`, exitCode: 1 };
    }
    target = `${bare}.mtsw`;
  }

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
      return {
        stdout: '',
        stderr: `File '${target}' already exists (use --force to overwrite)`,
        exitCode: 1,
      };
    }
    return {
      stdout: '',
      stderr: `Failed to create '${target}': ${errMessage(error)}`,
      exitCode: 1,
    };
  }

  return { stdout: `Created ${target}`, stderr: '', exitCode: 0 };
}

export function importCommand(args: string[]): CommandResult {
  const json = args.includes('--json');
  const fail = (problems: string[]): CommandResult =>
    json
      ? { stdout: jsonEnvelope('import', false, null, problems), stderr: '', exitCode: 1 }
      : { stdout: '', stderr: problems.join('\n'), exitCode: 1 };

  const file = firstPositional(args);
  let input: string;
  if (!file || file === '-') {
    if (process.stdin.isTTY) return fail(['Provide an input file, or pipe JSON/YAML to stdin']);
    try {
      input = readFileSync(0, 'utf-8');
    } catch (error) {
      return fail([`Failed to read stdin: ${errMessage(error)}`]);
    }
  } else {
    const read = readFile(file);
    if (read.error) return fail([read.error]);
    input = read.content!;
  }

  const result = importWorkbook(input);
  if (!result.success || !result.workbook) return fail(result.errors ?? ['Import failed']);
  const content = serializeWorkbook(result.workbook);
  const count = result.workbook.cells.length;

  const outPath = flagValue(args, '-o') ?? flagValue(args, '--output');
  if (outPath) {
    try {
      writeFileAtomic(outPath, content);
    } catch (error) {
      return fail([`Failed to write '${outPath}': ${errMessage(error)}`]);
    }
    if (json)
      return {
        stdout: jsonEnvelope('import', true, { path: outPath, cells: count }, []),
        stderr: '',
        exitCode: 0,
      };
    return { stdout: '', stderr: `Imported ${count} cell(s) -> ${outPath}`, exitCode: 0 };
  }
  if (json)
    return {
      stdout: jsonEnvelope('import', true, { content, cells: count }, []),
      stderr: '',
      exitCode: 0,
    };
  return { stdout: content, stderr: '', exitCode: 0 };
}

/** All non-flag positional args, skipping value-flag values. */
function positionals(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (VALUE_FLAGS.has(a)) {
      i++;
      continue;
    }
    if (!a.startsWith('-')) out.push(a);
  }
  return out;
}

/** Parse `--depends-on a,b` into a trimmed, de-duplicated, non-empty list. */
function parseDependsOn(args: string[]): string[] | undefined {
  const value = flagValue(args, '--depends-on');
  if (value === undefined) return undefined;
  return [
    ...new Set(
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];
}

function parsePosition(args: string[]): CellPosition | undefined {
  const before = flagValue(args, '--before');
  if (before !== undefined) return { before };
  const after = flagValue(args, '--after');
  if (after !== undefined) return { after };
  const at = flagValue(args, '--at');
  if (at !== undefined) {
    const n = Number(at);
    if (!Number.isInteger(n)) throw new Error(`--at must be an integer (got '${at}')`);
    return { at: n };
  }
  return undefined;
}

/** Resolve cell content from --content (inline) or --content-file (path | - for stdin). */
function resolveContent(args: string[]): { content?: string; error?: string } {
  const inline = flagValue(args, '--content');
  const fromFile = flagValue(args, '--content-file');
  if (inline !== undefined && fromFile !== undefined) {
    return { error: 'Use only one of --content / --content-file' };
  }
  if (inline !== undefined) return { content: inline };
  if (fromFile !== undefined) {
    if (fromFile === '-') {
      if (process.stdin.isTTY) {
        return {
          error: 'No piped input for --content-file - (pipe content via stdin, or use --content)',
        };
      }
      try {
        return { content: readFileSync(0, 'utf-8') };
      } catch (error) {
        return { error: `Cannot read stdin: ${errMessage(error)}` };
      }
    }
    const r = readFile(fromFile);
    return r.error ? { error: r.error } : { content: r.content };
  }
  return {};
}

const CELL_VERBS = ['add', 'edit', 'rm', 'move', 'rename'];

export function cellCommand(args: string[]): CommandResult {
  const json = args.includes('--json');
  const fail = (problems: string[]): CommandResult =>
    json
      ? { stdout: jsonEnvelope('cell', false, null, problems), stderr: '', exitCode: 1 }
      : { stdout: '', stderr: problems.join('\n'), exitCode: 1 };

  const verb = args[0];
  if (!verb || !CELL_VERBS.includes(verb)) {
    return fail([`Usage: mtsw cell <${CELL_VERBS.join('|')}> <file> ...`]);
  }
  const vargs = args.slice(1);
  const pos = positionals(vargs);
  const file = pos[0];
  if (!file) return fail([`Usage: mtsw cell ${verb} <file> ...`]);

  const read = readFile(file);
  if (read.error) return fail([read.error]);
  const parsed = parseWorkbook(read.content!);
  if (!parsed.success) return fail(parsed.errors ?? ['Parse error']);
  const wb = parsed.workbook!;

  let result: Workbook;
  let changedCells: string[] = [];
  try {
    switch (verb) {
      case 'add': {
        const id = flagValue(vargs, '--id');
        const type = flagValue(vargs, '--type') ?? flagValue(vargs, '-t');
        if (!id) return fail(['cell add requires --id']);
        if (!type) return fail(['cell add requires --type']);
        const content = resolveContent(vargs);
        if (content.error) return fail([content.error]);
        result = addCell(
          wb,
          {
            id,
            type: type as CellType,
            content: content.content,
            dependsOn: parseDependsOn(vargs),
          },
          parsePosition(vargs)
        );
        break;
      }
      case 'edit': {
        const id = pos[1];
        if (!id) return fail(['cell edit requires <id>']);
        const content = resolveContent(vargs);
        if (content.error) return fail([content.error]);
        const type = flagValue(vargs, '--type') ?? flagValue(vargs, '-t');
        const deps = parseDependsOn(vargs);
        const changes: { content?: string; type?: CellType; dependsOn?: string[] } = {};
        if (content.content !== undefined) changes.content = content.content;
        if (type !== undefined) changes.type = type as CellType;
        if (deps !== undefined) changes.dependsOn = deps;
        result = editCell(wb, id, changes);
        break;
      }
      case 'rm': {
        const id = pos[1];
        if (!id) return fail(['cell rm requires <id>']);
        const removed = removeCell(wb, id, { force: vargs.includes('--force') });
        result = removed.workbook;
        changedCells = removed.changedCells;
        break;
      }
      case 'move': {
        const id = pos[1];
        if (!id) return fail(['cell move requires <id>']);
        const position = parsePosition(vargs);
        if (!position) return fail(['cell move requires --before/--after/--at']);
        result = moveCell(wb, id, position);
        break;
      }
      case 'rename': {
        const oldId = pos[1];
        const newId = pos[2];
        if (!oldId || !newId) return fail(['cell rename requires <oldId> <newId>']);
        result = renameCell(wb, oldId, newId);
        break;
      }
      default:
        return fail([`Unknown cell verb: ${verb}`]);
    }
  } catch (error) {
    return fail([errMessage(error)]);
  }

  const after = serializeWorkbook(result);
  const changed = after !== serializeWorkbook(wb);

  if (vargs.includes('--dry-run')) {
    if (json) {
      const data = {
        dryRun: true,
        changed,
        content: after,
        ...(changedCells.length ? { changedCells } : {}),
      };
      return { stdout: jsonEnvelope('cell', true, data, []), stderr: '', exitCode: 0 };
    }
    return { stdout: after, stderr: '', exitCode: 0 };
  }

  if (changed) {
    try {
      writeFileAtomic(file, after);
    } catch (error) {
      return fail([`Failed to write '${file}': ${errMessage(error)}`]);
    }
  }

  if (json) {
    const data = {
      changed,
      ...(changedCells.length ? { changedCells } : {}),
      ...describeData(result),
    };
    return { stdout: jsonEnvelope('cell', true, data, []), stderr: '', exitCode: 0 };
  }
  const note = changed ? `Updated ${file}` : `No change (${file})`;
  const detached = changedCells.length ? `\nDetached from: ${changedCells.join(', ')}` : '';
  return { stdout: '', stderr: note + detached, exitCode: 0 };
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
      case 'cell':
        return cellCommand(rest);
      case 'functions':
        return functionsCommand(rest);
      case 'meta':
        return metaCommand(rest);
      case 'import':
        return importCommand(rest);
      case 'export':
        return exportCommand(rest);
      case 'serve':
        return serveCommand();
      default:
        return { stdout: '', stderr: `Unknown command: ${command}\n${HELP}`, exitCode: 1 };
    }
  } catch (error) {
    // Defense-in-depth: handlers shouldn't throw, but if one does, still honor
    // the envelope contract when --json was requested.
    const message = error instanceof Error ? error.message : String(error);
    if (rest.includes('--json')) {
      return {
        stdout: jsonEnvelope(command, false, null, [`Internal error: ${message}`]),
        stderr: '',
        exitCode: 1,
      };
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
