import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { clone, extend, mapObject } from '@danielsimonjr/mathts-core/internal';
import { isPollutingKey } from '../src/shared.js';

const FC = { seed: 0x5eed, numRuns: 100 } as const;

const pollutingKey = fc.constantFrom('__proto__', 'constructor', 'toString');

function protoSnapshot(): string {
  return JSON.stringify(Object.prototype);
}

function ownPolluted(obj: Record<string, unknown>): unknown {
  return Object.getOwnPropertyDescriptor(obj, 'polluted')?.value;
}

/** Plain object copier oracle (skips polluting keys like clone). */
function manualClone(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => manualClone(v));
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (isPollutingKey(key)) continue;
    out[key] = manualClone((value as Record<string, unknown>)[key]);
  }
  return out;
}

const objectKey = fc.oneof(
  pollutingKey,
  fc.string({ minLength: 1, maxLength: 6 }).filter((s) => s !== '__proto__' && s !== 'constructor')
);

const plainObject = fc
  .dictionary(objectKey, fc.oneof(fc.double({ noNaN: false }), fc.boolean()), {
    maxKeys: 6,
  })
  .filter((o) => {
    if (Object.getPrototypeOf(o) !== Object.prototype) return false;
    // Own `constructor` / `__proto__` shadow builtins and break `isObject` / `clone`.
    if (Object.prototype.hasOwnProperty.call(o, 'constructor')) return false;
    if (Object.prototype.hasOwnProperty.call(o, '__proto__')) return false;
    return true;
  });

describe('object pollution properties (fast-check)', () => {
  it('clone leaves Object.prototype and result prototype untouched', () => {
    fc.assert(
      fc.property(plainObject, (src) => {
        const before = protoSnapshot();
        const result = clone(src) as Record<string, unknown>;
        expect(protoSnapshot()).toBe(before);
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        expect(ownPolluted(Object.prototype as Record<string, unknown>)).toBeUndefined();
        expect(ownPolluted(result)).toBeUndefined();
      }),
      FC
    );
  });

  it('mapObject leaves Object.prototype and result prototype untouched', () => {
    fc.assert(
      fc.property(plainObject, (src) => {
        const before = protoSnapshot();
        const result = mapObject(src, (v) => v) as Record<string, unknown>;
        expect(protoSnapshot()).toBe(before);
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        expect(ownPolluted(Object.prototype as Record<string, unknown>)).toBeUndefined();
      }),
      FC
    );
  });

  it('extend leaves Object.prototype and result prototype untouched', () => {
    fc.assert(
      fc.property(plainObject, plainObject, (target, extra) => {
        const before = protoSnapshot();
        const base = { ...target };
        const result = extend(base, extra) as Record<string, unknown>;
        expect(protoSnapshot()).toBe(before);
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        expect(ownPolluted(Object.prototype as Record<string, unknown>)).toBeUndefined();
      }),
      FC
    );
  });

  it('clone matches a test-local copier on plain objects', () => {
    fc.assert(
      fc.property(plainObject, (src) => {
        expect(clone(src)).toEqual(manualClone(src));
      }),
      FC
    );
  });
});
