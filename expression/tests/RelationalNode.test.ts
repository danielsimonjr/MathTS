import { describe, it, expect } from 'vitest'
import { createNode } from '../src/node/Node.js'
import { createConstantNode } from '../src/node/ConstantNode.js'
import { createRelationalNode } from '../src/node/RelationalNode.js'

// ── Bootstrap ──────────────────────────────────────────────────────────────
const mathScope: Record<string, any> = {
  smaller: (a: number, b: number) => a < b,
  larger: (a: number, b: number) => a > b,
  smallerEq: (a: number, b: number) => a <= b,
  largerEq: (a: number, b: number) => a >= b,
  equal: (a: number, b: number) => a === b,
  unequal: (a: number, b: number) => a !== b,
}

const Node = createNode({ mathWithTransform: mathScope })
const isBounded = (v: any): boolean => Number.isFinite(Number(v))
const ConstantNode = createConstantNode({ Node, isBounded })
const RelationalNode = createRelationalNode({ Node })

function makeConst(v: any) {
  return new ConstantNode(v)
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('RelationalNode - construction & identity', () => {
  it('stores conditionals and params', () => {
    const node = new RelationalNode(['smaller'], [makeConst(1), makeConst(2)])
    expect(node.conditionals).toEqual(['smaller'])
    expect(node.params).toHaveLength(2)
  })

  it('has correct type', () => {
    expect(new RelationalNode(['smaller'], [makeConst(1), makeConst(2)]).type).toBe('RelationalNode')
  })

  it('has isRelationalNode = true', () => {
    expect(new RelationalNode(['smaller'], [makeConst(1), makeConst(2)]).isRelationalNode).toBe(true)
  })

  it('has isNode = true', () => {
    expect((new RelationalNode(['smaller'], [makeConst(1), makeConst(2)]) as any).isNode).toBe(true)
  })

  it('throws when conditionals is not an array', () => {
    expect(() => new RelationalNode('smaller' as any, [makeConst(1), makeConst(2)])).toThrow(
      'Parameter conditionals must be an array'
    )
  })

  it('throws when params is not an array', () => {
    expect(() => new RelationalNode(['smaller'], makeConst(1) as any)).toThrow(
      'Parameter params must be an array'
    )
  })

  it('throws when params.length !== conditionals.length + 1', () => {
    expect(() => new RelationalNode(['smaller'], [makeConst(1)])).toThrow(
      'Parameter params must contain exactly one more element'
    )
  })

  it('allows chained comparisons: conditionals.length = params.length - 1', () => {
    const node = new RelationalNode(
      ['smaller', 'smaller'],
      [makeConst(1), makeConst(2), makeConst(3)]
    )
    expect(node.conditionals).toHaveLength(2)
    expect(node.params).toHaveLength(3)
  })
})

describe('RelationalNode - _compile', () => {
  const math = mathScope
  const argNames = {}

  it('evaluates 1 < 2 as true', () => {
    const node = new RelationalNode(['smaller'], [makeConst(1), makeConst(2)])
    const fn = node._compile(math, argNames)
    expect(fn(new Map(), {}, null)).toBe(true)
  })

  it('evaluates 2 < 1 as false', () => {
    const node = new RelationalNode(['smaller'], [makeConst(2), makeConst(1)])
    const fn = node._compile(math, argNames)
    expect(fn(new Map(), {}, null)).toBe(false)
  })

  it('evaluates chained 1 < 2 < 3 as true', () => {
    const node = new RelationalNode(
      ['smaller', 'smaller'],
      [makeConst(1), makeConst(2), makeConst(3)]
    )
    const fn = node._compile(math, argNames)
    expect(fn(new Map(), {}, null)).toBe(true)
  })

  it('evaluates chained 1 < 3 < 2 as false', () => {
    const node = new RelationalNode(
      ['smaller', 'smaller'],
      [makeConst(1), makeConst(3), makeConst(2)]
    )
    const fn = node._compile(math, argNames)
    expect(fn(new Map(), {}, null)).toBe(false)
  })

  it('evaluates 1 == 1 as true', () => {
    const node = new RelationalNode(['equal'], [makeConst(1), makeConst(1)])
    const fn = node._compile(math, argNames)
    expect(fn(new Map(), {}, null)).toBe(true)
  })

  it('evaluates 1 != 2 as true', () => {
    const node = new RelationalNode(['unequal'], [makeConst(1), makeConst(2)])
    const fn = node._compile(math, argNames)
    expect(fn(new Map(), {}, null)).toBe(true)
  })

  it('short-circuits on first false in chained comparison', () => {
    // 3 < 2 < 1: first comparison fails, should return false
    const node = new RelationalNode(
      ['smaller', 'smaller'],
      [makeConst(3), makeConst(2), makeConst(1)]
    )
    const fn = node._compile(math, argNames)
    expect(fn(new Map(), {}, null)).toBe(false)
  })
})

describe('RelationalNode - forEach', () => {
  it('calls callback for each param with correct path', () => {
    const a = makeConst(1)
    const b = makeConst(2)
    const node = new RelationalNode(['smaller'], [a, b])
    const visited: Array<{ child: any; path: string }> = []
    node.forEach((child, path) => visited.push({ child, path }))
    expect(visited).toHaveLength(2)
    expect(visited[0].path).toBe('params[0]')
    expect(visited[1].path).toBe('params[1]')
    expect(visited[0].child).toBe(a)
    expect(visited[1].child).toBe(b)
  })
})

describe('RelationalNode - map', () => {
  it('returns a new RelationalNode with transformed params', () => {
    const a = makeConst(1)
    const b = makeConst(2)
    const node = new RelationalNode(['smaller'], [a, b])
    const replacement = makeConst(99)
    const mapped: any = node.map((_child, _path, _parent) => replacement)
    expect(mapped).not.toBe(node)
    expect(mapped.params[0]).toBe(replacement)
    expect(mapped.params[1]).toBe(replacement)
    expect(mapped.conditionals).toEqual(['smaller'])
  })

  it('throws when callback returns non-node', () => {
    const node = new RelationalNode(['smaller'], [makeConst(1), makeConst(2)])
    expect(() => node.map((_child) => ({ notANode: true } as any))).toThrow(
      'Callback function must return a Node'
    )
  })
})

describe('RelationalNode - clone', () => {
  it('creates a shallow copy', () => {
    const a = makeConst(1)
    const b = makeConst(2)
    const node = new RelationalNode(['smaller'], [a, b])
    const cloned: any = node.clone()
    expect(cloned).not.toBe(node)
    expect(cloned.conditionals).toEqual(['smaller'])
    expect(cloned.params[0]).toBe(a)
    expect(cloned.params[1]).toBe(b)
  })
})

describe('RelationalNode - toString', () => {
  it('formats single comparison: 1 < 2', () => {
    const node = new RelationalNode(['smaller'], [makeConst(1), makeConst(2)])
    expect(node.toString()).toBe('1 < 2')
  })

  it('formats larger: 5 > 3', () => {
    const node = new RelationalNode(['larger'], [makeConst(5), makeConst(3)])
    expect(node.toString()).toBe('5 > 3')
  })

  it('formats equal: 1 == 1', () => {
    const node = new RelationalNode(['equal'], [makeConst(1), makeConst(1)])
    expect(node.toString()).toBe('1 == 1')
  })

  it('formats unequal: 1 != 2', () => {
    const node = new RelationalNode(['unequal'], [makeConst(1), makeConst(2)])
    expect(node.toString()).toBe('1 != 2')
  })

  it('formats smallerEq: 1 <= 2', () => {
    const node = new RelationalNode(['smallerEq'], [makeConst(1), makeConst(2)])
    expect(node.toString()).toBe('1 <= 2')
  })

  it('formats largerEq: 3 >= 2', () => {
    const node = new RelationalNode(['largerEq'], [makeConst(3), makeConst(2)])
    expect(node.toString()).toBe('3 >= 2')
  })

  it('formats chained: 1 < 2 < 3', () => {
    const node = new RelationalNode(
      ['smaller', 'smaller'],
      [makeConst(1), makeConst(2), makeConst(3)]
    )
    expect(node.toString()).toBe('1 < 2 < 3')
  })
})

describe('RelationalNode - toHTML', () => {
  it('includes operator span for <', () => {
    const node = new RelationalNode(['smaller'], [makeConst(1), makeConst(2)])
    const html = node.toHTML()
    expect(html).toContain('math-operator')
    expect(html).toContain('&lt;') // HTML-escaped <
  })

  it('includes operator span for >', () => {
    const node = new RelationalNode(['larger'], [makeConst(5), makeConst(3)])
    const html = node.toHTML()
    expect(html).toContain('&gt;')
  })
})

describe('RelationalNode - toTex', () => {
  it('formats smaller as LaTeX <', () => {
    const node = new RelationalNode(['smaller'], [makeConst(1), makeConst(2)])
    const tex = node.toTex()
    expect(tex).toContain('<')
  })

  it('formats largerEq as LaTeX >=', () => {
    const node = new RelationalNode(['largerEq'], [makeConst(3), makeConst(2)])
    const tex = node.toTex()
    expect(tex).toContain('\\geq')
  })
})

describe('RelationalNode - toJSON / fromJSON', () => {
  it('toJSON returns correct shape', () => {
    const a = makeConst(1)
    const b = makeConst(2)
    const node = new RelationalNode(['smaller'], [a, b])
    const json = node.toJSON()
    expect(json.mathjs).toBe('RelationalNode')
    expect(json.conditionals).toEqual(['smaller'])
    expect(json.params).toHaveLength(2)
  })

  it('fromJSON creates a RelationalNode', () => {
    const a = makeConst(1)
    const b = makeConst(2)
    const node = RelationalNode.fromJSON({ conditionals: ['smaller'], params: [a, b] })
    expect(node.isRelationalNode).toBe(true)
    expect(node.conditionals).toEqual(['smaller'])
  })
})

describe('RelationalNode - equals', () => {
  it('equal when same conditionals and params', () => {
    const a = new RelationalNode(['smaller'], [makeConst(1), makeConst(2)])
    const b = new RelationalNode(['smaller'], [makeConst(1), makeConst(2)])
    expect(a.equals(b)).toBe(true)
  })

  it('not equal when conditionals differ', () => {
    const a = new RelationalNode(['smaller'], [makeConst(1), makeConst(2)])
    const b = new RelationalNode(['larger'], [makeConst(1), makeConst(2)])
    expect(a.equals(b)).toBe(false)
  })

  it('not equal to null', () => {
    expect(new RelationalNode(['smaller'], [makeConst(1), makeConst(2)]).equals(null as any)).toBe(false)
  })
})

describe('RelationalNode - traverse', () => {
  it('visits root and each param', () => {
    const a = makeConst(1)
    const b = makeConst(2)
    const node = new RelationalNode(['smaller'], [a, b])
    const visited: any[] = []
    node.traverse((n) => visited.push(n))
    expect(visited).toHaveLength(3) // root + 2 params
    expect(visited[0]).toBe(node)
    expect(visited.some((n) => n === a)).toBe(true)
    expect(visited.some((n) => n === b)).toBe(true)
  })
})
