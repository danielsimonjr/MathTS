import { describe, it, expect } from 'vitest'
import { createNode } from '../src/node/Node.js'
import { createConstantNode } from '../src/node/ConstantNode.js'

// ── Bootstrap ──────────────────────────────────────────────────────────────
const mathWithTransform: Record<string, any> = {}
const Node = createNode({ mathWithTransform })
const isBounded = (v: any): boolean => Number.isFinite(Number(v))
const ConstantNode = createConstantNode({ Node, isBounded })

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ConstantNode - construction & identity', () => {
  it('stores numeric value', () => {
    const node = new ConstantNode(42)
    expect(node.value).toBe(42)
  })

  it('stores string value', () => {
    const node = new ConstantNode('hello')
    expect(node.value).toBe('hello')
  })

  it('stores boolean value', () => {
    expect(new ConstantNode(true).value).toBe(true)
    expect(new ConstantNode(false).value).toBe(false)
  })

  it('stores null value', () => {
    expect(new ConstantNode(null).value).toBe(null)
  })

  it('has correct type property', () => {
    expect(new ConstantNode(1).type).toBe('ConstantNode')
  })

  it('has isConstantNode = true', () => {
    expect(new ConstantNode(1).isConstantNode).toBe(true)
  })

  it('static name is ConstantNode', () => {
    expect((ConstantNode as any).name).toBe('ConstantNode')
  })
})

describe('ConstantNode - _compile', () => {
  const math = {}
  const argNames = {}

  it('returns a function that always returns the stored value', () => {
    const node = new ConstantNode(99)
    const fn = node._compile(math, argNames)
    expect(fn({}, {}, null)).toBe(99)
  })

  it('compile is scope-independent', () => {
    const node = new ConstantNode('static')
    const fn = node._compile(math, argNames)
    expect(fn({}, {}, null)).toBe('static')
    expect(fn({ x: 5 }, {}, null)).toBe('static')
  })
})

describe('ConstantNode - clone & map', () => {
  it('clone creates a new node with the same value', () => {
    const node = new ConstantNode(7)
    const cloned = node.clone()
    expect(cloned).not.toBe(node)
    expect(cloned.value).toBe(7)
    expect(cloned.isConstantNode).toBe(true)
  })

  it('map returns a clone (no children to map)', () => {
    const node = new ConstantNode(3)
    const mapped = node.map((_child, _path, _parent) => new ConstantNode(999))
    expect(mapped.value).toBe(3) // map returns clone, not callback result
  })

  it('forEach calls callback for no children', () => {
    const node = new ConstantNode(1)
    const visited: any[] = []
    node.forEach((child, path) => visited.push({ child, path }))
    expect(visited).toHaveLength(0)
  })
})

describe('ConstantNode - toString', () => {
  it('converts number to string', () => {
    expect(new ConstantNode(3.14).toString()).toBe('3.14')
  })

  it('converts integer to string', () => {
    expect(new ConstantNode(0).toString()).toBe('0')
  })

  it('converts string value with quotes', () => {
    // String constants are formatted with surrounding quotes
    const result = new ConstantNode('hello').toString()
    expect(result).toContain('hello')
  })
})

describe('ConstantNode - toHTML', () => {
  it('wraps number in math-number span', () => {
    const html = new ConstantNode(5).toHTML()
    expect(html).toContain('class="math-number"')
    expect(html).toContain('5')
  })

  it('wraps string in math-string span', () => {
    const html = new ConstantNode('hi').toHTML()
    expect(html).toContain('class="math-string"')
  })

  it('wraps boolean in math-boolean span', () => {
    const html = new ConstantNode(true).toHTML()
    expect(html).toContain('class="math-boolean"')
  })

  it('wraps null in math-null-symbol span', () => {
    const html = new ConstantNode(null).toHTML()
    expect(html).toContain('class="math-null-symbol"')
  })
})

describe('ConstantNode - toTex', () => {
  it('renders a simple number as plain text', () => {
    const tex = new ConstantNode(42).toTex()
    expect(tex).toBe('42')
  })

  it('renders a string value in mathtt', () => {
    const tex = new ConstantNode('hello').toTex()
    expect(tex).toContain('\\mathtt{')
    expect(tex).toContain('hello')
  })

  it('renders infinity as \\infty for unbounded positive number', () => {
    // Infinity is not isFinite so isBounded returns false
    const tex = new ConstantNode(Infinity).toTex()
    expect(tex).toBe('\\infty')
  })

  it('renders -Infinity as -\\infty', () => {
    const tex = new ConstantNode(-Infinity).toTex()
    expect(tex).toBe('-\\infty')
  })
})

describe('ConstantNode - toJSON / fromJSON', () => {
  it('toJSON returns correct shape', () => {
    const node = new ConstantNode(42)
    const json = node.toJSON()
    expect(json).toEqual({ mathjs: 'ConstantNode', value: 42 })
  })

  it('fromJSON creates a node from JSON', () => {
    const node = ConstantNode.fromJSON({ value: 'hi' })
    expect(node.value).toBe('hi')
    expect(node.isConstantNode).toBe(true)
  })
})

describe('ConstantNode - equals', () => {
  it('equal nodes with same value', () => {
    const a = new ConstantNode(5)
    const b = new ConstantNode(5)
    expect(a.equals(b)).toBe(true)
  })

  it('not equal with different value', () => {
    const a = new ConstantNode(5)
    const b = new ConstantNode(6)
    expect(a.equals(b)).toBe(false)
  })

  it('not equal to null', () => {
    expect(new ConstantNode(1).equals(null)).toBe(false)
  })
})

describe('ConstantNode - traverse', () => {
  it('traverse only visits the node itself (no children)', () => {
    const node = new ConstantNode(99)
    const visited: any[] = []
    node.traverse((n) => visited.push(n))
    expect(visited).toHaveLength(1)
    expect(visited[0]).toBe(node)
  })
})

describe('ConstantNode - getIdentifier', () => {
  it('returns ConstantNode type identifier', () => {
    expect(new ConstantNode(1).getIdentifier()).toBe('ConstantNode')
  })
})
