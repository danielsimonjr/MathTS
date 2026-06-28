import { describe, it, expect } from 'vitest';
import { compile } from '../src/compiler/compile.js';

/**
 * Coverage-focused tests for the standalone tree-walking compiler.
 *
 * These exercise the branches of `compile` / `compileNode` that the existing
 * `compile.test.ts` does not reach: accessor/index nodes, range nodes, the
 * sandbox-enforcing assignment/object/accessor paths, conditional truthiness
 * over BigNumber/Complex/null, alternate evaluate() scope inputs, and the
 * various resolveFn failure modes for FunctionNode.
 *
 * Mock AST nodes mirror the structure produced by the parser: each node carries
 * an `is<Type>Node: true` discriminator plus the fields the compiler reads.
 */

// ── Mock node helpers ────────────────────────────────────────────────────────
/**
 * Structural stand-in for the parsed AST nodes the compiler walks. Each mock
 * carries an `is<Type>Node` discriminator plus the fields the compiler reads;
 * dynamic field values are `unknown`.
 */
type MockNode = Record<string, unknown>;

function constantNode(value: unknown) {
  return { type: 'ConstantNode', isConstantNode: true, value };
}
function symbolNode(name: string) {
  return { type: 'SymbolNode', isSymbolNode: true, name };
}
function operatorNode(op: string, fn: string, args: MockNode[]) {
  return { type: 'OperatorNode', isOperatorNode: true, op, fn, args };
}
function functionNode(fnName: string, args: MockNode[]) {
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
function parenthesisNode(content: MockNode) {
  return { type: 'ParenthesisNode', isParenthesisNode: true, content };
}
function arrayNode(items: MockNode[]) {
  return { type: 'ArrayNode', isArrayNode: true, items };
}
function objectPropertyIndex(prop: string) {
  return {
    type: 'IndexNode',
    isIndexNode: true,
    isObjectProperty: () => true,
    getObjectProperty: () => prop,
    dimensions: [constantNode(prop)],
  };
}
function arrayIndexNode(dimensions: MockNode[]) {
  return {
    type: 'IndexNode',
    isIndexNode: true,
    isObjectProperty: () => false,
    dimensions,
  };
}
function accessorNode(object: MockNode, index: MockNode, optionalChaining = false) {
  return {
    type: 'AccessorNode',
    isAccessorNode: true,
    object,
    index,
    optionalChaining,
  };
}
function rangeNode(start: MockNode, end: MockNode, step?: MockNode) {
  return { type: 'RangeNode', isRangeNode: true, start, end, step };
}
function blockNode(blocks: Array<{ node: MockNode; visible: boolean }>) {
  return { type: 'BlockNode', isBlockNode: true, blocks };
}
function conditionalNode(condition: MockNode, trueExpr: MockNode, falseExpr: MockNode) {
  return { type: 'ConditionalNode', isConditionalNode: true, condition, trueExpr, falseExpr };
}
function objectNode(properties: Record<string, MockNode>) {
  return { type: 'ObjectNode', isObjectNode: true, properties };
}
function relationalNode(conditionals: string[], params: MockNode[]) {
  return { type: 'RelationalNode', isRelationalNode: true, conditionals, params };
}
function functionAssignmentNode(name: string, params: string[], expr: MockNode) {
  return {
    type: 'FunctionAssignmentNode',
    isFunctionAssignmentNode: true,
    name,
    params,
    expr,
  };
}

const mathScope: Record<string, unknown> = {
  add: (a: number, b: number) => a + b,
  multiply: (a: number, b: number) => a * b,
  smaller: (a: number, b: number) => a < b,
};

// ── ParenthesisNode ──────────────────────────────────────────────────────────
describe('compile - ParenthesisNode (passthrough)', () => {
  it('passes through the wrapped content', () => {
    const node = parenthesisNode(constantNode(7));
    expect(compile(node, mathScope).evaluate()).toBe(7);
  });
});

// ── ArrayNode ────────────────────────────────────────────────────────────────
describe('compile - ArrayNode', () => {
  it('evaluates each item', () => {
    const node = arrayNode([constantNode(1), constantNode(2)]);
    expect(compile(node, mathScope).evaluate()).toEqual([1, 2]);
  });
});

// ── AssignmentNode ───────────────────────────────────────────────────────────
describe('compile - AssignmentNode (symbol target)', () => {
  it('assigns to a symbol and returns the value', () => {
    const node = {
      type: 'AssignmentNode',
      isAssignmentNode: true,
      object: symbolNode('x'),
      value: constantNode(5),
    };
    const scope: Record<string, unknown> = {};
    expect(compile(node, mathScope).evaluate(scope)).toBe(5);
    expect(scope.x).toBe(5);
  });

  it('falls back to node.name when object is not a recognised target', () => {
    // object lacks isSymbolNode/isAccessorNode, but the node has a `name`.
    const node = {
      type: 'AssignmentNode',
      isAssignmentNode: true,
      object: { foo: true },
      name: 'y',
      value: constantNode(11),
    };
    const scope: Record<string, unknown> = {};
    expect(compile(node, mathScope).evaluate(scope)).toBe(11);
    expect(scope.y).toBe(11);
  });

  it('throws "Unsupported assignment target" when no usable target exists', () => {
    const node = {
      type: 'AssignmentNode',
      isAssignmentNode: true,
      object: { foo: true },
      value: constantNode(1),
    };
    expect(() => compile(node, mathScope)).toThrow('Unsupported assignment target');
  });
});

describe('compile - AssignmentNode (property target)', () => {
  it('assigns a safe property through setSafeProperty', () => {
    const node = {
      type: 'AssignmentNode',
      isAssignmentNode: true,
      object: accessorNode(symbolNode('obj'), objectPropertyIndex('a')),
      value: constantNode(9),
    };
    const target = { a: 0 };
    const result = compile(node, mathScope).evaluate({ obj: target });
    expect(result).toBe(9);
    expect(target.a).toBe(9);
  });

  it('refuses to assign "__proto__" (sandbox)', () => {
    const node = {
      type: 'AssignmentNode',
      isAssignmentNode: true,
      object: accessorNode(symbolNode('obj'), objectPropertyIndex('__proto__')),
      value: constantNode({ polluted: 1 }),
    };
    const target = {};
    expect(() => compile(node, mathScope).evaluate({ obj: target })).toThrow(
      'No access to property "__proto__"'
    );
  });

  it('refuses to assign "constructor" (sandbox)', () => {
    const node = {
      type: 'AssignmentNode',
      isAssignmentNode: true,
      object: accessorNode(symbolNode('obj'), objectPropertyIndex('constructor')),
      value: constantNode(1),
    };
    const target = { a: 0 };
    expect(() => compile(node, mathScope).evaluate({ obj: target })).toThrow(
      'No access to property "constructor"'
    );
  });
});

// ── BlockNode ────────────────────────────────────────────────────────────────
describe('compile - BlockNode (visibility)', () => {
  it('returns the single visible result', () => {
    const node = blockNode([
      { node: constantNode(1), visible: false },
      { node: constantNode(2), visible: true },
    ]);
    expect(compile(node, mathScope).evaluate()).toBe(2);
  });

  it('returns an array when multiple results are visible', () => {
    const node = blockNode([
      { node: constantNode(1), visible: true },
      { node: constantNode(2), visible: true },
    ]);
    expect(compile(node, mathScope).evaluate()).toEqual([1, 2]);
  });

  it('returns undefined when no result is visible', () => {
    const node = blockNode([{ node: constantNode(1), visible: false }]);
    expect(compile(node, mathScope).evaluate()).toBeUndefined();
  });
});

// ── ConditionalNode + testCondition ──────────────────────────────────────────
describe('compile - ConditionalNode truthiness', () => {
  it('selects the true branch for a truthy number', () => {
    const node = conditionalNode(constantNode(1), constantNode('T'), constantNode('F'));
    expect(compile(node, mathScope).evaluate()).toBe('T');
  });

  it('selects the false branch for 0', () => {
    const node = conditionalNode(constantNode(0), constantNode('T'), constantNode('F'));
    expect(compile(node, mathScope).evaluate()).toBe('F');
  });

  it('handles boolean conditions', () => {
    expect(
      compile(conditionalNode(constantNode(true), constantNode('T'), constantNode('F')), mathScope).evaluate()
    ).toBe('T');
    expect(
      compile(conditionalNode(constantNode(false), constantNode('T'), constantNode('F')), mathScope).evaluate()
    ).toBe('F');
  });

  it('handles string conditions', () => {
    expect(
      compile(conditionalNode(constantNode('x'), constantNode('T'), constantNode('F')), mathScope).evaluate()
    ).toBe('T');
    expect(
      compile(conditionalNode(constantNode(''), constantNode('T'), constantNode('F')), mathScope).evaluate()
    ).toBe('F');
  });

  it('treats a non-zero BigNumber-like as truthy', () => {
    const big = { isZero: () => false };
    const node = conditionalNode(constantNode(big), constantNode('T'), constantNode('F'));
    expect(compile(node, mathScope).evaluate()).toBe('T');
  });

  it('treats a zero BigNumber-like as falsy', () => {
    const big = { isZero: () => true };
    const node = conditionalNode(constantNode(big), constantNode('T'), constantNode('F'));
    expect(compile(node, mathScope).evaluate()).toBe('F');
  });

  it('treats a non-zero Complex-like as truthy', () => {
    const complex = { re: 0, im: 1 };
    const node = conditionalNode(constantNode(complex), constantNode('T'), constantNode('F'));
    expect(compile(node, mathScope).evaluate()).toBe('T');
  });

  it('treats a zero Complex-like as falsy', () => {
    const complex = { re: 0, im: 0 };
    const node = conditionalNode(constantNode(complex), constantNode('T'), constantNode('F'));
    expect(compile(node, mathScope).evaluate()).toBe('F');
  });

  it('treats null as falsy', () => {
    const node = conditionalNode(constantNode(null), constantNode('T'), constantNode('F'));
    expect(compile(node, mathScope).evaluate()).toBe('F');
  });

  it('treats undefined as falsy', () => {
    const node = conditionalNode(constantNode(undefined), constantNode('T'), constantNode('F'));
    expect(compile(node, mathScope).evaluate()).toBe('F');
  });

  it('throws on an unsupported condition type', () => {
    // A plain object with no isZero / re / im is unsupported.
    const node = conditionalNode(constantNode({ weird: true }), constantNode('T'), constantNode('F'));
    expect(() => compile(node, mathScope).evaluate()).toThrow('Unsupported type of condition');
  });
});

// ── ObjectNode ───────────────────────────────────────────────────────────────
describe('compile - ObjectNode (sandbox keys)', () => {
  it('builds an object from safe keys', () => {
    const node = objectNode({ k: constantNode(3) });
    expect(compile(node, mathScope).evaluate()).toEqual({ k: 3 });
  });

  it('rejects "__proto__" object keys (sandbox)', () => {
    // A literal `{__proto__: ...}` sets the prototype rather than an own key,
    // so define it as a real own enumerable property to exercise the sandbox.
    const properties: Record<string, MockNode> = {};
    Object.defineProperty(properties, '__proto__', {
      value: constantNode({ polluted: 1 }),
      enumerable: true,
      configurable: true,
      writable: true,
    });
    const node = objectNode(properties);
    expect(() => compile(node, mathScope).evaluate()).toThrow('No access to property "__proto__"');
  });
});

// ── RangeNode ────────────────────────────────────────────────────────────────
describe('compile - RangeNode', () => {
  const rangeScope = {
    ...mathScope,
    range: (start: number, end: number, step?: number) => ({ start, end, step }),
  };

  it('calls range(start, end) without a step', () => {
    const node = rangeNode(constantNode(1), constantNode(3));
    expect(compile(node, rangeScope).evaluate()).toEqual({ start: 1, end: 3, step: undefined });
  });

  it('calls range(start, end, step) with a step', () => {
    const node = rangeNode(constantNode(1), constantNode(9), constantNode(2));
    expect(compile(node, rangeScope).evaluate()).toEqual({ start: 1, end: 9, step: 2 });
  });

  it('throws when math has no range function', () => {
    const node = rangeNode(constantNode(1), constantNode(3));
    expect(() => compile(node, mathScope)).toThrow('Function "range" missing');
  });
});

// ── RelationalNode ───────────────────────────────────────────────────────────
describe('compile - RelationalNode', () => {
  it('evaluates a satisfied chain 1 < 2 < 3', () => {
    const node = relationalNode(
      ['smaller', 'smaller'],
      [constantNode(1), constantNode(2), constantNode(3)]
    );
    expect(compile(node, mathScope).evaluate()).toBe(true);
  });

  it('short-circuits a failing chain to false', () => {
    const node = relationalNode(
      ['smaller', 'smaller'],
      [constantNode(3), constantNode(2), constantNode(1)]
    );
    expect(compile(node, mathScope).evaluate()).toBe(false);
  });

  it('throws on an unknown comparison function', () => {
    const node = relationalNode(['noSuchCmp'], [constantNode(1), constantNode(2)]);
    expect(() => compile(node, mathScope).evaluate()).toThrow('Unknown comparison function');
  });
});

// ── FunctionAssignmentNode ───────────────────────────────────────────────────
describe('compile - FunctionAssignmentNode', () => {
  it('compiles a function, registers it in scope, and is callable', () => {
    const node = functionAssignmentNode(
      'f',
      ['a', 'b'],
      operatorNode('+', 'add', [symbolNode('a'), symbolNode('b')])
    );
    const scope: Record<string, unknown> = {};
    const fn = compile(node, mathScope).evaluate(scope);
    expect(typeof fn).toBe('function');
    expect(fn(2, 3)).toBe(5);
    expect(fn.syntax).toBe('f(a, b)');
    expect(typeof scope.f).toBe('function');
  });
});

// ── AccessorNode (object property) ───────────────────────────────────────────
describe('compile - AccessorNode (object property)', () => {
  it('reads a safe property through getSafeProperty', () => {
    const node = accessorNode(symbolNode('o'), objectPropertyIndex('p'));
    expect(compile(node, mathScope).evaluate({ o: { p: 42 } })).toBe(42);
  });

  it('short-circuits to undefined with optional chaining on null', () => {
    const node = accessorNode(symbolNode('o'), objectPropertyIndex('p'), true);
    expect(compile(node, mathScope).evaluate({ o: null })).toBeUndefined();
  });

  it('rejects access to "constructor" (sandbox)', () => {
    const node = accessorNode(symbolNode('o'), objectPropertyIndex('constructor'));
    expect(() => compile(node, mathScope).evaluate({ o: { p: 1 } })).toThrow(
      'No access to property "constructor"'
    );
  });
});

// ── AccessorNode (array index) ───────────────────────────────────────────────
describe('compile - AccessorNode (array / matrix index)', () => {
  it('uses math.subset when available', () => {
    const subsetScope = {
      ...mathScope,
      subset: (obj: unknown, index: number) => `subset:${JSON.stringify(obj)}:${index}`,
    };
    const node = accessorNode(symbolNode('arr'), arrayIndexNode([constantNode(0)]));
    const result = compile(node, subsetScope).evaluate({ arr: [10, 20] });
    expect(result).toBe('subset:[10,20]:0');
  });

  it('indexes numerically when no subset is present', () => {
    // No subset, IndexNode returns the single numeric dimension (0).
    const node = accessorNode(symbolNode('arr'), arrayIndexNode([constantNode(1)]));
    const result = compile(node, mathScope).evaluate({ arr: [10, 20, 30] });
    expect(result).toBe(20);
  });

  it('falls back to getSafeProperty for non-numeric index', () => {
    // No subset and the resolved index is a string -> getSafeProperty.
    const node = accessorNode(symbolNode('o'), arrayIndexNode([constantNode('length')]));
    const result = compile(node, mathScope).evaluate({ o: [1, 2, 3] });
    expect(result).toBe(3); // length is whitelisted as a safe native property
  });

  it('optional chaining short-circuits array access on null', () => {
    const node = accessorNode(symbolNode('arr'), arrayIndexNode([constantNode(0)]), true);
    expect(compile(node, mathScope).evaluate({ arr: null })).toBeUndefined();
  });
});

// ── IndexNode (standalone) ───────────────────────────────────────────────────
describe('compile - IndexNode', () => {
  it('uses math.index when available', () => {
    const indexScope = {
      ...mathScope,
      index: (...dims: unknown[]) => ({ dims }),
    };
    const node = arrayIndexNode([constantNode(0), constantNode(1)]);
    expect(compile(node, indexScope).evaluate()).toEqual({ dims: [0, 1] });
  });

  it('returns the single dimension value when math.index is absent', () => {
    const node = arrayIndexNode([constantNode(5)]);
    expect(compile(node, mathScope).evaluate()).toBe(5);
  });

  it('returns the dimension array for multiple dims when math.index is absent', () => {
    const node = arrayIndexNode([constantNode(1), constantNode(2)]);
    expect(compile(node, mathScope).evaluate()).toEqual([1, 2]);
  });
});

// ── Unknown node type ────────────────────────────────────────────────────────
describe('compile - unknown node type', () => {
  it('throws for an unrecognised node', () => {
    expect(() => compile({ type: 'Weird' }, mathScope)).toThrow('Unknown node type');
  });
});

// ── evaluate() scope-input handling ──────────────────────────────────────────
describe('compile - evaluate() scope inputs', () => {
  const node = operatorNode('+', 'add', [symbolNode('x'), constantNode(1)]);

  it('wraps an undefined scope in an empty map', () => {
    // With no scope passed, evaluate() builds an empty ObjectWrappingMap, so the
    // unknown symbol `x` is not found and the empty-map lookup path throws.
    expect(() => compile(node, mathScope).evaluate()).toThrow('Undefined symbol "x"');
  });

  it('uses a Map-like scope directly (has/get/set)', () => {
    const mapScope = new Map<string, unknown>([['x', 41]]);
    expect(compile(node, mathScope).evaluate(mapScope)).toBe(42);
  });

  it('wraps a plain object scope', () => {
    expect(compile(node, mathScope).evaluate({ x: 9 })).toBe(10);
  });
});

// ── compileSymbolNode edge cases ─────────────────────────────────────────────
describe('compile - SymbolNode resolution', () => {
  it('prefers scope value over math namespace for an own math property', () => {
    const scopeMath = { ...mathScope, k: 100 };
    const node = symbolNode('k');
    expect(compile(node, scopeMath).evaluate()).toBe(100);
    expect(compile(node, scopeMath).evaluate({ k: 7 })).toBe(7);
  });

  it('throws for an unknown symbol not in math or scope', () => {
    const node = symbolNode('nope');
    expect(() => compile(node, mathScope).evaluate()).toThrow('Undefined symbol "nope"');
  });
});

// ── compileFunctionNode resolveFn + arities ──────────────────────────────────
describe('compile - FunctionNode resolution', () => {
  it('resolves a function from scope', () => {
    const node = functionNode('triple', [constantNode(4)]);
    expect(compile(node, mathScope).evaluate({ triple: (x: number) => x * 3 })).toBe(12);
  });

  it('resolves a function from the math namespace', () => {
    const scopeMath = { ...mathScope, neg: (x: number) => -x };
    const node = functionNode('neg', [constantNode(5)]);
    expect(compile(node, scopeMath).evaluate()).toBe(-5);
  });

  it('throws when a scope value is not a function', () => {
    const node = functionNode('notFn', [constantNode(1)]);
    expect(() => compile(node, mathScope).evaluate({ notFn: 99 })).toThrow(
      "'notFn' is not a function"
    );
  });

  it('throws when a math value is not a function', () => {
    const scopeMath = { ...mathScope, notFn: 7 };
    const node = functionNode('notFn', [constantNode(1)]);
    expect(() => compile(node, scopeMath).evaluate()).toThrow("'notFn' is not a function");
  });

  it('throws for an undefined function', () => {
    const node = functionNode('missing', [constantNode(1)]);
    expect(() => compile(node, mathScope).evaluate()).toThrow('Undefined function "missing"');
  });

  it('supports arity 0', () => {
    const node = functionNode('now', []);
    expect(compile(node, mathScope).evaluate({ now: () => 'tick' })).toBe('tick');
  });

  it('supports arity 1', () => {
    const node = functionNode('inc', [constantNode(1)]);
    expect(compile(node, mathScope).evaluate({ inc: (x: number) => x + 1 })).toBe(2);
  });

  it('supports arity 2', () => {
    const node = functionNode('sum2', [constantNode(2), constantNode(3)]);
    expect(compile(node, mathScope).evaluate({ sum2: (a: number, b: number) => a + b })).toBe(5);
  });

  it('supports arity 3+', () => {
    const node = functionNode('sum3', [constantNode(1), constantNode(2), constantNode(3)]);
    expect(
      compile(node, mathScope).evaluate({ sum3: (a: number, b: number, c: number) => a + b + c })
    ).toBe(6);
  });
});

// ── compileFunctionNode: AccessorNode-as-fn (obj.method()) ───────────────────
describe('compile - FunctionNode with accessor fn (method call)', () => {
  function methodCallNode(objSymbol: string, method: string, args: MockNode[]) {
    return {
      type: 'FunctionNode',
      isFunctionNode: true,
      fn: accessorNode(symbolNode(objSymbol), objectPropertyIndex(method)),
      args,
      get name() {
        return method;
      },
    };
  }

  it('calls a safe method via getSafeMethod', () => {
    const node = methodCallNode('o', 'twice', [constantNode(21)]);
    const o = { twice: (x: number) => x * 2 };
    expect(compile(node, mathScope).evaluate({ o })).toBe(42);
  });

  it('throws when the resolved member is not a function', () => {
    // getSafeMethod throws "No access to method" when the property is not a function.
    const node = methodCallNode('o', 'value', [constantNode(1)]);
    const o = { value: 5 };
    expect(() => compile(node, mathScope).evaluate({ o })).toThrow('No access to method "value"');
  });
});

// ── compileFunctionNode: general computed-fn fallback ────────────────────────
describe('compile - FunctionNode with computed fn fallback', () => {
  function computedFnCall(objSymbol: string, indexExpr: MockNode, args: MockNode[]) {
    // fn is an accessor with a NON-object-property index -> general fallback path.
    return {
      type: 'FunctionNode',
      isFunctionNode: true,
      fn: accessorNode(symbolNode(objSymbol), arrayIndexNode([indexExpr])),
      args,
      get name() {
        return '';
      },
    };
  }

  it('invokes a function produced by a computed accessor', () => {
    // arr[0] resolves (no subset) to arr[0], which is a function.
    const node = computedFnCall('arr', constantNode(0), [constantNode(10)]);
    const arr = [(x: number) => x + 5];
    expect(compile(node, mathScope).evaluate({ arr })).toBe(15);
  });

  it('throws when the computed accessor does not resolve to a function', () => {
    const node = computedFnCall('arr', constantNode(0), [constantNode(10)]);
    const arr = [123];
    expect(() => compile(node, mathScope).evaluate({ arr })).toThrow(
      'Expression does not evaluate to a function'
    );
  });
});
