/**
 * Workbook executor
 */

import type { Workbook, Cell, WorkbookEvent, DependencyGraph, CellResult, RunResult } from './types';
import { buildDependencyGraph, getDependents, detectCycles, getAncestors } from './graph';
import { evaluate } from '@danielsimonjr/mathts-functions';
import { parseYamlHardened, assertNoPollution } from './yaml-safe';

/**
 * Event handler type
 */
type EventHandler = (event: WorkbookEvent) => void;

/**
 * Workbook executor with reactive execution support
 */
export class WorkbookExecutor {
  private workbook: Workbook;
  private graph: DependencyGraph;
  private outputs: Map<string, unknown> = new Map();
  private handlers: EventHandler[] = [];

  constructor(workbook: Workbook) {
    this.workbook = workbook;
    this.graph = buildDependencyGraph(workbook.cells);
  }

  /**
   * Subscribe to execution events
   */
  on(handler: EventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index >= 0) {
        this.handlers.splice(index, 1);
      }
    };
  }

  /**
   * Emit an event to all handlers
   */
  private emit(event: WorkbookEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }

  /**
   * Run all cells in order
   */
  async runAll(): Promise<void> {
    for (const cellId of this.graph.executionOrder) {
      await this.runCell(cellId);
    }

    this.emit({
      type: 'workbook:complete',
      timestamp: Date.now(),
    });
  }

  /**
   * Run a specific cell
   */
  async runCell(cellId: string): Promise<unknown> {
    const cell = this.workbook.cells.find((c) => c.id === cellId);
    if (!cell) {
      throw new Error(`Cell not found: ${cellId}`);
    }

    this.emit({
      type: 'cell:start',
      cellId,
      timestamp: Date.now(),
    });

    try {
      const output = await this.executeCell(cell);
      this.outputs.set(cellId, output);

      this.emit({
        type: 'cell:success',
        cellId,
        output,
        timestamp: Date.now(),
      });

      // Mark dependents as stale in reactive mode
      if (this.workbook.runtime.execution === 'reactive') {
        const dependents = getDependents(this.graph, cellId);
        for (const depId of dependents) {
          this.emit({
            type: 'cell:stale',
            cellId: depId,
            timestamp: Date.now(),
          });
        }
      }

      return output;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.emit({
        type: 'cell:error',
        cellId,
        error: errorMessage,
        timestamp: Date.now(),
      });

      throw error;
    }
  }

  /**
   * Execute a single cell
   */
  private async executeCell(cell: Cell): Promise<unknown> {
    switch (cell.type) {
      case 'code':
        return this.executeCode(cell);
      case 'test':
        return this.executeTest(cell);
      case 'markdown':
        return cell.content; // Markdown is pass-through
      case 'data':
        return this.executeData(cell);
      default:
        throw new Error(`Unsupported cell type: ${cell.type}`);
    }
  }

  /**
   * Build the evaluation scope from a cell's DIRECT dependency outputs.
   *
   * Dependency outputs are injected as named variables keyed by the
   * dependency's cell id, so a cell can reference an earlier cell's result by
   * that id. Injection is non-transitive: only ids in `cell.dependsOn` are
   * injected (a dependency's own dependencies are not). An output of
   * `undefined` (cell never ran) is skipped, so the reference fails loudly.
   */
  private buildScope(cell: Cell): Record<string, unknown> {
    const scope: Record<string, unknown> = {};
    if (cell.dependsOn) {
      for (const depId of cell.dependsOn) {
        // Use `has` (not `!== undefined`) so a dependency whose result is
        // legitimately `undefined` is still injected rather than silently
        // dropped. A dependency that never ran has no entry and is skipped.
        if (this.outputs.has(depId)) {
          scope[depId] = this.outputs.get(depId);
        }
      }
    }
    return scope;
  }

  /**
   * Execute a code cell by evaluating its content as a MathTS expression.
   *
   * Evaluation goes through the MathTS expression engine — property and
   * method access route through the expression sandbox, so this does not
   * have the arbitrary-code-execution exposure of the `Function` constructor.
   */
  private async executeCode(cell: Cell): Promise<unknown> {
    return evaluate(cell.content, this.buildScope(cell));
  }

  /**
   * Execute a test cell: evaluate its assertion expression in the dependency
   * scope. The result must be a boolean — `runReport` classifies `true` as a
   * pass and `false` as a fail. A non-boolean result is a usage error (a test
   * that doesn't assert), surfaced via throw like any other evaluation error.
   */
  private async executeTest(cell: Cell): Promise<boolean> {
    const result = evaluate(cell.content, this.buildScope(cell));
    if (typeof result !== 'boolean') {
      throw new Error(`test cell must evaluate to a boolean, got ${typeof result}`);
    }
    return result;
  }

  /**
   * Execute a data cell — parse its content as YAML (a superset of JSON) using
   * the same hardened options + prototype-pollution guard as the document
   * parser, so both YAML entry points are consistent.
   */
  private async executeData(cell: Cell): Promise<unknown> {
    const value = parseYamlHardened(cell.content);
    assertNoPollution(value);
    return value;
  }

  /**
   * Run every cell in dependency order and return a structured report.
   *
   * Unlike {@link runAll} (the event-stream API, which throws on the first cell
   * error), `runReport` is the headless/report API: it is **continue-on-error**
   * (one failing cell does not abort the rest) and never throws on a cell
   * failure. A dependency cycle is refused up front. Test cells are classified
   * as `pass`/`fail`/`error`; all other cells as `success`/`error`.
   */
  async runReport(options: { only?: string } = {}): Promise<RunResult> {
    const cells: CellResult[] = [];

    const cycles = detectCycles(this.graph);
    if (cycles.length > 0) {
      const description = cycles.map((cycle) => cycle.join(' -> ')).join('; ');
      cells.push({
        id: '(workbook)',
        type: 'code',
        status: 'error',
        error: `Dependency cycle detected: ${description}`,
      });
      return { cells, ok: false };
    }

    // When `only` is set, restrict execution to that cell's ancestor closure
    // (the cell plus everything it transitively depends on), in topo order.
    let order = this.graph.executionOrder;
    if (options.only !== undefined) {
      const allowed = new Set(getAncestors(this.graph, options.only));
      order = order.filter((id) => allowed.has(id));
    }

    for (const cellId of order) {
      const cell = this.workbook.cells.find((c) => c.id === cellId);
      if (!cell) continue;

      try {
        const output = await this.runCell(cellId);
        if (cell.type === 'test') {
          const passed = output === true;
          cells.push({
            id: cell.id,
            type: cell.type,
            status: passed ? 'pass' : 'fail',
            output,
            error: passed ? undefined : `Assertion failed in cell '${cell.id}'`,
          });
        } else {
          cells.push({ id: cell.id, type: cell.type, status: 'success', output });
        }
      } catch (error) {
        cells.push({
          id: cell.id,
          type: cell.type,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const ok = cells.every((c) => c.status === 'success' || c.status === 'pass');
    return { cells, ok };
  }

  /**
   * Get output from a previous cell
   */
  getOutput(cellId: string): unknown {
    return this.outputs.get(cellId);
  }
}

/**
 * Create an executor for a workbook
 */
export function createExecutor(workbook: Workbook): WorkbookExecutor {
  return new WorkbookExecutor(workbook);
}
