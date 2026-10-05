import { describe, expect, it } from 'vitest';
import { SCALAR_FUNCTIONS, ScalarBuildError, createScalarBuilder } from '../src/scalar-builder.js';
import * as expression from '../src/index.js';

const EXPR_EVAL_FUNCTIONS = [
  'exp',
  'ln',
  'log2',
  'log10',
  'sin',
  'cos',
  'tan',
  'sinh',
  'cosh',
  'tanh',
] as const;

describe('createScalarBuilder', () => {
  const scalar = createScalarBuilder();

  it('is on the expression public surface with the scalar function set', () => {
    expect(typeof expression.createScalarBuilder).toBe('function');
    expect(expression.SCALAR_FUNCTIONS).toEqual(SCALAR_FUNCTIONS);
    expect(expression.SCALAR_FUNCTION_LOWERING.ln).toBe('log');
    expect(expression.SCALAR_FUNCTION_LOWERING.log).toBe('log10');
    for (const name of EXPR_EVAL_FUNCTIONS) {
      expect(SCALAR_FUNCTIONS).toContain(name);
    }
    expect(SCALAR_FUNCTIONS).toContain('abs');
    expect(SCALAR_FUNCTIONS).toContain('log');
  });

  it('lowers ln to natural log and log to log10', () => {
    const x = scalar.symbol('x');
    expect(scalar.call('ln', x)).toEqual({ kind: 'call', fn: 'log', arg: x });
    expect(scalar.call('log', x)).toEqual({ kind: 'call', fn: 'log10', arg: x });
    expect(scalar.call('log10', x)).toMatchObject({ kind: 'call', fn: 'log10' });
    expect(scalar.call('log2', x)).toMatchObject({ kind: 'call', fn: 'log2' });
    expect(scalar.call('abs', x)).toMatchObject({ kind: 'call', fn: 'abs' });
  });

  it('keeps a lowered natural log when the built node is passed through from again', () => {
    const once = scalar.call('ln', scalar.number(1));
    expect(once).toMatchObject({ kind: 'call', fn: 'log' });
    expect(scalar.from(once)).toEqual(once);
  });

  it('builds operator trees from typed nodes', () => {
    const node = scalar.op('+', [
      scalar.op('*', [scalar.symbol('2'), scalar.symbol('a')]),
      scalar.call('ln', scalar.symbol('x')),
    ]);
    expect(node).toEqual({
      kind: 'op',
      op: '+',
      args: [
        {
          kind: 'op',
          op: '*',
          args: [
            { kind: 'symbol', name: '2' },
            { kind: 'symbol', name: 'a' },
          ],
        },
        { kind: 'call', fn: 'log', arg: { kind: 'symbol', name: 'x' } },
      ],
    });
  });

  it('reads a transcendental and abs tree without parsing a formula string', () => {
    const node = scalar.from({
      kind: 'op',
      op: '^',
      args: [
        {
          kind: 'transcendental',
          fn: 'ln',
          arg: { kind: 'symbol', name: 'x' },
        },
        { kind: 'abs', arg: { kind: 'symbol', name: 'n' } },
      ],
    });
    expect(node).toEqual({
      kind: 'op',
      op: '^',
      args: [
        { kind: 'call', fn: 'log', arg: { kind: 'symbol', name: 'x' } },
        { kind: 'call', fn: 'abs', arg: { kind: 'symbol', name: 'n' } },
      ],
    });
    expect(() => scalar.from('ln(x) + 1')).toThrow(ScalarBuildError);
    expect(() => scalar.from('ln(x) + 1')).toThrow(/formula string/);
  });

  it('rejects unknown functions, a bad power arity, and non-scalar kinds', () => {
    expect(() => scalar.call('sqrt' as 'ln', scalar.number(1))).toThrow(ScalarBuildError);
    expect(() => scalar.op('^', [scalar.number(2)])).toThrow(/exactly 2 args/);
    expect(() => scalar.from({ kind: 'integral', over: { kind: 'symbol', name: 'x' } })).toThrow(
      /integral/
    );
    expect(() =>
      scalar.from({ kind: 'transcendental', fn: 'log1p', arg: { kind: 'number', value: 1 } })
    ).toThrow(/unknown scalar function/);
  });
});
