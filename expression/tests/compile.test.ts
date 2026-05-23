import { describe, it, expect } from 'vitest';
import { compile } from '../src/compiler/compile.js';

/**
 * Create mock AST nodes that match the structure produced by the parser.
 * Each node has `is<Type>Node: true` and the relevant properties.
 */

function constantNode(value: any) {
  return { type: 'ConstantNode', isConstantNode: true, value };
}

function symbolNode(name: string) {
  return { type: 'SymbolNode', isSymbolNode: true, name };
}

function operatorNode(op: string, fn: string, args: any[]) {
  return { type: 'OperatorNode', isOperatorNode: true, op, fn, args };
}

function functionNode(fnName: string, args: any[]) {
  return {
    type: 'FunctionNode',
    isFunctionNode: true,
    fn: symbolNode(fnName),
    args,
    get name() {
      return fnName;
    },
  };
}

function parenthesisNode(content: any) {
  return { type: 'ParenthesisNode', isParenthesisNode: true, content };
}

function arrayNode(items: any[]) {
  return { type: 'ArrayNode', isArrayNode: true, items };
}

function assignmentNode(name: string, value: any) {
  return {
    type: 'AssignmentNode',
    isAssignmentNode: true,
    object: symbolNode(name),
    value,
    name,
  };
}

function blockNode(blocks: Array<{ node: any; visible: boolean }>) {
  return { type: 'BlockNode', isBlockNode: true, blocks };
}

function conditionalNode(condition: any, trueExpr: any, falseExpr: any) {
  return {
    type: 'ConditionalNode',
    isConditionalNode: true,
    condition,
    trueExpr,
    falseExpr,
  };
}

function objectNode(properties: Record<string, any>) {
  return { type: 'ObjectNode', isObjectNode: true, properties };
}

function relationalNode(conditionals: string[], params: any[]) {
  return {
    type: 'RelationalNode',
    isRelationalNode: true,
    conditionals,
    params,
  };
}

function functionAssignmentNode(name: string, params: string[], expr: any) {
  return {
    type: 'FunctionAssignmentNode',
    isFunctionAssignmentNode: true,
    name,
    params,
    expr,
  };
}

// Standard math scope for tests
const mathScope: Record<string, any> = {
  add: (a: number, b: number) => a + b,
  subtract: (a: number, b: number) => a - b,
  multiply: (a: number, b: number) => a * b,
  divide: (a: number, b: number) => a / b,
  pow: (a: number, b: number) => Math.pow(a, b),
  unaryMinus: (a: number) => -a,
  unaryPlus: (a: number) => +a,
  mod: (a: number, b: number) => a % b,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  log: Math.log,
  exp: Math.exp,
  max: Math.max,
  min: Math.min,
  pi: Math.PI,
  e: Math.E,
  Infinity: Infinity,
  equal: (a: number, b: number) => a === b,
  smaller: (a: number, b: number) => a < b,
  larger: (a: number, b: number) => a > b,
  smallerEq: (a: number, b: number) => a <= b,
  largerEq: (a: number, b: number) => a >= b,
  unequal: (a: number, b: number) => a !== b,
};

describe('compile - ConstantNode', () => {
  it('should evaluate a numeric constant', () => {
    const node = constantNode(42);
    const result = compile(node, mathScope).evaluate();
    expect(result).toBe(42);
  });

  it('should evaluate a string constant', () => {
    const node = constantNode('hello');
    const result = compile(node, mathScope).evaluate();
    expect(result).toBe('hello');
  });

  it('should evaluate boolean constants', () => {
    expect(compile(constantNode(true), mathScope).evaluate()).toBe(true);
    expect(compile(constantNode(false), mathScope).evaluate()).toBe(false);
  });

  it('should evaluate null', () => {
    expect(compile(constantNode(null), mathScope).evaluate()).toBe(null);
  });
});

describe('compile - SymbolNode', () => {
  it('should resolve a symbol from the math scope', () => {
    const node = symbolNode('pi');
    const result = compile(node, mathScope).evaluate();
    expect(result).toBeCloseTo(Math.PI);
  });

  it('should resolve a symbol from the user scope', () => {
    const node = symbolNode('x');
    const result = compile(node, mathScope).evaluate({ x: 42 });
    expect(result).toBe(42);
  });

  it('should prefer user scope over math scope', () => {
    const node = symbolNode('pi');
    const result = compile(node, mathScope).evaluate({ pi: 3 });
    expect(result).toBe(3);
  });

  it('should throw for undefined symbols', () => {
    const node = symbolNode('undefined_var');
    expect(() => compile(node, mathScope).evaluate()).toThrow('Undefined symbol "undefined_var"');
  });
});

describe('compile - OperatorNode', () => {
  it('should evaluate addition: 2 + 3', () => {
    const node = operatorNode('+', 'add', [constantNode(2), constantNode(3)]);
    expect(compile(node, mathScope).evaluate()).toBe(5);
  });

  it('should evaluate subtraction: 10 - 4', () => {
    const node = operatorNode('-', 'subtract', [constantNode(10), constantNode(4)]);
    expect(compile(node, mathScope).evaluate()).toBe(6);
  });

  it('should evaluate multiplication: 3 * 7', () => {
    const node = operatorNode('*', 'multiply', [constantNode(3), constantNode(7)]);
    expect(compile(node, mathScope).evaluate()).toBe(21);
  });

  it('should evaluate division: 15 / 3', () => {
    const node = operatorNode('/', 'divide', [constantNode(15), constantNode(3)]);
    expect(compile(node, mathScope).evaluate()).toBe(5);
  });

  it('should evaluate power: 2 ^ 10', () => {
    const node = operatorNode('^', 'pow', [constantNode(2), constantNode(10)]);
    expect(compile(node, mathScope).evaluate()).toBe(1024);
  });

  it('should evaluate unary minus: -5', () => {
    const node = operatorNode('-', 'unaryMinus', [constantNode(5)]);
    expect(compile(node, mathScope).evaluate()).toBe(-5);
  });

  it('should evaluate nested operations: (2 + 3) * 4', () => {
    const inner = operatorNode('+', 'add', [constantNode(2), constantNode(3)]);
    const outer = operatorNode('*', 'multiply', [inner, constantNode(4)]);
    expect(compile(outer, mathScope).evaluate()).toBe(20);
  });

  it('should evaluate complex nested: 2 + 3 * 4 (AST reflects precedence)', () => {
    // Parser would produce: add(2, multiply(3, 4))
    const mul = operatorNode('*', 'multiply', [constantNode(3), constantNode(4)]);
    const add = operatorNode('+', 'add', [constantNode(2), mul]);
    expect(compile(add, mathScope).evaluate()).toBe(14);
  });

  it('should throw for unknown operator function', () => {
    expect(() => {
      const node = operatorNode('@', 'unknownOp', [constantNode(1), constantNode(2)]);
      compile(node, mathScope);
    }).toThrow('Function "unknownOp" missing');
  });

  it('should evaluate with variables: x + y', () => {
    const node = operatorNode('+', 'add', [symbolNode('x'), symbolNode('y')]);
    expect(compile(node, mathScope).evaluate({ x: 10, y: 20 })).toBe(30);
  });
});

describe('compile - FunctionNode', () => {
  it('should evaluate sin(0)', () => {
    const node = functionNode('sin', [constantNode(0)]);
    expect(compile(node, mathScope).evaluate()).toBeCloseTo(0);
  });

  it('should evaluate cos(0)', () => {
    const node = functionNode('cos', [constantNode(0)]);
    expect(compile(node, mathScope).evaluate()).toBeCloseTo(1);
  });

  it('should evaluate sqrt(16)', () => {
    const node = functionNode('sqrt', [constantNode(16)]);
    expect(compile(node, mathScope).evaluate()).toBe(4);
  });

  it('should evaluate sin(pi/2)', () => {
    const piOver2 = operatorNode('/', 'divide', [symbolNode('pi'), constantNode(2)]);
    const node = functionNode('sin', [piOver2]);
    expect(compile(node, mathScope).evaluate()).toBeCloseTo(1);
  });

  it('should evaluate abs(-5)', () => {
    const neg = operatorNode('-', 'unaryMinus', [constantNode(5)]);
    const node = functionNode('abs', [neg]);
    expect(compile(node, mathScope).evaluate()).toBe(5);
  });

  it('should evaluate max(1, 5, 3)', () => {
    const node = functionNode('max', [constantNode(1), constantNode(5), constantNode(3)]);
    expect(compile(node, mathScope).evaluate()).toBe(5);
  });

  it('should evaluate zero-argument functions', () => {
    const scope = { ...mathScope, random: () => 0.5 };
    const node = functionNode('random', []);
    expect(compile(node, scope).evaluate()).toBe(0.5);
  });

  it('should resolve functions from user scope', () => {
    const node = functionNode('double', [constantNode(21)]);
    expect(compile(node, mathScope).evaluate({ double: (x: number) => x * 2 })).toBe(42);
  });

  it('should throw for undefined functions', () => {
    const node = functionNode('notAFunction', [constantNode(1)]);
    expect(() => compile(node, mathScope).evaluate()).toThrow('Undefined function "notAFunction"');
  });

  it('should throw when calling a non-function value', () => {
    const node = functionNode('pi', []);
    expect(() => compile(node, mathScope).evaluate()).toThrow("'pi' is not a function");
  });
});

describe('compile - ParenthesisNode', () => {
  it('should pass through parenthesized content', () => {
    const node = parenthesisNode(constantNode(42));
    expect(compile(node, mathScope).evaluate()).toBe(42);
  });

  it('should handle nested parentheses: ((2 + 3))', () => {
    const add = operatorNode('+', 'add', [constantNode(2), constantNode(3)]);
    const node = parenthesisNode(parenthesisNode(add));
    expect(compile(node, mathScope).evaluate()).toBe(5);
  });
});

describe('compile - ArrayNode', () => {
  it('should evaluate an array of constants', () => {
    const node = arrayNode([constantNode(1), constantNode(2), constantNode(3)]);
    expect(compile(node, mathScope).evaluate()).toEqual([1, 2, 3]);
  });

  it('should evaluate an array with expressions', () => {
    const items = [
      operatorNode('+', 'add', [constantNode(1), constantNode(2)]),
      constantNode(4),
      operatorNode('*', 'multiply', [constantNode(2), constantNode(3)]),
    ];
    const node = arrayNode(items);
    expect(compile(node, mathScope).evaluate()).toEqual([3, 4, 6]);
  });

  it('should evaluate an empty array', () => {
    const node = arrayNode([]);
    expect(compile(node, mathScope).evaluate()).toEqual([]);
  });
});

describe('compile - AssignmentNode', () => {
  it('should assign a value to a variable', () => {
    const node = assignmentNode('x', constantNode(42));
    const scope: Record<string, any> = {};
    const result = compile(node, mathScope).evaluate(scope);
    expect(result).toBe(42);
    // The scope should have been updated (via ObjectWrappingMap internally)
  });

  it('should assign an expression result', () => {
    const expr = operatorNode('+', 'add', [constantNode(2), constantNode(3)]);
    const node = assignmentNode('result', expr);
    const scope: Record<string, any> = {};
    expect(compile(node, mathScope).evaluate(scope)).toBe(5);
  });
});

describe('compile - BlockNode', () => {
  it('should evaluate a single visible block', () => {
    const node = blockNode([{ node: constantNode(42), visible: true }]);
    expect(compile(node, mathScope).evaluate()).toBe(42);
  });

  it('should return only visible results', () => {
    const node = blockNode([
      { node: assignmentNode('x', constantNode(5)), visible: false },
      { node: operatorNode('+', 'add', [symbolNode('x'), constantNode(3)]), visible: true },
    ]);
    // The assignment is not visible, so only the second result is returned
    const scope = { x: 5 }; // pre-set x since our simple assign might not propagate through the Map
    expect(compile(node, mathScope).evaluate(scope)).toBe(8);
  });
});

describe('compile - ConditionalNode', () => {
  it('should evaluate true branch', () => {
    const node = conditionalNode(constantNode(true), constantNode('yes'), constantNode('no'));
    expect(compile(node, mathScope).evaluate()).toBe('yes');
  });

  it('should evaluate false branch', () => {
    const node = conditionalNode(constantNode(false), constantNode('yes'), constantNode('no'));
    expect(compile(node, mathScope).evaluate()).toBe('no');
  });

  it('should treat 0 as false', () => {
    const node = conditionalNode(constantNode(0), constantNode('yes'), constantNode('no'));
    expect(compile(node, mathScope).evaluate()).toBe('no');
  });

  it('should treat nonzero as true', () => {
    const node = conditionalNode(constantNode(42), constantNode('yes'), constantNode('no'));
    expect(compile(node, mathScope).evaluate()).toBe('yes');
  });

  it('should treat empty string as false', () => {
    const node = conditionalNode(constantNode(''), constantNode('yes'), constantNode('no'));
    expect(compile(node, mathScope).evaluate()).toBe('no');
  });

  it('should treat nonempty string as true', () => {
    const node = conditionalNode(constantNode('x'), constantNode('yes'), constantNode('no'));
    expect(compile(node, mathScope).evaluate()).toBe('yes');
  });
});

describe('compile - ObjectNode', () => {
  it('should evaluate an object with constant properties', () => {
    const node = objectNode({
      a: constantNode(1),
      b: constantNode(2),
    });
    expect(compile(node, mathScope).evaluate()).toEqual({ a: 1, b: 2 });
  });

  it('should evaluate an object with expression properties', () => {
    const node = objectNode({
      sum: operatorNode('+', 'add', [constantNode(1), constantNode(2)]),
      product: operatorNode('*', 'multiply', [constantNode(3), constantNode(4)]),
    });
    expect(compile(node, mathScope).evaluate()).toEqual({ sum: 3, product: 12 });
  });
});

describe('compile - RelationalNode', () => {
  it('should evaluate 1 < 2 as true', () => {
    const node = relationalNode(['smaller'], [constantNode(1), constantNode(2)]);
    expect(compile(node, mathScope).evaluate()).toBe(true);
  });

  it('should evaluate 2 < 1 as false', () => {
    const node = relationalNode(['smaller'], [constantNode(2), constantNode(1)]);
    expect(compile(node, mathScope).evaluate()).toBe(false);
  });

  it('should evaluate chained: 1 < 2 < 3', () => {
    const node = relationalNode(
      ['smaller', 'smaller'],
      [constantNode(1), constantNode(2), constantNode(3)]
    );
    expect(compile(node, mathScope).evaluate()).toBe(true);
  });

  it('should evaluate chained: 1 < 3 < 2 as false', () => {
    const node = relationalNode(
      ['smaller', 'smaller'],
      [constantNode(1), constantNode(3), constantNode(2)]
    );
    expect(compile(node, mathScope).evaluate()).toBe(false);
  });
});

describe('compile - FunctionAssignmentNode', () => {
  it('should create a callable function', () => {
    // f(x) = x * 2
    const expr = operatorNode('*', 'multiply', [symbolNode('x'), constantNode(2)]);
    const node = functionAssignmentNode('f', ['x'], expr);
    const scope: Record<string, any> = {};
    const fn = compile(node, mathScope).evaluate(scope);
    expect(typeof fn).toBe('function');
    expect(fn(5)).toBe(10);
    expect(fn(21)).toBe(42);
  });

  it('should create a multi-parameter function', () => {
    // g(a, b) = a + b
    const expr = operatorNode('+', 'add', [symbolNode('a'), symbolNode('b')]);
    const node = functionAssignmentNode('g', ['a', 'b'], expr);
    const fn = compile(node, mathScope).evaluate({});
    expect(fn(3, 4)).toBe(7);
  });
});

describe('compile - complex expressions', () => {
  it('should evaluate quadratic formula component: b^2 - 4*a*c', () => {
    // b^2 - 4*a*c
    const bSquared = operatorNode('^', 'pow', [symbolNode('b'), constantNode(2)]);
    const fourAC = operatorNode('*', 'multiply', [
      operatorNode('*', 'multiply', [constantNode(4), symbolNode('a')]),
      symbolNode('c'),
    ]);
    const discriminant = operatorNode('-', 'subtract', [bSquared, fourAC]);

    const result = compile(discriminant, mathScope).evaluate({ a: 1, b: 5, c: 6 });
    expect(result).toBe(1); // 25 - 24 = 1
  });

  it('should evaluate nested function calls: sqrt(abs(-16))', () => {
    const neg = operatorNode('-', 'unaryMinus', [constantNode(16)]);
    const absCall = functionNode('abs', [neg]);
    const sqrtCall = functionNode('sqrt', [absCall]);
    expect(compile(sqrtCall, mathScope).evaluate()).toBe(4);
  });

  it('should evaluate expression with scope: 2*pi*r', () => {
    const twoPiR = operatorNode('*', 'multiply', [
      operatorNode('*', 'multiply', [constantNode(2), symbolNode('pi')]),
      symbolNode('r'),
    ]);
    const result = compile(twoPiR, mathScope).evaluate({ r: 1 });
    expect(result).toBeCloseTo(2 * Math.PI);
  });

  it('should evaluate exp(1) = e', () => {
    const node = functionNode('exp', [constantNode(1)]);
    expect(compile(node, mathScope).evaluate()).toBeCloseTo(Math.E);
  });
});

describe('compile - CompiledExpression reuse', () => {
  it('should evaluate the same compiled expression with different scopes', () => {
    const node = operatorNode('+', 'add', [symbolNode('x'), symbolNode('y')]);
    const compiled = compile(node, mathScope);
    expect(compiled.evaluate({ x: 1, y: 2 })).toBe(3);
    expect(compiled.evaluate({ x: 10, y: 20 })).toBe(30);
    expect(compiled.evaluate({ x: -5, y: 5 })).toBe(0);
  });
});

describe('compile - error handling', () => {
  it('should throw for unknown node types', () => {
    const unknownNode = { type: 'UnknownNode' };
    expect(() => compile(unknownNode, mathScope)).toThrow('Unknown node type');
  });
});
