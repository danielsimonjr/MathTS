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

describe('detectCycles - longer cycles and clean DAGs', () => {
  it('should detect a three-node cycle a -> b -> c -> a', () => {
    const graph = buildDependencyGraph([
      cell('a', ['c']),
      cell('b', ['a']),
      cell('c', ['b']),
    ]);
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
    // The reported cycle should reference the participating nodes.
    const flat = cycles.flat();
    expect(flat).toContain('a');
  });

  it('should NOT report a cycle for a diamond DAG', () => {
    const graph = buildDependencyGraph([
      cell('a'),
      cell('b', ['a']),
      cell('c', ['a']),
      cell('d', ['b', 'c']),
    ]);
    expect(detectCycles(graph)).toEqual([]);
  });

  it('should ignore dangling dependency ids when detecting cycles', () => {
    // 'b' depends on a non-existent 'ghost' node; dfs must handle the missing node.
    const graph = buildDependencyGraph([cell('a'), cell('b', ['ghost'])]);
    expect(detectCycles(graph)).toEqual([]);
  });
});

describe('getDependents - traversal edge cases', () => {
  it('should not double-count a node reachable by two paths', () => {
    // a -> b, a -> c, b -> d, c -> d : d is a dependent reachable twice.
    const graph = buildDependencyGraph([
      cell('a'),
      cell('b', ['a']),
      cell('c', ['a']),
      cell('d', ['b', 'c']),
    ]);
    const deps = getDependents(graph, 'a');
    expect(deps.filter((id) => id === 'd')).toHaveLength(1);
    expect(deps).toContain('b');
    expect(deps).toContain('c');
    expect(deps).toContain('d');
  });

  it('should return empty for a leaf cell that nothing depends on', () => {
    const graph = buildDependencyGraph([cell('a'), cell('b', ['a'])]);
    expect(getDependents(graph, 'b')).toEqual([]);
  });
});

describe('topologicalSort - dependency on missing node', () => {
  it('should visit a missing dependency id before its dependent', () => {
    // topologicalSort recurses on dependency ids unconditionally, so a missing
    // id is still emitted (ahead of the node that references it).
    const nodes = new Map<string, DependencyNode>([
      ['a', { id: 'a', dependencies: ['missing'], dependents: [] }],
    ]);
    const order = topologicalSort(nodes);
    expect(order).toEqual(['missing', 'a']);
  });
});

describe('buildDependencyGraph - multiple roots', () => {
  it('should place every dependency before its dependent in execution order', () => {
    const graph: DependencyGraph = buildDependencyGraph([
      cell('a'),
      cell('b'),
      cell('c', ['a', 'b']),
      cell('d', ['c']),
    ]);
    const order = graph.executionOrder;
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
  });
});
