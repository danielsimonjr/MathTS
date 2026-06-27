#!/usr/bin/env node
/**
 * MathTS Workbook CLI
 *
 * Command handlers are pure functions returning `{ stdout, stderr, exitCode }`
 * (no direct console / process.exit) so they can be unit-tested. The thin
 * `main()` at the bottom wires them to the real streams, and only runs when
 * this file is the process entry point.
 */

import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseWorkbook } from './parser';
import { createExecutor } from './executor';
import { buildDependencyGraph, detectCycles, toMermaid } from './graph';
import { formatResult } from './formatter';
import { VERSION } from './index';
import type { CellResult } from './types';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const HELP = `
mtsw - MathTS Workbook CLI

Usage:
  mtsw run <file> [-v] [--json]   Execute a workbook (-v: events, --json: machine output)
  mtsw validate <file>            Validate workbook structure (ids, deps, cycles)
  mtsw graph <file> [-f mermaid]  Print the dependency graph

Options:
  -h, --help     Show this help
  -V, --version  Show version

Notes:
  Dependency scope is direct-only (non-transitive): a cell sees only the cells
  listed in its own depends_on, not their dependencies. Cell ids must be valid
  identifiers ([A-Za-z_][A-Za-z0-9_]*).
`.trimStart();

/** Flags that consume the following argument as their value. */
const VALUE_FLAGS = new Set(['-f', '--format']);

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

export async function runCommand(args: string[]): Promise<CommandResult> {
  const file = firstPositional(args);
  if (!file) {
    return { stdout: '', stderr: 'Usage: mtsw run <file> [-v] [--json]', exitCode: 1 };
  }

  const read = readFile(file);
  if (read.error) return { stdout: '', stderr: read.error, exitCode: 1 };

  const parsed = parseWorkbook(read.content!);
  if (!parsed.success) {
    return { stdout: '', stderr: `Parse errors:\n${bullets(parsed.errors ?? [])}`, exitCode: 1 };
  }

  const verbose = args.includes('-v') || args.includes('--verbose');
  const json = args.includes('--json');

  const executor = createExecutor(parsed.workbook!);
  const events: string[] = [];
  if (verbose) {
    executor.on((event) => events.push(`[${event.type}] ${event.cellId ?? ''}`.trimEnd()));
  }

  const report = await executor.runReport();
  const stderr = report.ok ? '' : failureSummary(report.cells);

  if (json) {
    const cells = report.cells.map((c) => ({
      id: c.id,
      type: c.type,
      status: c.status,
      ...(c.output !== undefined ? { output: formatResult(c.output) } : {}),
      ...(c.error ? { error: c.error } : {}),
    }));
    const stdout = JSON.stringify({ ok: report.ok, cells }, null, 2);
    return { stdout, stderr, exitCode: report.ok ? 0 : 1 };
  }

  const body = report.cells.map(humanCellLine).join('\n');
  const stdout = verbose && events.length > 0 ? `${events.join('\n')}\n\n${body}` : body;
  return { stdout, stderr, exitCode: report.ok ? 0 : 1 };
}

export function validateCommand(args: string[]): CommandResult {
  const file = firstPositional(args);
  if (!file) {
    return { stdout: '', stderr: 'Usage: mtsw validate <file>', exitCode: 1 };
  }

  const read = readFile(file);
  if (read.error) return { stdout: '', stderr: read.error, exitCode: 1 };

  const parsed = parseWorkbook(read.content!);
  const problems: string[] = [...(parsed.errors ?? [])];

  if (parsed.success) {
    const graph = buildDependencyGraph(parsed.workbook!.cells);
    for (const cycle of detectCycles(graph)) {
      problems.push(`Dependency cycle: ${cycle.join(' -> ')}`);
    }
  }

  if (problems.length === 0) {
    const count = parsed.workbook!.cells.length;
    return { stdout: `OK: '${file}' is valid (${count} cell(s))`, stderr: '', exitCode: 0 };
  }

  return { stdout: '', stderr: `Invalid workbook:\n${bullets(problems)}`, exitCode: 1 };
}

export function graphCommand(args: string[]): CommandResult {
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
  switch (command) {
    case 'run':
      return runCommand(rest);
    case 'validate':
      return validateCommand(rest);
    case 'graph':
      return graphCommand(rest);
    default:
      return { stdout: '', stderr: `Unknown command: ${command}\n${HELP}`, exitCode: 1 };
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
