import { describe, it, expect } from 'vitest';
import {
  isNumber,
  isBigInt,
  isString,
  isBoolean,
  isArray,
  isFunction,
  isDate,
  isRegExp,
  isNull,
  isUndefined,
  isObject,
  isMap,
  isPartitionedMap,
  isComplex,
  isFraction,
  isBigNumber,
  isUnit,
  isMatrix,
  isCollection,
  isDenseMatrix,
  isSparseMatrix,
  isRange,
  isIndex,
  isResultSet,
  isHelp,
  isChain,
  isAccessorNode,
  isArrayNode,
  isAssignmentNode,
  isBlockNode,
  isConditionalNode,
  isConstantNode,
  isFunctionAssignmentNode,
  isFunctionNode,
  isIndexNode,
  isObjectNode,
  isOperatorNode,
  isParenthesisNode,
  isRangeNode,
  isRelationalNode,
  isSymbolNode,
  isNode,
} from '../src/utils/is.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a class-based instance whose prototype carries the listed boolean
 * flags. Matches the duck-typing the `isXxx` guards perform —
 * `constructor.prototype.isXxx === true` plus `instance.isXxx === true`.
 */
function makeWithProto(...flags: string[]): unknown {
  class Fake {}
  for (const f of flags) (Fake.prototype as Record<string, unknown>)[f] = true;
  return new Fake();
}

function makeNodeLike(flag: string): unknown {
  return makeWithProto('isNode', flag);
}

// ─── Primitive guards ────────────────────────────────────────────────────────

describe('isNumber', () => {
  it('returns true for numbers (including NaN, Infinity)', () => {
    expect(isNumber(0)).toBe(true);
    expect(isNumber(1.5)).toBe(true);
    expect(isNumber(NaN)).toBe(true);
    expect(isNumber(Infinity)).toBe(true);
  });
  it('returns false for non-numbers', () => {
    expect(isNumber('1')).toBe(false);
    expect(isNumber(null)).toBe(false);
    expect(isNumber(undefined)).toBe(false);
    expect(isNumber(1n)).toBe(false);
  });
});

describe('isBigInt / isString / isBoolean', () => {
  it('isBigInt true for bigint only', () => {
    expect(isBigInt(1n)).toBe(true);
    expect(isBigInt(1)).toBe(false);
  });
  it('isString true for strings only', () => {
    expect(isString('x')).toBe(true);
    expect(isString(1)).toBe(false);
  });
  it('isBoolean true for booleans only', () => {
    expect(isBoolean(true)).toBe(true);
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean(0)).toBe(false);
  });
});

describe('isArray / isFunction / isDate / isRegExp', () => {
  it('isArray detects arrays', () => {
    expect(isArray([])).toBe(true);
    expect(isArray({ length: 0 })).toBe(false);
  });
  it('isFunction detects functions', () => {
    expect(isFunction(() => 0)).toBe(true);
    expect(isFunction({})).toBe(false);
  });
  it('isDate detects Date instances', () => {
    expect(isDate(new Date())).toBe(true);
    expect(isDate('2026-01-01')).toBe(false);
  });
  it('isRegExp detects RegExp instances', () => {
    expect(isRegExp(/a/)).toBe(true);
    expect(isRegExp('a')).toBe(false);
  });
});

describe('isNull / isUndefined', () => {
  it('isNull only true for null', () => {
    expect(isNull(null)).toBe(true);
    expect(isNull(undefined)).toBe(false);
    expect(isNull(0)).toBe(false);
  });
  it('isUndefined only true for undefined', () => {
    expect(isUndefined(undefined)).toBe(true);
    expect(isUndefined(null)).toBe(false);
  });
});

describe('isObject', () => {
  it('returns true for plain objects', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ a: 1 })).toBe(true);
  });
  it('returns false for non-plain values', () => {
    expect(isObject([])).toBe(false);
    expect(isObject(new Date())).toBe(false);
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject(1)).toBe(false);
    expect(isObject('s')).toBe(false);
    expect(isObject(() => 0)).toBe(false);
  });
});

// ─── Map duck-typed guards ───────────────────────────────────────────────────

describe('isMap', () => {
  it('returns true for native Map instances', () => {
    expect(isMap(new Map())).toBe(true);
  });
  it('returns true for Map-shaped duck-typed objects', () => {
    expect(isMap({ get: () => 0, set: () => 0, keys: () => [], has: () => false })).toBe(true);
  });
  it('returns false for plain objects, arrays, primitives', () => {
    expect(isMap({})).toBe(false);
    expect(isMap([])).toBe(false);
    expect(isMap(null)).toBe(false);
    expect(isMap(undefined)).toBe(false);
  });
});

describe('isPartitionedMap', () => {
  it('returns true for a map with a and b sub-maps', () => {
    const partitioned: Map<unknown, unknown> & {
      a?: Map<unknown, unknown>;
      b?: Map<unknown, unknown>;
    } = new Map();
    partitioned.a = new Map();
    partitioned.b = new Map();
    expect(isPartitionedMap(partitioned)).toBe(true);
  });
  it('returns false for a plain Map', () => {
    expect(isPartitionedMap(new Map())).toBe(false);
  });
});

// ─── Numeric-type duck-typed guards ──────────────────────────────────────────

describe('isComplex', () => {
  it('returns true when prototype carries isComplex', () => {
    expect(isComplex(makeWithProto('isComplex'))).toBe(true);
  });
  it('returns false for plain object with own isComplex flag', () => {
    expect(isComplex({ isComplex: true })).toBe(false);
  });
  it('returns false for primitives/null', () => {
    expect(isComplex(0)).toBe(false);
    expect(isComplex(null)).toBe(false);
  });
});

describe('isFraction', () => {
  it('returns true when prototype carries isFraction', () => {
    expect(isFraction(makeWithProto('isFraction'))).toBe(true);
  });
  it('returns false for plain object with own isFraction flag', () => {
    expect(isFraction({ isFraction: true })).toBe(false);
  });
});

describe('isBigNumber', () => {
  it('returns true when instance.isBigNumber + prototype.isBigNumber are set', () => {
    expect(isBigNumber(makeWithProto('isBigNumber'))).toBe(true);
  });
  it('returns true when the constructor has a working isDecimal()', () => {
    class FakeDecimal {
      static isDecimal(v: unknown) {
        return v instanceof FakeDecimal;
      }
    }
    expect(isBigNumber(new FakeDecimal())).toBe(true);
  });
  it('returns false for plain values', () => {
    expect(isBigNumber({ isBigNumber: true })).toBe(false);
    expect(isBigNumber(1)).toBe(false);
    expect(isBigNumber(null)).toBe(false);
  });
});

describe('isUnit', () => {
  it('returns true when prototype carries isUnit', () => {
    expect(isUnit(makeWithProto('isUnit'))).toBe(true);
  });
  it('returns false for plain objects with own isUnit flag', () => {
    expect(isUnit({ isUnit: true })).toBe(false);
  });
});

// ─── Matrix duck-typed guards ────────────────────────────────────────────────

describe('isMatrix / isDenseMatrix / isSparseMatrix / isCollection', () => {
  it('isMatrix detects matrix-like classes (prototype.isMatrix)', () => {
    expect(isMatrix(makeWithProto('isMatrix'))).toBe(true);
    expect(isMatrix({ isMatrix: true })).toBe(false);
  });
  it('isDenseMatrix requires instance.isDenseMatrix AND prototype.isMatrix', () => {
    expect(isDenseMatrix(makeWithProto('isMatrix', 'isDenseMatrix'))).toBe(true);
    expect(isDenseMatrix(makeWithProto('isMatrix'))).toBe(false);
    expect(isDenseMatrix({ isDenseMatrix: true })).toBe(false);
  });
  it('isSparseMatrix requires instance.isSparseMatrix AND prototype.isMatrix', () => {
    expect(isSparseMatrix(makeWithProto('isMatrix', 'isSparseMatrix'))).toBe(true);
    expect(isSparseMatrix(makeWithProto('isMatrix'))).toBe(false);
  });
  it('isCollection accepts arrays and matrix-likes', () => {
    expect(isCollection([])).toBe(true);
    expect(isCollection(makeWithProto('isMatrix'))).toBe(true);
    expect(isCollection({})).toBe(false);
    expect(isCollection('abc')).toBe(false);
  });
});

// ─── Other duck-typed guards ─────────────────────────────────────────────────

describe('isRange / isIndex / isResultSet / isHelp / isChain', () => {
  it('isRange detects prototype.isRange', () => {
    expect(isRange(makeWithProto('isRange'))).toBe(true);
    expect(isRange({ isRange: true })).toBe(false);
  });
  it('isIndex detects prototype.isIndex', () => {
    expect(isIndex(makeWithProto('isIndex'))).toBe(true);
    expect(isIndex({})).toBe(false);
  });
  it('isResultSet detects prototype.isResultSet', () => {
    expect(isResultSet(makeWithProto('isResultSet'))).toBe(true);
  });
  it('isHelp detects prototype.isHelp', () => {
    expect(isHelp(makeWithProto('isHelp'))).toBe(true);
  });
  it('isChain detects prototype.isChain', () => {
    expect(isChain(makeWithProto('isChain'))).toBe(true);
  });
});

// ─── Node type guards ────────────────────────────────────────────────────────

describe('isNode and the AST node guards', () => {
  it('isNode detects prototype.isNode', () => {
    expect(isNode(makeWithProto('isNode'))).toBe(true);
    expect(isNode({})).toBe(false);
    expect(isNode(null)).toBe(false);
  });

  const cases: Array<[string, (x: unknown) => boolean]> = [
    ['isAccessorNode', isAccessorNode],
    ['isArrayNode', isArrayNode],
    ['isAssignmentNode', isAssignmentNode],
    ['isBlockNode', isBlockNode],
    ['isConditionalNode', isConditionalNode],
    ['isConstantNode', isConstantNode],
    ['isFunctionAssignmentNode', isFunctionAssignmentNode],
    ['isFunctionNode', isFunctionNode],
    ['isIndexNode', isIndexNode],
    ['isObjectNode', isObjectNode],
    ['isOperatorNode', isOperatorNode],
    ['isParenthesisNode', isParenthesisNode],
    ['isRangeNode', isRangeNode],
    ['isRelationalNode', isRelationalNode],
    ['isSymbolNode', isSymbolNode],
  ];

  for (const [name, guard] of cases) {
    it(`${name} returns true for a class instance with isNode + ${name.replace(/^is/, 'is')} on the prototype`, () => {
      const instance = makeNodeLike(name.replace(/^is/, 'is'));
      expect(guard(instance)).toBe(true);
    });

    it(`${name} returns false for a plain object that only carries the flag as an own property`, () => {
      const plain: Record<string, boolean> = {};
      plain[name.replace(/^is/, 'is')] = true;
      expect(guard(plain)).toBe(false);
    });

    it(`${name} returns false for null and primitives`, () => {
      expect(guard(null)).toBe(false);
      expect(guard(undefined)).toBe(false);
      expect(guard(0)).toBe(false);
      expect(guard('x')).toBe(false);
    });
  }
});
