/**
 * Grammar-surface coverage tests for `expression/src/parse.ts`.
 *
 * This file imports `createParse` directly from `'../src/parse.js'` (mirroring
 * the bootstrap in `parse.test.ts`) so that coverage is attributed to the
 * *source* `parse.ts` rather than the bundled package. The tests drive the
 * full token/grammar surface — number radixes, string escapes, every
 * operator-precedence level, implicit multiplication, accessors / optional
 * chaining, matrices, objects, blocks, ranges — plus the many syntax-error
 * paths. Assertions are round-trip `toString()` / structural checks and exact
 * error-message checks for the throw paths.
 *
 * Companion to `parse.test.ts`; this file targets the previously-uncovered
 * branches (radix tokenizing, rule-2 division, percentage, conversions,
 * custom-node handler, string escapes, matrix dimensions, etc.).
 */
import { describe, it, expect } from 'vitest';

import { createParse } from '../src/parse.js';
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
import { mathTyped } from '@danielsimonjr/mathts-core';

// Register the Node type with typed-function so parse.ts's addConversion works.
try {
  (
    mathTyped as unknown as {
      addType: (
        type: { name: string; test: (x: unknown) => boolean },
        beforePrevious: boolean
      ) => void;
    }
  ).addType(
    {
      name: 'Node',
      test: (x: unknown): boolean =>
        typeof x === 'object' && x !== null && (x as { isNode?: unknown }).isNode === true,
    },
    false
  );
} catch {
  // Already registered (module-level singleton) — ignore.
}

const config = { number: 'number' as const, numberFallback: 'number' as const };

/** Minimal numeric: handles plain decimals + radix prefixes the tokenizer emits. */
function numeric(value: string, _type: string): number {
  return Number(value);
}

function isBounded(_v: unknown): boolean {
  return false;
}

class ResultSet {
  entries: unknown[];
  constructor(entries: unknown[]) {
    this.entries = entries;
  }
}

const mathScope: Record<string, unknown> = {};

/** Options accepted by the parse function under test. */
interface ParseOptions {
  nodes?: Record<string, unknown>;
}

/**
 * Structural view of a parsed node. The parser returns concrete node subtypes;
 * these are the type-guard flags, subtype fields, and methods read off results
 * in this file (all optional, since which are present depends on the node kind).
 */
interface ParsedNode {
  isConstantNode?: boolean;
  isOperatorNode?: boolean;
  isRelationalNode?: boolean;
  isConditionalNode?: boolean;
  isFunctionNode?: boolean;
  isFunctionAssignmentNode?: boolean;
  isAssignmentNode?: boolean;
  isBlockNode?: boolean;
  isPercentage?: boolean;
  value?: unknown;
  fn?: string;
  args?: ParsedNode[];
  falseExpr?: ParsedNode;
  comment?: string;
  params?: unknown[];
  toString(): string;
}

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
  subset: (_obj: unknown) => _obj,
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
}) as unknown as (expr: string | string[], options?: ParseOptions) => ParsedNode;

const str = (s: string) => parse(s).toString();

describe('parse — numbers', () => {
  it('parses decimals and integers', () => {
    expect(str('3.14')).toBe('3.14');
    expect(str('42')).toBe('42');
  });

  it('parses leading-dot and trailing-dot decimals', () => {
    expect(str('.5')).toBe('0.5');
    expect(str('2.')).toBe('2');
  });

  it('parses scientific notation', () => {
    expect(parse('2e3').value).toBe(2000);
    expect(parse('1.5e-2').value).toBeCloseTo(0.015);
    expect(parse('2E2').value).toBe(200);
    expect(parse('3e+2').value).toBe(300);
  });

  it('parses hex, binary, and octal literals as number tokens', () => {
    // numeric() here uses Number(), which understands 0x/0b/0o prefixes.
    expect(parse('0x1A').value).toBe(26);
    expect(parse('0b101').value).toBe(5);
    expect(parse('0o17').value).toBe(15);
  });

  it('parses a radix literal with a word-size suffix without throwing', () => {
    const n = parse('0xFFi16');
    expect(n.isConstantNode).toBe(true);
  });

  it('parses a radix literal with a radix point without throwing', () => {
    // exercises the "radix has a '.' point" branch of the tokenizer
    const n = parse('0b1.1');
    expect(n.isConstantNode).toBe(true);
  });

  it('throws on an incomplete exponent', () => {
    expect(() => parse('2e+')).toThrow(/Digit expected/);
  });

  it('throws on a decimal mark after an exponent', () => {
    expect(() => parse('1.2e3.4')).toThrow(/Digit expected/);
  });

  it('throws on a double decimal', () => {
    expect(() => parse('1.2.3')).toThrow(/Unexpected part/);
  });

  it('treats a bare "2e" as implicit multiplication 2 * e', () => {
    expect(str('2e')).toBe('2 e');
  });
});

describe('parse — strings', () => {
  it('parses double and single quoted strings', () => {
    expect(str('"abc"')).toBe('"abc"');
    expect(str("'abc'")).toBe('"abc"');
  });

  it('parses escape sequences', () => {
    expect(parse('"a\\nb"').value).toBe('a\nb');
    expect(parse('"tab\\tend"').value).toBe('tab\tend');
    expect(parse('"q\\"x"').value).toBe('q"x');
    expect(parse('"back\\\\slash"').value).toBe('back\\slash');
    expect(parse('"r\\rf\\fb\\b"').value).toBe('r\rf\fb\b');
    expect(parse('"slash\\/end"').value).toBe('slash/end');
  });

  it('parses a unicode escape', () => {
    expect(parse('"\\u0041"').value).toBe('A');
  });

  it('throws on an unterminated string', () => {
    expect(() => parse('"abc')).toThrow(/End of string/);
  });

  it('throws on a bad escape character', () => {
    expect(() => parse('"\\q"')).toThrow(/Bad escape character/);
  });

  it('throws on an invalid unicode escape', () => {
    expect(() => parse('"\\u00zz"')).toThrow(/Invalid unicode character/);
  });
});

describe('parse — arithmetic & precedence', () => {
  it('respects multiplication over addition', () => {
    expect(str('2+3*4')).toBe('2 + 3 * 4');
  });

  it('treats power as right-associative', () => {
    const n = parse('2^3^2');
    expect(n.fn).toBe('pow');
    // right child is itself a pow
    expect(n.args![1].fn).toBe('pow');
  });

  it('parses dotPow, dotMultiply and dotDivide', () => {
    expect(str('a.^b')).toBe('a .^ b');
    expect(str('a.*b')).toBe('a .* b');
    expect(str('a./b')).toBe('a ./ b');
  });

  it('parses modulus via % and mod', () => {
    expect(str('a%b')).toBe('a % b');
    expect(parse('7 mod 3').fn).toBe('mod');
  });
});

describe('parse — unary, postfix, percentage', () => {
  it('parses unary minus, plus, bitwise-not, logical-not', () => {
    expect(str('-x')).toBe('-x');
    expect(str('+x')).toBe('+x');
    expect(str('~5')).toBe('~5');
    expect(str('not x')).toBe('not x');
  });

  it('parses factorial and ctranspose postfix operators', () => {
    expect(str('5!')).toBe('5!');
    expect(str("a'")).toBe("a'");
  });

  it('parses a postfix factorial followed by an accessor', () => {
    // exercises parseLeftHandOperators → parseAccessors after the '!'
    expect(str('a!.b')).toBe('(a!).b');
  });

  it('parses unary percentage as value / 100', () => {
    expect(str('10%')).toBe('10 / 100');
    const n = parse('10%');
    expect(n.isPercentage).toBe(true);
  });

  it('parses x + y% as x + x * y (percentage inside add)', () => {
    // 100 + 10% → add(100, multiply(100, 10/100))
    const n = parse('100 + 10%') as any;
    expect(n.fn).toBe('add');
    expect(n.args[1].fn).toBe('multiply');
  });

  it('parses binary modulo % when a term follows', () => {
    // "10 % 3" → after the %, a unary term parses, so it is binary mod
    expect(str('10 % 3')).toBe('10 % 3');
  });
});

describe('parse — comparison & relational chains', () => {
  it('parses a single comparison as an OperatorNode', () => {
    const n = parse('a == b');
    expect(n.isOperatorNode).toBe(true);
    expect(str('a==b')).toBe('a == b');
    expect(str('a!=b')).toBe('a != b');
    expect(str('a<=b')).toBe('a <= b');
    expect(str('a>=b')).toBe('a >= b');
  });

  it('parses a 3-way chain as a RelationalNode', () => {
    const n = parse('1 < 2 < 3');
    expect(n.isRelationalNode).toBe(true);
  });
});

describe('parse — logical & bitwise operators', () => {
  it('parses logical and/or/xor', () => {
    expect(str('a and b')).toBe('a and b');
    expect(str('a or b')).toBe('a or b');
    expect(str('a xor b')).toBe('a xor b');
  });

  it('parses bitwise and/or/xor', () => {
    expect(str('a&b')).toBe('a & b');
    expect(str('a|b')).toBe('a | b');
    expect(str('a^|b')).toBe('a ^| b');
  });

  it('parses shift operators', () => {
    expect(str('a<<b')).toBe('a << b');
    expect(str('a>>b')).toBe('a >> b');
    expect(str('a>>>b')).toBe('a >>> b');
  });

  it('parses nullish coalescing', () => {
    expect(str('a??b')).toBe('a ?? b');
  });
});

describe('parse — conditional operator', () => {
  it('parses a ? b : c into a ConditionalNode', () => {
    const n = parse('a ? b : c');
    expect(n.isConditionalNode).toBe(true);
    expect(str('a?b:c')).toBe('a ? b : c');
  });

  it('parses nested (right-associative) conditionals', () => {
    const n = parse('a ? b : c ? d : e') as any;
    expect(n.isConditionalNode).toBe(true);
    // false-expr is itself a conditional
    expect(n.falseExpr.isConditionalNode).toBe(true);
  });

  it('throws when the false-part is missing', () => {
    expect(() => parse('a ? b')).toThrow(/False part of conditional/);
  });

  it('throws on an empty true-expression (range collision)', () => {
    expect(() => parse('a ? : b')).toThrow();
  });
});

describe('parse — ranges', () => {
  it('parses start:end and start:step:end', () => {
    expect(str('1:5')).toBe('1:5');
    expect(str('1:2:10')).toBe('1:2:10');
  });

  it('parses an implicit start (:5 → 1:5)', () => {
    expect(str(':5')).toBe('1:5');
  });

  it('parses an implicit end (1: → 1:end)', () => {
    expect(str('1:')).toBe('1:end');
  });

  it('parses a bare colon (: → 1:end)', () => {
    expect(str(':')).toBe('1:end');
  });

  it('parses a range used as a matrix index with implicit ends', () => {
    expect(str('a[:, 1]')).toBe('a[1:end, 1]');
  });
});

describe('parse — unit conversion (to / in)', () => {
  it('parses "a to b" and "a in b"', () => {
    expect(str('2 inch to cm')).toBe('2 inch to cm');
    expect(str('5 cm in mm')).toBe('5 cm in mm');
  });

  it('treats a trailing "in" as the unit "inch" (implicit multiply)', () => {
    expect(str('5 in')).toBe('5 in');
  });

  it('throws when conversion target is missing', () => {
    expect(() => parse('1 to')).toThrow(/Unexpected end of expression/);
  });
});

describe('parse — implicit multiplication', () => {
  it('parses number-symbol implicit multiply', () => {
    expect(str('2x')).toBe('2 x');
  });

  it('parses number-parenthesis implicit multiply', () => {
    expect(str('2(3)')).toBe('2 (3)');
  });

  it('parses parenthesis-parenthesis implicit multiply', () => {
    expect(str('(2)(3)')).toBe('(2) (3)');
  });

  it('applies rule-2 (explicit division before implicit multiply)', () => {
    // 6/2 x → (6/2) x per rule 2
    expect(str('6/2 x')).toBe('6 / 2 x');
  });

  it('does not apply rule-2 when no symbol follows the division', () => {
    // 6/2/3 stays as nested divides (rule-2 lookahead fails, rewinds)
    expect(str('6/2/3')).toBe('6 / 2 / 3');
  });
});

describe('parse — functions & function assignment', () => {
  it('parses function calls with 1 and many args', () => {
    expect(str('sqrt(4)')).toBe('sqrt(4)');
    expect(str('f(x, y)')).toBe('f(x, y)');
  });

  it('parses nested function calls', () => {
    expect(str('sin(cos(0))')).toBe('sin(cos(0))');
  });

  it('parses a function-assignment definition', () => {
    const n = parse('f(x) = x^2');
    expect(n.isFunctionAssignmentNode).toBe(true);
    expect(str('f(x) = x^2')).toBe('f(x) = x ^ 2');
  });

  it('parses a zero-arg function-assignment definition', () => {
    expect(str('f() = 1')).toBe('f() = 1');
  });

  it('throws Parenthesis ) expected on an unclosed call', () => {
    expect(() => parse('sqrt(2')).toThrow(/Parenthesis \) expected/);
  });
});

describe('parse — matrices & rows', () => {
  it('parses a vector', () => {
    expect(str('[1,2,3]')).toBe('[1, 2, 3]');
  });

  it('parses a 2-D matrix', () => {
    expect(str('[1,2;3,4]')).toBe('[[1, 2], [3, 4]]');
  });

  it('parses an empty matrix', () => {
    expect(str('[]')).toBe('[]');
  });

  it('parses a range inside a matrix', () => {
    expect(str('[1:3]')).toBe('[1:3]');
  });

  it('parses a trailing comma in a matrix row', () => {
    expect(str('[1, 2, ]')).toBe('[1, 2]');
  });

  it('throws on a column-dimension mismatch', () => {
    expect(() => parse('[1,2;3]')).toThrow(/Column dimensions mismatch/);
  });

  it('throws on an unterminated matrix', () => {
    expect(() => parse('[1,2')).toThrow(/End of matrix \] expected/);
  });

  it('throws on an unterminated 2-D matrix', () => {
    expect(() => parse('[1;2')).toThrow(/End of matrix \] expected/);
  });
});

describe('parse — objects', () => {
  it('parses an object literal with symbol keys', () => {
    expect(str('{a: 1, b: 2}')).toBe('{"a": 1, "b": 2}');
  });

  it('parses a nested object literal', () => {
    expect(str('{a: {b: 1}}')).toBe('{"a": {"b": 1}}');
  });

  it('parses an object literal with a string key', () => {
    expect(str('{"k": 1}')).toBe('{"k": 1}');
  });

  it('parses an object with a named-delimiter key (e.g. "in")', () => {
    // 'in' is a NAMED_DELIMITER but is accepted as an object key
    expect(str('{in: 1}')).toBe('{"in": 1}');
  });

  it('throws when a key is neither symbol nor string', () => {
    expect(() => parse('{1: 2}')).toThrow(/Symbol or string expected/);
  });

  it('throws when the colon separator is missing', () => {
    expect(() => parse('{a 1}')).toThrow(/Colon : expected/);
  });

  it('throws when the closing brace is missing', () => {
    expect(() => parse('{a:1')).toThrow(/Comma , or bracket } expected/);
  });
});

describe('parse — accessors, indexing & optional chaining', () => {
  it('parses dot-notation property access (chained)', () => {
    expect(str('a.b')).toBe('a.b');
    expect(str('a.b.c')).toBe('a.b.c');
  });

  it('parses bracket indexing and mixed access', () => {
    expect(str('a[2]')).toBe('a[2]');
    expect(str('a.b[1]')).toBe('a.b[1]');
  });

  it('parses an "end" index symbol', () => {
    expect(str('a[end]')).toBe('a[end]');
  });

  it('parses optional chaining for property, index, and call', () => {
    expect(str('a?.b')).toBe('a?.b');
    expect(str('a?.[1]')).toBe('a?.[1]');
    expect(parse('a?.(2)').isFunctionNode).toBe(true);
  });

  it('parses a method call on an accessor (obj.fn(2))', () => {
    expect(str('obj.fn(2)')).toBe('obj.fn(2)');
  });

  it('parses a property access using a named-delimiter name', () => {
    // dot followed by a NAMED_DELIMITER token ('in') is a valid property name
    expect(str('a.in')).toBe('a.in');
  });

  it('throws when a property name is missing after dot', () => {
    expect(() => parse('a.')).toThrow(/Property name expected after dot/);
  });

  it('throws when a property name is missing after optional chain', () => {
    expect(() => parse('a?.')).toThrow(/Property name expected after optional chain/);
  });

  it('throws on an unterminated index', () => {
    expect(() => parse('a[2')).toThrow(/Parenthesis \] expected/);
  });

  it('rejects assignment to an optional chain', () => {
    expect(() => parse('a?.b = 1')).toThrow(/Cannot assign to optional chain/);
  });
});

describe('parse — assignments', () => {
  it('parses a simple variable assignment', () => {
    const n = parse('x = 5');
    expect(n.isAssignmentNode).toBe(true);
    expect(str('x = 5')).toBe('x = 5');
  });

  it('parses a property assignment', () => {
    expect(str('a.b = 1')).toBe('a.b = 1');
  });

  it('parses a matrix-subset assignment', () => {
    expect(str('a[2] = 3')).toBe('a[2] = 3');
    expect(str('a.b[2] = 3')).toBe('a.b[2] = 3');
  });

  it('throws on an invalid left-hand side', () => {
    expect(() => parse('2 = 3')).toThrow(/Invalid left hand side/);
  });
});

describe('parse — blocks & comments', () => {
  it('parses a multi-statement block separated by newlines', () => {
    const n = parse('a = 1\nb = 2\na + b');
    expect(n.isBlockNode).toBe(true);
  });

  it('parses a semicolon-separated block (suppressed output)', () => {
    const n = parse('a = 1; b = 2; a + b');
    expect(n.isBlockNode).toBe(true);
  });

  it('parses a single statement with a trailing semicolon as a block', () => {
    const n = parse('a = 1;');
    expect(n.isBlockNode).toBe(true);
  });

  it('strips a trailing hash comment', () => {
    expect(str('2 + 3 # comment')).toBe('2 + 3');
  });

  it('parses a lone comment as an undefined constant', () => {
    const n = parse('# only a comment');
    expect(n.isConstantNode).toBe(true);
  });

  it('attaches a comment to a node', () => {
    const n = parse('2 # note') as any;
    expect(n.comment).toContain('note');
  });
});

describe('parse — parentheses & constants', () => {
  it('parses parenthesized and redundant-parenthesized expressions', () => {
    expect(str('(1+2)*3')).toBe('(1 + 2) * 3');
    expect(str('((1))')).toBe('((1))');
  });

  it('parses boolean/null constants and numeric constants', () => {
    expect((parse('true') as any).value).toBe(true);
    expect((parse('false') as any).value).toBe(false);
    expect((parse('null') as any).value).toBe(null);
    expect(Number.isNaN((parse('NaN') as any).value)).toBe(true);
    expect((parse('Infinity') as any).value).toBe(Infinity);
  });

  it('throws Parenthesis ) expected on an unclosed paren', () => {
    expect(() => parse('(1+2')).toThrow(/Parenthesis \) expected/);
  });

  it('throws Value expected / Unexpected end on incomplete input', () => {
    expect(() => parse('2+')).toThrow(/Unexpected end of expression/);
    expect(() => parse(')')).toThrow(/Value expected/);
  });

  it('throws a syntax error on an unknown character', () => {
    expect(() => parse('@')).toThrow(/Syntax error in part/);
  });

  it('throws "Unexpected operator" on a stray binary operator', () => {
    expect(() => parse('a ~ b')).toThrow(/Unexpected operator/);
  });
});

describe('parse — custom node handlers', () => {
  it('invokes a custom node constructor with parsed params', () => {
    const seen: any[] = [];
    class CustomNode {
      params: any[];
      isNode = true;
      type = 'CustomNode';
      constructor(params: any[]) {
        this.params = params;
        seen.push(params);
      }
      toString() {
        return 'CUSTOM';
      }
    }
    const node = parse('plot(1, 2)', { nodes: { plot: CustomNode } }) as any;
    expect(node).toBeInstanceOf(CustomNode);
    expect(node.params).toHaveLength(2);
    expect(seen).toHaveLength(1);
  });

  it('invokes a custom node constructor with no params', () => {
    class CustomNode {
      params: any[];
      isNode = true;
      type = 'CustomNode';
      constructor(params: any[]) {
        this.params = params;
      }
      toString() {
        return 'C';
      }
    }
    const node = parse('thing', { nodes: { thing: CustomNode } }) as any;
    expect(node).toBeInstanceOf(CustomNode);
    expect(node.params).toEqual([]);
  });

  it('throws Parenthesis ) expected on an unclosed custom-node call', () => {
    class CustomNode {
      isNode = true;
      type = 'CustomNode';
      constructor(public params: any[]) {}
      toString() {
        return 'C';
      }
    }
    expect(() => parse('plot(1', { nodes: { plot: CustomNode } })).toThrow(
      /Parenthesis \) expected/
    );
  });
});

describe('parse — array & matrix input forms', () => {
  it('parses an array of expression strings into an array of nodes', () => {
    const nodes = parse(['1 + 1', '2 + 2', 'sqrt(9)']) as any[];
    expect(Array.isArray(nodes)).toBe(true);
    expect(nodes).toHaveLength(3);
    expect(nodes[0].toString()).toBe('1 + 1');
    expect(nodes[1].toString()).toBe('2 + 2');
    expect(nodes[2].toString()).toBe('sqrt(9)');
  });

  it('parses an array of expressions with an options object', () => {
    const nodes = parse(['1 + 1'], { nodes: {} }) as any[];
    expect(nodes[0].toString()).toBe('1 + 1');
  });

  it('throws when an array element is not a string', () => {
    expect(() => parse([42 as any])).toThrow(/String expected/);
  });

  it('accepts the string + options overload', () => {
    const n = parse('1 + 2', { nodes: {} });
    expect(n.toString()).toBe('1 + 2');
  });

  it('accepts the string + options overload with undefined nodes', () => {
    const n = parse('3 + 4', {});
    expect(n.toString()).toBe('3 + 4');
  });
});
