/**
 * In-memory editing/execution session for a single workbook — the stateful
 * core behind `mtsw serve`. Holds the workbook, a per-cell result cache, and a
 * stale set so a `run` only re-executes what an edit invalidated.
 *
 * File I/O is limited to `open`/`save`; everything else is in-memory. Edits are
 * not persisted until `save`.
 */

import { readFileSync } from 'node:fs';
import type { Workbook, Cell, CellResult, RunResult, CellType } from './types';
import { parseWorkbook, serializeWorkbook } from './parser';
import { WorkbookExecutor } from './executor';
import { buildDependencyGraph, getAncestors, getDependents } from './graph';
import { writeFileAtomic } from './fs-atomic';
import * as edit from './edit';

/** Canonical, output-independent form of a cell (for stale-diffing). Metadata
 * keys are sorted so a cosmetic key-order change doesn't spuriously invalidate. */
function canonicalCell(cell: Cell): string {
  const meta = cell.metadata ?? {};
  const sortedMeta: Record<string, unknown> = {};
  for (const key of Object.keys(meta).sort()) sortedMeta[key] = meta[key];
  return JSON.stringify([cell.type, cell.content, cell.dependsOn ?? [], sortedMeta]);
}

export class Session {
  workbook: Workbook | null = null;
  path: string | null = null;
  dirty = false;
  private cache = new Map<string, CellResult>();
  private stale = new Set<string>();

  private require(): Workbook {
    if (!this.workbook) throw new Error('No workbook open');
    return this.workbook;
  }

  /** A cell has a usable, up-to-date result (the basis for "not stale"). */
  private hasValidResult(id: string): boolean {
    const r = this.cache.get(id);
    return r !== undefined && (r.status === 'success' || r.status === 'pass');
  }

  /** Load a workbook file into the session. Refuses to discard unsaved edits. */
  open(path: string, options?: { force?: boolean }): void {
    if (this.dirty && !options?.force) {
      throw new Error('Workbook has unsaved changes (open with force to discard)');
    }
    const content = readFileSync(path, 'utf-8');
    const parsed = parseWorkbook(content);
    if (!parsed.success) {
      throw new Error(`Parse errors: ${(parsed.errors ?? []).join('; ')}`);
    }
    this.workbook = parsed.workbook!;
    this.path = path;
    this.cache.clear();
    this.stale = new Set(this.workbook.cells.map((c) => c.id));
    this.dirty = false;
  }

  /** Replace the workbook and recompute the stale set by diffing old vs new. */
  private commit(next: Workbook): void {
    const old = this.require();
    const oldCanonical = new Map(old.cells.map((c) => [c.id, canonicalCell(c)]));

    // A cell is directly changed if it is new or its canonical form differs.
    const changed = new Set<string>();
    for (const cell of next.cells) {
      const prev = oldCanonical.get(cell.id);
      if (prev === undefined || prev !== canonicalCell(cell)) changed.add(cell.id);
    }

    // Affected = changed cells plus everything that transitively depends on them.
    const graph = buildDependencyGraph(next.cells);
    const affected = new Set(changed);
    for (const id of changed) {
      for (const dep of getDependents(graph, id)) affected.add(dep);
    }

    // Prune the cache to surviving ids, then drop the affected ones.
    const survivingIds = new Set(next.cells.map((c) => c.id));
    for (const id of [...this.cache.keys()]) {
      if (!survivingIds.has(id) || affected.has(id)) this.cache.delete(id);
    }
    // Stale = any cell without a VALID cached result (an errored cell is cached
    // for reporting but is NOT valid, so it stays stale and gets retried).
    this.stale = new Set(next.cells.map((c) => c.id).filter((id) => !this.hasValidResult(id)));

    this.workbook = next;
    this.dirty = true;
  }

  // --- Edits (each is atomic: the pure op throws before any state change) ---
  addCell(spec: { id: string; type: CellType; content?: string; dependsOn?: string[] }, position?: edit.CellPosition): void {
    this.commit(edit.addCell(this.require(), spec, position));
  }
  editCell(id: string, changes: { content?: string; type?: CellType; dependsOn?: string[] }): void {
    this.commit(edit.editCell(this.require(), id, changes));
  }
  removeCell(id: string, options?: { force?: boolean }): string[] {
    const result = edit.removeCell(this.require(), id, options);
    this.commit(result.workbook);
    return result.changedCells;
  }
  moveCell(id: string, position: edit.CellPosition): void {
    this.commit(edit.moveCell(this.require(), id, position));
  }
  renameCell(oldId: string, newId: string): void {
    this.commit(edit.renameCell(this.require(), oldId, newId));
  }
  setMetadata(changes: { title?: string; author?: string; description?: string; tags?: string[] }): void {
    this.commit(edit.setMetadata(this.require(), changes));
  }

  /**
   * Incremental run: execute only stale cells in the target set (`only` + its
   * ancestors, or the whole workbook), reusing cached outputs for the rest.
   * Returns the merged report over the target plus the streamed events.
   */
  async run(only?: string): Promise<{ result: RunResult; events: WorkbookEventLite[] }> {
    const wb = this.require();
    const graph = buildDependencyGraph(wb.cells);
    const target = only ? new Set(getAncestors(graph, only)) : new Set(wb.cells.map((c) => c.id));
    const toRun = new Set([...this.stale].filter((id) => target.has(id)));

    const executor = new WorkbookExecutor(wb);
    const seed = new Map<string, unknown>();
    for (const [id, res] of this.cache) {
      // Seed every valid cell (including a legitimately-`undefined` output —
      // the executor's buildScope uses `has()`, matching full-run semantics).
      if (res.status === 'success' || res.status === 'pass') {
        seed.set(id, res.output);
      }
    }
    executor.seedOutputs(seed);

    const events: WorkbookEventLite[] = [];
    executor.on((e) => events.push({ type: e.type, cellId: e.cellId, error: e.error }));

    const report = await executor.runReport({ only, runIds: toRun });

    // Cycle (or other up-front refusal): pass through without caching.
    if (!report.ok && report.cells.some((c) => c.id === '(workbook)')) {
      return { result: report, events };
    }

    for (const cr of report.cells) {
      this.cache.set(cr.id, cr); // cache for reporting...
      // ...but only a successful result clears the stale flag. An error/fail
      // cell stays stale so it is retried next run and never seeded as scope.
      if (cr.status === 'success' || cr.status === 'pass') this.stale.delete(cr.id);
    }

    const ordered = graph.executionOrder.filter((id) => target.has(id));
    const cells: CellResult[] = ordered
      .map((id) => this.cache.get(id))
      .filter((c): c is CellResult => c !== undefined);
    const ok = cells.every((c) => c.status === 'success' || c.status === 'pass');
    return { result: { cells, ok }, events };
  }

  /** The set of cells awaiting (re-)execution. */
  staleIds(): string[] {
    return [...this.stale];
  }

  /** Serialize the current workbook and write it atomically. */
  save(path?: string): string {
    const wb = this.require();
    const target = path ?? this.path;
    if (!target) throw new Error('No path to save to');
    writeFileAtomic(target, serializeWorkbook(wb));
    this.path = target;
    this.dirty = false;
    return target;
  }
}

/** Slimmed event for streaming (avoids leaking timestamps / handler internals). */
export interface WorkbookEventLite {
  type: string;
  cellId?: string;
  error?: string;
}
