import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createScalarBuilder, type ScalarNode } from '../src/scalar-builder.js';
import {
  enumerateScalars,
  scalarGrammarAccepts,
  type EnumerationStop,
  type ScalarGrammar,
} from '../src/scalar-enumerate.js';
import { scalarCanonicalKey, scalarEquals } from '../src/scalar-structure.js';
import * as expression from '../src/index.js';

const tinyGrammar = (): ScalarGrammar => ({
  variables: ['x'],
  binary: ['+', '*'],
  unary: [],
  maxSize: 3,
});

function collect(
  grammar: ScalarGrammar,
  maxCandidates: number
): { nodes: ScalarNode[]; stop: EnumerationStop } {
  const gen = enumerateScalars(grammar, { maxCandidates });
  const nodes: ScalarNode[] = [];
  let result = gen.next();
  while (!result.done) {
    nodes.push(result.value);
    result = gen.next();
  }
  if (result.done !== true) {
    throw new Error('enumerateScalars did not return a stop reason');
  }
  return { nodes, stop: result.value };
}

describe('scalar-enumerate', () => {
  const b = createScalarBuilder();
  const x = b.symbol('x');
  const plusXX = b.op('+', [x, x]);
  const mulXX = b.op('*', [x, x]);

  it('exports enumeration API on the expression public surface', () => {
    expect(expression.enumerateScalars).toBe(enumerateScalars);
    expect(expression.scalarGrammarAccepts).toBe(scalarGrammarAccepts);
  });

  it('does not import createSeededRng', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/scalar-enumerate.ts', import.meta.url)),
      'utf8'
    );
    expect(src.includes('createSeededRng')).toBe(false);
  });

  it('tiny grammar oracle: visit order and exhausted-space', () => {
    const { nodes, stop } = collect(tinyGrammar(), 10);
    expect(stop).toBe('exhausted-space');
    expect(nodes).toHaveLength(3);
    expect(scalarEquals(nodes[0]!, x)).toBe(true);
    expect(scalarEquals(nodes[1]!, plusXX)).toBe(true);
    expect(scalarEquals(nodes[2]!, mulXX)).toBe(true);
  });

  it('tiny grammar stops at candidate-limit', () => {
    const { nodes, stop } = collect(tinyGrammar(), 2);
    expect(stop).toBe('candidate-limit');
    expect(nodes).toHaveLength(2);
    expect(scalarEquals(nodes[0]!, x)).toBe(true);
    expect(scalarEquals(nodes[1]!, plusXX)).toBe(true);
  });

  it('enumeration is deterministic by scalarCanonicalKey', () => {
    const keysA = collect(tinyGrammar(), 10).nodes.map(scalarCanonicalKey);
    const keysB = collect(tinyGrammar(), 10).nodes.map(scalarCanonicalKey);
    expect(keysB).toEqual(keysA);
  });

  it('admitMonotone prunes * subtrees from expansion', () => {
    const grammar: ScalarGrammar = {
      ...tinyGrammar(),
      admit: (node) => !(node.kind === 'op' && node.op === '*'),
      admitMonotone: true,
    };
    const { nodes, stop } = collect(grammar, 10);
    expect(stop).toBe('exhausted-space');
    expect(nodes).toHaveLength(2);
    expect(scalarEquals(nodes[0]!, x)).toBe(true);
    expect(scalarEquals(nodes[1]!, plusXX)).toBe(true);
  });

  it('scalarGrammarAccepts does not call admit', () => {
    const grammar: ScalarGrammar = {
      ...tinyGrammar(),
      admit: () => false,
    };
    expect(scalarGrammarAccepts(grammar, mulXX)).toBe(true);
  });
});
