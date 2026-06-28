import { describe, it, expect } from 'vitest';
import type { MathNode } from '../src/node/Node.js';
import { createEvaluate, compileExpression } from '../src/evaluator/evaluate.js';

/**
 * These tests use a minimal mock parser that handles simple expressions.
 * This validates the evaluator wiring without needing the full factory-based parser.
 *
 * The mock parser produces AST nodes matching the same structure as createParse.
 */

function constantNode(value: unknown): MathNode {
  return { type: 'ConstantNode', isConstantNode: true, value } as unknown as MathNode;
}

function symbolNode(name: string): MathNode {
  return { type: 'SymbolNode', isSymbolNode: true, name } as unknown as MathNode;
}

function operatorNode(op: string, fn: string, args: unknown[]): MathNode {
  return { type: 'OperatorNode', isOperatorNode: true, op, fn, args } as unknown as MathNode;
}

function functionNode(fnName: string, args: unknown[]): MathNode {
  return {
    type: 'FunctionNode',
    isFunctionNode: true,
    fn: symbolNode(fnName),
    args,
    get name() {
      return fnName;
    },
  } as unknown as MathNode;
}

/**
 * A minimal mock parser that handles:
 * - Numbers: '42', '3.14'
 * - Simple binary ops: 'a + b', 'a * b' (single operator, no precedence)
 * - Function calls: 'fn(arg)' (single argument)
 * - Symbols: 'pi', 'x'
 */
function createMockParser() {
  return function mockParse(expr: string): MathNode {
    expr = expr.trim();

    // Number
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
      return constantNode(parseFloat(expr));
    }

    // Function call: fn(...)
    const fnMatch = expr.match(/^(\w+)\((.+)\)$/);
    if (fnMatch) {
      const fnName = fnMatch[1];
      const argStr = fnMatch[2];
      // Simple single-arg parsing
      const arg = mockParse(argStr);
      return functionNode(fnName, [arg]);
    }

    // Binary operators (simple left-to-right, no precedence)
    const opMap: Record<string, string> = {
      '+': 'add',
      '-': 'subtract',
      '*': 'multiply',
      '/': 'divide',
      '^': 'pow',
    };
    for (const [op, fn] of Object.entries(opMap)) {
      // Find the operator not inside parentheses
      let depth = 0;
      for (let i = expr.length - 1; i >= 0; i--) {
        if (expr[i] === ')') depth++;
        else if (expr[i] === '(') depth--;
        else if (depth === 0 && expr[i] === op && i > 0) {
          const left = mockParse(expr.substring(0, i));
          const right = mockParse(expr.substring(i + 1));
          return operatorNode(op, fn, [left, right]);
        }
      }
    }

    // Symbol
    if (/^\w+$/.test(expr)) {
      return symbolNode(expr);
    }

    throw new Error(`Mock parser cannot handle: "${expr}"`);
  };
}

const mathScope: Record<string, unknown> = {
  add: (a: number, b: number) => a + b,
  subtract: (a: number, b: number) => a - b,
  multiply: (a: number, b: number) => a * b,
  divide: (a: number, b: number) => a / b,
  pow: (a: number, b: number) => Math.pow(a, b),
  sin: Math.sin,
  cos: Math.cos,
  sqrt: Math.sqrt,
  abs: Math.abs,
  pi: Math.PI,
  e: Math.E,
};

describe('createEvaluate', () => {
  const parse = createMockParser();
  const evaluate = createEvaluate(parse, mathScope);

  it('should evaluate a number', () => {
    expect(evaluate('42')).toBe(42);
  });

  it('should evaluate a float', () => {
    expect(evaluate('3.14')).toBeCloseTo(3.14);
  });

  it('should evaluate addition', () => {
    expect(evaluate('2+3')).toBe(5);
  });

  it('should evaluate subtraction', () => {
    expect(evaluate('10-4')).toBe(6);
  });

  it('should evaluate multiplication', () => {
    expect(evaluate('3*7')).toBe(21);
  });

  it('should evaluate division', () => {
    expect(evaluate('15/3')).toBe(5);
  });

  it('should evaluate a symbol from math scope', () => {
    expect(evaluate('pi')).toBeCloseTo(Math.PI);
  });

  it('should evaluate a symbol from user scope', () => {
    expect(evaluate('x', { x: 42 })).toBe(42);
  });

  it('should evaluate a function call', () => {
    expect(evaluate('sqrt(16)')).toBe(4);
  });

  it('should evaluate sin(0)', () => {
    expect(evaluate('sin(0)')).toBeCloseTo(0);
  });

  it('should evaluate cos(0)', () => {
    expect(evaluate('cos(0)')).toBeCloseTo(1);
  });

  it('should evaluate nested expression: abs(-5)', () => {
    // Note: our mock parser handles this as abs(symbolNode("-5")) which won't work,
    // but abs(fn arg) where arg is parsed as a number works for negative literals
    expect(evaluate('abs(-5)')).toBe(5);
  });

  it('should evaluate with user scope variable in expression', () => {
    expect(evaluate('x+1', { x: 41 })).toBe(42);
  });

  it('should evaluate an array of expressions', () => {
    const results = evaluate(['2+3', '10-4', '3*7']);
    expect(results).toEqual([5, 6, 21]);
  });
});

describe('compileExpression', () => {
  const parse = createMockParser();

  it('should compile and evaluate a simple expression', () => {
    const compiled = compileExpression(parse, mathScope, '2+3');
    expect(compiled.evaluate()).toBe(5);
  });

  it('should allow re-evaluating with different scopes', () => {
    const compiled = compileExpression(parse, mathScope, 'x+1');
    expect(compiled.evaluate({ x: 4 })).toBe(5);
    expect(compiled.evaluate({ x: 9 })).toBe(10);
    expect(compiled.evaluate({ x: 99 })).toBe(100);
  });
});
