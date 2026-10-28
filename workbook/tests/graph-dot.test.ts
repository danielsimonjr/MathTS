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

  it('empty graph is header plus closing brace on the next line (no blank line)', () => {
    const dot = toDOT(buildDependencyGraph([]));
    expect(dot).toBe('digraph deps {\n}');
  });

  it('matches the hand-written digraph oracle (node lines before edges)', () => {
    const graph = buildDependencyGraph([
      { id: 'a', type: 'data', content: '1' },
      { id: 'b', type: 'code', content: 'a + 1', dependsOn: ['a'] },
    ]);
    const expected = [
      'digraph deps {',
      '  a [label="a"];',
      '  b [label="b"];',
      '  a -> b;',
      '}',
    ].join('\n');
    expect(toDOT(graph)).toBe(expected);
  });

  it('edge order follows node.dependencies with all node lines first', () => {
    const graph = buildDependencyGraph([
      { id: 'first', type: 'code', content: '1' },
      { id: 'second', type: 'code', content: '1' },
      {
        id: 'sink',
        type: 'code',
        content: 'first + second',
        dependsOn: ['first', 'second'],
      },
    ]);
    const dot = toDOT(graph);
    const lines = dot.split('\n');
    const edgeStart = lines.findIndex((l) => l.includes('->'));
    const lastNodeLine = lines.findIndex((l) => l.includes('sink [label="sink"];'));
    expect(edgeStart).toBeGreaterThan(lastNodeLine);
    expect(lines.filter((l) => l.includes('->'))).toEqual([
      '  first -> sink;',
      '  second -> sink;',
    ]);
  });

  it('emits cycle edges without deduplication', () => {
    const dot = toDOT(
      buildDependencyGraph([
        { id: 'a', type: 'code', content: '1', dependsOn: ['b'] },
        { id: 'b', type: 'code', content: '2', dependsOn: ['a'] },
      ])
    );
    expect(dot).toContain('b -> a;');
    expect(dot).toContain('a -> b;');
  });

  it('quotes the id inside the DOT label attribute', () => {
    const id = 'quoted_style_id';
    const dot = toDOT(buildDependencyGraph([{ id, type: 'code', content: 'x' }]));
    expect(dot).toContain(`${id} [label="${id}"];`);
  });
});
