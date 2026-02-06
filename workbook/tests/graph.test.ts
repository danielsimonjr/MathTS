import { describe, it, expect } from 'vitest';
import {
  buildDependencyGraph,
  topologicalSort,
  getDependents,
  detectCycles,
} from '../src/graph.js';
import type { Cell, DependencyGraph, DependencyNode } from '../src/types.js';

function cell(id: string, dependsOn: string[] = []): Cell {
  return { id, type: 'code', content: '', dependsOn };
}

describe('buildDependencyGraph', () => {
  it('should return empty graph for empty cells', () => {
    const graph = buildDependencyGraph([]);
    expect(graph.nodes.size).toBe(0);
    expect(graph.executionOrder).toEqual([]);
  });

  it('should build graph for single cell', () => {
    const graph = buildDependencyGraph([cell('a')]);
    expect(graph.nodes.size).toBe(1);
    expect(graph.nodes.get('a')!.dependencies).toEqual([]);
    expect(graph.nodes.get('a')!.dependents).toEqual([]);
    expect(graph.executionOrder).toEqual(['a']);
  });

  it('should build linear chain A -> B -> C', () => {
    const cells = [cell('a'), cell('b', ['a']), cell('c', ['b'])];
    const graph = buildDependencyGraph(cells);
    expect(graph.nodes.get('a')!.dependents).toEqual(['b']);
    expect(graph.nodes.get('b')!.dependents).toEqual(['c']);
    const order = graph.executionOrder;
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
  });

  it('should build diamond pattern', () => {
    const cells = [cell('a'), cell('b', ['a']), cell('c', ['a']), cell('d', ['b', 'c'])];
    const graph = buildDependencyGraph(cells);
    expect(graph.nodes.get('a')!.dependents).toContain('b');
    expect(graph.nodes.get('a')!.dependents).toContain('c');
    const order = graph.executionOrder;
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('d'));
  });

  it('should handle missing dependency references', () => {
    const cells = [cell('a'), cell('b', ['z'])];
    const graph = buildDependencyGraph(cells);
    expect(graph.nodes.get('b')!.dependencies).toEqual(['z']);
    expect(graph.nodes.has('z')).toBe(false);
  });

  it('should handle cells without dependsOn', () => {
    const plainCell: Cell = { id: 'x', type: 'code', content: '' };
    const graph = buildDependencyGraph([plainCell]);
    expect(graph.nodes.get('x')!.dependencies).toEqual([]);
  });
});

describe('topologicalSort', () => {
  it('should return empty array for empty map', () => {
    expect(topologicalSort(new Map())).toEqual([]);
  });

  it('should return single element', () => {
    const nodes = new Map<string, DependencyNode>([
      ['a', { id: 'a', dependencies: [], dependents: [] }],
    ]);
    expect(topologicalSort(nodes)).toEqual(['a']);
  });

  it('should return all independent nodes', () => {
    const nodes = new Map<string, DependencyNode>([
      ['a', { id: 'a', dependencies: [], dependents: [] }],
      ['b', { id: 'b', dependencies: [], dependents: [] }],
    ]);
    const result = topologicalSort(nodes);
    expect(result).toHaveLength(2);
    expect(result).toContain('a');
    expect(result).toContain('b');
  });

  it('should order chain correctly', () => {
    const nodes = new Map<string, DependencyNode>([
      ['c', { id: 'c', dependencies: ['b'], dependents: [] }],
      ['b', { id: 'b', dependencies: ['a'], dependents: ['c'] }],
      ['a', { id: 'a', dependencies: [], dependents: ['b'] }],
    ]);
    const result = topologicalSort(nodes);
    expect(result.indexOf('a')).toBeLessThan(result.indexOf('b'));
    expect(result.indexOf('b')).toBeLessThan(result.indexOf('c'));
  });
});

describe('getDependents', () => {
  it('should return empty for cell with no dependents', () => {
    const graph = buildDependencyGraph([cell('a')]);
    expect(getDependents(graph, 'a')).toEqual([]);
  });

  it('should return direct dependents', () => {
    const graph = buildDependencyGraph([cell('a'), cell('b', ['a']), cell('c', ['a'])]);
    const deps = getDependents(graph, 'a');
    expect(deps).toContain('b');
    expect(deps).toContain('c');
  });

  it('should return transitive dependents', () => {
    const graph = buildDependencyGraph([cell('a'), cell('b', ['a']), cell('c', ['b'])]);
    const deps = getDependents(graph, 'a');
    expect(deps).toContain('b');
    expect(deps).toContain('c');
  });

  it('should return empty for non-existent cellId', () => {
    const graph = buildDependencyGraph([cell('a')]);
    expect(getDependents(graph, 'nonexistent')).toEqual([]);
  });
});

describe('detectCycles', () => {
  it('should return empty when no cycles', () => {
    const graph = buildDependencyGraph([cell('a'), cell('b', ['a'])]);
    expect(detectCycles(graph)).toEqual([]);
  });

  it('should detect two-node cycle', () => {
    const nodes = new Map<string, DependencyNode>([
      ['a', { id: 'a', dependencies: ['b'], dependents: ['b'] }],
      ['b', { id: 'b', dependencies: ['a'], dependents: ['a'] }],
    ]);
    const graph: DependencyGraph = { nodes, executionOrder: topologicalSort(nodes) };
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should detect self-loop', () => {
    const nodes = new Map<string, DependencyNode>([
      ['a', { id: 'a', dependencies: ['a'], dependents: ['a'] }],
    ]);
    const graph: DependencyGraph = { nodes, executionOrder: topologicalSort(nodes) };
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should return empty for independent nodes', () => {
    const graph = buildDependencyGraph([cell('a'), cell('b'), cell('c')]);
    expect(detectCycles(graph)).toEqual([]);
  });
});
