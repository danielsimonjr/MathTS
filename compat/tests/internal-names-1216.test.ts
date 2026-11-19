import { describe, expect, it } from 'vitest';
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { all, create } from '../src/index.js';
import { isInternalName } from '../src/internal-names.js';
import { MATHJS_PARITY_NAMES } from '../src/parity-names.generated.js';

const parity = new Set(MATHJS_PARITY_NAMES);
const isInternal = (key: string): boolean => isInternalName(key, parity);

/** The internal names that the functions namespace exports today. */
const INTERNAL_CONSTANTS = [
  'ARRAY_WORKER_THRESHOLD',
  'CAS_BATCH_THRESHOLD',
  'CENTRALITY_WORKER_THRESHOLD',
  'DEFAULT_MUTATION_WEIGHTS',
  'DIST_WORKER_THRESHOLD',
  'EARTH_RADIUS_KM',
  'EVALUATE_SCOPE_OMIT',
  'GAUSS_WORKER_THRESHOLD',
  'GL4_A',
  'GL4_B',
  'GL4_C',
  'GPU_ELEMENTWISE_OPS',
  'GPU_MIN_ELEMENTS',
  'GPU_REDUCE_OPS',
  'MASS_PROPERTY_SHAPES',
  'MUTATE_CONSTANT_NEGATE_PROBABILITY',
  'WASM_INTERP_THRESHOLD',
];

describe('compat instance hides the internal names of the functions namespace (#1216)', () => {
  const internalExports = Object.keys(mathFunctions).filter(isInternal);

  it('the functions namespace still exports the internal names', () => {
    expect(internalExports.filter((k) => k.startsWith('factory_')).length).toBeGreaterThan(40);
    for (const key of INTERNAL_CONSTANTS) expect(internalExports).toContain(key);
  });

  it('no internal name is reachable through in, for...in, own names, keys or spread', () => {
    const math = create(all) as unknown as Record<string, unknown>;
    const forIn: string[] = [];
    for (const key in math) forIn.push(key);
    const reached = [...internalExports, ...INTERNAL_CONSTANTS];
    for (const key of reached) {
      expect(key in math).toBe(false);
      expect(forIn).not.toContain(key);
      expect(Object.keys(math)).not.toContain(key);
      expect(Object.keys({ ...math })).not.toContain(key);
      expect(Object.getOwnPropertyNames(math)).not.toContain(key);
      expect(math[key]).toBeUndefined();
    }
    expect(forIn.filter(isInternal)).toEqual([]);
  });

  it('an internal name stays assignable as a plain own property', () => {
    const math = create(all) as unknown as Record<string, unknown>;
    math.GPU_MIN_ELEMENTS = 1;
    expect(math.GPU_MIN_ELEMENTS).toBe(1);
  });

  it('keeps the mathjs constants in capitals', () => {
    const math = create(all) as unknown as Record<string, unknown>;
    for (const key of ['LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT2', 'SQRT1_2']) {
      expect(typeof math[key]).toBe('number');
    }
  });

  it('keeps every other name of the functions namespace and the parity names', () => {
    const math = create(all) as unknown as Record<string, unknown>;
    for (const key of Object.keys(mathFunctions)) {
      if (!isInternal(key) && key !== 'default') expect(key in math).toBe(true);
    }
    const missing = MATHJS_PARITY_NAMES.filter((k) => !(k in math));
    expect(missing.length).toBe(KNOWN_MISSING_PARITY);
  });

  it('has a fixed instance key count', () => {
    const math = create(all) as unknown as Record<string, unknown>;
    const forIn: string[] = [];
    for (const key in math) forIn.push(key);
    expect(Object.keys(math).length).toBe(317);
    expect(forIn.length).toBe(FOR_IN_COUNT);
  });
});

const KNOWN_MISSING_PARITY = 85;
const FOR_IN_COUNT = 1406 - 64 - 17;
