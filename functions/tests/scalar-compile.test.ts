import { describe, expect, it } from 'vitest';
import type { ScalarNode } from '@danielsimonjr/mathts-expression';
import { compileScalar } from '../src/scalar-compile.js';
import { compileScalar as compileFromIndex } from '../src/index.js';
import { ScalarEvalError, evaluateScalar, scalar } from '../src/scalar-eval.js';

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('compileScalar', () => {
  it('re-exports compileScalar from the package index', () => {
    expect(compileFromIndex).toBe(compileScalar);
  });

  it('mulberry32 seed 0x5ca1a matches pinned values', () => {
    const rng = mulberry32(0x5ca1a);
    expect(rng()).toBe(0.3941456207539886);
    expect(rng()).toBe(0.4408325254917145);
    expect(rng()).toBe(0.06790005695074797);
    expect(rng()).toBe(0.0023013048339635134);
  });

  describe('hand-computed division /(x, y)', () => {
    const node = scalar.op('/', [scalar.symbol('x'), scalar.symbol('y')]);
    const compiled = compileScalar(node, { variables: ['x', 'y'] });
    const x = Float64Array.of(8, 1, 0, -4, 0, 9);
    const y = Float64Array.of(2, 0, 0, 2, -1, 3);
    const { values, valid, allValid } = compiled.evaluate([x, y]);

    it('matches the division table', () => {
      expect(allValid).toBe(false);
      expect(valid).toEqual(Uint8Array.of(1, 0, 0, 1, 1, 1));
      expect(values[0]).toBe(4);
      expect(Number.isNaN(values[1])).toBe(true);
      expect(Number.isNaN(values[2])).toBe(true);
      expect(values[3]).toBe(-2);
      expect(Object.is(values[4], -0)).toBe(true);
      expect(values[5]).toBe(3);
    });

    it('evaluateRow matches valid rows and throws on invalid', () => {
      expect(compiled.evaluateRow([8, 2])).toBe(4);
      expect(compiled.evaluateRow([-4, 2])).toBe(-2);
      expect(Object.is(compiled.evaluateRow([0, -1]), -0)).toBe(true);
      expect(compiled.evaluateRow([9, 3])).toBe(3);
      expect(() => compiled.evaluateRow([1, 0])).toThrow(ScalarEvalError);
      expect(() => compiled.evaluateRow([1, 0])).toThrow(/non-finite/);
      expect(() => compiled.evaluateRow([0, 0])).toThrow(/non-finite/);
    });

    it('reuses out buffer when length matches', () => {
      const out = new Float64Array(6);
      const result = compiled.evaluate([x, y], undefined, out);
      expect(result.values).toBe(out);
      expect(out[0]).toBe(4);
    });
  });

  describe('hand-computed power ^(x, y)', () => {
    const node = scalar.op('^', [scalar.symbol('x'), scalar.symbol('y')]);
    const compiled = compileScalar(node, { variables: ['x', 'y'] });
    const x = Float64Array.of(-2, -8, -4, 0, 0);
    const y = Float64Array.of(2, 1 / 3, 0.5, 0, -1);
    const { values, valid } = compiled.evaluate([x, y]);

    it('matches the power table', () => {
      expect(valid).toEqual(Uint8Array.of(1, 0, 0, 1, 0));
      expect(values[0]).toBe(4);
      expect(Number.isNaN(values[1])).toBe(true);
      expect(Number.isNaN(values[2])).toBe(true);
      expect(values[3]).toBe(1);
      expect(Number.isNaN(values[4])).toBe(true);
    });
  });

  describe('calls and overflow', () => {
    const callAt = (fn: Parameters<typeof scalar.call>[0], xv: number) => {
      const compiled = compileScalar(scalar.call(fn, scalar.symbol('x')), { variables: ['x'] });
      return compiled.evaluate([Float64Array.of(xv)]);
    };

    it('ln and log family', () => {
      expect(callAt('ln', 1).values[0]).toBe(0);
      expect(callAt('ln', Math.E).values[0]).toBe(1);
      expect(callAt('ln', 0).valid[0]).toBe(0);
      expect(callAt('ln', -1).valid[0]).toBe(0);
      expect(callAt('log', 100).values[0]).toBe(2);
      expect(callAt('log10', 1000).values[0]).toBe(3);
      expect(callAt('log2', 8).values[0]).toBe(3);
    });

    it('exp sin abs', () => {
      expect(callAt('exp', 0).values[0]).toBe(1);
      expect(Object.is(callAt('exp', 1).values[0], Math.E)).toBe(true);
      expect(callAt('exp', 709).values[0]).toBe(8.218407461554972e307);
      expect(callAt('exp', 800).valid[0]).toBe(0);
      expect(callAt('sin', 0).values[0]).toBe(0);
      expect(callAt('sin', Infinity).valid[0]).toBe(0);
      expect(callAt('abs', -3).values[0]).toBe(3);
      expect(Object.is(callAt('abs', -0).values[0], 0)).toBe(true);
      expect(callAt('sinh', 0).values[0]).toBe(0);
    });
  });

  it('bare non-finite symbol column stays valid', () => {
    const node = scalar.symbol('x');
    const compiled = compileScalar(node, { variables: ['x'] });
    const col = Float64Array.of(Number.NaN, Infinity, -0);
    const { values, valid, allValid } = compiled.evaluate([col]);
    expect(valid).toEqual(Uint8Array.of(1, 1, 1));
    expect(allValid).toBe(true);
    expect(Object.is(values[0], Number.NaN)).toBe(true);
    expect(values[1]).toBe(Infinity);
    expect(Object.is(values[2], -0)).toBe(true);
  });

  it('bare Infinity number node with no variables', () => {
    const compiled = compileScalar(scalar.number(Infinity), { variables: [] });
    const { values, valid } = compiled.evaluate([]);
    expect(valid).toEqual(Uint8Array.of(1));
    expect(values[0]).toBe(Infinity);
  });

  it('left fold non-finite at first step', () => {
    const overflow = scalar.op('+', [
      scalar.number(1e308),
      scalar.number(1e308),
      scalar.number(-1e308),
    ]);
    const ok = scalar.op('+', [scalar.number(1), scalar.number(2), scalar.number(3)]);
    const compiledOver = compileScalar(overflow, { variables: [] });
    const compiledOk = compileScalar(ok, { variables: [] });
    expect(compiledOver.evaluate([]).valid[0]).toBe(0);
    expect(compiledOk.evaluate([]).values[0]).toBe(6);
    expect(
      compileScalar(scalar.op('-', [scalar.number(4)]), { variables: [] }).evaluate([]).values[0]
    ).toBe(4);
    expect(compileScalar(scalar.op('+', []), { variables: [] }).evaluate([]).values[0]).toBe(0);
    expect(compileScalar(scalar.op('*', []), { variables: [] }).evaluate([]).values[0]).toBe(1);
  });

  it('mask is per row for +(ln(x), y)', () => {
    const node = scalar.op('+', [scalar.call('ln', scalar.symbol('x')), scalar.symbol('y')]);
    const compiled = compileScalar(node, { variables: ['x', 'y'] });
    const x = Float64Array.of(1, -1, Math.E);
    const y = Float64Array.of(2, 5, -1);
    const { values, valid } = compiled.evaluate([x, y]);
    expect(valid).toEqual(Uint8Array.of(1, 0, 1));
    expect(values[0]).toBe(2);
    expect(Number.isNaN(values[1])).toBe(true);
    expect(values[2]).toBe(0);
  });

  describe('bindings', () => {
    it('parameters and constants', () => {
      const node = scalar.op('+', [
        scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]),
        scalar.symbol('b'),
      ]);
      const compiled = compileScalar(node, {
        variables: ['x'],
        parameters: ['a', 'b'],
      });
      const col = Float64Array.of(1, 2, 3);
      expect(compiled.evaluate([col], [10, 1]).values).toEqual(Float64Array.of(11, 21, 31));
      expect(compiled.evaluate([col], [3, 0]).values).toEqual(Float64Array.of(3, 6, 9));
    });

    it('constant c and literal symbol 2', () => {
      const cNode = scalar.op('*', [scalar.symbol('c'), scalar.symbol('x')]);
      const cCompiled = compileScalar(cNode, { variables: ['x'], constants: { c: 3 } });
      expect(cCompiled.evaluate([Float64Array.of(2, 5)]).values).toEqual(Float64Array.of(6, 15));

      const lit = compileScalar(scalar.op('*', [scalar.symbol('2'), scalar.symbol('x')]), {
        variables: ['x'],
      });
      expect(lit.evaluate([Float64Array.of(3, 4)]).values).toEqual(Float64Array.of(6, 8));

      const alone = compileScalar(scalar.symbol('2'), { variables: [] });
      expect(alone.evaluate([]).values[0]).toBe(2);
    });

    it('compile-time symbol errors', () => {
      expect(() => compileScalar(scalar.symbol('mystery'), { variables: [] })).toThrow(
        ScalarEvalError
      );
      expect(() => compileScalar(scalar.symbol('mystery'), { variables: [] })).toThrow(/mystery/);
      expect(() => compileScalar(scalar.symbol('pi'), { variables: [] })).toThrow(/no value/);
      expect(() =>
        compileScalar(scalar.symbol('toString'), { variables: [], constants: {} })
      ).toThrow(/no value/);
      expect(() => compileScalar(scalar.symbol('x'), { variables: ['x', 'x'] })).toThrow(
        /listed more than once/
      );
      expect(() =>
        compileScalar(scalar.symbol('x'), { variables: ['x'], parameters: ['x'] })
      ).toThrow(/listed more than once/);
      expect(() =>
        compileScalar(scalar.symbol('c'), {
          variables: [],
          constants: { c: '3' as unknown as number },
        })
      ).toThrow(/not a number/);
      expect(() =>
        compileScalar(
          {
            kind: 'op',
            op: '^',
            args: [scalar.number(1), scalar.number(2), scalar.number(3)],
          } as ScalarNode,
          { variables: [] }
        )
      ).toThrow(/exactly 2 args/);
    });

    it('rejects non-ScalarNode inputs', () => {
      expect(() => compileScalar('x+1' as unknown as ScalarNode, { variables: [] })).toThrow(
        /not a ScalarNode/
      );
      expect(() =>
        compileScalar(
          {
            kind: 'transcendental',
            fn: 'ln',
            arg: { kind: 'number', value: 1 },
          } as unknown as ScalarNode,
          { variables: [] }
        )
      ).toThrow(/not a ScalarNode/);
    });

    it('copies variables and parameters arrays', () => {
      const vars = ['x'];
      const compiled = compileScalar(scalar.symbol('x'), { variables: vars, parameters: ['a'] });
      expect(compiled.variables).not.toBe(vars);
      expect(compiled.variables).toEqual(['x']);
      vars.push('z');
      expect(compiled.variables).toEqual(['x']);
    });
  });

  describe('shape, reuse, purity', () => {
    const base = compileScalar(scalar.op('/', [scalar.symbol('x'), scalar.symbol('y')]), {
      variables: ['x', 'y'],
    });

    it('column and parameter shape errors', () => {
      expect(() => base.evaluate([Float64Array.of(1)])).toThrow(/expected 2 columns/);
      expect(() => base.evaluate([Float64Array.of(1, 2), Float64Array.of(1)])).toThrow(
        /same length/
      );
      expect(() =>
        base.evaluate([Float64Array.of(1, 2), [1, 2] as unknown as Float64Array])
      ).toThrow(/Float64Array/);

      const pNode = compileScalar(scalar.symbol('a'), { variables: [], parameters: ['a'] });
      expect(() => pNode.evaluate([])).toThrow(/expected 1 parameters, got 0/);
      expect(() => pNode.evaluate([], [1, 2])).toThrow(/expected 1 parameters, got 2/);
      expect(() =>
        base.evaluate(
          [Float64Array.of(1, 2), Float64Array.of(1, 2)],
          undefined,
          new Float64Array(1)
        )
      ).toThrow(/out length 1 does not match row count 2/);
    });

    it('empty column batch', () => {
      const c = compileScalar(scalar.symbol('x'), { variables: ['x'] });
      const empty = new Float64Array(0);
      const r = c.evaluate([empty]);
      expect(r.values.length).toBe(0);
      expect(r.valid.length).toBe(0);
      expect(r.allValid).toBe(true);
      const out = new Float64Array(0);
      expect(c.evaluate([empty], undefined, out).values).toBe(out);
    });

    it('does not mutate frozen node', () => {
      const node = scalar.op('/', [scalar.symbol('x'), scalar.symbol('y')]);
      Object.freeze(node);
      if (node.kind === 'op') {
        Object.freeze(node.args);
      }
      const compiled = compileScalar(node, { variables: ['x', 'y'] });
      const { values } = compiled.evaluate([Float64Array.of(8, 1), Float64Array.of(2, 0)]);
      expect(values[0]).toBe(4);
    });
  });

  describe('parity sweep 500×64', () => {
    const LEAF_NUMS = [-2, -1, 0, 1, 2, 0.5];
    const CALLS = [
      'exp',
      'ln',
      'log',
      'log2',
      'log10',
      'sin',
      'cos',
      'tan',
      'sinh',
      'cosh',
      'tanh',
      'abs',
    ] as const;
    const OPS = ['+', '-', '*', '/', '^'] as const;

    function gen(rng: () => number, depth: number): ScalarNode {
      if (depth === 0 || rng() < 0.25) {
        if (rng() < 0.5) {
          return scalar.symbol(rng() < 0.5 ? 'x' : 'y');
        }
        return scalar.number(LEAF_NUMS[Math.floor(rng() * 6)]!);
      }
      if (rng() < 0.55) {
        const fn = CALLS[Math.floor(rng() * 12)]!;
        return scalar.call(fn, gen(rng, depth - 1));
      }
      const op = OPS[Math.floor(rng() * 5)]!;
      return scalar.op(op, [gen(rng, depth - 1), gen(rng, depth - 1)]);
    }

    it('agrees with evaluateScalar on seed 0x5CA1A', () => {
      const x = new Float64Array(64);
      const y = new Float64Array(64);
      for (let i = 0; i < 64; i++) {
        x[i] = (i % 17) - 8;
        y[i] = ((i * 3) % 11) - 5;
      }
      x[60] = 0;
      y[60] = 0;
      x[61] = -1;
      y[61] = 0.5;
      x[62] = 800;
      y[62] = 1;
      x[63] = Number.NaN;
      y[63] = 1;

      let sawSuccess = false;
      let sawThrow = false;
      let treeCount = 0;
      const rng = mulberry32(0x5ca1a);

      for (let t = 0; t < 500; t++) {
        treeCount++;
        const tree = gen(rng, 4);
        const compiled = compileScalar(tree, { variables: ['x', 'y'] });
        const { values, valid } = compiled.evaluate([x, y]);

        for (let i = 0; i < 64; i++) {
          try {
            const expected = evaluateScalar(tree, { x: x[i], y: y[i] });
            expect(valid[i]).toBe(1);
            expect(Object.is(values[i], expected)).toBe(true);
            sawSuccess = true;
          } catch (err) {
            expect(err).toBeInstanceOf(ScalarEvalError);
            expect(valid[i]).toBe(0);
            expect(Number.isNaN(values[i])).toBe(true);
            sawThrow = true;
          }
        }

        if (t === 0) {
          try {
            const expected = evaluateScalar(tree, { x: x[0], y: y[0] });
            expect(compiled.evaluateRow([x[0], y[0]])).toBe(expected);
          } catch (err) {
            expect(err).toBeInstanceOf(ScalarEvalError);
            expect(() => compiled.evaluateRow([x[0], y[0]])).toThrow(ScalarEvalError);
          }
        }
      }

      expect(treeCount).toBe(500);
      expect(sawSuccess).toBe(true);
      expect(sawThrow).toBe(true);
    });
  });
});
