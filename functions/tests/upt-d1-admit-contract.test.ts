import { describe, it, expect } from 'vitest';
import {
  createScalarBuilder,
  type ScalarGrammar,
  type ScalarNode,
} from '@danielsimonjr/mathts-expression';
import { createSeededRng } from '@danielsimonjr/mathts-core';
import { compileScalar, scalarToTex, searchScalars } from '../src/index.js';

const b = createScalarBuilder();
const X = b.symbol('x');

function observedOf(node: ScalarNode, x: Float64Array): Float64Array {
  return compileScalar(node, { variables: ['x'] }).evaluate([x]).values;
}

describe('D1 search contract for a later UPT caller', () => {
  it('scalarToTex is a function and does not accept a formula string', () => {
    expect(typeof scalarToTex).toBe('function');
    expect(typeof scalarToTex(X)).toBe('string');
  });

  it('admit that rejects every node throws before a hall entry', async () => {
    const grammar: ScalarGrammar = {
      variables: ['x'],
      binary: ['+', '*', '^'],
      unary: [],
      literals: [1],
      maxSize: 7,
      admit: () => false,
    };
    const xs = new Float64Array([0, 1]);
    const planted = b.op('+', [b.op('*', [X, X]), X]);
    const gen = searchScalars(
      {
        variables: ['x'],
        columns: [xs],
        observed: observedOf(planted, xs),
      },
      {
        grammar,
        rng: createSeededRng(7),
        seeds: [X],
        maxEvaluations: 10,
      }
    );
    await expect(gen.next()).rejects.toThrow('searchScalars: the grammar admits no tree');
  });
});
