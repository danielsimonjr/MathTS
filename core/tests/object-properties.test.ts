import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { clone, deepExtend, extend, mapObject } from '../src/object.js';

const FC = { seed: 0x5eed, numRuns: 100 } as const;

/** Keys that are attack vectors, or names that sit on `Object.prototype` / `Function.prototype`. */
const specialKey = fc.constantFrom(
  '__proto__',
  'constructor',
  'toString',
  'name',
  'length',
  'polluted'
);
const anyKey = fc.oneof(specialKey, fc.string({ minLength: 1, maxLength: 6 }));

const leafValue = fc.oneof(
  fc.double({ noNaN: false }),
  fc.boolean(),
  fc.constant({ polluted: true })
);

type Entries = [string, unknown][];

/**
 * Build the object with `Object.fromEntries`, which defines `__proto__` as an own data property
 * (as `JSON.parse` does), unlike the assignment `obj['__proto__'] = v`.
 */
function build(entries: Entries): Record<string, unknown> {
  return Object.fromEntries(entries);
}

const entriesArb = (keys: fc.Arbitrary<string>): fc.Arbitrary<Entries> =>
  fc.array(fc.tuple(keys, leafValue), { maxLength: 6 });

/** `clone` recognises a plain object by `constructor === Object`, so it cannot take that data key. */
const cloneKey = anyKey.filter((k) => k !== 'constructor');
const noProtoKey = anyKey.filter((k) => k !== '__proto__');

function assertGlobalPrototypeIntact(before: string[]): void {
  expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(before);
  expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
}

function assertCleanResult(result: Record<string, unknown>): void {
  expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  expect(Object.getOwnPropertyDescriptor(result, '__proto__')).toBeUndefined();
}

describe('object pollution properties (fast-check)', () => {
  it('clone copies every key but __proto__ and leaves the prototype alone', () => {
    fc.assert(
      fc.property(entriesArb(cloneKey), (entries) => {
        const before = Object.getOwnPropertyNames(Object.prototype);
        const src = build(entries);
        const result = clone(src);
        assertGlobalPrototypeIntact(before);
        assertCleanResult(result);

        // Oracle: a test-local recursive loop, not the production key predicates.
        const copy = (value: unknown): unknown => {
          if (typeof value !== 'object' || value === null) return value;
          const out: Record<string, unknown> = {};
          for (const [key, v] of Object.entries(value)) if (key !== '__proto__') out[key] = copy(v);
          return out;
        };
        expect(result).toEqual(copy(src));
      }),
      FC
    );
  });

  it('mapObject keeps every key but __proto__ and leaves the prototype alone', () => {
    fc.assert(
      fc.property(entriesArb(anyKey), (entries) => {
        const before = Object.getOwnPropertyNames(Object.prototype);
        const src = build(entries);
        const result = mapObject(src, (v) => v);
        assertGlobalPrototypeIntact(before);
        assertCleanResult(result);

        const expectedKeys: string[] = [];
        for (const key of Object.keys(src)) if (key !== '__proto__') expectedKeys.push(key);
        expect(Object.keys(result).sort()).toEqual(expectedKeys.sort());
        for (const key of expectedKeys) expect(result[key]).toBe(src[key]);
      }),
      FC
    );
  });

  it('extend copies every key of b but __proto__ and leaves the prototype alone', () => {
    fc.assert(
      fc.property(entriesArb(noProtoKey), entriesArb(anyKey), (targetEntries, extraEntries) => {
        const before = Object.getOwnPropertyNames(Object.prototype);
        const target = build(targetEntries);
        const extra = build(extraEntries);

        // Oracle: start from target's keys, then overlay b's keys in order.
        const expected = new Map<string, unknown>(Object.entries(target));
        for (const [key, value] of Object.entries(extra)) {
          if (key !== '__proto__') expected.set(key, value);
        }

        const result = extend(target, extra);
        assertGlobalPrototypeIntact(before);
        assertCleanResult(result);
        expect(Object.keys(result).sort()).toEqual([...expected.keys()].sort());
        for (const [key, value] of expected) expect(result[key]).toBe(value);
      }),
      FC
    );
  });

  it('deepExtend never writes through __proto__, constructor or prototype', () => {
    const vectorKey = fc.constantFrom('__proto__', 'constructor', 'prototype');
    fc.assert(
      fc.property(
        fc.array(vectorKey, { minLength: 1, maxLength: 3 }),
        fc.string({ minLength: 1, maxLength: 5 }),
        (path, leaf) => {
          const before = Object.getOwnPropertyNames(Object.prototype);
          // {"__proto__": {"constructor": {"prototype": {"<leaf>": true}}}} and permutations.
          let payload = JSON.stringify({ [leaf]: true });
          for (const key of [...path].reverse()) payload = `{"${key}":${payload}}`;
          const target: Record<string, unknown> = {};
          deepExtend(target, JSON.parse(payload));
          assertGlobalPrototypeIntact(before);
          expect(({} as Record<string, unknown>)[leaf]).toBeUndefined();
          expect((Object.prototype as unknown as Record<string, unknown>)[leaf]).toBeUndefined();
          expect(Object.getPrototypeOf(target)).toBe(Object.prototype);
        }
      ),
      FC
    );
  });

  it('a shared nested payload is not aliased into the clone', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true }), (n) => {
        const inner = { n };
        const result = clone({ a: inner, b: inner });
        expect(result.a).toEqual(inner);
        expect(result.a).not.toBe(inner);
      }),
      FC
    );
  });
});
