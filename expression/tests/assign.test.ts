import { describe, it, expect } from 'vitest';
import { assignFactory } from '../src/node/utils/assign.js';

// ── Mock index helpers ────────────────────────────────────────────────────

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

// ── Mock matrix / subset for arrays and strings ───────────────────────────

function makeSimpleNumericIndex(i: number) {
  return {
    isObjectProperty: () => false,
    getObjectProperty: () => null,
    _i: i,
  };
}

// Simple 1D array subset for assignment
const mockMatrix = {
  subset(data: any[], index: any, value: any) {
    const result = [...data];
    result[index._i] = value;
    return {
      valueOf: () => result,
    };
  },
};

// subset for strings: replace char at index
function mockSubset(obj: any, index: any, value: any): any {
  if (typeof obj === 'string') {
    const i = index._i;
    return obj.substring(0, i) + value + obj.substring(i + 1);
  }
  if (Array.isArray(obj)) {
    return mockMatrix.subset(obj, index, value).valueOf();
  }
  throw new Error('Not supported by mock subset');
}

const assign = assignFactory({ subset: mockSubset });

// ── Tests ──────────────────────────────────────────────────────────────────

describe('assign - plain object property assignment', () => {
  it('assigns a value to an existing property', () => {
    const obj = { x: 1 };
    const index = makeObjectIndex('x');
    const result = assign(obj, index, 42);
    expect(result).toBe(obj); // returns original object
    expect(obj.x).toBe(42);
  });

  it('assigns a new property to a plain object', () => {
    const obj: Record<string, any> = {};
    const index = makeObjectIndex('newProp');
    const result = assign(obj, index, 'hello');
    expect(result).toBe(obj);
    expect(obj.newProp).toBe('hello');
  });

  it('assigns an object value as property', () => {
    const obj: Record<string, any> = {};
    const index = makeObjectIndex('nested');
    const value = { a: 1, b: 2 };
    assign(obj, index, value);
    expect(obj.nested).toEqual({ a: 1, b: 2 });
  });

  it('throws when numeric index used on plain object', () => {
    const obj = { x: 1 };
    const index = makeNumericIndex(0);
    expect(() => assign(obj, index, 99)).toThrow('Cannot apply a numeric index as object property');
  });

  it('blocks assignment to inherited properties (constructor)', () => {
    const obj = {};
    const index = makeObjectIndex('constructor');
    expect(() => assign(obj, index, 'evil')).toThrow();
  });

  it('blocks assignment to toString (inherited)', () => {
    const obj = {};
    const index = makeObjectIndex('toString');
    expect(() => assign(obj, index, 'evil')).toThrow();
  });
});

describe('assign - array assignment via subset', () => {
  it('assigns a value into an array at the given index', () => {
    const arr = [10, 20, 30];
    const index = makeSimpleNumericIndex(1);
    const result = assign(arr, index, 99);
    expect(result).toBe(arr); // returns same array reference
    expect(arr[1]).toBe(99);
  });

  it('assigns to first element of array', () => {
    const arr = ['a', 'b', 'c'];
    const index = makeSimpleNumericIndex(0);
    assign(arr, index, 'z');
    expect(arr[0]).toBe('z');
  });
});

describe('assign - string assignment via subset', () => {
  it('replaces a character in a string', () => {
    const index = makeSimpleNumericIndex(1);
    const result = assign('hello', index, 'a');
    // String replacement returns a new string
    expect(result).toBe('hallo');
  });
});

describe('assign - Matrix-like object (has .subset method)', () => {
  it('calls the .subset method on Matrix-like objects', () => {
    const calls: Array<{ index: any; value: any }> = [];
    const matrix = {
      subset(index: any, value: any) {
        calls.push({ index, value });
        return matrix; // fluent
      },
    };
    const index = makeSimpleNumericIndex(0);
    const result = assign(matrix, index, 42);
    expect(calls).toHaveLength(1);
    expect(calls[0].value).toBe(42);
    expect(result).toBe(matrix);
  });
});

describe('assign - unsupported type throws', () => {
  it('throws for a number as target', () => {
    expect(() => assign(42, makeSimpleNumericIndex(0), 99)).toThrow(
      'Cannot apply index: unsupported type of object'
    );
  });

  it('throws for a boolean as target', () => {
    expect(() => assign(true, makeSimpleNumericIndex(0), 99)).toThrow(
      'Cannot apply index: unsupported type of object'
    );
  });

  it('throws for undefined as target', () => {
    expect(() => assign(undefined, makeSimpleNumericIndex(0), 99)).toThrow(
      'Cannot apply index: unsupported type of object'
    );
  });
});
