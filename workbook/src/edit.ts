/**
 * Pure, immutable cell-mutation operations on a Workbook.
 *
 * Every op returns a NEW workbook (the input is never mutated) and enforces the
 * runnable-valid invariants — unique + identifier-safe ids, supported cell
 * types, existing `depends_on` references, no self-dependency, and no dependency
 * cycle. An op that would break an invariant throws; callers must not write the
 * file on a throw.
 */

import type { Workbook, Cell, CellType } from './types';
import { isValidIdentifier, SUPPORTED_CELL_TYPES } from './parser';
import { buildDependencyGraph, detectCycles } from './graph';

export interface CellPosition {
  before?: string;
  after?: string;
  at?: number;
}

export interface RemoveResult {
  workbook: Workbook;
  /** Cells whose `depends_on` was edited to detach the removed cell (force). */
  changedCells: string[];
}

function cloneWorkbook(wb: Workbook): Workbook {
  return {
    ...wb,
    metadata: { ...wb.metadata },
    runtime: { ...wb.runtime },
    cells: wb.cells.map((c) => ({
      ...c,
      ...(c.dependsOn ? { dependsOn: [...c.dependsOn] } : {}),
      ...(c.metadata ? { metadata: { ...c.metadata } } : {}),
    })),
  };
}

function assertSupportedType(type: string): asserts type is CellType {
  if (!(SUPPORTED_CELL_TYPES as string[]).includes(type)) {
    throw new Error(`Unsupported cell type '${type}' (supported: ${SUPPORTED_CELL_TYPES.join(', ')})`);
  }
}

function indexOfCell(wb: Workbook, id: string): number {
  const i = wb.cells.findIndex((c) => c.id === id);
  if (i < 0) throw new Error(`No such cell: '${id}'`);
  return i;
}

/** Validate dependency ids against the (already-mutated) workbook; return them. */
function validateDeps(wb: Workbook, dependsOn: string[], selfId: string): string[] {
  const ids = new Set(wb.cells.map((c) => c.id));
  for (const dep of dependsOn) {
    if (dep === selfId) throw new Error(`Cell '${selfId}' cannot depend on itself`);
    if (!ids.has(dep)) {
      throw new Error(`depends_on references unknown cell '${dep}'`);
    }
  }
  return dependsOn;
}

/**
 * Throw only if `after` has a dependency cycle that `before` did not — so an op
 * is blamed only for cycles it *introduces*. A workbook that was already cyclic
 * stays editable (you can edit toward fixing it).
 */
function assertNoNewCycle(before: Workbook, after: Workbook): void {
  if (detectCycles(buildDependencyGraph(before.cells)).length > 0) return;
  const cycles = detectCycles(buildDependencyGraph(after.cells));
  if (cycles.length > 0) {
    throw new Error(
      `Operation would create a dependency cycle: ${cycles.map((c) => c.join(' -> ')).join('; ')}`
    );
  }
}

/** A mutated cell's cached result is stale — drop it. */
function clearResult(cell: Cell): void {
  delete cell.output;
  delete cell.error;
}

/** Resolve a position to an insertion index within `wb.cells`. */
function resolveInsertIndex(wb: Workbook, position?: CellPosition): number {
  if (!position) return wb.cells.length;
  if (position.at !== undefined) {
    if (!Number.isInteger(position.at) || position.at < 0 || position.at > wb.cells.length) {
      throw new Error(`--at ${position.at} out of range (0..${wb.cells.length})`);
    }
    return position.at;
  }
  if (position.before !== undefined) {
    const i = wb.cells.findIndex((c) => c.id === position.before);
    if (i < 0) throw new Error(`--before: no such cell '${position.before}'`);
    return i;
  }
  if (position.after !== undefined) {
    const i = wb.cells.findIndex((c) => c.id === position.after);
    if (i < 0) throw new Error(`--after: no such cell '${position.after}'`);
    return i + 1;
  }
  return wb.cells.length;
}

export function addCell(
  wb: Workbook,
  spec: { id: string; type: CellType; content?: string; dependsOn?: string[] },
  position?: CellPosition
): Workbook {
  if (!isValidIdentifier(spec.id)) {
    throw new Error(`Invalid cell id '${spec.id}': must be an identifier ([A-Za-z_][A-Za-z0-9_]*)`);
  }
  if (wb.cells.some((c) => c.id === spec.id)) {
    throw new Error(`Duplicate cell id '${spec.id}'`);
  }
  assertSupportedType(spec.type);

  const next = cloneWorkbook(wb);
  const cell: Cell = { id: spec.id, type: spec.type, content: spec.content ?? '' };
  const deps = spec.dependsOn ? validateDeps(next, spec.dependsOn, spec.id) : undefined;
  if (deps && deps.length > 0) cell.dependsOn = deps;

  next.cells.splice(resolveInsertIndex(next, position), 0, cell);
  assertNoNewCycle(wb, next);
  return next;
}

export function editCell(
  wb: Workbook,
  id: string,
  changes: { content?: string; type?: CellType; dependsOn?: string[] }
): Workbook {
  const next = cloneWorkbook(wb);
  const cell = next.cells[indexOfCell(next, id)];

  let touched = false;
  if (changes.type !== undefined) {
    assertSupportedType(changes.type);
    cell.type = changes.type;
    touched = true;
  }
  if (changes.content !== undefined) {
    cell.content = changes.content;
    touched = true;
  }
  if (changes.dependsOn !== undefined) {
    const deps = validateDeps(next, changes.dependsOn, id);
    if (deps.length > 0) cell.dependsOn = deps;
    else delete cell.dependsOn;
    touched = true;
  }

  if (touched) clearResult(cell); // the cell's cached result is now stale
  // Only a dependency change can affect the graph; content/type edits can't.
  if (changes.dependsOn !== undefined) assertNoNewCycle(wb, next);
  return next;
}

export function removeCell(wb: Workbook, id: string, options?: { force?: boolean }): RemoveResult {
  const next = cloneWorkbook(wb);
  indexOfCell(next, id); // throws if missing

  const dependents = next.cells.filter((c) => (c.dependsOn ?? []).includes(id)).map((c) => c.id);
  if (dependents.length > 0 && !options?.force) {
    throw new Error(`Cell '${id}' has dependents: ${dependents.join(', ')} (use --force to remove and detach)`);
  }

  const changedCells: string[] = [];
  for (const c of next.cells) {
    if (c.dependsOn?.includes(id)) {
      c.dependsOn = c.dependsOn.filter((d) => d !== id);
      if (c.dependsOn.length === 0) delete c.dependsOn;
      clearResult(c); // detached from a dependency — its cached result is stale
      changedCells.push(c.id);
    }
  }
  next.cells = next.cells.filter((c) => c.id !== id);
  return { workbook: next, changedCells };
}

export function moveCell(wb: Workbook, id: string, position: CellPosition): Workbook {
  // Moving relative to itself is a no-op.
  if (position.before === id || position.after === id) return cloneWorkbook(wb);

  const next = cloneWorkbook(wb);
  const from = indexOfCell(next, id);
  const [cell] = next.cells.splice(from, 1);
  next.cells.splice(resolveInsertIndex(next, position), 0, cell);
  return next;
}

export function renameCell(wb: Workbook, oldId: string, newId: string): Workbook {
  if (oldId === newId) return cloneWorkbook(wb);

  const next = cloneWorkbook(wb);
  const cell = next.cells[indexOfCell(next, oldId)];
  if (!isValidIdentifier(newId)) {
    throw new Error(`Invalid cell id '${newId}': must be an identifier ([A-Za-z_][A-Za-z0-9_]*)`);
  }
  if (next.cells.some((c) => c.id === newId)) {
    throw new Error(`Duplicate cell id '${newId}'`);
  }

  cell.id = newId;
  // A dependent references its dependency by id as a variable in its content,
  // so renaming must rewrite BOTH the depends_on edge AND those by-id references
  // (whole-identifier matches) — otherwise scope has `newId` but the content
  // still asks for `oldId`. `oldId` is a validated identifier, so it is
  // regex-safe to interpolate. (Best-effort: a `\b` match could also touch the
  // id inside a string literal in a dependent's content.)
  const reference = new RegExp(`\\b${oldId}\\b`, 'g');
  for (const c of next.cells) {
    if (c.dependsOn?.includes(oldId)) {
      c.dependsOn = c.dependsOn.map((d) => (d === oldId ? newId : d));
      c.content = c.content.replace(reference, newId);
    }
  }
  // A rename is a pure relabel: it preserves the graph (no cycle possible) and
  // each cell's computed value is unchanged, so cached outputs stay valid.
  return next;
}
