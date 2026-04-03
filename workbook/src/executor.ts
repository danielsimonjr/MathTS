/**
 * Workbook executor
 */

import type { Workbook, Cell, WorkbookEvent, DependencyGraph } from './types';
import { buildDependencyGraph, getDependents } from './graph';

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
      case 'markdown':
        return cell.content; // Markdown is pass-through
      case 'data':
        return this.executeData(cell);
      default:
        throw new Error(`Unsupported cell type: ${cell.type}`);
    }
  }

  /**
   * Execute a code cell by evaluating its content with scope from dependency outputs.
   *
   * Uses the Function constructor to evaluate expressions. Cell dependencies
   * are injected as named variables in the evaluation scope, allowing cells
   * to reference outputs of earlier cells by their id.
   */
  private async executeCode(cell: Cell): Promise<unknown> {
    // Build scope from dependency outputs
    const scope: Record<string, unknown> = {};
    if (cell.dependsOn) {
      for (const depId of cell.dependsOn) {
        const output = this.outputs.get(depId);
        if (output !== undefined) {
          scope[depId] = output;
        }
      }
    }

    const scopeKeys = Object.keys(scope);
    const scopeValues = scopeKeys.map((k) => scope[k]);

    try {
      // Evaluate as an expression first (e.g. "2 + 3", "x * 2")
      // eslint-disable-next-line no-new-func
      const fn = new Function(...scopeKeys, `return (${cell.content});`);
      return fn(...scopeValues);
    } catch {
      // If expression evaluation fails, try as statements (e.g. "const x = 1; x + 2")
      // eslint-disable-next-line no-new-func
      const fn = new Function(...scopeKeys, cell.content);
      return fn(...scopeValues);
    }
  }

  /**
   * Execute a data cell
   */
  private async executeData(cell: Cell): Promise<unknown> {
    // TODO: Parse YAML/JSON data
    return cell.content;
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
