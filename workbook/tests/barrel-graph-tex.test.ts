/**
 * Public barrel exports for graph DOT and TeX document rendering (#433).
 */
import { describe, it, expect } from 'vitest';
import { buildDependencyGraph, toDOT, toTeX } from '../src/index.js';
import type { DependencyGraph, RenderDoc } from '../src/index.js';

describe('package barrel: graph + tex exports', () => {
  it('toDOT from the barrel matches the hand-written digraph oracle', () => {
    const graph = buildDependencyGraph([
      { id: 'a', type: 'data', content: '1' },
      { id: 'b', type: 'code', content: 'a + 1', dependsOn: ['a'] },
    ]);
    const dot = toDOT(graph);
    const expected = [
      'digraph deps {',
      '  a [label="a"];',
      '  b [label="b"];',
      '  a -> b;',
      '}',
    ].join('\n');
    expect(dot).toBe(expected);
  });

  it('toTeX fragment from the barrel omits documentclass and includes cell body', () => {
    const doc: RenderDoc = { title: 'T', cells: [{ type: 'markdown', content: 'hi' }] };
    const out = toTeX(doc, { fragment: true });
    expect(out).toContain('hi');
    expect(out).not.toContain('\\documentclass');
  });

  it('DependencyGraph is importable from the barrel (compile-time)', () => {
    const graph: DependencyGraph = buildDependencyGraph([{ id: 'x', type: 'code', content: '1' }]);
    expect(graph.executionOrder).toContain('x');
  });
});
