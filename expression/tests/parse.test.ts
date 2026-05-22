import { describe, it, expect } from 'vitest'
// Use the fully instantiated parse from the functions package evaluate factory,
// which wires up all node constructors and the typed/numeric dependencies.
import { parse } from '../../functions/src/factories/evaluate.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nodeType(node: any): string {
  return node.type
}

// ─── Number literals ──────────────────────────────────────────────────────────

describe('parse - number literals', () => {
  it('parses an integer into a ConstantNode', () => {
    const node = parse('42')
    expect(nodeType(node)).toBe('ConstantNode')
    expect((node as any).value).toBe(42)
  })

  it('parses a float', () => {
    const node = parse('3.14') as any
    expect(nodeType(node)).toBe('ConstantNode')
    expect(node.value).toBeCloseTo(3.14)
  })

  it('parses zero', () => {
    const node = parse('0') as any
    expect(nodeType(node)).toBe('ConstantNode')
    expect(node.value).toBe(0)
  })

  it('parses a negative number via unary minus', () => {
    const node = parse('-5') as any
    expect(nodeType(node)).toBe('OperatorNode')
    expect(node.fn).toBe('unaryMinus')
    expect(nodeType(node.args[0])).toBe('ConstantNode')
    expect(node.args[0].value).toBe(5)
  })

  it('parses scientific notation: 1.5e3', () => {
    const node = parse('1.5e3') as any
    expect(nodeType(node)).toBe('ConstantNode')
    expect(node.value).toBe(1500)
  })

  it('parses scientific notation with negative exponent: 2.5e-2', () => {
    const node = parse('2.5e-2') as any
    expect(nodeType(node)).toBe('ConstantNode')
    expect(node.value).toBeCloseTo(0.025)
  })
})

// ─── Boolean and special literals ────────────────────────────────────────────

describe('parse - boolean and special literals', () => {
  it('parses true into a ConstantNode with value true', () => {
    const node = parse('true') as any
    expect(nodeType(node)).toBe('ConstantNode')
    expect(node.value).toBe(true)
  })

  it('parses false into a ConstantNode with value false', () => {
    const node = parse('false') as any
    expect(nodeType(node)).toBe('ConstantNode')
    expect(node.value).toBe(false)
  })

  it('parses null into a ConstantNode with value null', () => {
    const node = parse('null') as any
    expect(nodeType(node)).toBe('ConstantNode')
    expect(node.value).toBe(null)
  })

  it('parses undefined into a ConstantNode with value undefined', () => {
    const node = parse('undefined') as any
    expect(nodeType(node)).toBe('ConstantNode')
    expect(node.value).toBeUndefined()
  })
})

// ─── Symbol nodes ─────────────────────────────────────────────────────────────

describe('parse - symbols', () => {
  it('parses a variable name into a SymbolNode', () => {
    const node = parse('x') as any
    expect(nodeType(node)).toBe('SymbolNode')
    expect(node.name).toBe('x')
  })

  it('parses "pi" into a SymbolNode', () => {
    const node = parse('pi') as any
    expect(nodeType(node)).toBe('SymbolNode')
    expect(node.name).toBe('pi')
  })

  it('parses "e" into a SymbolNode', () => {
    const node = parse('e') as any
    expect(nodeType(node)).toBe('SymbolNode')
    expect(node.name).toBe('e')
  })

  it('parses underscore-prefixed variable', () => {
    const node = parse('_myVar') as any
    expect(nodeType(node)).toBe('SymbolNode')
    expect(node.name).toBe('_myVar')
  })
})

// ─── Arithmetic operators ─────────────────────────────────────────────────────

describe('parse - arithmetic operators', () => {
  it('parses addition "1 + 2" into an OperatorNode', () => {
    const node = parse('1 + 2') as any
    expect(nodeType(node)).toBe('OperatorNode')
    expect(node.op).toBe('+')
    expect(node.fn).toBe('add')
    expect(nodeType(node.args[0])).toBe('ConstantNode')
    expect(nodeType(node.args[1])).toBe('ConstantNode')
    expect(node.args[0].value).toBe(1)
    expect(node.args[1].value).toBe(2)
  })

  it('parses subtraction "5 - 3"', () => {
    const node = parse('5 - 3') as any
    expect(nodeType(node)).toBe('OperatorNode')
    expect(node.fn).toBe('subtract')
    expect(node.args[0].value).toBe(5)
    expect(node.args[1].value).toBe(3)
  })

  it('parses multiplication "4 * 7"', () => {
    const node = parse('4 * 7') as any
    expect(nodeType(node)).toBe('OperatorNode')
    expect(node.fn).toBe('multiply')
  })

  it('parses division "10 / 2"', () => {
    const node = parse('10 / 2') as any
    expect(nodeType(node)).toBe('OperatorNode')
    expect(node.fn).toBe('divide')
  })

  it('parses power "2 ^ 3"', () => {
    const node = parse('2 ^ 3') as any
    expect(nodeType(node)).toBe('OperatorNode')
    expect(node.fn).toBe('pow')
    expect(node.args[0].value).toBe(2)
    expect(node.args[1].value).toBe(3)
  })

  it('parses modulo "10 mod 3"', () => {
    const node = parse('10 mod 3') as any
    expect(nodeType(node)).toBe('OperatorNode')
    expect(node.fn).toBe('mod')
  })
})

// ─── Operator precedence ──────────────────────────────────────────────────────

describe('parse - operator precedence', () => {
  it('"2 + 3 * 4" respects multiplication precedence', () => {
    // Should parse as 2 + (3 * 4)
    const node = parse('2 + 3 * 4') as any
    expect(node.fn).toBe('add')
    expect(node.args[1].fn).toBe('multiply')
  })

  it('"2 ^ 3 ^ 2" is right-associative for power', () => {
    // Should parse as 2 ^ (3 ^ 2)
    const node = parse('2 ^ 3 ^ 2') as any
    expect(node.fn).toBe('pow')
    expect(node.args[1].fn).toBe('pow')
  })

  it('unary minus binds tightly: -3 + 4', () => {
    const node = parse('-3 + 4') as any
    expect(node.fn).toBe('add')
    expect(node.args[0].fn).toBe('unaryMinus')
  })
})

// ─── Parentheses ──────────────────────────────────────────────────────────────

describe('parse - parentheses', () => {
  it('parenthesized expression produces a ParenthesisNode', () => {
    const node = parse('(1 + 2)') as any
    expect(nodeType(node)).toBe('ParenthesisNode')
    expect(nodeType(node.content)).toBe('OperatorNode')
  })

  it('parentheses change precedence', () => {
    // (2 + 3) * 4 should have multiply at root
    const node = parse('(2 + 3) * 4') as any
    expect(node.fn).toBe('multiply')
    expect(nodeType(node.args[0])).toBe('ParenthesisNode')
  })
})

// ─── Function calls ───────────────────────────────────────────────────────────

describe('parse - function calls', () => {
  it('parses "sin(x)" into a FunctionNode', () => {
    const node = parse('sin(x)') as any
    expect(nodeType(node)).toBe('FunctionNode')
    expect(node.fn.name).toBe('sin')
    expect(node.args.length).toBe(1)
    expect(nodeType(node.args[0])).toBe('SymbolNode')
    expect(node.args[0].name).toBe('x')
  })

  it('parses "sqrt(16)"', () => {
    const node = parse('sqrt(16)') as any
    expect(nodeType(node)).toBe('FunctionNode')
    expect(node.fn.name).toBe('sqrt')
    expect(node.args[0].value).toBe(16)
  })

  it('parses multi-argument function "max(1, 2, 3)"', () => {
    const node = parse('max(1, 2, 3)') as any
    expect(nodeType(node)).toBe('FunctionNode')
    expect(node.fn.name).toBe('max')
    expect(node.args.length).toBe(3)
  })

  it('parses nested function calls "sqrt(abs(-4))"', () => {
    const node = parse('sqrt(abs(-4))') as any
    expect(nodeType(node)).toBe('FunctionNode')
    expect(node.fn.name).toBe('sqrt')
    expect(nodeType(node.args[0])).toBe('FunctionNode')
    expect(node.args[0].fn.name).toBe('abs')
  })
})

// ─── Variable assignment ──────────────────────────────────────────────────────

describe('parse - assignment', () => {
  it('parses "x = 5" into an AssignmentNode', () => {
    const node = parse('x = 5') as any
    expect(nodeType(node)).toBe('AssignmentNode')
    expect(node.object.name).toBe('x')
    expect(node.value.value).toBe(5)
  })

  it('parses function assignment "f(x) = x^2" into FunctionAssignmentNode', () => {
    const node = parse('f(x) = x^2') as any
    expect(nodeType(node)).toBe('FunctionAssignmentNode')
    expect(node.name).toBe('f')
    expect(node.params).toEqual(['x'])
    expect(nodeType(node.expr)).toBe('OperatorNode')
    expect(node.expr.fn).toBe('pow')
  })

  it('parses multi-param function assignment "g(a, b) = a + b"', () => {
    const node = parse('g(a, b) = a + b') as any
    expect(nodeType(node)).toBe('FunctionAssignmentNode')
    expect(node.name).toBe('g')
    expect(node.params).toEqual(['a', 'b'])
  })
})

// ─── Blocks and semicolons ────────────────────────────────────────────────────

describe('parse - block expressions', () => {
  it('parses "a; b" into a BlockNode with two entries', () => {
    const node = parse('a; b') as any
    expect(nodeType(node)).toBe('BlockNode')
    expect(node.blocks.length).toBe(2)
    // semicolon makes a invisible, b visible
    expect(node.blocks[0].visible).toBe(false)
    expect(node.blocks[1].visible).toBe(true)
  })

  it('parses "a\\nb" (newline-separated) into a BlockNode', () => {
    const node = parse('a\nb') as any
    expect(nodeType(node)).toBe('BlockNode')
    expect(node.blocks.length).toBe(2)
    // newline: both visible
    expect(node.blocks[0].visible).toBe(true)
    expect(node.blocks[1].visible).toBe(true)
  })
})

// ─── Conditional operator ─────────────────────────────────────────────────────

describe('parse - conditional (ternary)', () => {
  it('parses "x > 0 ? 1 : -1" into a ConditionalNode', () => {
    const node = parse('x > 0 ? 1 : -1') as any
    expect(nodeType(node)).toBe('ConditionalNode')
    expect(nodeType(node.condition)).toBe('OperatorNode')
    expect(node.condition.fn).toBe('larger')
    expect(nodeType(node.trueExpr)).toBe('ConstantNode')
    expect(node.trueExpr.value).toBe(1)
  })
})

// ─── Comparison operators ─────────────────────────────────────────────────────

describe('parse - comparison operators', () => {
  it('parses "a == b" into OperatorNode with fn "equal"', () => {
    const node = parse('a == b') as any
    expect(nodeType(node)).toBe('OperatorNode')
    expect(node.fn).toBe('equal')
    expect(node.op).toBe('==')
  })

  it('parses "a != b" into OperatorNode with fn "unequal"', () => {
    const node = parse('a != b') as any
    expect(nodeType(node)).toBe('OperatorNode')
    expect(node.fn).toBe('unequal')
  })

  it('parses "a < b" into OperatorNode with fn "smaller"', () => {
    const node = parse('a < b') as any
    expect(nodeType(node)).toBe('OperatorNode')
    expect(node.fn).toBe('smaller')
  })

  it('parses "a > b"', () => {
    const node = parse('a > b') as any
    expect(nodeType(node)).toBe('OperatorNode')
    expect(node.fn).toBe('larger')
  })

  it('parses "a <= b"', () => {
    const node = parse('a <= b') as any
    expect(nodeType(node)).toBe('OperatorNode')
    expect(node.fn).toBe('smallerEq')
  })

  it('parses "a >= b"', () => {
    const node = parse('a >= b') as any
    expect(nodeType(node)).toBe('OperatorNode')
    expect(node.fn).toBe('largerEq')
  })

  it('parses chained comparison "1 < x < 10" into RelationalNode', () => {
    const node = parse('1 < x < 10') as any
    expect(nodeType(node)).toBe('RelationalNode')
    expect(node.conditionals).toEqual(['smaller', 'smaller'])
    expect(node.params.length).toBe(3)
  })
})

// ─── Array and matrix literals ────────────────────────────────────────────────

describe('parse - array literals', () => {
  it('parses "[]" into an empty ArrayNode', () => {
    const node = parse('[]') as any
    expect(nodeType(node)).toBe('ArrayNode')
    expect(node.items.length).toBe(0)
  })

  it('parses "[1, 2, 3]" into an ArrayNode with 3 items', () => {
    const node = parse('[1, 2, 3]') as any
    expect(nodeType(node)).toBe('ArrayNode')
    expect(node.items.length).toBe(3)
    expect(node.items[0].value).toBe(1)
    expect(node.items[2].value).toBe(3)
  })
})

// ─── Object literals ──────────────────────────────────────────────────────────

describe('parse - object literals', () => {
  it('parses "{a: 1, b: 2}" into an ObjectNode', () => {
    const node = parse('{a: 1, b: 2}') as any
    expect(nodeType(node)).toBe('ObjectNode')
    expect(Object.keys(node.properties)).toContain('a')
    expect(Object.keys(node.properties)).toContain('b')
    expect(node.properties.a.value).toBe(1)
    expect(node.properties.b.value).toBe(2)
  })
})

// ─── String literals ──────────────────────────────────────────────────────────

describe('parse - string literals', () => {
  it('parses a double-quoted string into a ConstantNode', () => {
    const node = parse('"hello"') as any
    expect(nodeType(node)).toBe('ConstantNode')
    expect(node.value).toBe('hello')
  })

  it('parses a single-quoted string', () => {
    const node = parse("'world'") as any
    expect(nodeType(node)).toBe('ConstantNode')
    expect(node.value).toBe('world')
  })

  it('parses escape sequences in strings', () => {
    const node = parse('"line1\\nline2"') as any
    expect(node.value).toBe('line1\nline2')
  })
})

// ─── Array input (parse multiple) ────────────────────────────────────────────

describe('parse - array of expressions', () => {
  it('parses an array of strings into an array of nodes', () => {
    const nodes = parse(['1 + 2', 'x', 'sin(pi)']) as any[]
    expect(Array.isArray(nodes)).toBe(true)
    expect(nodes.length).toBe(3)
    expect(nodeType(nodes[0])).toBe('OperatorNode')
    expect(nodeType(nodes[1])).toBe('SymbolNode')
    expect(nodeType(nodes[2])).toBe('FunctionNode')
  })

  it('throws if an array element is not a string', () => {
    expect(() => parse([42 as any])).toThrow()
  })
})

// ─── Empty expression ─────────────────────────────────────────────────────────

describe('parse - empty expression', () => {
  it('parses empty string into ConstantNode(undefined)', () => {
    const node = parse('') as any
    expect(nodeType(node)).toBe('ConstantNode')
    expect(node.value).toBeUndefined()
  })
})

// ─── Logical operators ────────────────────────────────────────────────────────

describe('parse - logical operators', () => {
  it('parses "a and b" into OperatorNode:and', () => {
    const node = parse('a and b') as any
    expect(nodeType(node)).toBe('OperatorNode')
    expect(node.fn).toBe('and')
  })

  it('parses "a or b" into OperatorNode:or', () => {
    const node = parse('a or b') as any
    expect(nodeType(node)).toBe('OperatorNode')
    expect(node.fn).toBe('or')
  })

  it('parses "not a" into OperatorNode:not', () => {
    const node = parse('not a') as any
    expect(nodeType(node)).toBe('OperatorNode')
    expect(node.fn).toBe('not')
  })
})

// ─── Error handling ───────────────────────────────────────────────────────────

describe('parse - error handling', () => {
  it('throws SyntaxError for unexpected end of expression', () => {
    expect(() => parse('1 +')).toThrow(SyntaxError)
  })

  it('throws SyntaxError for unmatched parenthesis', () => {
    expect(() => parse('(1 + 2')).toThrow(SyntaxError)
  })

  it('throws SyntaxError for garbage operator "//"', () => {
    expect(() => parse('1 // 2')).toThrow()
  })

  it('throws SyntaxError for bad assignment lhs', () => {
    expect(() => parse('1 + 2 = 3')).toThrow(SyntaxError)
  })
})

// ─── parse static helpers ─────────────────────────────────────────────────────

describe('parse static helpers', () => {
  it('parse.isDigit identifies digits', () => {
    expect((parse as any).isDigit('0')).toBe(true)
    expect((parse as any).isDigit('9')).toBe(true)
    expect((parse as any).isDigit('a')).toBe(false)
    expect((parse as any).isDigit(' ')).toBe(false)
  })

  it('parse.isDigitDot identifies digits and dots', () => {
    expect((parse as any).isDigitDot('5')).toBe(true)
    expect((parse as any).isDigitDot('.')).toBe(true)
    expect((parse as any).isDigitDot('a')).toBe(false)
  })

  it('parse.isWhitespace identifies space and tab', () => {
    expect((parse as any).isWhitespace(' ', 0)).toBe(true)
    expect((parse as any).isWhitespace('\t', 0)).toBe(true)
    // newline at nestingLevel 0 is NOT whitespace (it's a delimiter)
    expect((parse as any).isWhitespace('\n', 0)).toBe(false)
    // newline inside params (nesting > 0) IS whitespace
    expect((parse as any).isWhitespace('\n', 1)).toBe(true)
  })

  it('parse.isDecimalMark identifies decimal dots', () => {
    expect((parse as any).isDecimalMark('.', '5')).toBe(true)
    expect((parse as any).isDecimalMark('.', '*')).toBe(false)
    expect((parse as any).isDecimalMark('.', '/')).toBe(false)
    expect((parse as any).isDecimalMark('.', '^')).toBe(false)
  })

  it('parse.isValidLatinOrGreek identifies valid alpha chars', () => {
    expect((parse as any).isValidLatinOrGreek('a')).toBe(true)
    expect((parse as any).isValidLatinOrGreek('Z')).toBe(true)
    expect((parse as any).isValidLatinOrGreek('_')).toBe(true)
    expect((parse as any).isValidLatinOrGreek('$')).toBe(true)
    expect((parse as any).isValidLatinOrGreek('1')).toBe(false)
    expect((parse as any).isValidLatinOrGreek(' ')).toBe(false)
  })
})
