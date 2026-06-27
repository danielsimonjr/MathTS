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
});
