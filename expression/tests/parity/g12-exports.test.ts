import { describe, it, expect } from 'vitest';
import * as expression from '../../src/index.js';
import * as mathjs from 'mathjs';

/**
 * G12 typed-package surface decisions (#1569, #1571):
 *
 * #1569: `docs` (the embedded-docs map) is exported from the expression package and
 * covers every mathjs embedded-docs key; `all` and the `expression` namespace stay
 * compat-only (documented in the migration guide) — `all` must stay absent here.
 *
 * #1571: the Node classes (`Node`, `ConstantNode`, …), the `Parser` class, and a
 * real `ResultSet` class are exported as ready-made constructors, in addition to
 * the `create<X>` factories that already exist.
 */

const NODE_CLASSES = [
  'Node',
  'AccessorNode',
  'ArrayNode',
  'AssignmentNode',
  'BlockNode',
  'ConditionalNode',
  'ConstantNode',
  'FunctionAssignmentNode',
  'FunctionNode',
  'IndexNode',
  'ObjectNode',
  'OperatorNode',
  'ParenthesisNode',
  'RangeNode',
  'RelationalNode',
  'SymbolNode',
] as const;

describe('G12 expression export surface (#1569, #1571)', () => {
  it('exports docs with every mathjs embedded-docs key (#1569)', () => {
    const docs = (expression as unknown as Record<string, unknown>).docs;
    expect(docs, 'docs must be exported from @danielsimonjr/mathts-expression').toBeDefined();
    const mathjsKeys = Object.keys((mathjs as unknown as { docs: Record<string, unknown> }).docs);
    const ours = new Set(Object.keys(docs as Record<string, unknown>));
    const missing = mathjsKeys.filter((k) => !ours.has(k));
    expect(missing, 'mathjs docs keys missing from expression docs').toEqual([]);
  });

  it('stays without the compat-only all bundle (#1569 decision)', () => {
    expect('all' in expression).toBe(false);
  });

  it('exports the 16 Node classes (#1571)', () => {
    const exp = expression as unknown as Record<string, unknown>;
    for (const name of NODE_CLASSES) {
      expect(typeof exp[name], `${name} must be exported as a class`).toBe('function');
      expect(
        (exp[name] as abstract new (...args: never[]) => unknown).prototype,
        `${name} must be a constructor`
      ).toBeDefined();
    }
  });

  it('the node classes construct and share one instanceof chain (#1571)', () => {
    const { Node, ConstantNode, SymbolNode, ParenthesisNode } = expression as unknown as {
      Node: abstract new (...args: never[]) => object;
      ConstantNode: new (value: unknown) => object;
      SymbolNode: new (name: string) => object;
      ParenthesisNode: new (content: object) => { content: object };
    };
    const c = new ConstantNode(2.3);
    const s = new SymbolNode('x');
    const p = new ParenthesisNode(c);
    expect(c).toBeInstanceOf(Node);
    expect(s).toBeInstanceOf(Node);
    expect(p).toBeInstanceOf(Node);
    expect(p.content).toBe(c);
  });

  it('exports the Parser class (#1571)', () => {
    const exp = expression as unknown as Record<string, unknown>;
    expect(typeof exp.Parser).toBe('function');
    const parser = new (exp.Parser as new () => { evaluate(expr: string): unknown })();
    expect(parser.evaluate('2 + 3')).toBe(5);
  });

  it('exports a real ResultSet class (#1567/#1571)', () => {
    const exp = expression as unknown as Record<string, unknown>;
    expect(typeof exp.ResultSet).toBe('function');
    const ResultSet = exp.ResultSet as new (entries?: unknown[]) => {
      entries: unknown[];
      valueOf(): unknown[];
      isResultSet: boolean;
    };
    const rs = new ResultSet([1, 2]);
    expect(rs.entries).toEqual([1, 2]);
    expect(rs.valueOf()).toEqual([1, 2]);
    expect(rs.isResultSet).toBe(true);
  });

  it('the exported class names exist on the mathjs oracle', () => {
    const oracle = new Set(Object.keys(mathjs));
    for (const name of [...NODE_CLASSES, 'Parser', 'ResultSet', 'docs']) {
      expect(oracle.has(name), `mathjs exports ${name}`).toBe(true);
    }
  });
});
