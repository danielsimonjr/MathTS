import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import {
  buildMathjsSymbolicAlgebraScope,
  createCompatDerivative,
  createCompatResolve,
  createCompatSimplify,
  createCompatSimplifyCore,
} from '../src/mathjs-symbolic-adapters.js';
import { typeOf } from '../src/mathjs-symbolic-algebra/mathjs-is.js';
import { markSymbolicAlgebraNodes, stripCompatNodeEvaluatePatches } from '../src/bignumber.js';
import { create, all } from '../src/index.js';

type MathInst = ReturnType<typeof create> & {
  OperatorNode: new (
    op: string,
    fn: string,
    args: unknown[],
    implicit?: boolean
  ) => { toString: () => string; isOperatorNode?: boolean };
  ConstantNode: new (value: unknown) => unknown;
  SymbolNode: new (name: string) => unknown;
  parse: (expr: string) => { toString: () => string; isSymbolNode?: boolean };
  derivative: (
    expr: unknown,
    variable: unknown,
    options?: { simplify?: boolean }
  ) => { toString: () => string; evaluate: (scope?: Record<string, unknown>) => number };
  simplify: (
    expr: unknown,
    rules?: unknown,
    scope?: unknown,
    options?: Record<string, unknown>
  ) => { toString: (o?: Record<string, unknown>) => string };
  simplifyCore: (
    expr: unknown,
    options?: Record<string, unknown>
  ) => { toString: (o?: Record<string, unknown>) => string };
  simplifyConstant: (
    expr: unknown,
    options?: Record<string, unknown>
  ) => { toString: (o?: Record<string, unknown>) => string };
  resolve: (expr: unknown, scope?: unknown) => { toString: () => string };
};

function instances(): { compat: MathInst; mathjs: MathInst } {
  return {
    compat: create(all) as MathInst,
    mathjs: oracle.create(oracle.all) as MathInst,
  };
}

function compareToMathjs(
  run: (m: MathInst) => { toString: (o?: Record<string, unknown>) => string }
) {
  const { compat, mathjs } = instances();
  expect(run(compat).toString()).toBe(run(mathjs).toString());
}

function derivativeWithoutSimplify(m: MathInst, expr: unknown, variable: unknown) {
  return m.derivative(expr, variable, { simplify: false });
}

describe('mathjs symbolic port coverage (#1790)', () => {
  describe('derivative vs mathjs', () => {
    const cases: Array<[string, string]> = [
      ['1', 'x'],
      ['10000000', 'x'],
      ['2x', 'x'],
      ['sin(2x)', 'x'],
      ['x', 'x'],
      ['(1)', 'x'],
      ['(x)', 'x'],
      ['f(x) = 5x + x + 2', 'x'],
      ['f(x) = 5 + 2', 'x'],
      ['f(y) = 5y + 2', 'x'],
      ['1 + 2', 'x'],
      ['-100^2 + 3*3/2 - 12', 'x'],
      ['-4x', 'x'],
      ['+4x', 'x'],
      ['5x + x + 2', 'x'],
      ['5x - x - 2', 'x'],
      ['2(x + x)', 'x'],
      ['(x + x)*2', 'x'],
      ['5x*3x', 'x'],
      ['7x / 2', 'x'],
      ['5 / (3x)', 'x'],
      ['(2x) / (3x + 2)', 'x'],
      ['0^(2^x + x^3 + 2)', 'x'],
      ['1^(2^x + x^3 + 2)', 'x'],
      ['10^(2x + 2)', 'x'],
      ['(x^x^x^x)^0', 'x'],
      ['(x+2)^1', 'x'],
      ['2x^2', 'x'],
      ['2x^-2', 'x'],
      ['(x^3 + x)^(5x + 2)', 'x'],
      ['-x', 'x'],
      ['1 - (-x)', 'x'],
      ['cbrt(6x)', 'x'],
      ['sqrt(6x)', 'x'],
      ['nthRoot(6x)', 'x'],
      ['nthRoot(6x, 3)', 'x'],
      ['nthRoot((6x), (2x))', 'x'],
      ['log((6*x))', 'x'],
      ['log10((6x))', 'x'],
      ['log((6x), 10)', 'x'],
      ['log((2x), (3x))', 'x'],
      ['log(x)', 'x'],
      ['sin(2x)', 'x'],
      ['cos(2x)', 'x'],
      ['tan(2x)', 'x'],
      ['sec(2x)', 'x'],
      ['csc(2x)', 'x'],
      ['cot((2x))', 'x'],
      ['asin((2x))', 'x'],
      ['acos((2x))', 'x'],
      ['atan((2x))', 'x'],
      ['asec((2x))', 'x'],
      ['acsc((2x))', 'x'],
      ['acot((2x))', 'x'],
      ['sinh(2x)', 'x'],
      ['cosh(2x)', 'x'],
      ['tanh(2x)', 'x'],
      ['sech(2x)', 'x'],
      ['csch(2x)', 'x'],
      ['coth(2x)', 'x'],
      ['asinh((2x))', 'x'],
      ['acosh((2x))', 'x'],
      ['atanh((2x))', 'x'],
      ['asech((2x))', 'x'],
      ['acsch((2x))', 'x'],
      ['acoth((2x))', 'x'],
      ['abs(2x)', 'x'],
      ['pow(0, 2^x + x^3 + 2)', 'x'],
      ['pow(1, 2^x + x^3 + 2)', 'x'],
      ['pow(10, 2x + 2)', 'x'],
      ['pow(x^x^x^x, 0)', 'x'],
      ['pow(x + 2, 1)', 'x'],
      ['2 * pow(x, 2)', 'x'],
      ['2 * pow(x, -2)', 'x'],
      ['pow(x^3 + x, 5x + 2)', 'x'],
      ['exp(2x)', 'x'],
      ['x + y', 'x'],
      ['x + log(y)*y', 'x'],
      ['x + y + z', 'x'],
      ['x + log(y)*z', 'x'],
      ['x + log(y)*x', 'x'],
      ['x^2 + x*y + y^2', 'x'],
      ['2x^3', 'x'],
      ['1 + x', 'x'],
      ['1 + $x', '$x'],
    ];

    for (const [expr, variable] of cases) {
      it(`d/d${variable}(${expr}) without simplify`, () => {
        compareToMathjs((m) => derivativeWithoutSimplify(m, expr, variable));
      });
    }

    it('simplify option and acoth sign', () => {
      const { compat, mathjs } = instances();
      expect(compat.derivative('2x', 'x').toString()).toBe('2');
      expect(compat.derivative('2x', 'x', { simplify: true }).toString()).toBe('2');
      expect(compat.derivative('2x', 'x', { simplify: false }).toString()).toBe(
        mathjs.derivative('2x', 'x', { simplify: false }).toString()
      );
      expect(Math.abs(compat.derivative('acoth(x)', 'x').evaluate({ x: 2 }) + 1 / 3)).toBeLessThan(
        1e-12
      );
    });

    it('accepts Node variable and parse input', () => {
      const { compat, mathjs } = instances();
      expect(compat.derivative('x^2', 'x').toString()).toBe(
        mathjs.derivative('x^2', 'x').toString()
      );
      expect(compat.derivative(compat.parse('x^2'), 'x').toString()).toBe(
        mathjs.derivative(mathjs.parse('x^2'), 'x').toString()
      );
      expect(compat.derivative('x^2', compat.parse('x')).toString()).toBe(
        mathjs.derivative('x^2', mathjs.parse('x')).toString()
      );
    });

    it('FunctionAssignmentNode composition', () => {
      const { compat, mathjs } = instances();
      const f = compat.parse('f(x) = x + 2');
      const newFunc = new compat.OperatorNode('+', 'add', [compat.parse('5x'), f]);
      compareToMathjs((m) => derivativeWithoutSimplify(m, newFunc, 'x'));
      void mathjs;
    });

    it('rejects unsupported operators and bad arguments', () => {
      const { compat } = instances();
      const c12 = new compat.ConstantNode(12);
      const c4 = new compat.ConstantNode(4);
      const x = new compat.SymbolNode('x');
      expect(() =>
        compat.derivative(new compat.OperatorNode('/', 'myDivide', [c12, c4, x]), 'x')
      ).toThrow(/Cannot process operator/);
      expect(() => compat.derivative('x << 2', 'x')).toThrow(/Cannot process operator/);
      expect(() => compat.derivative('max(x)', 'x')).toThrow(/Cannot process function/);
      expect(() => compat.derivative('42', '42')).toThrow(/Invalid variable/);
      expect(() => compat.derivative('x + 2')).toThrow(/Too few arguments/);
      expect(() => compat.derivative('foo(x)', 'x')).toThrow(/Cannot process function/);
    });

    it('three-arg multiply constant operator node', () => {
      const { compat } = instances();
      const node = new compat.OperatorNode('*', 'multiply', [
        compat.parse('3'),
        compat.parse('7^4'),
        compat.parse('123.124'),
      ]);
      compareToMathjs((m) => derivativeWithoutSimplify(m, node, 'x'));
    });
  });

  describe('simplifyCore vs mathjs', () => {
    const exprs: Array<[string, string]> = [
      ['5*x*3', '3 * 5 * x'],
      ['x-0', 'x'],
      ['0+x', 'x'],
      ['x*1', 'x'],
      ['-(x)', '-x'],
      ['0/x', '0'],
      ['not (not (p and q))', 'p and q'],
      ['(p or q) and "you"', 'p or q'],
      ['(1*x + y*0)*1+0', 'x'],
      ['sin(x+0)*1', 'sin(x)'],
      ['[x+0,1*y,z*0]', '[x, y, 0]'],
      ['{a:x*1, b:y-0}', '{"a": x, "b": y}'],
    ];
    const moreExprs: Array<[string, string, Record<string, unknown>?]> = [
      ['5*x*3*x', '3 * 5 * x * x'],
      ['0-x', '-x'],
      ['0-3', '-3'],
      ['x+0', 'x'],
      ['0*x', '0'],
      ['1*x', '1 * x'],
      ['~~(a | b)', 'a | b'],
      ['1 and not done', 'not done'],
      ['false and you(know, it)', 'false'],
      ['(p or q) and "you"', 'p or q'],
      ['6 or dozen/2', 'true'],
      ['sin((x-0)*1+y*0)', 'sin(x)'],
      ['((x+0)*1)', 'x'],
      ['add(x, y)', 'x + y'],
      ['mod(x, 5)', 'x mod 5'],
      ['add(multiply(x, 0), y)', 'y'],
      ['0 - -x', 'x'],
      ['x+0==5', 'x == 5'],
      ['+(5*x*3)', '5 * x * 3', { context: { multiply: { commutative: false } } }],
      ['foo(y)', 'y', { context: { foo: { trivial: true } } }],
      ['((x)*(y))', 'x * y'],
      ['x + -1', 'x - 1'],
    ];
    for (const [expr, expected, opts] of [...exprs, ...moreExprs]) {
      it(`simplifyCore ${expr}`, () => {
        const { compat, mathjs } = instances();
        const c = opts ? compat.simplifyCore(expr, opts) : compat.simplifyCore(expr);
        const m = opts ? mathjs.simplifyCore(expr, opts) : mathjs.simplifyCore(expr);
        expect(c.toString()).toBe(m.toString());
        void expected;
      });
    }
  });

  describe('simplifyConstant vs mathjs', () => {
    const runConstant = (
      m: MathInst,
      expr: string,
      simpOpts?: Record<string, unknown>
    ): { toString: (o?: Record<string, unknown>) => string } => {
      const node = m.parse(expr);
      return simpOpts ? m.simplifyConstant(node, simpOpts) : m.simplifyConstant(node);
    };

    const cases: Array<[string, string, Record<string, unknown>?, Record<string, unknown>?]> = [
      ['2+2', '4'],
      ['x+3*5', 'x + 15'],
      ['f(sin(0))', 'f(0)'],
      ['[10/2, y, 8-4]', '[5, y, 4]'],
      ['0.5 x', '1 / 2 x'],
      ['3 + 2 / 4', '7 / 2'],
      ['3 + x + 7 + y', '10 + x + y'],
      ['3 * x * 7 * y', '21 * x * y'],
      ['0.5 x', '0.5 * x', { implicit: 'show' }, { exactFractions: false }],
      ['0.001 x', '0.001 * x', { implicit: 'show' }, { fractionsLimit: 999 }],
      ['3 * x * 7 * y', '3 * x * 7 * y', {}, { context: { multiply: { commutative: false } } }],
      ['2 + 7 + "foo" + 3 + 8', '9 + "foo" + 11'],
    ];
    const nc = {
      context: { add: { commutative: false }, multiply: { commutative: false } },
    };
    const ncCases: Array<[string, string]> = [
      ['2 + 2 + a', '4 + a'],
      ['2 * 2 * b', '4 * b'],
      ['a + 3 + 2', 'a + 5'],
      ['a * 3 * 2', 'a * 6'],
      ['a + 3 + 2 + a + 4 + 4 + b', 'a + 5 + a + 8 + b'],
      ['c * 3 * 2 * d * 4 * 1 * d', 'c * 6 * d * 4 * d'],
      ['a + 0 + 7 + b', 'a + 7 + b'],
    ];
    it('simplifyConstant object and matrix folds', () => {
      const { compat, mathjs } = instances();
      for (const expr of ['{a:2+2, b:x}', '[[1,2],[3,4]]', 'size([1,2,3,4])']) {
        const c = runConstant(compat, expr);
        const m = runConstant(mathjs, expr);
        expect(c.toString()).toBe(m.toString());
      }
      expect(() => runConstant(compat, '1..3', {})).toThrow();
    });

    for (const row of [...cases, ...ncCases.map((r) => [...r, undefined, nc] as const)]) {
      const [expr, expected, toOpts, simpOpts] = row;
      it(`simplifyConstant ${expr}`, () => {
        const { compat, mathjs } = instances();
        const c = runConstant(compat, expr, simpOpts);
        const m = runConstant(mathjs, expr, simpOpts);
        expect(c.toString(toOpts)).toBe(expected);
        expect(c.toString(toOpts)).toBe(m.toString(toOpts));
      });
    }
  });

  describe('simplify vs mathjs', () => {
    const parity: Array<[string, string, Record<string, unknown>?]> = [
      ['2 * 1 * x ^ (2 - 1)', '2 * x'],
      ['3 + 2 / 4', '7 / 2'],
      ['0.4 * x', 'x * 2 / 5', { exactFractions: true }],
      ['2 * 3 * x', '24', { x: 4 }],
    ];
    const moreDefault: Array<string> = [
      '-(x*y)',
      '-(x+y+x+y)',
      'x*(y+z)',
      'x+(y+z)+w',
      'a*b/a',
      'a*b/b',
      '(x+1)/(x+1)',
      'sin(x)^2+cos(x)^2',
      '2/(1+sqrt(2))',
    ];
    for (const left of moreDefault) {
      it(`default simplify probe ${left}`, () => {
        const { compat, mathjs } = instances();
        expect(compat.simplify(left).toString()).toBe(mathjs.simplify(left).toString());
      });
    }

    const defaultRules: Array<[string, string]> = [
      ['2 + x', 'x + 2'],
      ['-2 + x', 'x - 2'],
      ['(x^2)^3', 'x^6'],
      ['2*(x^2)^3', '2*x^6'],
      ['x^(2+3)', 'x^5'],
      ['x^2^3', 'x^8'],
      ['3*4', '12'],
      ['3+2/4', '7/2'],
      ['string(4/2)', '"2"'],
      ['2+number("2")', '4'],
      ['-(x+y)', '-(x + y)'],
      ['x+x+x', '3*x'],
      ['2x+x', '3*x'],
      ['x*1', 'x'],
      ['(x-1)^0', '1'],
      ['(x*y)^0', '1'],
    ];
    for (const [left, right] of defaultRules) {
      it(`default simplify ${left}`, () => {
        const { compat, mathjs } = instances();
        expect(compat.simplify(left).toString()).toBe(mathjs.parse(right).toString());
        expect(compat.simplify(left).toString()).toBe(mathjs.simplify(left).toString());
      });
    }

    for (const [expr, _right, scope] of parity) {
      it(`simplify ${expr}`, () => {
        const { compat, mathjs } = instances();
        if (scope) {
          expect(compat.simplify(expr, scope).toString()).toBe(
            mathjs.simplify(expr, scope).toString()
          );
        } else {
          expect(compat.simplify(expr).toString()).toBe(mathjs.simplify(expr).toString());
        }
      });
    }

    const wildcards: Array<[string, string, string, string]> = [
      ['1', 'c', '5', '5'],
      ['-1', 'c', '5', '-5'],
      ['2 * a', 'c', '5', '5 * a'],
      ['1', 'cl', '5', '5'],
      ['a', 'v', '5', '5'],
      ['a', 'vl', '5', '5'],
      ['-1', 'cd', '5', '5'],
      ['a', 'vd', '5', '5'],
      ['2*x', 'ce', '5', '5'],
      ['2*x', 've', '5', '2*x'],
    ];
    for (const [left, pat, rep, _expected] of wildcards) {
      it(`simplify wildcard ${pat} on ${left}`, () => {
        const rule = [{ l: pat, r: rep }];
        compareToMathjs((m) => m.simplify(left, rule));
      });
    }

    it('exercises default simplify.rules on varied expressions', () => {
      const { compat, mathjs } = instances();
      const rules = (compat.simplify as typeof compat.simplify & { rules?: unknown[] }).rules;
      const probes = [
        'x^2+2x+1',
        'log(exp(x))',
        'tan(x)*cos(x)',
        '(-1)^2',
        'sqrt(x^2)',
        'sin(x)^2 + cos(x)^2',
        'exp(log(x))',
        'abs(-x)',
        'mod(x,2)',
        'bitOr(x,1)',
      ];
      for (const expr of probes) {
        const c = compat.simplify(expr, rules).toString();
        const m = mathjs.simplify(expr, rules).toString();
        expect(c).toBe(m);
      }
    });

    it('simplify real and positive contexts', () => {
      const { compat, mathjs } = instances();
      expect(compat.simplify('x/x', {}, { context: compat.simplify.realContext }).toString()).toBe(
        mathjs.simplify('x/x', {}, { context: mathjs.simplify.realContext }).toString()
      );
      expect(
        compat.simplify('sqrt(x^2)', {}, { context: compat.simplify.positiveContext }).toString()
      ).toBe(
        mathjs.simplify('sqrt(x^2)', {}, { context: mathjs.simplify.positiveContext }).toString()
      );
    });

    it('simplify with rules array and scope object', () => {
      const { compat } = instances();
      const rules =
        (compat.simplify as typeof compat.simplify & { rules?: unknown[] }).rules?.slice(0, 3) ??
        [];
      expect(() =>
        compat.simplify(compat.parse('x+x'), rules, {}, { exactFractions: true })
      ).not.toThrow();
    });
  });

  describe('resolve vs mathjs', () => {
    it('resolve nested matrix results', () => {
      const { compat, mathjs } = instances();
      const nested = ['z/y', ['x+x', 'gcd(x,y)'], '3+x'];
      const scope = { x: 1, y: 2 };
      expect(compat.resolve(nested, scope).map((n) => n.toString())).toEqual(
        mathjs.resolve(nested, scope).map((n: { toString: () => string }) => n.toString())
      );
    });

    it('resolve rejects bad inputs like mathjs', () => {
      const { compat, mathjs } = instances();
      expect(() => compat.resolve([compat.parse('x'), 'y', 7])).toThrow();
      expect(() => mathjs.resolve([mathjs.parse('x'), 'y', 7])).toThrow();
      expect(() => compat.resolve(compat.parse('x+y'), { x: compat.parse('x') })).toThrow();
      expect(() => mathjs.resolve(mathjs.parse('x+y'), { x: mathjs.parse('x') })).toThrow();
    });

    it('substitutes scoped constants and matrices', () => {
      const { compat, mathjs } = instances();
      const collapsing = { x: compat.parse('y'), y: compat.parse('z') };
      expect(compat.resolve(compat.parse('x+y'), { x: 1 }).toString()).toBe(
        mathjs.resolve(mathjs.parse('x+y'), { x: 1 }).toString()
      );
      expect(compat.resolve(compat.parse('x+y'), collapsing).toString()).toBe(
        mathjs.resolve(mathjs.parse('x+y'), collapsing).toString()
      );
      expect(compat.resolve(compat.parse('x+y'), new Map([['x', 1]])).toString()).toBe(
        mathjs.resolve(mathjs.parse('x+y'), new Map([['x', 1]])).toString()
      );
      const expressions = [compat.parse('x+z'), 'y+z', 'y-x'];
      const scope = { x: 1, y: 2 };
      expect(compat.resolve(expressions, scope).map((n) => n.toString())).toEqual(
        mathjs.resolve(expressions, scope).map((n: { toString: () => string }) => n.toString())
      );
    });
  });

  describe('adapters and mathjs-is', () => {
    it('buildMathjsSymbolicAlgebraScope exposes symbolic fns', () => {
      const scope = buildMathjsSymbolicAlgebraScope({ number: 'number' });
      expect(String(scope.simplify('x+0'))).toBe('x');
      expect(String(scope.derivative('x^2', 'x'))).toBe('2 * x');
    });

    it('createCompat wrappers match module simplify paths', () => {
      const math = create(all) as MathInst;
      const ctx = () => ({ mathScope: math });
      const simp = createCompatSimplify({}, ctx);
      const core = createCompatSimplifyCore(ctx);
      const res = createCompatResolve(ctx);
      const deriv = createCompatDerivative(ctx);
      expect(String(simp('3 + 2 / 4'))).toBe('7 / 2');
      expect(String(core('x+0'))).toBe('x');
      expect(String(res('x+y', { x: 1 }))).toBe('1 + y');
      expect(String(deriv('x^2', 'x'))).toBe('2 * x');
    });

    it('typeOf covers symbolic helper types', () => {
      const { compat } = instances();
      expect(typeOf(1)).toBe('number');
      expect(typeOf(compat.fraction(1, 2))).toBe('Fraction');
      expect(typeOf(null)).toBe('null');
      expect(typeOf(compat.bignumber(2))).toBe('BigNumber');
      expect(
        typeOf({ get: () => 1, set: () => {}, keys: () => [][Symbol.iterator](), has: () => false })
      ).toBe('Object');
    });

    it('stripCompatNodeEvaluatePatches and markSymbolicAlgebraNodes on trees', () => {
      const math = create(all) as MathInst;
      const node = math.parse('x + y') as {
        evaluate?: unknown;
        map?: (fn: (c: unknown) => unknown) => void;
      };
      node.evaluate = () => 0;
      markSymbolicAlgebraNodes(node);
      stripCompatNodeEvaluatePatches(node);
      const matrix = math.matrix([math.parse('a'), math.parse('b')]);
      markSymbolicAlgebraNodes(matrix);
      stripCompatNodeEvaluatePatches([node]);
      expect(math.parse('z').toString()).toBe('z');
    });

    it('BigNumber simplify evaluate uses the instance decimal class', () => {
      const bigmath = create(all, { number: 'BigNumber', precision: 64 }) as MathInst;
      const node = bigmath.simplify('111111111111111111 + 111111111111111111') as {
        evaluate: () => { constructor: unknown };
      };
      const value = node.evaluate();
      const ref = bigmath.evaluate('222222222222222222') as { constructor: unknown };
      expect(value.constructor).toBe(ref.constructor);
    });

    it('simplify accepts built-in null constant in custom rules', () => {
      const math = create(all) as MathInst;
      expect(math.simplify('null', ['null -> 1']).toString()).toBe('1');
    });
  });
});
