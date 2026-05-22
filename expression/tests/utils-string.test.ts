import { describe, it, expect } from 'vitest'
import {
  endsWith,
  format,
  stringify,
  escape,
  compareText,
} from '../src/utils/string.js'

// ---------------------------------------------------------------------------
// endsWith
// ---------------------------------------------------------------------------
describe('endsWith', () => {
  it('returns true when text ends with search', () => {
    expect(endsWith('hello world', 'world')).toBe(true)
    expect(endsWith('foobar', 'bar')).toBe(true)
  })

  it('returns false when text does not end with search', () => {
    expect(endsWith('hello world', 'hello')).toBe(false)
    expect(endsWith('abc', 'xyz')).toBe(false)
  })

  it('returns true for empty search string', () => {
    expect(endsWith('anything', '')).toBe(true)
  })

  it('returns true when text equals search', () => {
    expect(endsWith('exact', 'exact')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// stringify
// ---------------------------------------------------------------------------
describe('stringify', () => {
  it('wraps a plain string in double quotes', () => {
    expect(stringify('hello')).toBe('"hello"')
  })

  it('escapes double quotes inside the string', () => {
    expect(stringify('say "hi"')).toBe('"say \\"hi\\""')
  })

  it('escapes backslashes', () => {
    expect(stringify('back\\slash')).toBe('"back\\\\slash"')
  })

  it('escapes newlines', () => {
    expect(stringify('line1\nline2')).toBe('"line1\\nline2"')
  })

  it('escapes tab characters', () => {
    expect(stringify('tab\there')).toBe('"tab\\there"')
  })

  it('escapes carriage return', () => {
    expect(stringify('cr\rhere')).toBe('"cr\\rhere"')
  })

  it('handles numbers by converting to string first', () => {
    expect(stringify(42 as any)).toBe('"42"')
  })

  it('handles empty string', () => {
    expect(stringify('')).toBe('""')
  })
})

// ---------------------------------------------------------------------------
// escape
// ---------------------------------------------------------------------------
describe('escape', () => {
  it('escapes &, <, >, \', "', () => {
    expect(escape('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    )
  })

  it('escapes ampersands', () => {
    expect(escape('a & b')).toBe('a &amp; b')
  })

  it('escapes single quotes', () => {
    expect(escape("it's")).toBe('it&#39;s')
  })

  it('returns unchanged string when nothing to escape', () => {
    expect(escape('hello world')).toBe('hello world')
  })

  it('converts non-string values via String()', () => {
    expect(escape(42 as any)).toBe('42')
  })
})

// ---------------------------------------------------------------------------
// compareText
// ---------------------------------------------------------------------------
describe('compareText', () => {
  it('returns 0 when strings are equal', () => {
    expect(compareText('apple', 'apple')).toBe(0)
  })

  it('returns positive when x > y lexicographically', () => {
    expect(compareText('banana', 'apple')).toBe(1)
  })

  it('returns negative when x < y lexicographically', () => {
    expect(compareText('apple', 'banana')).toBe(-1)
  })

  it('throws when x is not a string', () => {
    expect(() => compareText(42 as any, 'hello')).toThrow('Unexpected type')
  })

  it('throws when y is not a string', () => {
    expect(() => compareText('hello', 42 as any)).toThrow('Unexpected type')
  })

  it('handles empty strings', () => {
    expect(compareText('', '')).toBe(0)
    expect(compareText('a', '')).toBe(1)
    expect(compareText('', 'a')).toBe(-1)
  })
})

// ---------------------------------------------------------------------------
// format (string-level dispatcher)
// ---------------------------------------------------------------------------
describe('format (string dispatcher)', () => {
  it('formats a number', () => {
    expect(format(6.4, {})).toBe('6.4')
  })

  it('formats a string as a quoted value', () => {
    expect(format('hello', {})).toBe('"hello"')
  })

  it('formats an array recursively', () => {
    expect(format([1, 2, 3], {})).toBe('[1, 2, 3]')
  })

  it('formats a nested array', () => {
    expect(format([[1, 2], [3, 4]], {})).toBe('[[1, 2], [3, 4]]')
  })

  it('formats a function with .syntax property', () => {
    const fn: any = () => {}
    fn.syntax = 'f(x)'
    expect(format(fn, {})).toBe('f(x)')
  })

  it('formats a function without .syntax as "function"', () => {
    expect(format(() => {}, {})).toBe('function')
  })

  it('formats a plain object with toString fallback as JSON-like string', () => {
    // format() wraps keys and values with quotes: {"a": 1, "b": 2}
    expect(format({ a: 1, b: 2 }, {})).toBe('{"a": 1, "b": 2}')
  })

  it('truncates when truncate option is set', () => {
    const result = format('a very long string indeed yes it is', { truncate: 10 })
    expect(result.length).toBe(10)
    expect(result.endsWith('...')).toBe(true)
  })

  it('does not truncate when result is shorter than truncate limit', () => {
    const result = format('hi', { truncate: 100 })
    expect(result).toBe('"hi"')
  })

  it('uses object.format(options) when available', () => {
    const obj = { format: (opts: any) => `formatted:${opts.x}` }
    expect(format(obj, { x: 42 })).toBe('formatted:42')
  })
})
