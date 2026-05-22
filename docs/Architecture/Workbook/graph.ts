/**
 * MathTS Scientific Workbook - Dependency Graph
 *
 * Builds and manages the cell dependency graph for reactive execution
 */

import type { Workbook, Cell, DependencyGraph, DependencyNode, CellStatus } from './types';

// ============================================================================
// Graph Builder
// ============================================================================

export function buildDependencyGraph(workbook: Workbook): DependencyGraph {
  const nodes = new Map<string, DependencyNode>();
  const edges = new Map<string, Set<string>>();

  // Create nodes for all cells
  for (const cell of workbook.cells) {
    nodes.set(cell.id, {
      id: cell.id,
      cell,
      status: 'pending',
      dependencies: [],
      dependents: [],
    });
    edges.set(cell.id, new Set());
  }

  // Build edges from explicit depends_on
  for (const cell of workbook.cells) {
    const node = nodes.get(cell.id)!;

    if (cell.depends_on) {
      for (const depId of cell.depends_on) {
        if (nodes.has(depId)) {
          node.dependencies.push(depId);
          edges.get(depId)!.add(cell.id);
          nodes.get(depId)!.dependents.push(cell.id);
        }
      }
    }

    // Auto-detect dependencies from code
    if (cell.type === 'code' || cell.type === 'visualization' || cell.type === 'test') {
      const content = getCellContent(cell);
      const detected = detectDependencies(content, workbook);

      for (const depId of detected) {
        if (depId !== cell.id && nodes.has(depId) && !node.dependencies.includes(depId)) {
          node.dependencies.push(depId);
          edges.get(depId)!.add(cell.id);
          nodes.get(depId)!.dependents.push(cell.id);
        }
      }
    }
  }

  return { nodes, edges };
}

function getCellContent(cell: Cell): string {
  switch (cell.type) {
    case 'code':
      return cell.code;
    case 'visualization':
      return cell.visualization;
    case 'test':
      return cell.test;
    case 'export':
      return cell.export;
    default:
      return '';
  }
}

/**
 * Detect dependencies from import statements and cell references
 *
 * Patterns:
 * - import { x } from '#cell-id'
 * - import x from '#cell-id'
 * - References like '#cell-id' in strings
 */
function detectDependencies(code: string, workbook: Workbook): string[] {
  const deps: string[] = [];
  const cellIds = new Set(workbook.cells.map((c) => c.id));

  // Pattern: import ... from '#cell-id'
  const importPattern = /from\s+['"]#([^'"]+)['"]/g;
  let match;
  while ((match = importPattern.exec(code)) !== null) {
    if (cellIds.has(match[1])) {
      deps.push(match[1]);
    }
  }

  // Pattern: '#cell-id' references
  const refPattern = /['"]#([a-zA-Z0-9_-]+)['"]/g;
  while ((match = refPattern.exec(code)) !== null) {
    if (cellIds.has(match[1]) && !deps.includes(match[1])) {
      deps.push(match[1]);
    }
  }

  return deps;
}

// ============================================================================
// Graph Operations
// ============================================================================

/**
 * Get cells in topological order (respecting dependencies)
 */
export function topologicalSort(graph: DependencyGraph): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  function visit(id: string): boolean {
    if (temp.has(id)) {
      // Cycle detected
      return false;
    }
    if (visited.has(id)) {
      return true;
    }

    temp.add(id);
    const node = graph.nodes.get(id);
    if (node) {
      for (const dep of node.dependencies) {
        if (!visit(dep)) {
          return false;
        }
      }
    }
    temp.delete(id);
    visited.add(id);
    result.push(id);
    return true;
  }

  for (const id of graph.nodes.keys()) {
    if (!visited.has(id)) {
      if (!visit(id)) {
        throw new Error(`Circular dependency detected involving cell "${id}"`);
      }
    }
  }

  return result;
}

/**
 * Get all cells that depend on the given cell (direct and transitive)
 */
export function getDependents(graph: DependencyGraph, cellId: string): string[] {
  const result: string[] = [];
  const visited = new Set<string>();

  function collect(id: string) {
    const deps = graph.edges.get(id);
    if (deps) {
      for (const depId of deps) {
        if (!visited.has(depId)) {
          visited.add(depId);
          result.push(depId);
          collect(depId);
        }
      }
    }
  }

  collect(cellId);
  return result;
}

/**
 * Get all cells that the given cell depends on (direct and transitive)
 */
export function getDependencies(graph: DependencyGraph, cellId: string): string[] {
  const result: string[] = [];
  const visited = new Set<string>();

  function collect(id: string) {
    const node = graph.nodes.get(id);
    if (node) {
      for (const depId of node.dependencies) {
        if (!visited.has(depId)) {
          visited.add(depId);
          result.push(depId);
          collect(depId);
        }
      }
    }
  }

  collect(cellId);
  return result;
}

/**
 * Mark a cell and its dependents as stale
 */
export function markStale(graph: DependencyGraph, cellId: string): string[] {
  const stale = [cellId, ...getDependents(graph, cellId)];

  for (const id of stale) {
    const node = graph.nodes.get(id);
    if (node && node.status === 'success') {
      node.status = 'stale';
    }
  }

  return stale;
}

/**
 * Update cell status
 */
export function updateStatus(graph: DependencyGraph, cellId: string, status: CellStatus) {
  const node = graph.nodes.get(cellId);
  if (node) {
    node.status = status;
    if (status === 'success') {
      node.lastExecuted = Date.now();
    }
  }
}

/**
 * Get cells ready to execute (all dependencies satisfied)
 */
export function getReadyCells(graph: DependencyGraph): string[] {
  const ready: string[] = [];

  for (const [id, node] of graph.nodes) {
    if (node.status === 'pending' || node.status === 'stale') {
      const allDepsReady = node.dependencies.every((depId) => {
        const dep = graph.nodes.get(depId);
        return dep && dep.status === 'success';
      });

      if (allDepsReady) {
        ready.push(id);
      }
    }
  }

  return ready;
}

/**
 * Check for circular dependencies
 */
export function hasCycle(graph: DependencyGraph): { hasCycle: boolean; cycle?: string[] } {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(id: string): boolean {
    if (stack.has(id)) {
      // Found cycle - extract it
      const cycleStart = path.indexOf(id);
      return true;
    }
    if (visited.has(id)) {
      return false;
    }

    visited.add(id);
    stack.add(id);
    path.push(id);

    const deps = graph.edges.get(id);
    if (deps) {
      for (const dep of deps) {
        if (dfs(dep)) {
          return true;
        }
      }
    }

    stack.delete(id);
    path.pop();
    return false;
  }

  for (const id of graph.nodes.keys()) {
    if (dfs(id)) {
      const cycleStart = path.findIndex((p) => stack.has(p));
      return {
        hasCycle: true,
        cycle: path.slice(cycleStart),
      };
    }
  }

  return { hasCycle: false };
}

/**
 * Generate Mermaid diagram of dependency graph
 */
export function toMermaid(graph: DependencyGraph): string {
  const lines: string[] = ['graph TD'];

  for (const [id, node] of graph.nodes) {
    // Node styling based on status
    let style = '';
    switch (node.status) {
      case 'success':
        style = ':::success';
        break;
      case 'error':
        style = ':::error';
        break;
      case 'running':
        style = ':::running';
        break;
      case 'stale':
        style = ':::stale';
        break;
    }

    const label = `${id}[${node.cell.type}: ${id}]${style}`;
    lines.push(`  ${label}`);

    // Edges
    for (const dep of node.dependencies) {
      lines.push(`  ${dep} --> ${id}`);
    }
  }

  // Style definitions
  lines.push('  classDef success fill:#90EE90');
  lines.push('  classDef error fill:#FFB6C1');
  lines.push('  classDef running fill:#87CEEB');
  lines.push('  classDef stale fill:#FFE4B5');

  return lines.join('\n');
}
