import { describe, expect, it } from 'vitest';
import { abs, add, cosh, exp, log, log10, log2, pow, sinh, tanh } from '../src/typed/arithmetic.js';
import { cos, sin, tan } from '../src/typed/trigonometry.js';
import { ScalarEvalError, evaluateScalar, scalar } from '../src/scalar-eval.js';
import { evaluateScalar as evaluateFromIndex, scalar as scalarFromIndex } from '../src/index.js';

const asNumber = (value: unknown): number => value as number;

describe('evaluateScalar', () => {
  it('exports scalar and evaluateScalar from the functions package', () => {
    expect(scalarFromIndex).toBe(scalar);
    expect(evaluateFromIndex).toBe(evaluateScalar);
  });

  it('evaluates + - * / ^ with literal symbols and caller scope', () => {
    const expr = {
      kind: 'op',
      op: '/',
      args: [
        {
          kind: 'op',
          op: '*',
          args: [
            { kind: 'symbol', name: '2' },
            { kind: 'symbol', name: 'a' },
          ],
        },
        { kind: 'symbol', name: 'b' },
      ],
    };
    expect(evaluateScalar(expr, { a: 12, b: 3 })).toBe(8);
    expect(
      evaluateScalar(scalar.op('-', [scalar.number(10), scalar.number(3), scalar.number(2)]))
    ).toBe(5);
    expect(evaluateScalar(scalar.op('+', []))).toBe(0);
    expect(evaluateScalar(scalar.op('-', []))).toBe(0);
    expect(evaluateScalar(scalar.op('*', []))).toBe(1);
    expect(evaluateScalar(scalar.op('/', []))).toBe(1);
    expect(evaluateScalar(scalar.op('^', [scalar.symbol('2'), scalar.symbol('10')]))).toBe(
      asNumber(pow(2, 10))
    );
    expect(evaluateScalar(scalar.op('-', [scalar.number(4)]))).toBe(4);
  });

  it('prefers a scope binding over a numeric literal spelling', () => {
    expect(evaluateScalar(scalar.symbol('2'), { '2': 9 })).toBe(9);
    expect(evaluateScalar(scalar.symbol('-1'))).toBe(-1);
    expect(evaluateScalar(scalar.symbol('1e-3'))).toBe(0.001);
  });

  it('lowers ln to natural log and log to log10 through MathTS', () => {
    expect(evaluateScalar(scalar.call('ln', scalar.number(Math.E)))).toBe(asNumber(log(Math.E)));
    expect(evaluateScalar(scalar.call('log', scalar.number(100)))).toBe(asNumber(log10(100)));
    expect(evaluateScalar(scalar.call('log10', scalar.number(1000)))).toBe(asNumber(log10(1000)));
    expect(evaluateScalar(scalar.call('log2', scalar.number(8)))).toBe(asNumber(log2(8)));
    expect(evaluateScalar(scalar.call('exp', scalar.number(1)))).toBe(asNumber(exp(1)));
    expect(evaluateScalar(scalar.call('abs', scalar.number(-3)))).toBe(asNumber(abs(-3)));
  });

  it('evaluates the expr-eval transcendentals through MathTS', () => {
    const x = 0.3;
    const cases: Array<[string, number]> = [
      ['sin', asNumber(sin(x))],
      ['cos', asNumber(cos(x))],
      ['tan', asNumber(tan(x))],
      ['sinh', asNumber(sinh(x))],
      ['cosh', asNumber(cosh(x))],
      ['tanh', asNumber(tanh(x))],
    ];
    for (const [fn, expected] of cases) {
      const node = {
        kind: 'transcendental',
        fn,
        arg: { kind: 'number', value: x },
      };
      expect(evaluateScalar(node)).toBe(expected);
    }
    expect(
      evaluateScalar(
        {
          kind: 'op',
          op: '+',
          args: [
            { kind: 'transcendental', fn: 'ln', arg: { kind: 'symbol', name: 'x' } },
            { kind: 'transcendental', fn: 'log', arg: { kind: 'number', value: 100 } },
          ],
        },
        { x: Math.E }
      )
    ).toBe(asNumber(add(asNumber(log(Math.E)), asNumber(log10(100)))));
  });

  it('evaluates absolute value from an abs node', () => {
    expect(
      evaluateScalar({
        kind: 'abs',
        arg: {
          kind: 'op',
          op: '-',
          args: [
            { kind: 'symbol', name: '3' },
            { kind: 'symbol', name: '8' },
          ],
        },
      })
    ).toBe(5);
  });

  it('leaves pi, e, and pi-multiple names unbound', () => {
    expect(() => evaluateScalar(scalar.symbol('e'))).toThrow(ScalarEvalError);
    expect(() => evaluateScalar(scalar.symbol('pi'))).toThrow(/no value/);
    expect(() => evaluateScalar(scalar.symbol('6pi'))).toThrow(ScalarEvalError);
    expect(evaluateScalar(scalar.symbol('e'), { e: 1.602176634e-19 })).toBe(1.602176634e-19);
  });

  it('throws on an unresolved symbol, a non-finite result, a formula string, and a non-scalar kind', () => {
    expect(() => evaluateScalar(scalar.symbol('mystery'))).toThrow(/mystery/);
    expect(() => evaluateScalar(scalar.op('/', [scalar.number(1), scalar.number(0)]))).toThrow(
      ScalarEvalError
    );
    expect(() => evaluateScalar(scalar.call('ln', scalar.number(-1)))).toThrow(/non-finite/);
    expect(() => evaluateScalar('ln(x)')).toThrow(/formula string/);
    expect(() => evaluateScalar({ kind: 'integral', over: { kind: 'symbol', name: 'x' } })).toThrow(
      /integral/
    );
    expect(() =>
      evaluateScalar(scalar.op('^', [scalar.number(2), scalar.number(3), scalar.number(4)]))
    ).toThrow(/exactly 2 args/);
  });
});
