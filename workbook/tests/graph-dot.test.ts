import { describe, it, expect } from 'vitest';
import { buildDependencyGraph, toDOT } from '../src/graph.js';
import type { Cell } from '../src/types.js';

describe('toDOT(graph)', () => {
  it('emits a digraph with a node per cell and dep -> cell edges', () => {
    const cells: Cell[] = [
      { id: 'a', type: 'data', content: '1' },
      { id: 'b', type: 'code', content: 'a + 1', dependsOn: ['a'] },
    ];
    const dot = toDOT(buildDependencyGraph(cells));
    expect(dot.startsWith('digraph deps {')).toBe(true);
    expect(dot.trimEnd().endsWith('}')).toBe(true);
    expect(dot).toContain('a [label="a"];');
    expect(dot).toContain('b [label="b"];');
    expect(dot).toContain('a -> b;');
  });
});
