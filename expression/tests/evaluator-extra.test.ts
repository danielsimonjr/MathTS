import { describe, it, expect } from 'vitest';
import { createEvaluate, compileExpression } from '../src/evaluator/evaluate.js';

/**
 * Covers the validateAst recursion branches in evaluator/evaluate.ts:
 *  - the real `node.forEach` traversal path (lines ~83-89)
 *  - the ObjectNode `properties` recursion (line ~116)
 *  - security rejections surfacing through forEach
 */

function constantNode(value: unknown) {
  return { type: 'ConstantNode', isConstantNode: true, value };
}

const mathScope: Record<string, unknown> = {
  add: (a: number, b: number) => a + b,
};

describe('evaluator validateAst - forEach traversal path', () => {
  it('walks children via a real forEach and evaluates', () => {
    // A node exposing forEach (the production AST shape). The forEach visits a
    // single safe child constant.
    function parse(_expr: string) {
      const child = constantNode(5);
      return {
        isOperatorNode: true,
        fn: 'add',
        args: [child, constantNode(0)],
        forEach(cb: (c: unknown) => void) {
          cb(child);
          cb(constantNode(0));
        },
      };
    }
    const evaluate = createEvaluate(parse, mathScope);
    expect(evaluate('anything')).toBe(5);
  });

  it('re-throws Security errors raised during forEach traversal', () => {
    function parse(_expr: string) {
      return {
        isOperatorNode: true,
        fn: 'add',
        args: [],
        forEach(cb: (c: unknown) => void) {
          // a child that is a forbidden assignment node
          cb({ isAssignmentNode: true });
        },
      };
    }
    const evaluate = createEvaluate(parse, mathScope);
    expect(() => evaluate('x = 1')).toThrow(/Security: assignment/);
  });

  it('absorbs non-security errors thrown by forEach and falls back to manual recursion', () => {
    function parse(_expr: string) {
      const child = constantNode(9);
      return {
        isOperatorNode: true,
        fn: 'add',
        args: [child, constantNode(0)],
        forEach() {
          throw new Error('forEach incompatibility');
        },
      };
    }
    const evaluate = createEvaluate(parse, mathScope);
    // forEach throws a non-Security error -> absorbed; manual recursion over
    // args proceeds and compile/evaluate still works.
    expect(evaluate('add(9,0)')).toBe(9);
  });
});

describe('evaluator validateAst - properties recursion (ObjectNode)', () => {
  it('recurses into object properties and rejects forbidden calls inside', () => {
    function parse(_expr: string) {
      return {
        isObjectNode: true,
        properties: {
          danger: { isFunctionNode: true, fn: { isSymbolNode: true, name: 'import' } },
        },
      };
    }
    const evaluate = createEvaluate(parse, mathScope);
    expect(() => evaluate('{danger: import(1)}')).toThrow(/forbidden function "import"/);
  });
});

describe('evaluator - function-assignment & forbidden-function rejections', () => {
  it('rejects FunctionAssignmentNode by default', () => {
    function parse(_expr: string) {
      return { isFunctionAssignmentNode: true };
    }
    const evaluate = createEvaluate(parse, mathScope);
    expect(() => evaluate('f(x)=x')).toThrow(/function definitions/);
  });

  it('allows opting out of validation with { unsafe: true }', () => {
    function parse(_expr: string) {
      return { isConstantNode: true, value: 42 };
    }
    const evaluate = createEvaluate(parse, mathScope);
    expect(evaluate('42', undefined, { unsafe: true })).toBe(42);
  });
});

describe('compileExpression - validation', () => {
  it('validates by default and rejects assignments', () => {
    function parse(_expr: string) {
      return { isAssignmentNode: true };
    }
    expect(() => compileExpression(parse, mathScope, 'x = 1')).toThrow(/Security: assignment/);
  });

  it('skips validation when unsafe is set', () => {
    function parse(_expr: string) {
      return { isConstantNode: true, value: 3 };
    }
    const compiled = compileExpression(parse, mathScope, '3', { unsafe: true });
    expect(compiled.evaluate()).toBe(3);
  });
});
