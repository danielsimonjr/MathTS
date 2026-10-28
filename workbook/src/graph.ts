/**
 * Dependency graph management
 */

import type { Cell, DependencyGraph, DependencyNode } from './types.js';

/**
 * Build dependency graph from cells
 */
export function buildDependencyGraph(cells: Cell[]): DependencyGraph {
  const nodes = new Map<string, DependencyNode>();

  // Initialize all nodes
  for (const cell of cells) {
    nodes.set(cell.id, {
      id: cell.id,
      dependencies: cell.dependsOn ?? [],
      dependents: [],
    });
  }

  // Build reverse dependencies (dependents)
  for (const cell of cells) {
    for (const depId of cell.dependsOn ?? []) {
      const depNode = nodes.get(depId);
      if (depNode) {
        depNode.dependents.push(cell.id);
      }
    }
  }

  // Compute execution order
  const executionOrder = topologicalSort(nodes);

  return { nodes, executionOrder };
}

/**
 * Topological sort for execution order
 */
export function topologicalSort(nodes: Map<string, DependencyNode>): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);

    const node = nodes.get(id);
    if (node) {
      for (const depId of node.dependencies) {
        visit(depId);
      }
    }

    result.push(id);
  }

  for (const id of nodes.keys()) {
    visit(id);
  }

  return result;
}

/**
 * Get all cells that depend on a given cell
 */
export function getDependents(graph: DependencyGraph, cellId: string): string[] {
  const result: string[] = [];
  const visited = new Set<string>();

  function collect(id: string) {
    const node = graph.nodes.get(id);
    if (!node) return;

    for (const depId of node.dependents) {
      if (!visited.has(depId)) {
        visited.add(depId);
        result.push(depId);
        collect(depId);
      }
    }
  }

  collect(cellId);
  return result;
}

/**
 * All transitive dependencies of `id` plus `id` itself (its ancestor closure).
 * Used to run a single cell together with everything it needs. Cycle-safe via
 * a visited set; returns `[]` if `id` is not in the graph.
 */
export function getAncestors(graph: DependencyGraph, id: string): string[] {
  const result = new Set<string>();

  function visit(nodeId: string): void {
    if (result.has(nodeId)) return;
    const node = graph.nodes.get(nodeId);
    if (!node) return;
    result.add(nodeId);
    for (const dep of node.dependencies) visit(dep);
  }

  visit(id);
  // Return in topological (dependency-first) order so external callers get a
  // runnable sequence; `executionOrder` is the canonical topo order.
  return graph.executionOrder.filter((nodeId) => result.has(nodeId));
}

/** Line templates for {@link renderDependencyGraph} (Mermaid vs Graphviz DOT). */
interface GraphTextFormat {
  header: string;
  node: (id: string) => string;
  edge: (dep: string, id: string) => string;
  footer?: string;
}

/**
 * Shared dependency-graph text renderer: header, one node line per map key, then
 * one edge line per `(dep → cell)` dependency, optional footer, joined with `\n`.
 */
function renderDependencyGraph(graph: DependencyGraph, format: GraphTextFormat): string {
  const lines: string[] = [format.header];

  for (const id of graph.nodes.keys()) {
    lines.push(format.node(id));
  }

  for (const [id, node] of graph.nodes) {
    for (const dep of node.dependencies) {
      lines.push(format.edge(dep, id));
    }
  }

  if (format.footer !== undefined) {
    lines.push(format.footer);
  }

  return lines.join('\n');
}

/**
 * Render the dependency graph as a Mermaid `graph TD` diagram.
 *
 * Cell ids are validated identifiers (`[A-Za-z_][A-Za-z0-9_]*`), so they are
 * safe to use verbatim as both the node id and its quoted label — Mermaid
 * syntax injection is impossible and no cell content appears in the output.
 */
export function toMermaid(graph: DependencyGraph): string {
  return renderDependencyGraph(graph, {
    header: 'graph TD',
    node: (id) => `  ${id}["${id}"]`,
    edge: (dep, id) => `  ${dep} --> ${id}`,
  });
}

/**
 * Render the dependency graph as Graphviz DOT (the DOT analog of toMermaid).
 * Cell ids are validated identifiers ([A-Za-z_][A-Za-z0-9_]*), safe verbatim as
 * both node id and quoted label; no cell content appears in the output.
 *
 * @example
 * ```ts
 * import { buildDependencyGraph, toDOT } from '@danielsimonjr/mathts-workbook';
 * toDOT(buildDependencyGraph(cells)); // digraph deps { … }
 * ```
 */
export function toDOT(graph: DependencyGraph): string {
  return renderDependencyGraph(graph, {
    header: 'digraph deps {',
    node: (id) => `  ${id} [label="${id}"];`,
    edge: (dep, id) => `  ${dep} -> ${id};`,
    footer: '}',
  });
}

/**
 * Detect circular dependencies
 */
export function detectCycles(graph: DependencyGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(id: string, path: string[]): boolean {
    if (stack.has(id)) {
      // Found a cycle
      const cycleStart = path.indexOf(id);
      cycles.push(path.slice(cycleStart));
      return true;
    }

    if (visited.has(id)) return false;

    visited.add(id);
    stack.add(id);

    const node = graph.nodes.get(id);
    if (node) {
      for (const depId of node.dependencies) {
        dfs(depId, [...path, id]);
      }
    }

    stack.delete(id);
    return false;
  }

  for (const id of graph.nodes.keys()) {
    if (!visited.has(id)) {
      dfs(id, []);
    }
  }

  return cycles;
}
