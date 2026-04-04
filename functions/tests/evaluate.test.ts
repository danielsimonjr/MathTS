import { describe, it, expect } from 'vitest';
import { evaluate, compileExpr, parse } from '../src/factories/evaluate.js';

describe('evaluate()', () => {
  describe('arithmetic operators', () => {
    it('addition: 2 + 3 = 5', () => {
      expect(evaluate('2 + 3')).toBe(5);
    });

    it('subtraction: 10 - 4 = 6', () => {
      expect(evaluate('10 - 4')).toBe(6);
    });

    it('multiplication: 3 * 4 = 12', () => {
      expect(evaluate('3 * 4')).toBe(12);
    });

    it('division: 15 / 3 = 5', () => {
      expect(evaluate('15 / 3')).toBe(5);
    });

    it('power: 2 ^ 10 = 1024', () => {
      expect(evaluate('2 ^ 10')).toBe(1024);
    });

    it('unary minus: -5', () => {
      expect(evaluate('-5')).toBe(-5);
    });

    it('nested arithmetic: (2 + 3) * 4 = 20', () => {
      expect(evaluate('(2 + 3) * 4')).toBe(20);
    });

    it('chained: 1 + 2 + 3 + 4 = 10', () => {
      expect(evaluate('1 + 2 + 3 + 4')).toBe(10);
    });
  });

  describe('math functions', () => {
    it('sqrt(16) = 4', () => {
      expect(evaluate('sqrt(16)')).toBe(4);
    });

    it('abs(-5) = 5', () => {
      expect(evaluate('abs(-5)')).toBe(5);
    });

    it('sin(0) = 0', () => {
      expect(evaluate('sin(0)')).toBeCloseTo(0);
    });

    it('cos(0) = 1', () => {
      expect(evaluate('cos(0)')).toBeCloseTo(1);
    });

    it('tan(0) = 0', () => {
      expect(evaluate('tan(0)')).toBeCloseTo(0);
    });

    it('exp(0) = 1', () => {
      expect(evaluate('exp(0)')).toBeCloseTo(1);
    });

    it('log(1) = 0', () => {
      expect(evaluate('log(1)')).toBeCloseTo(0);
    });

    it('pow(2, 8) = 256', () => {
      expect(evaluate('pow(2, 8)')).toBe(256);
    });
  });

  describe('math constants', () => {
    it('pi ≈ 3.14159', () => {
      expect(evaluate('pi')).toBeCloseTo(Math.PI);
    });

    it('e ≈ 2.71828', () => {
      expect(evaluate('e')).toBeCloseTo(Math.E);
    });

    it('tau = 2 * pi', () => {
      expect(evaluate('tau')).toBeCloseTo(2 * Math.PI);
    });
  });

  describe('variable bindings', () => {
    it('x + 1 with x=5 → 6', () => {
      expect(evaluate('x + 1', { x: 5 })).toBe(6);
    });

    it('a * b with a=3, b=4 → 12', () => {
      expect(evaluate('a * b', { a: 3, b: 4 })).toBe(12);
    });

    it('x^2 + y with x=3, y=2 → 11', () => {
      expect(evaluate('x^2 + y', { x: 3, y: 2 })).toBe(11);
    });

    it('sin(x) with x=0 → 0', () => {
      expect(evaluate('sin(x)', { x: 0 })).toBeCloseTo(0);
    });
  });

  describe('expression arrays', () => {
    it('evaluates array of expressions', () => {
      const results = evaluate(['1 + 1', '2 * 3', 'sqrt(9)']);
      expect(results).toEqual([2, 6, 3]);
    });
  });
});

describe('compileExpr()', () => {
  it('compiles and evaluates a simple expression', () => {
    const compiled = compileExpr('x^2 + y');
    expect(compiled.evaluate({ x: 2, y: 1 })).toBe(5);
    expect(compiled.evaluate({ x: 3, y: 2 })).toBe(11);
  });

  it('reuses the same compiled expression efficiently', () => {
    const compiled = compileExpr('a + b');
    expect(compiled.evaluate({ a: 1, b: 2 })).toBe(3);
    expect(compiled.evaluate({ a: 10, b: 20 })).toBe(30);
    expect(compiled.evaluate({ a: -5, b: 5 })).toBe(0);
  });
});

describe('parse()', () => {
  it('parses an expression into an AST node', () => {
    const node = parse('2 + 3');
    expect(node).toBeDefined();
    expect(node.type).toBe('OperatorNode');
  });

  it('parsed node has correct structure', () => {
    const node = parse('sin(pi)') as any;
    expect(node.type).toBe('FunctionNode');
    expect(node.fn.name).toBe('sin');
  });
});
