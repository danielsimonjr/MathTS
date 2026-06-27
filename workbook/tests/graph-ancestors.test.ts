import { describe, it, expect } from 'vitest';
import { buildDependencyGraph, getAncestors } from '../src/graph.js';
import type { Cell } from '../src/types.js';

const cell = (id: string, dependsOn?: string[]): Cell => ({
  id,
  type: 'code',
  content: '0',
  ...(dependsOn ? { dependsOn } : {}),
});

describe('getAncestors', () => {
  it('returns just the cell itself when it has no dependencies', () => {
    const g = buildDependencyGraph([cell('a')]);
    expect(getAncestors(g, 'a').sort()).toEqual(['a']);
  });

  it('returns the full transitive dependency chain plus self (linear)', () => {
    const g = buildDependencyGraph([cell('a'), cell('b', ['a']), cell('c', ['b'])]);
    expect(getAncestors(g, 'c').sort()).toEqual(['a', 'b', 'c']);
    expect(getAncestors(g, 'b').sort()).toEqual(['a', 'b']);
  });

  it('handles a diamond (shared ancestor counted once)', () => {
    const g = buildDependencyGraph([
      cell('a'),
      cell('b', ['a']),
      cell('c', ['a']),
      cell('d', ['b', 'c']),
    ]);
    expect(getAncestors(g, 'd').sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not include unrelated cells', () => {
    const g = buildDependencyGraph([cell('a'), cell('b', ['a']), cell('x')]);
    expect(getAncestors(g, 'b')).not.toContain('x');
  });

  it('is cycle-safe', () => {
    const g = buildDependencyGraph([cell('a', ['b']), cell('b', ['a'])]);
    expect(getAncestors(g, 'a').sort()).toEqual(['a', 'b']);
  });

  it('returns empty for an unknown id', () => {
    const g = buildDependencyGraph([cell('a')]);
    expect(getAncestors(g, 'nope')).toEqual([]);
  });
});
