import { describe, expect, it } from 'vitest';
import type { MathNode, ScalarNode } from '@danielsimonjr/mathts-expression';
import { Dual } from '@danielsimonjr/mathts-core';
import {
  compileScalar,
  compileScalarGradient,
  derivative,
  gradientAt,
  numericJacobian,
  scalar,
  ScalarEvalError,
  scalarToNode,
} from '../src/index.js';
import { compileScalarGradient as gradFromCompile } from '../src/scalar-compile.js';

function relClose(actual: number, expected: number, relTol: number): void {
  const scale = Math.max(1, Math.abs(expected));
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(relTol * scale);
}

function evalSymbolicGrad(node: ScalarNode, param: string, scope: Record<string, number>): number {
  const expr = derivative(scalarToNode(node), param) as MathNode;
  return expr.evaluate(scope) as number;
}

describe('compileScalarGradient', () => {
  it('re-exports compileScalarGradient from the package index', () => {
    expect(gradFromCompile).toBe(compileScalarGradient);
  });

  it('throws on duplicate parameter names at compile time', () => {
    const node = scalar.symbol('a');
    expect(() => compileScalarGradient(node, { variables: [], parameters: ['a', 'a'] })).toThrow(
      ScalarEvalError
    );
    expect(() => compileScalarGradient(node, { variables: [], parameters: ['a', 'a'] })).toThrow(
      /compileScalarGradient:.*more than once/
    );
  });

  describe('hand closed forms', () => {
    it('a*x+b at x=3,a=2,b=-1', () => {
      const node = scalar.op('+', [
        scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]),
        scalar.symbol('b'),
      ]);
      const g = compileScalarGradient(node, { variables: ['x'], parameters: ['a', 'b'] });
      const { values, grad } = g.evaluate([new Float64Array([3])], [2, -1]);
      expect(values[0]).toBe(5);
      expect(grad[0]).toBe(3);
      expect(grad[1]).toBe(1);
    });

    it('a*x*x → grad a is x^2', () => {
      const node = scalar.op('*', [scalar.symbol('a'), scalar.symbol('x'), scalar.symbol('x')]);
      const g = compileScalarGradient(node, { variables: ['x'], parameters: ['a'] });
      const { grad } = g.evaluate([new Float64Array([4])], [2]);
      expect(grad[0]).toBe(16);
    });

    it('exp(a*x) → grad a is exp(a*x)*x', () => {
      const node = scalar.call('exp', scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]));
      const g = compileScalarGradient(node, { variables: ['x'], parameters: ['a'] });
      const a = 1.5;
      const x = 2;
      const { values, grad } = g.evaluate([new Float64Array([x])], [a]);
      const expected = Math.exp(a * x) * x;
      relClose(grad[0], expected, 1e-12);
      relClose(values[0], Math.exp(a * x), 1e-12);
    });

    it('sin(a) → grad a is cos(a)', () => {
      const node = scalar.call('sin', scalar.symbol('a'));
      const g = compileScalarGradient(node, { variables: [], parameters: ['a'] });
      const a = 0.7;
      const { grad } = g.evaluate([], [a]);
      relClose(grad[0], Math.cos(a), 1e-12);
    });

    it('a^2 at a=3 → 6; at a=-2 → -4', () => {
      const node = scalar.op('^', [scalar.symbol('a'), scalar.number(2)]);
      const g = compileScalarGradient(node, { variables: [], parameters: ['a'] });
      expect(g.evaluate([], [3]).grad[0]).toBe(6);
      expect(g.evaluate([], [-2]).grad[0]).toBe(-4);
    });

    it('2^a at a=3 → 8*LN2', () => {
      const node = scalar.op('^', [scalar.number(2), scalar.symbol('a')]);
      const g = compileScalarGradient(node, { variables: [], parameters: ['a'] });
      const { grad } = g.evaluate([], [3]);
      relClose(grad[0], 8 * Math.LN2, 1e-12);
    });

    it('(a+x)/b → [1/b, -(a+x)/b^2]', () => {
      const node = scalar.op('/', [
        scalar.op('+', [scalar.symbol('a'), scalar.symbol('x')]),
        scalar.symbol('b'),
      ]);
      const g = compileScalarGradient(node, {
        variables: ['x'],
        parameters: ['a', 'b'],
      });
      const a = 1;
      const x = 2;
      const b = 3;
      const { grad } = g.evaluate([new Float64Array([x])], [a, b]);
      relClose(grad[0], 1 / b, 1e-12);
      relClose(grad[1], -(a + x) / (b * b), 1e-12);
    });

    const loweredCases: Array<{
      fn: Parameters<typeof scalar.call>[0];
      x: number;
      deriv: (x: number, y: number) => number;
    }> = [
      { fn: 'exp', x: 0.5, deriv: (_x, y) => y },
      { fn: 'ln', x: 2, deriv: (xv) => 1 / xv },
      { fn: 'log', x: 100, deriv: (xv) => 1 / (xv * Math.LN10) },
      { fn: 'log10', x: 1000, deriv: (xv) => 1 / (xv * Math.LN10) },
      { fn: 'log2', x: 8, deriv: (xv) => 1 / (xv * Math.LN2) },
      { fn: 'sin', x: 0.3, deriv: (xv) => Math.cos(xv) },
      { fn: 'cos', x: 0.3, deriv: (xv) => -Math.sin(xv) },
      { fn: 'tan', x: 0.2, deriv: (xv) => 1 / (Math.cos(xv) * Math.cos(xv)) },
      { fn: 'sinh', x: 0.4, deriv: (xv) => Math.cosh(xv) },
      { fn: 'cosh', x: 0.4, deriv: (xv) => Math.sinh(xv) },
      { fn: 'tanh', x: 0.5, deriv: (_x, y) => 1 - y * y },
    ];

    for (const { fn, x, deriv } of loweredCases) {
      it(`lowered ${fn} at x=${x}`, () => {
        const node = scalar.call(fn, scalar.symbol('a'));
        const g = compileScalarGradient(node, { variables: [], parameters: ['a'] });
        const primal = compileScalar(node, { variables: [], parameters: ['a'] }).evaluateRow(
          [],
          [x]
        );
        const { grad } = g.evaluate([], [x]);
        relClose(grad[0], deriv(x, primal), 1e-12);
      });
    }

    it('abs(-3) → -1; abs(0) → 0', () => {
      const node = scalar.call('abs', scalar.symbol('a'));
      const g = compileScalarGradient(node, { variables: [], parameters: ['a'] });
      expect(g.evaluate([], [-3]).grad[0]).toBe(-1);
      expect(g.evaluate([], [0]).grad[0]).toBe(0);
    });

    it('matches gradientAt for a*sin(0.3)', () => {
      const node = scalar.op('*', [scalar.symbol('a'), scalar.call('sin', scalar.number(0.3))]);
      const g = compileScalarGradient(node, { variables: [], parameters: ['a'] });
      const a0 = 1.7;
      const tapeGrad = g.evaluate([], [a0]).grad[0];
      const dualGrad = gradientAt(([aa]) => aa.mul(new Dual(Math.sin(0.3), 0)), [a0])[0];
      expect(tapeGrad).toBe(dualGrad);
    });
  });

  describe('symbolic derivative oracle', () => {
    const scope = { a: 1.2, b: -0.4, x: 2.1, c: 0.5 };

    it('sin(a)*exp(b*x)', () => {
      const node = scalar.op('*', [
        scalar.call('sin', scalar.symbol('a')),
        scalar.call('exp', scalar.op('*', [scalar.symbol('b'), scalar.symbol('x')])),
      ]);
      const g = compileScalarGradient(node, {
        variables: ['x'],
        parameters: ['a', 'b'],
      });
      const { grad } = g.evaluate([new Float64Array([scope.x])], [scope.a, scope.b]);
      relClose(grad[0], evalSymbolicGrad(node, 'a', scope), 1e-12);
      relClose(grad[1], evalSymbolicGrad(node, 'b', scope), 1e-12);
    });

    it('log(a*x) with a*x>0', () => {
      const node = scalar.call('ln', scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]));
      const g = compileScalarGradient(node, { variables: ['x'], parameters: ['a'] });
      const { grad } = g.evaluate([new Float64Array([scope.x])], [scope.a]);
      relClose(grad[0], evalSymbolicGrad(node, 'a', scope), 1e-12);
    });

    it('tanh(a)+cosh(b)', () => {
      const node = scalar.op('+', [
        scalar.call('tanh', scalar.symbol('a')),
        scalar.call('cosh', scalar.symbol('b')),
      ]);
      const g = compileScalarGradient(node, { variables: [], parameters: ['a', 'b'] });
      const { grad } = g.evaluate([], [scope.a, scope.b]);
      relClose(grad[0], evalSymbolicGrad(node, 'a', scope), 1e-12);
      relClose(grad[1], evalSymbolicGrad(node, 'b', scope), 1e-12);
    });

    it('n-ary a+b+c', () => {
      const node = scalar.op('+', [scalar.symbol('a'), scalar.symbol('b'), scalar.symbol('c')]);
      const g = compileScalarGradient(node, { variables: [], parameters: ['a', 'b', 'c'] });
      const { grad } = g.evaluate([], [scope.a, scope.b, scope.c]);
      relClose(grad[0], evalSymbolicGrad(node, 'a', scope), 1e-12);
      relClose(grad[1], evalSymbolicGrad(node, 'b', scope), 1e-12);
      relClose(grad[2], evalSymbolicGrad(node, 'c', scope), 1e-12);
    });
  });

  describe('numericJacobian oracle', () => {
    it('linear model at one row', () => {
      const node = scalar.op('+', [
        scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]),
        scalar.symbol('b'),
      ]);
      const columns = [new Float64Array([3])];
      const params = [2, -1];
      const g = compileScalarGradient(node, { variables: ['x'], parameters: ['a', 'b'] });
      const { grad } = g.evaluate(columns, params);
      const J = numericJacobian(
        (p) => [
          compileScalar(node, { variables: ['x'], parameters: ['a', 'b'] }).evaluate(columns, p)
            .values[0]!,
        ],
        params
      );
      relClose(grad[0], J[0]![0]!, 1e-6);
      relClose(grad[1], J[0]![1]!, 1e-6);
    });

    it('exp(a*x)+b at one row', () => {
      const node = scalar.op('+', [
        scalar.call('exp', scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')])),
        scalar.symbol('b'),
      ]);
      const columns = [new Float64Array([1.1])];
      const params = [0.5, -0.2];
      const g = compileScalarGradient(node, { variables: ['x'], parameters: ['a', 'b'] });
      const { grad } = g.evaluate(columns, params);
      const J = numericJacobian(
        (p) => [
          compileScalar(node, { variables: ['x'], parameters: ['a', 'b'] }).evaluate(columns, p)
            .values[0]!,
        ],
        params
      );
      relClose(grad[0], J[0]![0]!, 1e-6);
      relClose(grad[1], J[0]![1]!, 1e-6);
    });
  });

  describe('edge cases from M6 table', () => {
    it('0^0 constants: value 1, grad 0', () => {
      const node = scalar.op('^', [scalar.number(0), scalar.number(0)]);
      const g = compileScalarGradient(node, { variables: [], parameters: ['a'] });
      const { values, valid, grad } = g.evaluate([], [1]);
      expect(valid[0]).toBe(1);
      expect(values[0]).toBe(1);
      expect(grad[0]).toBe(0);
    });

    it('0^0 with parameter base invalidates row', () => {
      const node = scalar.op('^', [scalar.symbol('a'), scalar.number(0)]);
      const g = compileScalarGradient(node, { variables: [], parameters: ['a'] });
      const m3 = compileScalar(node, { variables: [], parameters: ['a'] }).evaluate([], [0]);
      expect(m3.valid[0]).toBe(1);
      expect(m3.values[0]).toBe(1);
      const m6 = g.evaluate([], [0]);
      expect(m6.valid[0]).toBe(0);
      expect(Number.isNaN(m6.values[0])).toBe(true);
      expect(Number.isNaN(m6.grad[0])).toBe(true);
    });

    it('(-2)^2 with exp parameter: invalid', () => {
      const node = scalar.op('^', [scalar.number(-2), scalar.symbol('a')]);
      const g = compileScalarGradient(node, { variables: [], parameters: ['a'] });
      const m3 = compileScalar(node, { variables: [], parameters: ['a'] }).evaluate([], [2]);
      expect(m3.values[0]).toBe(4);
      const m6 = g.evaluate([], [2]);
      expect(m6.valid[0]).toBe(0);
      expect(Number.isNaN(m6.values[0])).toBe(true);
    });

    it('(-2)^2 with base parameter only: grad -4', () => {
      const node = scalar.op('^', [scalar.symbol('a'), scalar.number(2)]);
      const g = compileScalarGradient(node, { variables: [], parameters: ['a'] });
      const { values, valid, grad } = g.evaluate([], [-2]);
      expect(valid[0]).toBe(1);
      expect(values[0]).toBe(4);
      expect(grad[0]).toBe(-4);
    });

    it('log(0) invalidates grad', () => {
      const node = scalar.call('ln', scalar.symbol('a'));
      const g = compileScalarGradient(node, { variables: [], parameters: ['a'] });
      const { valid, grad } = g.evaluate([], [0]);
      expect(valid[0]).toBe(0);
      expect(Number.isNaN(grad[0])).toBe(true);
    });

    it('bare parameter NaN: valid value, grad seed 1', () => {
      const node = scalar.symbol('a');
      const g = compileScalarGradient(node, { variables: [], parameters: ['a'] });
      const nan = Number.NaN;
      const { values, valid, grad } = g.evaluate([], [nan]);
      expect(valid[0]).toBe(1);
      expect(Object.is(values[0], nan)).toBe(true);
      expect(grad[0]).toBe(1);
    });

    it('parameter absent from tree → lane 0', () => {
      const node = scalar.symbol('x');
      const g = compileScalarGradient(node, { variables: ['x'], parameters: ['a', 'b'] });
      const { grad } = g.evaluate([new Float64Array([5])], [1, 2]);
      expect(grad[0]).toBe(0);
      expect(grad[1]).toBe(0);
    });

    it('nParams===0 → grad.length===0', () => {
      const node = scalar.op('*', [scalar.symbol('x'), scalar.symbol('x')]);
      const g = compileScalarGradient(node, { variables: ['x'], parameters: [] });
      const { grad, values } = g.evaluate([new Float64Array([3])], []);
      expect(grad.length).toBe(0);
      const m3 = compileScalar(node, { variables: ['x'] }).evaluate([new Float64Array([3])]);
      expect(Object.is(values[0], m3.values[0])).toBe(true);
    });

    it('empty columns → one row', () => {
      const node = scalar.symbol('a');
      const g = compileScalarGradient(node, { variables: [], parameters: ['a'] });
      const { values, grad } = g.evaluate([], [7]);
      expect(values.length).toBe(1);
      expect(grad.length).toBe(1);
      expect(values[0]).toBe(7);
    });

    it('d(x)/da = 0 for column x', () => {
      const node = scalar.symbol('x');
      const g = compileScalarGradient(node, { variables: ['x'], parameters: ['a'] });
      expect(g.evaluate([new Float64Array([2])], [5]).grad[0]).toBe(0);
    });

    it('reuses out values and grad buffers', () => {
      const node = scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]);
      const g = compileScalarGradient(node, { variables: ['x'], parameters: ['a'] });
      const outV = new Float64Array(1);
      const outG = new Float64Array(1);
      const r = g.evaluate([new Float64Array([4])], [3], { values: outV, grad: outG });
      expect(r.values).toBe(outV);
      expect(r.grad).toBe(outG);
      expect(outV[0]).toBe(12);
      expect(outG[0]).toBe(4);
    });
  });

  describe('bit-identity with compileScalar (non-EXTRA rows)', () => {
    const cases: Array<{
      name: string;
      node: ScalarNode;
      options: { variables: string[]; parameters?: string[] };
      columns: Float64Array[];
      params?: number[];
      extra?: boolean;
    }> = [
      {
        name: 'ax+b',
        node: scalar.op('+', [
          scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]),
          scalar.symbol('b'),
        ]),
        options: { variables: ['x'], parameters: ['a', 'b'] },
        columns: [new Float64Array([3])],
        params: [2, -1],
      },
      {
        name: 'power smooth (-2)^2 base param',
        node: scalar.op('^', [scalar.symbol('a'), scalar.number(2)]),
        options: { variables: [], parameters: ['a'] },
        columns: [],
        params: [-2],
      },
      {
        name: 'ln invalid at 0',
        node: scalar.call('ln', scalar.symbol('x')),
        options: { variables: ['x'] },
        columns: [new Float64Array([0])],
      },
    ];

    for (const c of cases) {
      it(c.name, () => {
        const prim = compileScalar(c.node, c.options);
        const grad = compileScalarGradient(c.node, c.options);
        const p = prim.evaluate(c.columns, c.params);
        const g = grad.evaluate(c.columns, c.params ?? []);
        for (let r = 0; r < p.values.length; r++) {
          expect(g.valid[r]).toBe(p.valid[r]);
          expect(Object.is(g.values[r], p.values[r])).toBe(true);
        }
      });
    }
  });
});
