import { describe, it, expect } from 'vitest';
import { parse } from './helpers/bootstrap.js';

describe('Node.toDOT', () => {
  it('emits a digraph with a node per AST node and parent→child edges', () => {
    const dot = parse('2 * x').toDOT();
    // structure (label text is our format; op symbol comes from the parser):
    expect(dot.startsWith('digraph AST {')).toBe(true);
    expect(dot.trimEnd().endsWith('}')).toBe(true);
    // 3 node declarations, 2 edges
    expect(dot.match(/\[label=/g)?.length).toBe(3);
    expect(dot.match(/ -> /g)?.length).toBe(2);
    // root is the operator, children are the constant and symbol
    expect(dot).toMatch(/n0 \[label="OperatorNode: /);
    expect(dot).toContain('ConstantNode: 2');
    expect(dot).toContain('SymbolNode: x');
    expect(dot).toContain('n0 -> n1;');
    expect(dot).toContain('n0 -> n2;');
  });
  it('DOT-escapes quotes and backslashes in labels', () => {
    const dot = parse('"a\\\\b"').toDOT(); // a string node containing a backslash
    expect(dot).not.toMatch(/label="[^"]*[^\\]"[^\]]/); // no unescaped inner quote breaks the attr
    expect(dot).toContain('\\\\'); // backslash escaped
  });
  it('honors options.name', () => {
    expect(parse('x').toDOT({ name: 'Tree' }).startsWith('digraph Tree {')).toBe(true);
  });
});
