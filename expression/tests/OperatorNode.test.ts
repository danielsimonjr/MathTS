import { describe, it, expect } from 'vitest'
import { createNode } from '../src/node/Node.js'
import { createConstantNode } from '../src/node/ConstantNode.js'
import { createSymbolNode } from '../src/node/SymbolNode.js'
import { createOperatorNode } from '../src/node/OperatorNode.js'
import { createParenthesisNode } from '../src/node/ParenthesisNode.js'

// ── Bootstrap ──────────────────────────────────────────────────────────────
const mathScope: Record<string, any> = {
  add: (a: number, b: number) => a + b,
  subtract: (a: number, b: number) => a - b,
  multiply: (a: number, b: number) => a * b,
  divide: (a: number, b: number) => a / b,
  pow: (a: number, b: number) => Math.pow(a, b),
  unaryMinus: (a: number) => -a,
  mod: (a: number, b: number) => a % b,
}

const Node = createNode({ mathWithTransform: mathScope })
const isBounded = (v: any): boolean => Number.isFinite(Number(v))
const ConstantNode = createConstantNode({ Node, isBounded })
const SymbolNode = createSymbolNode({ math: mathScope, Node })
const OperatorNode = createOperatorNode({ Node })
const ParenthesisNode = createParenthesisNode({ Node })

function makeConst(v: any) {
  return new ConstantNode(v)
}

function makeOp(op: string, fn: string, args: any[]) {
  return new OperatorNode(op, fn, args)
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('OperatorNode - construction & identity', () => {
  it('stores op, fn, args', () => {
    const a = makeConst(2)
    const b = makeConst(3)
    const node = makeOp('+', 'add', [a, b])
    expect(node.op).toBe('+')
    expect(node.fn).toBe('add')
    expect(node.args).toHaveLength(2)
  })

  it('has correct type property', () => {
    expect(makeOp('+', 'add', [makeConst(1), makeConst(2)]).type).toBe('OperatorNode')
  })

  it('has isOperatorNode = true', () => {
    expect(makeOp('+', 'add', [makeConst(1), makeConst(2)]).isOperatorNode).toBe(true)
  })

  it('has isNode = true', () => {
    expect((makeOp('+', 'add', [makeConst(1), makeConst(2)]) as any).isNode).toBe(true)
  })

  it('implicit defaults to false', () => {
    expect(makeOp('*', 'multiply', [makeConst(2), makeConst(3)]).implicit).toBe(false)
  })

  it('isPercentage defaults to false', () => {
    expect(makeOp('+', 'add', [makeConst(1), makeConst(2)]).isPercentage).toBe(false)
  })

  it('can set implicit = true', () => {
    const node = new OperatorNode('*', 'multiply', [makeConst(2), makeConst(3)], true)
    expect(node.implicit).toBe(true)
  })

  it('throws when op is not a string', () => {
    expect(() => new (OperatorNode as any)(42, 'add', [makeConst(1)])).toThrow(
      'string expected for parameter "op"'
    )
  })

  it('throws when fn is not a string', () => {
    expect(() => new OperatorNode('+', 42 as any, [makeConst(1)])).toThrow(
      'string expected for parameter "fn"'
    )
  })

  it('throws when args is not an array of Nodes', () => {
    expect(() => new OperatorNode('+', 'add', [42 as any])).toThrow(
      'Array containing Nodes expected'
    )
  })
})

describe('OperatorNode - isUnary / isBinary', () => {
  it('isUnary returns true for 1 arg', () => {
    const node = makeOp('-', 'unaryMinus', [makeConst(5)])
    expect(node.isUnary()).toBe(true)
    expect(node.isBinary()).toBe(false)
  })

  it('isBinary returns true for 2 args', () => {
    const node = makeOp('+', 'add', [makeConst(1), makeConst(2)])
    expect(node.isBinary()).toBe(true)
    expect(node.isUnary()).toBe(false)
  })

  it('neither for 0 args', () => {
    const node = makeOp('+', 'add', [])
    expect(node.isUnary()).toBe(false)
    expect(node.isBinary()).toBe(false)
  })
})

describe('OperatorNode - getIdentifier', () => {
  it('returns OperatorNode:<fn>', () => {
    const node = makeOp('+', 'add', [makeConst(1), makeConst(2)])
    expect(node.getIdentifier()).toBe('OperatorNode:add')
  })

  it('works for multiply', () => {
    const node = makeOp('*', 'multiply', [makeConst(2), makeConst(3)])
    expect(node.getIdentifier()).toBe('OperatorNode:multiply')
  })
})

describe('OperatorNode - _compile', () => {
  const math = mathScope
  const argNames = {}

  it('compiles binary add', () => {
    const node = makeOp('+', 'add', [makeConst(3), makeConst(4)])
    const fn = node._compile(math, argNames)
    expect(fn(new Map(), {}, null)).toBe(7)
  })

  it('compiles unary minus', () => {
    const node = makeOp('-', 'unaryMinus', [makeConst(5)])
    const fn = node._compile(math, argNames)
    expect(fn(new Map(), {}, null)).toBe(-5)
  })

  it('compiles multiply', () => {
    const node = makeOp('*', 'multiply', [makeConst(6), makeConst(7)])
    const fn = node._compile(math, argNames)
    expect(fn(new Map(), {}, null)).toBe(42)
  })

  it('compiles nested: (2+3)*4', () => {
    const inner = makeOp('+', 'add', [makeConst(2), makeConst(3)])
    const outer = makeOp('*', 'multiply', [inner, makeConst(4)])
    const fn = outer._compile(math, argNames)
    expect(fn(new Map(), {}, null)).toBe(20)
  })

  it('throws when function is missing from math scope', () => {
    expect(() => {
      const node = makeOp('@', 'unknownFn', [makeConst(1)])
      node._compile(math, argNames)
    }).toThrow()
  })
})

describe('OperatorNode - forEach', () => {
  it('calls callback for each arg with correct path', () => {
    const a = makeConst(1)
    const b = makeConst(2)
    const node = makeOp('+', 'add', [a, b])
    const visited: Array<{ child: any; path: string }> = []
    node.forEach((child, path) => visited.push({ child, path }))
    expect(visited).toHaveLength(2)
    expect(visited[0].path).toBe('args[0]')
    expect(visited[1].path).toBe('args[1]')
    expect(visited[0].child).toBe(a)
    expect(visited[1].child).toBe(b)
  })
})

describe('OperatorNode - map', () => {
  it('returns a new OperatorNode with transformed children', () => {
    const a = makeConst(1)
    const b = makeConst(2)
    const node = makeOp('+', 'add', [a, b])
    const newConst = makeConst(99)
    const mapped: any = node.map((_child, _path, _parent) => newConst)
    expect(mapped).not.toBe(node)
    expect(mapped.args[0]).toBe(newConst)
    expect(mapped.args[1]).toBe(newConst)
    expect(mapped.op).toBe('+')
    expect(mapped.fn).toBe('add')
  })

  it('throws when callback returns non-node', () => {
    const node = makeOp('+', 'add', [makeConst(1), makeConst(2)])
    expect(() => node.map((_child) => ({ notANode: true } as any))).toThrow(
      'Callback function must return a Node'
    )
  })
})

describe('OperatorNode - clone', () => {
  it('creates a new OperatorNode with same properties', () => {
    const a = makeConst(1)
    const b = makeConst(2)
    const node = makeOp('+', 'add', [a, b])
    const cloned: any = node.clone()
    expect(cloned).not.toBe(node)
    expect(cloned.op).toBe('+')
    expect(cloned.fn).toBe('add')
    expect(cloned.args).toHaveLength(2)
    // shallow copy - children are same refs
    expect(cloned.args[0]).toBe(a)
    expect(cloned.args[1]).toBe(b)
  })

  it('preserves implicit flag on clone', () => {
    const node = new OperatorNode('*', 'multiply', [makeConst(2), makeConst(3)], true)
    const cloned = node.clone()
    expect(cloned.implicit).toBe(true)
  })
})

describe('OperatorNode - toString', () => {
  it('formats binary addition', () => {
    const node = makeOp('+', 'add', [makeConst(2), makeConst(3)])
    expect(node.toString()).toBe('2 + 3')
  })

  it('formats binary multiplication', () => {
    const node = makeOp('*', 'multiply', [makeConst(4), makeConst(5)])
    expect(node.toString()).toBe('4 * 5')
  })

  it('formats unary minus', () => {
    const node = makeOp('-', 'unaryMinus', [makeConst(5)])
    expect(node.toString()).toBe('-5')
  })

  it('formats nested expression: 2 + 3 * 4', () => {
    const mul = makeOp('*', 'multiply', [makeConst(3), makeConst(4)])
    const add = makeOp('+', 'add', [makeConst(2), mul])
    expect(add.toString()).toBe('2 + 3 * 4')
  })

  it('adds parentheses for lower precedence in auto mode', () => {
    // (2 + 3) * 4 — the add is lower precedence than multiply
    const add = makeOp('+', 'add', [makeConst(2), makeConst(3)])
    const mul = makeOp('*', 'multiply', [add, makeConst(4)])
    const str = mul.toString({ parenthesis: 'auto' })
    expect(str).toContain('(')
  })

  it('adds parentheses in "all" mode for nested operator children', () => {
    // In 'all' mode, OperatorNode children that are themselves OperatorNodes get parens
    const inner = makeOp('*', 'multiply', [makeConst(2), makeConst(3)])
    const outer = makeOp('+', 'add', [inner, makeConst(1)])
    const str = outer.toString({ parenthesis: 'all' })
    expect(str).toContain('(')
  })

  it('implicit multiply hides the operator when implicit=hide', () => {
    const node = new OperatorNode(
      '*', 'multiply', [makeConst(2), makeConst(3)], true
    )
    const str = node.toString({ implicit: 'hide' })
    expect(str).not.toContain('*')
    expect(str).toContain('2')
    expect(str).toContain('3')
  })
})

describe('OperatorNode - toHTML', () => {
  it('wraps operator in math-operator span', () => {
    const node = makeOp('+', 'add', [makeConst(1), makeConst(2)])
    const html = node.toHTML()
    expect(html).toContain('math-operator')
    expect(html).toContain('+')
  })

  it('wraps unary operator', () => {
    const node = makeOp('-', 'unaryMinus', [makeConst(5)])
    const html = node.toHTML()
    expect(html).toContain('math-unary-operator')
  })
})

describe('OperatorNode - toTex', () => {
  it('formats addition in LaTeX', () => {
    const node = makeOp('+', 'add', [makeConst(1), makeConst(2)])
    const tex = node.toTex()
    expect(tex).toContain('+')
  })

  it('formats division with \\frac', () => {
    const node = makeOp('/', 'divide', [makeConst(1), makeConst(2)])
    const tex = node.toTex()
    expect(tex).toContain('\\frac')
  })
})

describe('OperatorNode - toJSON / fromJSON', () => {
  it('toJSON returns correct shape', () => {
    const node = makeOp('+', 'add', [makeConst(1), makeConst(2)])
    const json = node.toJSON()
    expect(json.mathjs).toBe('OperatorNode')
    expect(json.op).toBe('+')
    expect(json.fn).toBe('add')
    expect(json.implicit).toBe(false)
    expect(json.isPercentage).toBe(false)
    expect(Array.isArray(json.args)).toBe(true)
  })

  it('fromJSON creates a node', () => {
    const a = makeConst(1)
    const b = makeConst(2)
    const json = { op: '+', fn: 'add', args: [a, b], implicit: false, isPercentage: false }
    const node = OperatorNode.fromJSON(json)
    expect(node.op).toBe('+')
    expect(node.fn).toBe('add')
    expect(node.isOperatorNode).toBe(true)
  })
})

describe('OperatorNode - equals', () => {
  it('equal operators with same args', () => {
    const a = makeOp('+', 'add', [makeConst(1), makeConst(2)])
    const b = makeOp('+', 'add', [makeConst(1), makeConst(2)])
    expect(a.equals(b)).toBe(true)
  })

  it('not equal when fn differs', () => {
    const a = makeOp('+', 'add', [makeConst(1), makeConst(2)])
    const b = makeOp('*', 'multiply', [makeConst(1), makeConst(2)])
    expect(a.equals(b)).toBe(false)
  })

  it('not equal when args differ', () => {
    const a = makeOp('+', 'add', [makeConst(1), makeConst(2)])
    const b = makeOp('+', 'add', [makeConst(1), makeConst(3)])
    expect(a.equals(b)).toBe(false)
  })

  it('not equal to null', () => {
    expect(makeOp('+', 'add', [makeConst(1), makeConst(2)]).equals(null as any)).toBe(false)
  })
})
