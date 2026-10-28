import { describe, it, expect } from 'vitest';
import { buildDependencyGraph, toMermaid } from '../src/graph.js';
import type { Cell } from '../src/types.js';

describe('toMermaid', () => {
  const cells: Cell[] = [
    { id: 'a', type: 'code', content: '1' },
    { id: 'b', type: 'code', content: 'a * 2', dependsOn: ['a'] },
    { id: 'c', type: 'test', content: 'b == 2', dependsOn: ['b'] },
  ];

  it('should emit a graph TD header', () => {
    expect(toMermaid(buildDependencyGraph(cells))).toMatch(/^graph TD/);
  });

  it('should declare each node as id["id"] (no content leaked)', () => {
    const m = toMermaid(buildDependencyGraph(cells));
    expect(m).toContain('a["a"]');
    expect(m).toContain('b["b"]');
    expect(m).toContain('c["c"]');
    expect(m).not.toContain('a * 2'); // cell content never appears
  });

  it('should emit one edge per dependency (dep --> cell)', () => {
    const m = toMermaid(buildDependencyGraph(cells));
    expect(m).toContain('a --> b');
    expect(m).toContain('b --> c');
  });

  it('empty graph is exactly the header line', () => {
    expect(toMermaid(buildDependencyGraph([]))).toBe('graph TD');
  });

  it('lists all node lines before edge lines; edge order follows dependencies', () => {
    const graph = buildDependencyGraph([
      { id: 'z', type: 'code', content: '1' },
      { id: 'y', type: 'code', content: '1' },
      {
        id: 'target',
        type: 'code',
        content: 'z + y',
        dependsOn: ['z', 'y'],
      },
    ]);
    const m = toMermaid(graph);
    const lines = m.split('\n');
    expect(lines[0]).toBe('graph TD');
    const edgeIdx = lines.findIndex((l) => l.includes('-->'));
    const lastNodeIdx = lines.findIndex((l) => l.includes('target["target"]'));
    expect(lastNodeIdx).toBeGreaterThan(-1);
    expect(edgeIdx).toBeGreaterThan(lastNodeIdx);
    const edges = lines.filter((l) => l.includes('-->'));
    expect(edges).toEqual(['  z --> target', '  y --> target']);
  });

  it('still emits edges when the graph has a cycle (debug render only)', () => {
    const graph = buildDependencyGraph([
      { id: 'a', type: 'code', content: '1', dependsOn: ['b'] },
      { id: 'b', type: 'code', content: '2', dependsOn: ['a'] },
    ]);
    const m = toMermaid(graph);
    expect(m).toContain('b --> a');
    expect(m).toContain('a --> b');
  });

  it('uses the cell id verbatim in labels (valid identifiers, including long names)', () => {
    const longId = 'cell_with_a_very_long_but_valid_identifier_name';
    const m = toMermaid(
      buildDependencyGraph([{ id: longId, type: 'code', content: 'secret payload' }])
    );
    expect(m).toBe(`graph TD\n  ${longId}["${longId}"]`);
    expect(m).not.toContain('secret');
  });
});
