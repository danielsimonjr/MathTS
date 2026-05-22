import { describe, it, expect } from 'vitest'
import { keywords } from '../src/keywords.js'

describe('keywords - type and structure', () => {
  it('is a Set', () => {
    expect(keywords).toBeInstanceOf(Set)
  })

  it('contains the reserved keyword "end"', () => {
    expect(keywords.has('end')).toBe(true)
  })

  it('does not contain arbitrary strings', () => {
    expect(keywords.has('for')).toBe(false)
    expect(keywords.has('while')).toBe(false)
    expect(keywords.has('if')).toBe(false)
    expect(keywords.has('function')).toBe(false)
    expect(keywords.has('')).toBe(false)
    expect(keywords.has('x')).toBe(false)
  })

  it('has exactly 1 element', () => {
    expect(keywords.size).toBe(1)
  })
})

describe('keywords - iteration', () => {
  it('can be iterated', () => {
    const items = [...keywords]
    expect(items).toEqual(['end'])
  })
})

describe('keywords - membership tests', () => {
  it('correctly classifies "end" as a keyword', () => {
    const word = 'end'
    expect(keywords.has(word)).toBe(true)
  })

  it('correctly classifies common variable names as non-keywords', () => {
    const names = ['x', 'y', 'z', 'i', 'j', 'n', 'result', 'sum', 'pi', 'e']
    for (const name of names) {
      expect(keywords.has(name)).toBe(false)
    }
  })
})
