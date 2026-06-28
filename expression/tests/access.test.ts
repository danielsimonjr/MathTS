import { describe, it, expect } from 'vitest';
import { accessFactory } from '../src/node/utils/access.js';

// ── Minimal mock Index object ─────────────────────────────────────────────

function makeObjectIndex(prop: string) {
  return {
    isObjectProperty: () => true,
    getObjectProperty: () => prop,
  };
}

function makeNumericIndex(_i: number) {
  return {
    isObjectProperty: () => false,
    getObjectProperty: () => null,
  };
}

// ── Minimal subset implementation (for arrays and strings) ────────────────

function subsetGet(obj: unknown, index: unknown): unknown {
  const i = (index as { _i: number })._i;
  if (Array.isArray(obj)) {
    // Very simple 1D subset extraction for tests
    return obj[i];
  }
  if (typeof obj === 'string') {
    return obj[i];
  }
  throw new Error('Not supported by mock subset');
}

// Numeric index with a `_i` property for mock subset
function makeSimpleNumericIndex(i: number) {
  return {
    isObjectProperty: () => false,
    getObjectProperty: () => null,
    _i: i,
  };
}

// ── Bootstrap access ──────────────────────────────────────────────────────

const access = accessFactory({ subset: subsetGet });

// ── Tests ──────────────────────────────────────────────────────────────────

describe('access - object property access', () => {
  it('reads a property from a plain object using dot notation index', () => {
    const obj = { name: 'Alice', age: 30 };
    const index = makeObjectIndex('name');
    expect(access(obj, index)).toBe('Alice');
  });

  it('reads a numeric property from a plain object', () => {
    const obj = { score: 42 };
    const index = makeObjectIndex('score');
    expect(access(obj, index)).toBe(42);
  });

  it('reads a nested property', () => {
    const obj = { config: { debug: true } };
    const index = makeObjectIndex('config');
    expect(access(obj, index)).toEqual({ debug: true });
  });

  it('throws when accessing a property that does not exist on a plain object', () => {
    // getSafeProperty will throw "No access to property" for non-own props
    const obj = { x: 1 };
    const index = makeObjectIndex('constructor'); // inherited — should be blocked
    expect(() => access(obj, index)).toThrow();
  });

  it('throws when trying numeric index on a plain object', () => {
    const obj = { x: 1 };
    const index = makeNumericIndex(0);
    expect(() => access(obj, index)).toThrow('Cannot apply a numeric index as object property');
  });
});

describe('access - array access via subset', () => {
  it('reads an element from an array', () => {
    const arr = [10, 20, 30];
    const index = makeSimpleNumericIndex(1);
    expect(access(arr, index)).toBe(20);
  });

  it('reads first element from an array', () => {
    const arr = ['a', 'b', 'c'];
    const index = makeSimpleNumericIndex(0);
    expect(access(arr, index)).toBe('a');
  });
});

describe('access - string access via subset', () => {
  it('reads a character from a string', () => {
    const str = 'hello';
    const index = makeSimpleNumericIndex(1);
    expect(access(str, index)).toBe('e');
  });
});

describe('access - Matrix-like object (has .subset method)', () => {
  it('calls the .subset method on Matrix-like objects', () => {
    const matrix = {
      subset: (index: unknown) => `matrix[${JSON.stringify(index)}]`,
    };
    const index = makeSimpleNumericIndex(2);
    const result = access(matrix, index);
    expect(typeof result).toBe('string');
    expect(result).toContain('matrix[');
  });
});

describe('access - unsupported type throws', () => {
  it('throws for a number', () => {
    expect(() => access(42, makeSimpleNumericIndex(0))).toThrow(
      'Cannot apply index: unsupported type of object'
    );
  });

  it('throws for a boolean', () => {
    expect(() => access(true, makeSimpleNumericIndex(0))).toThrow(
      'Cannot apply index: unsupported type of object'
    );
  });

  it('throws for null with numeric index (hits object branch, not unsupported branch)', () => {
    // null has typeof 'object', so it falls into the object branch and fails on numeric index
    expect(() => access(null, makeSimpleNumericIndex(0))).toThrow(
      'Cannot apply a numeric index as object property'
    );
  });
});
