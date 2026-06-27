import { describe, it, expect } from 'vitest';
import { formatResult } from '../src/formatter.js';

describe('formatResult', () => {
  it('should render primitives directly', () => {
    expect(formatResult('hello')).toBe('hello');
    expect(formatResult(42)).toBe('42');
    expect(formatResult(true)).toBe('true');
    expect(formatResult(false)).toBe('false');
  });

  it('should render bigint with an n suffix', () => {
    expect(formatResult(10n)).toBe('10n');
  });

  it('should render undefined and null as a no-result marker', () => {
    expect(formatResult(undefined)).toBe('(no result)');
    expect(formatResult(null)).toBe('(no result)');
  });

  it('should JSON-stringify plain objects and arrays', () => {
    expect(formatResult({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
    expect(formatResult([1, 2, 3])).toBe('[1,2,3]');
  });

  it('should use a custom toString for class instances (e.g. Complex/Fraction)', () => {
    class Complexish {
      toString() {
        return '3 + 4i';
      }
    }
    expect(formatResult(new Complexish())).toBe('3 + 4i');
  });

  it('should not throw on a circular reference', () => {
    const a: Record<string, unknown> = { x: 1 };
    a.self = a;
    let out = '';
    expect(() => {
      out = formatResult(a);
    }).not.toThrow();
    expect(out).toContain('[Circular]');
  });

  it('should not throw on a bigint nested in an object', () => {
    let out = '';
    expect(() => {
      out = formatResult({ big: 10n });
    }).not.toThrow();
    expect(out).toContain('10n');
  });

  it('should render shared (non-circular) references in full, not as [Circular]', () => {
    const shared = { v: 1 };
    const out = formatResult({ a: shared, b: shared });
    expect(out).not.toContain('[Circular]');
    expect(out).toBe('{"a":{"v":1},"b":{"v":1}}');
  });
});
