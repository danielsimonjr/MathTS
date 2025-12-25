/**
 * MathTS Scientific Workbook - Cell Executor
 * 
 * Executes cells and manages the execution context
 */

import type {
  Workbook,
  Cell,
  CodeCell,
  TensorCell,
  VisualizationCell,
  TestCell,
  DataCell,
  ExportCell,
  CellOutput,
  ErrorOutput,
  ExecutionContext,
  WorkbookEvent,
  WorkbookEventHandler,
} from './types';
import {
  buildDependencyGraph,
  topologicalSort,
  markStale,
  updateStatus,
  getReadyCells,
  getDependencies,
} from './runtime/graph';

// ============================================================================
// Executor
// ============================================================================

export class WorkbookExecutor {
  private context: ExecutionContext;
  private handlers: Set<WorkbookEventHandler> = new Set();

  constructor(workbook: Workbook) {
    const graph = buildDependencyGraph(workbook);
    
    this.context = {
      workbook,
      graph,
      scope: new Map(),
      outputs: new Map(),
      config: workbook.runtime ?? { engine: 'mathts', execution: 'reactive' },
    };
  }

  // --------------------------------------------------------------------------
  // Event Handling
  // --------------------------------------------------------------------------

  on(handler: WorkbookEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(event: WorkbookEvent) {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (e) {
        console.error('Event handler error:', e);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Execution
  // --------------------------------------------------------------------------

  /**
   * Execute all cells in dependency order
   */
  async runAll(): Promise<Map<string, CellOutput>> {
    const order = topologicalSort(this.context.graph);
    
    for (const cellId of order) {
      await this.runCell(cellId);
    }

    this.emit({ type: 'workbook:ready' });
    return this.context.outputs;
  }

  /**
   * Execute a single cell and its stale dependents (reactive mode)
   */
  async runCell(cellId: string): Promise<CellOutput | null> {
    const node = this.context.graph.nodes.get(cellId);
    if (!node) {
      return null;
    }

    const cell = node.cell;

    // Check dependencies are satisfied
    for (const depId of node.dependencies) {
      const dep = this.context.graph.nodes.get(depId);
      if (dep && dep.status !== 'success') {
        // Run dependency first
        await this.runCell(depId);
      }
    }

    // Execute the cell
    this.emit({ type: 'cell:start', cellId });
    updateStatus(this.context.graph, cellId, 'running');

    const startTime = performance.now();
    
    try {
      const output = await this.executeCell(cell);
      const executionTime = performance.now() - startTime;

      output.execution_time_ms = Math.round(executionTime);
      output.executed_at = new Date().toISOString();

      this.context.outputs.set(cellId, output);
      updateStatus(this.context.graph, cellId, 'success');
      this.emit({ type: 'cell:success', cellId, output });

      // Reactive: run dependents if in reactive mode
      if (this.context.config.execution === 'reactive') {
        const stale = markStale(this.context.graph, cellId);
        if (stale.length > 1) {
          this.emit({ type: 'cell:stale', cellIds: stale.slice(1) });
          
          // Auto-run stale cells
          for (const staleId of stale.slice(1)) {
            await this.runCell(staleId);
          }
        }
      }

      return output;

    } catch (e) {
      const error: ErrorOutput = {
        name: e instanceof Error ? e.name : 'Error',
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        cell_id: cellId,
      };

      updateStatus(this.context.graph, cellId, 'error');
      this.emit({ type: 'cell:error', cellId, error });

      return { error };
    }
  }

  /**
   * Execute a specific cell type
   */
  private async executeCell(cell: Cell): Promise<CellOutput> {
    switch (cell.type) {
      case 'markdown':
        // Markdown cells don't execute, just render
        return { result: { type: 'object', value: null } };

      case 'code':
        return this.executeCodeCell(cell);

      case 'tensor':
        return this.executeTensorCell(cell);

      case 'data':
        return this.executeDataCell(cell);

      case 'visualization':
        return this.executeVisualizationCell(cell);

      case 'test':
        return this.executeTestCell(cell);

      case 'export':
        return this.executeExportCell(cell);

      case 'equation':
        // Equation cells render LaTeX, no execution
        return { result: { type: 'object', value: null, latex: cell.equation } };

      default:
        throw new Error(`Unknown cell type: ${(cell as Cell).type}`);
    }
  }

  // --------------------------------------------------------------------------
  // Cell Type Executors
  // --------------------------------------------------------------------------

  private async executeCodeCell(cell: CodeCell): Promise<CellOutput> {
    // Build the execution scope from dependencies
    const scope = this.buildScope(cell.id);

    // Create a sandboxed execution environment
    const code = this.wrapCode(cell.code, scope);
    
    // Capture stdout
    const stdout: string[] = [];
    const mockConsole = {
      log: (...args: unknown[]) => stdout.push(args.map(String).join(' ')),
      warn: (...args: unknown[]) => stdout.push('[warn] ' + args.map(String).join(' ')),
      error: (...args: unknown[]) => stdout.push('[error] ' + args.map(String).join(' ')),
    };

    try {
      // Execute in async context
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction('console', '__scope__', code);
      const result = await fn(mockConsole, scope);

      // Store exports in scope
      if (result && typeof result === 'object') {
        this.context.scope.set(cell.id, result);
      }

      return {
        result: {
          type: this.inferResultType(result),
          value: result,
        },
        stdout: stdout.length > 0 ? stdout.join('\n') : undefined,
      };

    } catch (e) {
      throw e;
    }
  }

  private async executeTensorCell(cell: TensorCell): Promise<CellOutput> {
    // TODO: Integrate with MathTS tensor engine
    // For now, parse and validate the tensor notation
    
    const tensorDef = cell.tensor;
    
    // Simple parser for tensor notation
    // Full implementation would use MathTS symbolic engine
    const result = {
      type: 'tensor' as const,
      value: { raw: tensorDef, notation: cell.notation },
      latex: this.tensorToLatex(tensorDef),
    };

    return { result };
  }

  private async executeDataCell(cell: DataCell): Promise<CellOutput> {
    // Parse the data based on format
    let parsed: unknown;

    switch (cell.format ?? 'yaml') {
      case 'yaml':
        // Using dynamic import for yaml
        const { parse } = await import('yaml');
        parsed = parse(cell.data);
        break;
      case 'json':
        parsed = JSON.parse(cell.data);
        break;
      case 'csv':
        parsed = this.parseCSV(cell.data);
        break;
      case 'toml':
        // Would need toml parser
        throw new Error('TOML parsing not yet implemented');
    }

    // Store in scope
    this.context.scope.set(cell.id, parsed);

    return {
      result: {
        type: 'object',
        value: parsed,
      },
    };
  }

  private async executeVisualizationCell(cell: VisualizationCell): Promise<CellOutput> {
    // TODO: Integrate with Three.js / D3 / Plotly
    // For now, just validate the code
    
    const scope = this.buildScope(cell.id);
    
    return {
      result: {
        type: 'object',
        value: {
          renderer: cell.renderer ?? 'threejs',
          interactive: cell.interactive ?? true,
          code: cell.visualization,
        },
      },
    };
  }

  private async executeTestCell(cell: TestCell): Promise<CellOutput> {
    const scope = this.buildScope(cell.id);
    const assertions: { passed: boolean; message?: string }[] = [];

    // Mock test utilities
    const testUtils = {
      assert: (condition: unknown, message?: string) => {
        if (!condition) {
          assertions.push({ passed: false, message: message ?? 'Assertion failed' });
          throw new Error(message ?? 'Assertion failed');
        }
        assertions.push({ passed: true, message });
      },
      equal: (a: unknown, b: unknown, message?: string) => {
        const passed = a === b;
        assertions.push({ passed, message: message ?? `Expected ${a} === ${b}` });
        if (!passed) throw new Error(message ?? `Expected ${a} === ${b}`);
      },
      almostEqual: (a: number, b: number, epsilon = 1e-10) => {
        const passed = Math.abs(a - b) < epsilon;
        assertions.push({ passed, message: `${a} ≈ ${b}` });
        if (!passed) throw new Error(`Expected ${a} ≈ ${b} (epsilon=${epsilon})`);
      },
    };

    const code = this.wrapCode(cell.test, { ...scope, assert: testUtils });

    try {
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction('assert', 'almostEqual', '__scope__', code);
      
      const timeoutMs = cell.timeout ?? 5000;
      await Promise.race([
        fn(testUtils.assert, testUtils.almostEqual, scope),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), timeoutMs)
        ),
      ]);

      return {
        result: {
          type: 'object',
          value: {
            passed: true,
            assertions: assertions.length,
          },
        },
      };

    } catch (e) {
      if (cell.critical) {
        throw e;
      }
      return {
        result: {
          type: 'object',
          value: {
            passed: false,
            assertions: assertions.length,
            error: e instanceof Error ? e.message : String(e),
          },
        },
      };
    }
  }

  private async executeExportCell(cell: ExportCell): Promise<CellOutput> {
    // TODO: Implement export functionality
    // Would generate LaTeX, PDF, HTML, etc.

    return {
      result: {
        type: 'object',
        value: {
          exported: false,
          reason: 'Export not yet implemented',
        },
      },
    };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private buildScope(cellId: string): Record<string, unknown> {
    const scope: Record<string, unknown> = {};
    const deps = getDependencies(this.context.graph, cellId);

    for (const depId of deps) {
      const exports = this.context.scope.get(depId);
      if (exports && typeof exports === 'object') {
        Object.assign(scope, exports);
      }
    }

    // Also check direct dependencies
    const node = this.context.graph.nodes.get(cellId);
    if (node) {
      for (const depId of node.dependencies) {
        const exports = this.context.scope.get(depId);
        if (exports && typeof exports === 'object') {
          Object.assign(scope, exports);
        }
      }
    }

    return scope;
  }

  private wrapCode(code: string, scope: Record<string, unknown>): string {
    // Inject scope variables
    const scopeVars = Object.keys(scope)
      .map(k => `const ${k} = __scope__["${k}"];`)
      .join('\n');

    // Handle exports
    const hasExport = /\bexport\s+/.test(code);
    
    if (hasExport) {
      // Transform exports to return statement
      const transformed = code
        .replace(/export\s+\{([^}]+)\};?/g, 'return { $1 };')
        .replace(/export\s+(const|let|var)\s+/g, '$1 ');
      
      return `${scopeVars}\n${transformed}`;
    }

    return `${scopeVars}\n${code}`;
  }

  private inferResultType(value: unknown): 'tensor' | 'matrix' | 'scalar' | 'symbolic' | 'object' {
    if (value === null || value === undefined) return 'object';
    if (typeof value === 'number') return 'scalar';
    if (Array.isArray(value)) {
      if (Array.isArray(value[0])) return 'matrix';
    }
    // Would check for MathTS types
    return 'object';
  }

  private tensorToLatex(notation: string): string {
    // Simple conversion of tensor notation to LaTeX
    // Full implementation would use MathTS symbolic engine
    return notation
      .replace(/(\w+)_\{([^}]+)\}/g, '$1_{$2}')
      .replace(/(\w+)\^(\w)/g, '$1^{$2}')
      .replace(/(\w+)_(\w)/g, '$1_{$2}');
  }

  private parseCSV(csv: string): unknown[][] {
    return csv.trim().split('\n').map(line => 
      line.split(',').map(cell => {
        const trimmed = cell.trim();
        const num = Number(trimmed);
        return isNaN(num) ? trimmed : num;
      })
    );
  }

  // --------------------------------------------------------------------------
  // Context Access
  // --------------------------------------------------------------------------

  getOutput(cellId: string): CellOutput | undefined {
    return this.context.outputs.get(cellId);
  }

  getScope(): Map<string, unknown> {
    return new Map(this.context.scope);
  }

  getGraph() {
    return this.context.graph;
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createExecutor(workbook: Workbook): WorkbookExecutor {
  return new WorkbookExecutor(workbook);
}
