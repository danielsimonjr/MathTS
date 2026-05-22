import { describe, it, expect } from 'vitest'
import { createNode } from '../src/node/Node.js'
import { createConstantNode } from '../src/node/ConstantNode.js'
import { createSymbolNode } from '../src/node/SymbolNode.js'

// ── Bootstrap ──────────────────────────────────────────────────────────────
const mathScope: Record<string, any> = {
  pi: Math.PI,
  e: Math.E,
  add: (a: number, b: number) => a + b,
}

const Node = createNode({ mathWithTransform: mathScope })
const isBounded = (v: any): boolean => Number.isFinite(Number(v))
const ConstantNode = createConstantNode({ Node, isBounded })
const SymbolNode = createSymbolNode({ math: mathScope, Node })

// ── Tests ──────────────────────────────────────────────────────────────────

describe('SymbolNode - construction & identity', () => {
  it('stores the name', () => {
    const node = new SymbolNode('x')
    expect(node.name).toBe('x')
  })

  it('has correct type property', () => {
    expect(new SymbolNode('x').type).toBe('SymbolNode')
  })

  it('has isSymbolNode = true', () => {
    expect(new SymbolNode('x').isSymbolNode).toBe(true)
  })

  it('is also a Node (isNode = true)', () => {
    expect((new SymbolNode('x') as any).isNode).toBe(true)
  })

  it('throws when name is not a string', () => {
    expect(() => new (SymbolNode as any)(42)).toThrow('String expected for parameter "name"')
  })
})

describe('SymbolNode - _compile: resolving from math scope', () => {
  it('returns math scope value when present', () => {
    const node = new SymbolNode('pi')
    const fn = node._compile(mathScope, {})
    const scope = new Map<string, any>()
    expect(fn(scope, {}, null)).toBeCloseTo(Math.PI)
  })

  it('prefers user scope over math scope', () => {
    const node = new SymbolNode('pi')
    const fn = node._compile(mathScope, {})
    const scope = new Map<string, any>([['pi', 3]])
    expect(fn(scope, {}, null)).toBe(3)
  })
})

describe('SymbolNode - _compile: resolving from argNames', () => {
  it('reads from args when name is in argNames', () => {
    const node = new SymbolNode('x')
    const fn = node._compile(mathScope, { x: true })
    const scope = new Map<string, any>()
    const result = fn(scope, { x: 42 }, null)
    expect(result).toBe(42)
  })
})

describe('SymbolNode - _compile: undefined symbol', () => {
  it('throws for an undefined symbol', () => {
    const node = new SymbolNode('unknownVar')
    const fn = node._compile(mathScope, {})
    const scope = new Map<string, any>()
    expect(() => fn(scope, {}, null)).toThrow('Undefined symbol unknownVar')
  })
})

describe('SymbolNode - forEach / map / clone', () => {
  it('forEach calls callback for no children', () => {
    const node = new SymbolNode('x')
    const visited: any[] = []
    node.forEach((child, path) => visited.push({ child, path }))
    expect(visited).toHaveLength(0)
  })

  it('map returns a clone (no children)', () => {
    const node = new SymbolNode('x')
    const mapped = node.map((_child, _path, _parent) => new SymbolNode('y'))
    expect(mapped.name).toBe('x') // clone, not the callback result
    expect(mapped).not.toBe(node)
  })

  it('clone creates a new node with same name', () => {
    const node = new SymbolNode('alpha')
    const cloned = node.clone()
    expect(cloned).not.toBe(node)
    expect(cloned.name).toBe('alpha')
    expect(cloned.isSymbolNode).toBe(true)
  })
})

describe('SymbolNode - toString / toHTML / toTex', () => {
  it('toString returns the name', () => {
    expect(new SymbolNode('myVar').toString()).toBe('myVar')
  })

  it('toHTML wraps regular symbol in math-symbol span', () => {
    const html = new SymbolNode('x').toHTML()
    expect(html).toContain('class="math-symbol"')
    expect(html).toContain('x')
  })

  it('toHTML renders true as math-boolean', () => {
    const html = new SymbolNode('true').toHTML()
    expect(html).toContain('math-boolean')
  })

  it('toHTML renders false as math-boolean', () => {
    const html = new SymbolNode('false').toHTML()
    expect(html).toContain('math-boolean')
  })

  it('toHTML renders i as math-imaginary-symbol', () => {
    const html = new SymbolNode('i').toHTML()
    expect(html).toContain('math-imaginary-symbol')
  })

  it('toHTML renders Infinity as math-infinity-symbol', () => {
    const html = new SymbolNode('Infinity').toHTML()
    expect(html).toContain('math-infinity-symbol')
  })

  it('toHTML renders NaN as math-nan-symbol', () => {
    const html = new SymbolNode('NaN').toHTML()
    expect(html).toContain('math-nan-symbol')
  })

  it('toHTML renders null as math-null-symbol', () => {
    const html = new SymbolNode('null').toHTML()
    expect(html).toContain('math-null-symbol')
  })

  it('toHTML renders undefined as math-undefined-symbol', () => {
    const html = new SymbolNode('undefined').toHTML()
    expect(html).toContain('math-undefined-symbol')
  })

  it('toTex returns a LaTeX symbol', () => {
    const tex = new SymbolNode('x').toTex()
    expect(typeof tex).toBe('string')
    expect(tex.length).toBeGreaterThan(0)
  })
})

describe('SymbolNode - toJSON / fromJSON', () => {
  it('toJSON returns correct shape', () => {
    const node = new SymbolNode('myVar')
    const json = node.toJSON()
    expect(json).toEqual({ mathjs: 'SymbolNode', name: 'myVar' })
  })

  it('fromJSON creates a node from JSON', () => {
    const node = SymbolNode.fromJSON({ name: 'z' })
    expect(node.name).toBe('z')
    expect(node.isSymbolNode).toBe(true)
  })
})

describe('SymbolNode - onUndefinedSymbol', () => {
  it('throws an error with the symbol name', () => {
    expect(() => SymbolNode.onUndefinedSymbol('undefinedXYZ')).toThrow(
      'Undefined symbol undefinedXYZ'
    )
  })
})

describe('SymbolNode - equals', () => {
  it('equal when same name', () => {
    const a = new SymbolNode('x')
    const b = new SymbolNode('x')
    expect(a.equals(b)).toBe(true)
  })

  it('not equal when different names', () => {
    const a = new SymbolNode('x')
    const b = new SymbolNode('y')
    expect(a.equals(b)).toBe(false)
  })

  it('not equal to null', () => {
    expect(new SymbolNode('x').equals(null as any)).toBe(false)
  })

  it('not equal to a ConstantNode', () => {
    const s = new SymbolNode('x')
    const c = new ConstantNode(42)
    expect(s.equals(c as any)).toBe(false)
  })
})

describe('SymbolNode - traverse', () => {
  it('traverse visits only the node itself (no children)', () => {
    const node = new SymbolNode('x')
    const visited: any[] = []
    node.traverse((n) => visited.push(n))
    expect(visited).toHaveLength(1)
    expect(visited[0]).toBe(node)
  })
})

describe('SymbolNode - getIdentifier', () => {
  it('returns SymbolNode type identifier', () => {
    expect((new SymbolNode('x') as any).getIdentifier()).toBe('SymbolNode')
  })
})
