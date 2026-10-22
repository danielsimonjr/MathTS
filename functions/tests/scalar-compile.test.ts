import { describe, expect, it } from 'vitest';
import type { ScalarNode } from '@danielsimonjr/mathts-expression';
import { compileScalar } from '../src/scalar-compile.js';
import type { CompileScalarOptions, ScalarBatchResult } from '../src/scalar-compile.js';
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

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
}

function expectBatchMatchesEvaluateScalar(
  node: ScalarNode,
  options: CompileScalarOptions,
  columns: readonly Float64Array[],
  result: ScalarBatchResult,
  params?: ArrayLike<number>
): void {
  const n = options.variables.length === 0 ? 1 : columns[0]!.length;
  expect(result.values.length).toBe(n);
  for (let i = 0; i < n; i++) {
    const scope: Record<string, number> = { ...(options.constants ?? {}) };
    for (let v = 0; v < options.variables.length; v++) {
      scope[options.variables[v]!] = columns[v]![i]!;
    }
    if (options.parameters !== undefined && params !== undefined) {
      for (let p = 0; p < options.parameters.length; p++) {
        scope[options.parameters[p]!] = params[p] as number;
      }
    }
    try {
      const expected = evaluateScalar(node, scope);
      expect(result.valid[i]).toBe(1);
      expect(Object.is(result.values[i], expected)).toBe(true);
    } catch (err) {
      expect(err).toBeInstanceOf(ScalarEvalError);
      expect(result.valid[i]).toBe(0);
      expect(Number.isNaN(result.values[i])).toBe(true);
    }
  }
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
      expectBatchMatchesEvaluateScalar(node, { variables: ['x', 'y'] }, [x, y], {
        values,
        valid,
        allValid,
      });
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
      expect(Object.is(values[3], 1)).toBe(true);
      expect(Number.isNaN(values[4])).toBe(true);
      expectBatchMatchesEvaluateScalar(
        node,
        { variables: ['x', 'y'] },
        [x, y],
        compiled.evaluate([x, y])
      );
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
      expect(Number.isNaN(callAt('ln', 0).values[0])).toBe(true);
      expect(callAt('ln', -1).valid[0]).toBe(0);
      expect(Number.isNaN(callAt('ln', -1).values[0])).toBe(true);
      expect(callAt('log', 100).values[0]).toBe(2);
      expect(callAt('log10', 1000).values[0]).toBe(3);
      expect(callAt('log2', 8).values[0]).toBe(3);
      for (const [fn, xv] of [
        ['ln', 1],
        ['ln', Math.E],
        ['ln', 0],
        ['ln', -1],
        ['log', 100],
        ['log10', 1000],
        ['log2', 8],
      ] as const) {
        const node = scalar.call(fn, scalar.symbol('x'));
        expectBatchMatchesEvaluateScalar(
          node,
          { variables: ['x'] },
          [Float64Array.of(xv)],
          compileScalar(node, { variables: ['x'] }).evaluate([Float64Array.of(xv)])
        );
      }
    });

    it('exp sin abs', () => {
      expect(callAt('exp', 0).values[0]).toBe(1);
      expect(Object.is(callAt('exp', 1).values[0], Math.E)).toBe(true);
      expect(callAt('exp', 709).values[0]).toBe(8.218407461554972e307);
      expect(callAt('exp', 800).valid[0]).toBe(0);
      expect(Number.isNaN(callAt('exp', 800).values[0])).toBe(true);
      expect(callAt('sin', 0).values[0]).toBe(0);
      expect(callAt('sin', Infinity).valid[0]).toBe(0);
      expect(Number.isNaN(callAt('sin', Infinity).values[0])).toBe(true);
      expect(callAt('abs', -3).values[0]).toBe(3);
      expect(Object.is(callAt('abs', -0).values[0], 0)).toBe(true);
      expect(callAt('sinh', 0).values[0]).toBe(0);
      for (const [fn, xv] of [
        ['exp', 0],
        ['exp', 1],
        ['exp', 709],
        ['exp', 800],
        ['sin', 0],
        ['sin', Infinity],
        ['abs', -3],
        ['abs', -0],
        ['sinh', 0],
      ] as const) {
        const node = scalar.call(fn, scalar.symbol('x'));
        expectBatchMatchesEvaluateScalar(
          node,
          { variables: ['x'] },
          [Float64Array.of(xv)],
          compileScalar(node, { variables: ['x'] }).evaluate([Float64Array.of(xv)])
        );
      }
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
    expectBatchMatchesEvaluateScalar(node, { variables: ['x'] }, [col], {
      values,
      valid,
      allValid,
    });
  });

  it('bare Infinity number node with no variables', () => {
    const node = scalar.number(Infinity);
    const compiled = compileScalar(node, { variables: [] });
    const { values, valid, allValid } = compiled.evaluate([]);
    expect(valid).toEqual(Uint8Array.of(1));
    expect(values[0]).toBe(Infinity);
    expectBatchMatchesEvaluateScalar(node, { variables: [] }, [], { values, valid, allValid });
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
    expect(Number.isNaN(compiledOver.evaluate([]).values[0])).toBe(true);
    expect(compiledOk.evaluate([]).values[0]).toBe(6);
    expect(
      compileScalar(scalar.op('-', [scalar.number(4)]), { variables: [] }).evaluate([]).values[0]
    ).toBe(4);
    expect(compileScalar(scalar.op('+', []), { variables: [] }).evaluate([]).values[0]).toBe(0);
    expect(compileScalar(scalar.op('*', []), { variables: [] }).evaluate([]).values[0]).toBe(1);
    const plusX = scalar.op('+', [scalar.symbol('x')]);
    const plusXCol = Float64Array.of(3, Number.NaN, Infinity);
    const plusXBatch = compileScalar(plusX, { variables: ['x'] }).evaluate([plusXCol]);
    expect(plusXBatch.valid).toEqual(Uint8Array.of(1, 0, 0));
    expect(plusXBatch.values[0]).toBe(3);
    expect(Number.isNaN(plusXBatch.values[1])).toBe(true);
    expect(Number.isNaN(plusXBatch.values[2])).toBe(true);
    expect(() => evaluateScalar(plusX, { x: Number.NaN })).toThrow(ScalarEvalError);
    expectBatchMatchesEvaluateScalar(plusX, { variables: ['x'] }, [plusXCol], plusXBatch);
    expectBatchMatchesEvaluateScalar(overflow, { variables: [] }, [], compiledOver.evaluate([]));
    expectBatchMatchesEvaluateScalar(ok, { variables: [] }, [], compiledOk.evaluate([]));
    const unaryMinus = scalar.op('-', [scalar.number(4)]);
    expectBatchMatchesEvaluateScalar(
      unaryMinus,
      { variables: [] },
      [],
      compileScalar(unaryMinus, { variables: [] }).evaluate([])
    );
  });

  it('one-argument + - * / apply evalOp requireFinite', () => {
    const plusNan = scalar.op('+', [scalar.number(Number.NaN)]);
    const plusInf = scalar.op('+', [scalar.number(Infinity)]);
    const plusNegZero = scalar.op('+', [scalar.number(-0)]);
    const plusX = scalar.op('+', [scalar.symbol('x')]);
    expect(() => evaluateScalar(plusNan)).toThrow(ScalarEvalError);
    expect(() => evaluateScalar(plusInf)).toThrow(ScalarEvalError);
    expect(Object.is(evaluateScalar(plusNegZero), -0)).toBe(true);

    const nanRow = compileScalar(plusNan, { variables: [] }).evaluate([]);
    expect(nanRow.valid[0]).toBe(0);
    expect(Number.isNaN(nanRow.values[0])).toBe(true);
    expect(() => compileScalar(plusNan, { variables: [] }).evaluateRow([])).toThrow(/non-finite/);

    const infRow = compileScalar(plusInf, { variables: [] }).evaluate([]);
    expect(infRow.valid[0]).toBe(0);
    expect(Number.isNaN(infRow.values[0])).toBe(true);

    const negZeroRow = compileScalar(plusNegZero, { variables: [] }).evaluate([]);
    expect(negZeroRow.valid[0]).toBe(1);
    expect(Object.is(negZeroRow.values[0], -0)).toBe(true);

    const col = Float64Array.of(Number.NaN, Infinity, -0);
    const wrapped = compileScalar(plusX, { variables: ['x'] }).evaluate([col]);
    expect(wrapped.valid).toEqual(Uint8Array.of(0, 0, 1));
    expect(Number.isNaN(wrapped.values[0])).toBe(true);
    expect(Number.isNaN(wrapped.values[1])).toBe(true);
    expect(Object.is(wrapped.values[2], -0)).toBe(true);
    expectBatchMatchesEvaluateScalar(plusNan, { variables: [] }, [], nanRow);
    expectBatchMatchesEvaluateScalar(plusInf, { variables: [] }, [], infRow);
    expectBatchMatchesEvaluateScalar(plusNegZero, { variables: [] }, [], negZeroRow);
    expectBatchMatchesEvaluateScalar(plusX, { variables: ['x'] }, [col], wrapped);
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
    expectBatchMatchesEvaluateScalar(node, { variables: ['x', 'y'] }, [x, y], {
      values,
      valid,
      allValid: false,
    });
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
      const first = compiled.evaluate([col], [10, 1]);
      expect(first.values).toEqual(Float64Array.of(11, 21, 31));
      expect(compiled.evaluate([col], [3, 0]).values).toEqual(Float64Array.of(3, 6, 9));
      expectBatchMatchesEvaluateScalar(
        node,
        { variables: ['x'], parameters: ['a', 'b'] },
        [col],
        first,
        [10, 1]
      );
    });

    it('constant c and literal symbol 2', () => {
      const cNode = scalar.op('*', [scalar.symbol('c'), scalar.symbol('x')]);
      const cCompiled = compileScalar(cNode, { variables: ['x'], constants: { c: 3 } });
      const cCols = Float64Array.of(2, 5);
      expect(cCompiled.evaluate([cCols]).values).toEqual(Float64Array.of(6, 15));
      expectBatchMatchesEvaluateScalar(
        cNode,
        { variables: ['x'], constants: { c: 3 } },
        [cCols],
        cCompiled.evaluate([cCols])
      );

      const litNode = scalar.op('*', [scalar.symbol('2'), scalar.symbol('x')]);
      const lit = compileScalar(litNode, {
        variables: ['x'],
      });
      const litCols = Float64Array.of(3, 4);
      expect(lit.evaluate([litCols]).values).toEqual(Float64Array.of(6, 8));
      expectBatchMatchesEvaluateScalar(
        litNode,
        { variables: ['x'] },
        [litCols],
        lit.evaluate([litCols])
      );

      const aloneNode = scalar.symbol('2');
      const alone = compileScalar(aloneNode, { variables: [] });
      expect(alone.evaluate([]).values[0]).toBe(2);
      expectBatchMatchesEvaluateScalar(aloneNode, { variables: [] }, [], alone.evaluate([]));
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
      expect(() =>
        compileScalar(
          {
            kind: 'abs',
            arg: { kind: 'number', value: -3 },
          } as unknown as ScalarNode,
          { variables: [] }
        )
      ).toThrow(/not a ScalarNode/);
      expect(() =>
        compileScalar(
          {
            kind: 'op',
            op: '+',
            args: [
              {
                kind: 'transcendental',
                fn: 'ln',
                arg: { kind: 'number', value: 1 },
              },
            ],
          } as unknown as ScalarNode,
          { variables: [] }
        )
      ).toThrow(/not a ScalarNode/);
      expect(() =>
        compileScalar(
          {
            kind: 'call',
            fn: 'nope',
            arg: { kind: 'number', value: 1 },
          } as unknown as ScalarNode,
          { variables: [] }
        )
      ).toThrow(/unknown scalar function/);
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
      deepFreeze(node);
      const compiled = compileScalar(node, { variables: ['x', 'y'] });
      const x = Float64Array.of(8, 1);
      const y = Float64Array.of(2, 0);
      const { values } = compiled.evaluate([x, y]);
      expect(values[0]).toBe(4);
      expectBatchMatchesEvaluateScalar(
        node,
        { variables: ['x', 'y'] },
        [x, y],
        compiled.evaluate([x, y])
      );
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
            expect(Object.is(compiled.evaluateRow([x[0], y[0]]), expected)).toBe(true);
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
