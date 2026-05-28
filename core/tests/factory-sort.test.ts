import { describe, it, expect } from 'vitest';
import { factory, sortFactories } from '../src/factory.js';

describe('sortFactories', () => {
  it('should detect direct circular dependencies', () => {
    const fA = factory('A', ['B'], () => {});
    const fB = factory('B', ['A'], () => {});

    expect(() => sortFactories([fA, fB])).toThrow(/Circular dependency detected: A|Circular dependency detected: B/);
  });

  it('should detect indirect circular dependencies', () => {
    const fA = factory('A', ['B'], () => {});
    const fB = factory('B', ['C'], () => {});
    const fC = factory('C', ['A'], () => {});

    expect(() => sortFactories([fA, fB, fC])).toThrow(/Circular dependency detected:/);
  });

  it('should not throw on non-circular dependencies', () => {
    const fA = factory('A', ['B'], () => {});
    const fB = factory('B', ['C'], () => {});
    const fC = factory('C', [], () => {});

    const sorted = sortFactories([fA, fB, fC]);
    expect(sorted.length).toBe(3);
    expect((sorted[0] as any).fn).toBe('C');
    expect((sorted[1] as any).fn).toBe('B');
    expect((sorted[2] as any).fn).toBe('A');
  });
});
