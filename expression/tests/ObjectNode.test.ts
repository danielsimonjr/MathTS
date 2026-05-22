import { describe, it, expect } from 'vitest'
import { createNode } from '../src/node/Node.js'
import { createConstantNode } from '../src/node/ConstantNode.js'
import { createSymbolNode } from '../src/node/SymbolNode.js'
import { createObjectNode } from '../src/node/ObjectNode.js'

// ── Bootstrap ──────────────────────────────────────────────────────────────
const mathScope: Record<string, any> = {
  x: 10,
}

const Node = createNode({ mathWithTransform: mathScope })
const isBounded = (v: any): boolean => Number.isFinite(Number(v))
const ConstantNode = createConstantNode({ Node, isBounded })
const SymbolNode = createSymbolNode({ math: mathScope, Node })
const ObjectNode = createObjectNode({ Node })

function makeConst(v: any) {
  return new ConstantNode(v)
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ObjectNode - construction & identity', () => {
  it('stores properties', () => {
    const node = new ObjectNode({ a: makeConst(1), b: makeConst(2) })
    expect(node.properties).toHaveProperty('a')
    expect(node.properties).toHaveProperty('b')
  })

  it('accepts empty properties', () => {
    const node = new ObjectNode()
    expect(Object.keys(node.properties)).toHaveLength(0)
  })

  it('has correct type', () => {
    expect(new ObjectNode({}).type).toBe('ObjectNode')
  })

  it('has isObjectNode = true', () => {
    expect(new ObjectNode({}).isObjectNode).toBe(true)
  })

  it('has isNode = true', () => {
    expect((new ObjectNode({}) as any).isNode).toBe(true)
  })

  it('throws when properties values are not nodes', () => {
    expect(() => new (ObjectNode as any)({ a: 42 })).toThrow('Object containing Nodes expected')
  })
})

describe('ObjectNode - _compile', () => {
  const math = mathScope
  const argNames = {}

  it('compiles to an object with evaluated values', () => {
    const node = new ObjectNode({ x: makeConst(1), y: makeConst(2) })
    const fn = node._compile(math, argNames)
    const result = fn(new Map(), {}, null)
    expect(result).toEqual({ x: 1, y: 2 })
  })

  it('compiles empty object', () => {
    const node = new ObjectNode({})
    const fn = node._compile(math, argNames)
    expect(fn(new Map(), {}, null)).toEqual({})
  })
})

describe('ObjectNode - forEach', () => {
  it('calls callback for each property with a path', () => {
    const a = makeConst(1)
    const b = makeConst(2)
    const node = new ObjectNode({ a, b })
    const visited: Array<{ child: any; path: string }> = []
    node.forEach((child, path) => visited.push({ child, path }))
    expect(visited).toHaveLength(2)
    const paths = visited.map((v) => v.path)
    expect(paths.some((p) => p.includes('"a"'))).toBe(true)
    expect(paths.some((p) => p.includes('"b"'))).toBe(true)
    const children = visited.map((v) => v.child)
    expect(children).toContain(a)
    expect(children).toContain(b)
  })

  it('calls callback for 0 props on empty ObjectNode', () => {
    const node = new ObjectNode({})
    const visited: any[] = []
    node.forEach((child) => visited.push(child))
    expect(visited).toHaveLength(0)
  })
})

describe('ObjectNode - map', () => {
  it('returns a new ObjectNode with transformed children', () => {
    const a = makeConst(10)
    const node = new ObjectNode({ a })
    const newConst = makeConst(99)
    const mapped: any = node.map((_child, _path, _parent) => newConst)
    expect(mapped).not.toBe(node)
    expect(mapped.properties.a).toBe(newConst)
  })

  it('throws when callback returns non-node', () => {
    const node = new ObjectNode({ a: makeConst(1) })
    expect(() => node.map((_child) => ({ notANode: true } as any))).toThrow(
      'Callback function must return a Node'
    )
  })
})

describe('ObjectNode - clone', () => {
  it('creates shallow copy', () => {
    const a = makeConst(5)
    const node = new ObjectNode({ a })
    const cloned: any = node.clone()
    expect(cloned).not.toBe(node)
    expect(cloned.properties.a).toBe(a)
    expect(cloned.type).toBe('ObjectNode')
  })
})

describe('ObjectNode - toString', () => {
  it('formats as {key: value} notation', () => {
    const node = new ObjectNode({ x: makeConst(1) })
    const str = node.toString()
    expect(str).toContain('x')
    expect(str).toContain('1')
    expect(str.startsWith('{')).toBe(true)
    expect(str.endsWith('}')).toBe(true)
  })

  it('formats empty object as {}', () => {
    const node = new ObjectNode({})
    expect(node.toString()).toBe('{}')
  })
})

describe('ObjectNode - toHTML', () => {
  it('contains curly parenthesis spans', () => {
    const node = new ObjectNode({ x: makeConst(1) })
    const html = node.toHTML()
    expect(html).toContain('math-curly-parenthesis')
    expect(html).toContain('math-property')
    expect(html).toContain('x')
  })

  it('empty ObjectNode renders curly braces', () => {
    const node = new ObjectNode({})
    const html = node.toHTML()
    expect(html).toContain('math-curly-parenthesis')
  })
})

describe('ObjectNode - toTex', () => {
  it('returns a LaTeX string with array environment', () => {
    const node = new ObjectNode({ x: makeConst(1) })
    const tex = node.toTex()
    expect(tex).toContain('\\left\\{')
    expect(tex).toContain('\\end{array}')
    expect(tex).toContain('x')
  })
})

describe('ObjectNode - toJSON / fromJSON', () => {
  it('toJSON returns correct shape', () => {
    const node = new ObjectNode({ a: makeConst(1) })
    const json = node.toJSON()
    expect(json.mathjs).toBe('ObjectNode')
    expect(json.properties).toHaveProperty('a')
  })

  it('fromJSON creates node from JSON', () => {
    const props = { x: makeConst(7) }
    const node = ObjectNode.fromJSON({ properties: props })
    expect(node.isObjectNode).toBe(true)
    expect(node.properties.x).toBe(props.x)
  })
})

describe('ObjectNode - equals', () => {
  it('equal when same properties and values', () => {
    const a = new ObjectNode({ x: makeConst(1) })
    const b = new ObjectNode({ x: makeConst(1) })
    expect(a.equals(b)).toBe(true)
  })

  it('not equal when values differ', () => {
    const a = new ObjectNode({ x: makeConst(1) })
    const b = new ObjectNode({ x: makeConst(2) })
    expect(a.equals(b)).toBe(false)
  })

  it('not equal when keys differ', () => {
    const a = new ObjectNode({ x: makeConst(1) })
    const b = new ObjectNode({ y: makeConst(1) })
    expect(a.equals(b)).toBe(false)
  })

  it('not equal to null', () => {
    expect(new ObjectNode({}).equals(null as any)).toBe(false)
  })
})

describe('ObjectNode - traverse', () => {
  it('visits root and each property child', () => {
    const a = makeConst(1)
    const b = makeConst(2)
    const node = new ObjectNode({ a, b })
    const visited: any[] = []
    node.traverse((n) => visited.push(n))
    expect(visited).toHaveLength(3) // root + 2 children
    expect(visited[0]).toBe(node)
    expect(visited.some((n) => n === a)).toBe(true)
    expect(visited.some((n) => n === b)).toBe(true)
  })
})
