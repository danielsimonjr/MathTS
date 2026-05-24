/**
 * Direct unit tests for expression/src/parse.ts.
 *
 * This file imports `createParse` from `'../src/parse.js'` so that the CDG
 * tool counts `parse.ts` as directly tested.  The tests exercise the full
 * grammar surface produced by the factory's returned `parse` function.
 */
import { describe, it, expect } from 'vitest';

// ── The target symbol that must be imported directly from parse.ts ────────────
import { createParse } from '../src/parse.js';

// ── Node constructors (intra-package source imports) ─────────────────────────
import { createNode } from '../src/node/Node.js';
import { createAccessorNode } from '../src/node/AccessorNode.js';
import { createArrayNode } from '../src/node/ArrayNode.js';
import { createAssignmentNode } from '../src/node/AssignmentNode.js';
import { createBlockNode } from '../src/node/BlockNode.js';
import { createConditionalNode } from '../src/node/ConditionalNode.js';
import { createConstantNode } from '../src/node/ConstantNode.js';
import { createFunctionAssignmentNode } from '../src/node/FunctionAssignmentNode.js';
import { createFunctionNode } from '../src/node/FunctionNode.js';
import { createIndexNode } from '../src/node/IndexNode.js';
import { createObjectNode } from '../src/node/ObjectNode.js';
import { createOperatorNode } from '../src/node/OperatorNode.js';
import { createParenthesisNode } from '../src/node/ParenthesisNode.js';
import { createRangeNode } from '../src/node/RangeNode.js';
import { createRelationalNode } from '../src/node/RelationalNode.js';
import { createSymbolNode } from '../src/node/SymbolNode.js';

// ── Typed-function runtime from the core package ─────────────────────────────
import { mathTyped } from '@danielsimonjr/mathts-core';

// Register the Node type with typed-function so that parse.ts's
// `typed.addConversion({ from: 'string', to: 'Node', ... })` succeeds.
// We must do this before calling createParse.
try {
  (mathTyped as any).addType(
    {
      name: 'Node',
      test: (x: unknown): boolean =>
        typeof x === 'object' && x !== null && (x as any).isNode === true,
    },
    false
  );
} catch {
  // Already registered in a previous test run (module-level singleton) — ignore
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the minimal parse scope, mirroring functions/src/factories/index.ts
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal config: use plain JS numbers. */
const config = { number: 'number' as const, numberFallback: 'number' as const };

/**
 * Minimal `numeric` function: converts a token string to the requested type.
 * The parser only ever asks for 'number', 'BigNumber', 'bigint', or 'Fraction'.
 * For tests we only need the plain `number` path.
 */
function numeric(value: string, _type: string): number {
  return Number(value);
}

/** Stub for isBounded – ConstantNode needs it to detect BigNumber bounds. */
function isBounded(_v: unknown): boolean {
  return false;
}

/** Minimal ResultSet stub – BlockNode needs the constructor. */
class ResultSet {
  entries: unknown[];
  constructor(entries: unknown[]) {
    this.entries = entries;
  }
}

// Build node classes from the factory chain
const mathScope: Record<string, any> = {};

const _Node = createNode({ mathWithTransform: mathScope });
const _ArrayNode = createArrayNode({ Node: _Node });
const _ObjectNode = createObjectNode({ Node: _Node });
const _OperatorNode = createOperatorNode({ Node: _Node });
const _ParenthesisNode = createParenthesisNode({ Node: _Node });
const _RangeNode = createRangeNode({ Node: _Node });
const _RelationalNode = createRelationalNode({ Node: _Node });
const _ConditionalNode = createConditionalNode({ Node: _Node });
const _BlockNode = createBlockNode({ ResultSet, Node: _Node });
const _ConstantNode = createConstantNode({ Node: _Node, isBounded });
const _FunctionAssignmentNode = createFunctionAssignmentNode({
  typed: mathTyped,
  Node: _Node,
});
const _SymbolNode = createSymbolNode({ math: mathScope, Node: _Node });
const _IndexNode = createIndexNode({ Node: _Node, size: () => [] });
const _AccessorNode = createAccessorNode({
  subset: (_obj: unknown, _idx: unknown) => _obj,
  Node: _Node,
});
const _AssignmentNode = createAssignmentNode({
  subset: (_obj: unknown, _idx: unknown, _val: unknown) => _val,
  matrix: () => ({}),
  Node: _Node,
});
const _FunctionNode = createFunctionNode({
  math: mathScope,
  Node: _Node,
  SymbolNode: _SymbolNode,
});

// Populate mathScope so node constructors that reference `math` can resolve
Object.assign(mathScope, {
  typed: mathTyped,
  config,
  numeric,
  ConstantNode: _ConstantNode,
  SymbolNode: _SymbolNode,
  OperatorNode: _OperatorNode,
  FunctionNode: _FunctionNode,
  AssignmentNode: _AssignmentNode,
  FunctionAssignmentNode: _FunctionAssignmentNode,
  BlockNode: _BlockNode,
  ArrayNode: _ArrayNode,
  ObjectNode: _ObjectNode,
  IndexNode: _IndexNode,
  AccessorNode: _AccessorNode,
  ParenthesisNode: _ParenthesisNode,
  RangeNode: _RangeNode,
  RelationalNode: _RelationalNode,
  ConditionalNode: _ConditionalNode,
});

/** The fully wired parse function under test. */
const parse = createParse({
  typed: mathTyped,
  numeric,
  config,
  AccessorNode: _AccessorNode,
  ArrayNode: _ArrayNode,
  AssignmentNode: _AssignmentNode,
  BlockNode: _BlockNode,
  ConditionalNode: _ConditionalNode,
  ConstantNode: _ConstantNode,
  FunctionAssignmentNode: _FunctionAssignmentNode,
  FunctionNode: _FunctionNode,
  IndexNode: _IndexNode,
  ObjectNode: _ObjectNode,
  OperatorNode: _OperatorNode,
  ParenthesisNode: _ParenthesisNode,
  RangeNode: _RangeNode,
  RelationalNode: _RelationalNode,
  SymbolNode: _SymbolNode,
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function nodeType(node: any): string {
  return node.type;
}

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

// ─── Factory metadata ─────────────────────────────────────────────────────────

describe('createParse – factory metadata', () => {
  it('createParse is a function', () => {
    expect(typeof createParse).toBe('function');
  });

  it('createParse.fn is "parse"', () => {
    expect((createParse as any).fn).toBe('parse');
  });

  it('createParse.isFactory is true', () => {
    expect((createParse as any).isFactory).toBe(true);
  });

  it('createParse.dependencies includes required deps', () => {
    const deps: string[] = (createParse as any).dependencies;
    expect(deps).toContain('typed');
    expect(deps).toContain('numeric');
    expect(deps).toContain('ConstantNode');
    expect(deps).toContain('SymbolNode');
    expect(deps).toContain('OperatorNode');
  });

  it('parse function is callable', () => {
    expect(typeof parse).toBe('function');
  });
});

// ─── Numeric literals ─────────────────────────────────────────────────────────

describe('parse – numeric literals', () => {
  it('parses integer into ConstantNode', () => {
    const node = parse('42') as any;
    expect(nodeType(node)).toBe('ConstantNode');
    expect(node.value).toBe(42);
  });

  it('parses zero', () => {
    const node = parse('0') as any;
    expect(nodeType(node)).toBe('ConstantNode');
    expect(node.value).toBe(0);
  });

  it('parses a floating-point number', () => {
    const node = parse('3.14') as any;
    expect(nodeType(node)).toBe('ConstantNode');
    expect(node.value).toBeCloseTo(3.14);
  });

  it('parses scientific notation 1.5e3', () => {
    const node = parse('1.5e3') as any;
    expect(nodeType(node)).toBe('ConstantNode');
    expect(node.value).toBe(1500);
  });

  it('parses scientific notation with negative exponent 2.5e-2', () => {
    const node = parse('2.5e-2') as any;
    expect(nodeType(node)).toBe('ConstantNode');
    expect(node.value).toBeCloseTo(0.025);
  });

  it('parses negative number -5 via unary minus', () => {
    const node = parse('-5') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('unaryMinus');
    expect(nodeType(node.args[0])).toBe('ConstantNode');
    expect(node.args[0].value).toBe(5);
  });

  it('parses unary plus +3', () => {
    const node = parse('+3') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('unaryPlus');
  });
});

// ─── Boolean and special constants ────────────────────────────────────────────

describe('parse – boolean and special constants', () => {
  it('parses true into ConstantNode(true)', () => {
    const node = parse('true') as any;
    expect(nodeType(node)).toBe('ConstantNode');
    expect(node.value).toBe(true);
  });

  it('parses false into ConstantNode(false)', () => {
    const node = parse('false') as any;
    expect(nodeType(node)).toBe('ConstantNode');
    expect(node.value).toBe(false);
  });

  it('parses null into ConstantNode(null)', () => {
    const node = parse('null') as any;
    expect(nodeType(node)).toBe('ConstantNode');
    expect(node.value).toBeNull();
  });

  it('parses undefined into ConstantNode(undefined)', () => {
    const node = parse('undefined') as any;
    expect(nodeType(node)).toBe('ConstantNode');
    expect(node.value).toBeUndefined();
  });

  it('parses empty string into ConstantNode(undefined)', () => {
    const node = parse('') as any;
    expect(nodeType(node)).toBe('ConstantNode');
    expect(node.value).toBeUndefined();
  });
});

// ─── String literals ──────────────────────────────────────────────────────────

describe('parse – string literals', () => {
  it('parses double-quoted string into ConstantNode', () => {
    const node = parse('"hello"') as any;
    expect(nodeType(node)).toBe('ConstantNode');
    expect(node.value).toBe('hello');
  });

  it('parses single-quoted string into ConstantNode', () => {
    const node = parse("'world'") as any;
    expect(nodeType(node)).toBe('ConstantNode');
    expect(node.value).toBe('world');
  });

  it('parses escaped newline in string', () => {
    const node = parse('"line1\\nline2"') as any;
    expect(node.value).toBe('line1\nline2');
  });

  it('parses escaped tab in string', () => {
    const node = parse('"a\\tb"') as any;
    expect(node.value).toBe('a\tb');
  });

  it('parses unicode escape sequence in string', () => {
    const node = parse('"\\u0041"') as any;
    expect(node.value).toBe('A');
  });
});

// ─── Symbol nodes ─────────────────────────────────────────────────────────────

describe('parse – symbol nodes', () => {
  it('parses variable name x into SymbolNode', () => {
    const node = parse('x') as any;
    expect(nodeType(node)).toBe('SymbolNode');
    expect(node.name).toBe('x');
  });

  it('parses underscore-prefixed variable', () => {
    const node = parse('_myVar') as any;
    expect(nodeType(node)).toBe('SymbolNode');
    expect(node.name).toBe('_myVar');
  });

  it('parses dollar-prefixed variable', () => {
    const node = parse('$val') as any;
    expect(nodeType(node)).toBe('SymbolNode');
    expect(node.name).toBe('$val');
  });

  it('parses multi-character identifier', () => {
    const node = parse('alpha123') as any;
    expect(nodeType(node)).toBe('SymbolNode');
    expect(node.name).toBe('alpha123');
  });
});

// ─── Arithmetic operators ─────────────────────────────────────────────────────

describe('parse – arithmetic operators', () => {
  it('parses addition "1 + 2"', () => {
    const node = parse('1 + 2') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.op).toBe('+');
    expect(node.fn).toBe('add');
    expect(node.args[0].value).toBe(1);
    expect(node.args[1].value).toBe(2);
  });

  it('parses subtraction "5 - 3"', () => {
    const node = parse('5 - 3') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('subtract');
    expect(node.args[0].value).toBe(5);
    expect(node.args[1].value).toBe(3);
  });

  it('parses multiplication "4 * 7"', () => {
    const node = parse('4 * 7') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('multiply');
  });

  it('parses division "10 / 2"', () => {
    const node = parse('10 / 2') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('divide');
  });

  it('parses power "2 ^ 3"', () => {
    const node = parse('2 ^ 3') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('pow');
    expect(node.args[0].value).toBe(2);
    expect(node.args[1].value).toBe(3);
  });

  it('parses modulo "10 mod 3"', () => {
    const node = parse('10 mod 3') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('mod');
  });

  it('parses percent operator "50 %"', () => {
    // Unary %, which is parsed as 50 / 100
    const node = parse('50%') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('divide');
  });
});

// ─── Operator precedence ──────────────────────────────────────────────────────

describe('parse – operator precedence', () => {
  it('"2 + 3 * 4" respects multiplication before addition', () => {
    const node = parse('2 + 3 * 4') as any;
    expect(node.fn).toBe('add');
    // Right operand must be the multiply node
    expect(node.args[1].fn).toBe('multiply');
  });

  it('"2 ^ 3 ^ 2" is right-associative for power', () => {
    // Should parse as 2 ^ (3 ^ 2)
    const node = parse('2 ^ 3 ^ 2') as any;
    expect(node.fn).toBe('pow');
    expect(node.args[1].fn).toBe('pow');
  });

  it('unary minus binds tighter than addition: -3 + 4', () => {
    const node = parse('-3 + 4') as any;
    expect(node.fn).toBe('add');
    expect(node.args[0].fn).toBe('unaryMinus');
  });

  it('"1 - 2 + 3" is left-associative', () => {
    // Should parse as (1 - 2) + 3
    const node = parse('1 - 2 + 3') as any;
    expect(node.fn).toBe('add');
    expect(node.args[0].fn).toBe('subtract');
  });
});

// ─── Parentheses ──────────────────────────────────────────────────────────────

describe('parse – parentheses', () => {
  it('produces a ParenthesisNode for "(1 + 2)"', () => {
    const node = parse('(1 + 2)') as any;
    expect(nodeType(node)).toBe('ParenthesisNode');
    expect(nodeType(node.content)).toBe('OperatorNode');
  });

  it('parentheses change precedence: "(2 + 3) * 4"', () => {
    const node = parse('(2 + 3) * 4') as any;
    expect(node.fn).toBe('multiply');
    expect(nodeType(node.args[0])).toBe('ParenthesisNode');
    expect(node.args[0].content.fn).toBe('add');
  });

  it('nested parentheses', () => {
    const node = parse('((7))') as any;
    expect(nodeType(node)).toBe('ParenthesisNode');
    expect(nodeType(node.content)).toBe('ParenthesisNode');
  });
});

// ─── Function calls ───────────────────────────────────────────────────────────

describe('parse – function calls', () => {
  it('parses "sin(x)" into a FunctionNode', () => {
    const node = parse('sin(x)') as any;
    expect(nodeType(node)).toBe('FunctionNode');
    expect(node.fn.name).toBe('sin');
    expect(node.args.length).toBe(1);
    expect(nodeType(node.args[0])).toBe('SymbolNode');
    expect(node.args[0].name).toBe('x');
  });

  it('parses zero-argument call "f()"', () => {
    const node = parse('f()') as any;
    expect(nodeType(node)).toBe('FunctionNode');
    expect(node.args.length).toBe(0);
  });

  it('parses multi-argument call "max(1, 2, 3)"', () => {
    const node = parse('max(1, 2, 3)') as any;
    expect(nodeType(node)).toBe('FunctionNode');
    expect(node.fn.name).toBe('max');
    expect(node.args.length).toBe(3);
  });

  it('parses nested function calls "sqrt(abs(x))"', () => {
    const node = parse('sqrt(abs(x))') as any;
    expect(nodeType(node)).toBe('FunctionNode');
    expect(node.fn.name).toBe('sqrt');
    expect(nodeType(node.args[0])).toBe('FunctionNode');
    expect(node.args[0].fn.name).toBe('abs');
  });
});

// ─── Variable assignment ──────────────────────────────────────────────────────

describe('parse – variable assignment', () => {
  it('parses "x = 5" into AssignmentNode', () => {
    const node = parse('x = 5') as any;
    expect(nodeType(node)).toBe('AssignmentNode');
    expect(node.object.name).toBe('x');
    expect(node.value.value).toBe(5);
  });

  it('parses "a = b + 1"', () => {
    const node = parse('a = b + 1') as any;
    expect(nodeType(node)).toBe('AssignmentNode');
    expect(node.object.name).toBe('a');
    expect(nodeType(node.value)).toBe('OperatorNode');
  });
});

// ─── Function assignment ──────────────────────────────────────────────────────

describe('parse – function assignment', () => {
  it('parses "f(x) = x^2" into FunctionAssignmentNode', () => {
    const node = parse('f(x) = x^2') as any;
    expect(nodeType(node)).toBe('FunctionAssignmentNode');
    expect(node.name).toBe('f');
    expect(node.params).toEqual(['x']);
    expect(nodeType(node.expr)).toBe('OperatorNode');
    expect(node.expr.fn).toBe('pow');
  });

  it('parses multi-param function assignment "g(a, b) = a + b"', () => {
    const node = parse('g(a, b) = a + b') as any;
    expect(nodeType(node)).toBe('FunctionAssignmentNode');
    expect(node.name).toBe('g');
    expect(node.params).toEqual(['a', 'b']);
  });
});

// ─── Block and semicolon sequences ───────────────────────────────────────────

describe('parse – block sequences', () => {
  it('parses "a; b" into BlockNode with two entries', () => {
    const node = parse('a; b') as any;
    expect(nodeType(node)).toBe('BlockNode');
    expect(node.blocks.length).toBe(2);
    expect(node.blocks[0].visible).toBe(false);
    expect(node.blocks[1].visible).toBe(true);
  });

  it('parses newline-separated "a\\nb" into BlockNode', () => {
    const node = parse('a\nb') as any;
    expect(nodeType(node)).toBe('BlockNode');
    expect(node.blocks.length).toBe(2);
    // newline: both blocks visible
    expect(node.blocks[0].visible).toBe(true);
    expect(node.blocks[1].visible).toBe(true);
  });

  it('parses three expressions separated by semicolons', () => {
    const node = parse('a; b; c') as any;
    expect(nodeType(node)).toBe('BlockNode');
    expect(node.blocks.length).toBe(3);
  });
});

// ─── Conditional (ternary) ────────────────────────────────────────────────────

describe('parse – conditional operator', () => {
  it('parses "x > 0 ? 1 : -1" into ConditionalNode', () => {
    const node = parse('x > 0 ? 1 : -1') as any;
    expect(nodeType(node)).toBe('ConditionalNode');
    expect(nodeType(node.condition)).toBe('OperatorNode');
    expect(node.condition.fn).toBe('larger');
    expect(nodeType(node.trueExpr)).toBe('ConstantNode');
    expect(node.trueExpr.value).toBe(1);
  });

  it('parses nested ternary (right-associative)', () => {
    const node = parse('a ? b : c ? d : e') as any;
    expect(nodeType(node)).toBe('ConditionalNode');
    // The false branch should be another ConditionalNode
    expect(nodeType(node.falseExpr)).toBe('ConditionalNode');
  });
});

// ─── Comparison operators ─────────────────────────────────────────────────────

describe('parse – comparison operators', () => {
  it('parses "a == b" with fn "equal"', () => {
    const node = parse('a == b') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('equal');
  });

  it('parses "a != b" with fn "unequal"', () => {
    const node = parse('a != b') as any;
    expect(node.fn).toBe('unequal');
  });

  it('parses "a < b" with fn "smaller"', () => {
    const node = parse('a < b') as any;
    expect(node.fn).toBe('smaller');
  });

  it('parses "a > b" with fn "larger"', () => {
    const node = parse('a > b') as any;
    expect(node.fn).toBe('larger');
  });

  it('parses "a <= b" with fn "smallerEq"', () => {
    const node = parse('a <= b') as any;
    expect(node.fn).toBe('smallerEq');
  });

  it('parses "a >= b" with fn "largerEq"', () => {
    const node = parse('a >= b') as any;
    expect(node.fn).toBe('largerEq');
  });

  it('parses chained comparison "1 < x < 10" into RelationalNode', () => {
    const node = parse('1 < x < 10') as any;
    expect(nodeType(node)).toBe('RelationalNode');
    expect(node.conditionals).toEqual(['smaller', 'smaller']);
    expect(node.params.length).toBe(3);
  });
});

// ─── Logical operators ────────────────────────────────────────────────────────

describe('parse – logical operators', () => {
  it('parses "a and b" into OperatorNode:and', () => {
    const node = parse('a and b') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('and');
    expect(node.args.length).toBe(2);
  });

  it('parses "a or b" into OperatorNode:or', () => {
    const node = parse('a or b') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('or');
  });

  it('parses "a xor b" into OperatorNode:xor', () => {
    const node = parse('a xor b') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('xor');
  });

  it('parses "not a" into OperatorNode:not', () => {
    const node = parse('not a') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('not');
    expect(node.args.length).toBe(1);
  });
});

// ─── Bitwise operators ────────────────────────────────────────────────────────

describe('parse – bitwise operators', () => {
  it('parses "a & b" into OperatorNode:bitAnd', () => {
    const node = parse('a & b') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('bitAnd');
  });

  it('parses "a | b" into OperatorNode:bitOr', () => {
    const node = parse('a | b') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('bitOr');
  });

  it('parses "~a" into OperatorNode:bitNot', () => {
    const node = parse('~a') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('bitNot');
  });

  it('parses "a << 2" into OperatorNode:leftShift', () => {
    const node = parse('a << 2') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('leftShift');
  });

  it('parses "a >> 2" into OperatorNode:rightArithShift', () => {
    const node = parse('a >> 2') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('rightArithShift');
  });
});

// ─── Range expressions ────────────────────────────────────────────────────────

describe('parse – range expressions', () => {
  it('parses "1:5" into RangeNode', () => {
    const node = parse('1:5') as any;
    expect(nodeType(node)).toBe('RangeNode');
    expect(node.start.value).toBe(1);
    expect(node.end.value).toBe(5);
  });

  it('parses "1:2:10" (start:step:end) into RangeNode with step', () => {
    const node = parse('1:2:10') as any;
    expect(nodeType(node)).toBe('RangeNode');
    expect(node.start.value).toBe(1);
    expect(node.step.value).toBe(2);
    expect(node.end.value).toBe(10);
  });
});

// ─── Array literals ───────────────────────────────────────────────────────────

describe('parse – array literals', () => {
  it('parses empty array "[]" into ArrayNode', () => {
    const node = parse('[]') as any;
    expect(nodeType(node)).toBe('ArrayNode');
    expect(node.items.length).toBe(0);
  });

  it('parses "[1, 2, 3]" into ArrayNode with 3 items', () => {
    const node = parse('[1, 2, 3]') as any;
    expect(nodeType(node)).toBe('ArrayNode');
    expect(node.items.length).toBe(3);
    expect(node.items[0].value).toBe(1);
    expect(node.items[2].value).toBe(3);
  });

  it('parses 2D matrix "[1, 2; 3, 4]"', () => {
    const node = parse('[1, 2; 3, 4]') as any;
    expect(nodeType(node)).toBe('ArrayNode');
    // Outer array has 2 rows
    expect(node.items.length).toBe(2);
    expect(nodeType(node.items[0])).toBe('ArrayNode');
    expect(node.items[0].items.length).toBe(2);
  });
});

// ─── Object literals ──────────────────────────────────────────────────────────

describe('parse – object literals', () => {
  it('parses "{a: 1, b: 2}" into ObjectNode', () => {
    const node = parse('{a: 1, b: 2}') as any;
    expect(nodeType(node)).toBe('ObjectNode');
    expect(Object.keys(node.properties)).toContain('a');
    expect(Object.keys(node.properties)).toContain('b');
    expect(node.properties.a.value).toBe(1);
    expect(node.properties.b.value).toBe(2);
  });

  it('parses object with string key', () => {
    const node = parse('{"key": 42}') as any;
    expect(nodeType(node)).toBe('ObjectNode');
    expect(node.properties['key'].value).toBe(42);
  });
});

// ─── Index / property access ──────────────────────────────────────────────────

describe('parse – index access', () => {
  it('parses "a[1]" into AccessorNode', () => {
    const node = parse('a[1]') as any;
    expect(nodeType(node)).toBe('AccessorNode');
    expect(node.object.name).toBe('a');
  });

  it('parses dot access "obj.prop" into AccessorNode', () => {
    const node = parse('obj.prop') as any;
    expect(nodeType(node)).toBe('AccessorNode');
    expect(node.object.name).toBe('obj');
  });

  it('parses chained access "a.b.c"', () => {
    const node = parse('a.b.c') as any;
    expect(nodeType(node)).toBe('AccessorNode');
    // The innermost accessor wraps the outermost one
    expect(nodeType(node.object)).toBe('AccessorNode');
  });
});

// ─── Whitespace tolerance ─────────────────────────────────────────────────────

describe('parse – whitespace tolerance', () => {
  it('handles leading/trailing spaces', () => {
    const node = parse('  42  ') as any;
    expect(nodeType(node)).toBe('ConstantNode');
    expect(node.value).toBe(42);
  });

  it('handles tabs around operator', () => {
    const node = parse('1\t+\t2') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('add');
  });

  it('handles multiple spaces between tokens', () => {
    const node = parse('x   *   y') as any;
    expect(nodeType(node)).toBe('OperatorNode');
    expect(node.fn).toBe('multiply');
  });
});

// ─── Array of expressions (parseMultiple) ────────────────────────────────────

describe('parse – array of expressions', () => {
  it('parses an array of expression strings into an array of nodes', () => {
    const nodes = parse(['1 + 2', 'x', 'sin(a)']) as any[];
    expect(Array.isArray(nodes)).toBe(true);
    expect(nodes.length).toBe(3);
    expect(nodeType(nodes[0])).toBe('OperatorNode');
    expect(nodeType(nodes[1])).toBe('SymbolNode');
    expect(nodeType(nodes[2])).toBe('FunctionNode');
  });

  it('throws if an array element is not a string', () => {
    expect(() => parse([42 as unknown as string])).toThrow();
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('parse – error handling', () => {
  it('throws SyntaxError for unexpected end of expression "1 +"', () => {
    expect(() => parse('1 +')).toThrow(SyntaxError);
  });

  it('throws SyntaxError for unmatched parenthesis "(1 + 2"', () => {
    expect(() => parse('(1 + 2')).toThrow(SyntaxError);
  });

  it('throws for invalid operator "//"', () => {
    expect(() => parse('1 // 2')).toThrow();
  });

  it('throws for bad assignment LHS "1 + 2 = 3"', () => {
    expect(() => parse('1 + 2 = 3')).toThrow(SyntaxError);
  });

  it('throws for unmatched bracket "[1, 2"', () => {
    expect(() => parse('[1, 2')).toThrow(SyntaxError);
  });

  it('throws for bad escape character in string', () => {
    expect(() => parse('"\\q"')).toThrow(SyntaxError);
  });

  it('throws for bad invalid unicode escape', () => {
    expect(() => parse('"\\uXXXX"')).toThrow(SyntaxError);
  });
});

// ─── parse static helpers ─────────────────────────────────────────────────────

describe('parse – static helpers', () => {
  it('parse.isDigit identifies digits 0-9', () => {
    expect((parse as any).isDigit('0')).toBe(true);
    expect((parse as any).isDigit('9')).toBe(true);
    expect((parse as any).isDigit('a')).toBe(false);
  });

  it('parse.isDigitDot identifies digits and dots', () => {
    expect((parse as any).isDigitDot('5')).toBe(true);
    expect((parse as any).isDigitDot('.')).toBe(true);
    expect((parse as any).isDigitDot('x')).toBe(false);
  });

  it('parse.isWhitespace: space and tab are whitespace', () => {
    expect((parse as any).isWhitespace(' ', 0)).toBe(true);
    expect((parse as any).isWhitespace('\t', 0)).toBe(true);
  });

  it('parse.isWhitespace: newline at nesting 0 is NOT whitespace', () => {
    expect((parse as any).isWhitespace('\n', 0)).toBe(false);
  });

  it('parse.isWhitespace: newline inside params (nesting>0) IS whitespace', () => {
    expect((parse as any).isWhitespace('\n', 1)).toBe(true);
  });

  it('parse.isDecimalMark: dot before digit is decimal', () => {
    expect((parse as any).isDecimalMark('.', '5')).toBe(true);
  });

  it('parse.isDecimalMark: dot before * / ^ is NOT decimal', () => {
    expect((parse as any).isDecimalMark('.', '*')).toBe(false);
    expect((parse as any).isDecimalMark('.', '/')).toBe(false);
    expect((parse as any).isDecimalMark('.', '^')).toBe(false);
  });

  it('parse.isValidLatinOrGreek: letters, underscore, dollar', () => {
    expect((parse as any).isValidLatinOrGreek('a')).toBe(true);
    expect((parse as any).isValidLatinOrGreek('Z')).toBe(true);
    expect((parse as any).isValidLatinOrGreek('_')).toBe(true);
    expect((parse as any).isValidLatinOrGreek('$')).toBe(true);
    expect((parse as any).isValidLatinOrGreek('1')).toBe(false);
    expect((parse as any).isValidLatinOrGreek(' ')).toBe(false);
  });

  it('parse.isAlpha: delegates to isValidLatinOrGreek for simple chars', () => {
    expect((parse as any).isAlpha('x', '', '')).toBe(true);
    expect((parse as any).isAlpha('1', '', '')).toBe(false);
  });

  it('parse.isValidMathSymbol: rejects non-surrogate characters', () => {
    expect((parse as any).isValidMathSymbol('a', 'b')).toBe(false);
  });
});
