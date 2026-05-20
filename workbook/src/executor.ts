/**
 * Workbook executor
 */

import type { Workbook, Cell, WorkbookEvent, DependencyGraph } from './types';
import { buildDependencyGraph, getDependents } from './graph';
import { evaluate } from '@danielsimonjr/mathts-functions';
import { parse as parseYaml } from 'yaml';

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
   * Execute a code cell by evaluating its content as a MathTS expression.
   *
   * Dependency outputs are injected as named variables in the evaluation
   * scope, so a cell can reference the result of an earlier cell by its id.
   * Evaluation goes through the MathTS expression engine — property and
   * method access route through the expression sandbox, so this does not
   * have the arbitrary-code-execution exposure of the `Function` constructor.
   */
  private async executeCode(cell: Cell): Promise<unknown> {
    // Build the evaluation scope from dependency outputs.
    const scope: Record<string, unknown> = {};
    if (cell.dependsOn) {
      for (const depId of cell.dependsOn) {
        const output = this.outputs.get(depId);
        if (output !== undefined) {
          scope[depId] = output;
        }
      }
    }

    return evaluate(cell.content, scope);
  }

  /**
   * Execute a data cell — parse its content as YAML (a superset of JSON).
   */
  private async executeData(cell: Cell): Promise<unknown> {
    return parseYaml(cell.content);
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
