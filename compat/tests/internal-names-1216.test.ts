import { describe, expect, it } from 'vitest';
import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { all, create, type MathInstance } from '../src/index.js';
import { COMPAT_INTERNAL_NAMES } from '../src/internal-names.generated.js';
import { MATHJS_PARITY_NAMES } from '../src/parity-names.generated.js';

const INTERNAL = new Set<string>(COMPAT_INTERNAL_NAMES);

/** The ALL_CAPS internal names that the functions namespace exports today. */
const INTERNAL_CONSTANTS = [
  'ARRAY_WORKER_THRESHOLD',
  'CAS_BATCH_THRESHOLD',
  'CENTRALITY_WORKER_THRESHOLD',
  'DEFAULT_MUTATION_WEIGHTS',
  'DIST_WORKER_THRESHOLD',
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

/** Internal names that the expression scope of the functions package resolves. */
const resolvesInFunctionsEvaluate = (key: string): boolean => {
  try {
    (mathFunctions.evaluate as (expr: string) => unknown)(key);
    return true;
  } catch {
    return false;
  }
};

const forInNames = (math: Record<string, unknown>): string[] => {
  const out: string[] = [];
  for (const key in math) out.push(key);
  return out;
};

describe('compat instance hides the internal names of the functions namespace (#1216)', () => {
  it('the generated list holds the factory_* functions and the internal constants', () => {
    expect(COMPAT_INTERNAL_NAMES.filter((k) => k.startsWith('factory_')).length).toBe(64);
    expect(COMPAT_INTERNAL_NAMES.filter((k) => !k.startsWith('factory_'))).toEqual(
      INTERNAL_CONSTANTS
    );
    const exported = new Set(Object.keys(mathFunctions));
    for (const key of COMPAT_INTERNAL_NAMES) expect(exported.has(key)).toBe(true);
  });

  it('no internal name is reachable through in, for...in, own names, keys or spread', () => {
    const math = create(all) as unknown as Record<string, unknown>;
    const forIn = forInNames(math);
    for (const key of COMPAT_INTERNAL_NAMES) {
      expect(key in math).toBe(false);
      expect(forIn).not.toContain(key);
      expect(Object.keys({ ...math })).not.toContain(key);
      expect(Object.getOwnPropertyNames(math)).not.toContain(key);
      expect(math[key]).toBeUndefined();
    }
  });

  it('keeps EARTH_RADIUS_KM, the default radius of haversine', () => {
    const math = create(all) as unknown as Record<string, unknown>;
    expect(math.EARTH_RADIUS_KM).toBe(mathFunctions.EARTH_RADIUS_KM);
    expect(forInNames(math)).toContain('EARTH_RADIUS_KM');
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
      if (!INTERNAL.has(key) && key !== 'default') expect(key in math).toBe(true);
    }
    const missing = MATHJS_PARITY_NAMES.filter((k) => !(k in math));
    expect(missing.length).toBe(KNOWN_MISSING_PARITY);
  });

  it('has a fixed instance key count', () => {
    const math = create(all) as unknown as Record<string, unknown>;
    expect(Object.keys(math).length).toBe(317);
    expect(forInNames(math).length).toBe(1408 - COMPAT_INTERNAL_NAMES.length);
  });
});

describe('create keeps the names of user factories (#1250)', () => {
  it('keeps user names with the internal shape', () => {
    const mine = (): number => 1;
    const math = create({ MY_CONST: 5, R: 8.31, factory_mine: mine }) as unknown as Record<
      string,
      unknown
    >;
    expect(math.MY_CONST).toBe(5);
    expect(math.R).toBe(8.31);
    expect('factory_mine' in math).toBe(true);
    expect(forInNames(math)).toEqual(expect.arrayContaining(['MY_CONST', 'R', 'factory_mine']));
  });

  it('keeps a user name added to all', () => {
    const math = create({ ...all, X1: 7 }) as unknown as Record<string, unknown>;
    expect(math.X1).toBe(7);
    expect('GL4_A' in math).toBe(false);
  });

  it('keeps a parser that the caller supplies', () => {
    const mine = (): { evaluate: () => string } => ({ evaluate: () => 'mine' });
    const math = create({ ...all, parser: mine }) as unknown as {
      parser: () => { evaluate: (expr: string) => unknown };
    };
    expect(math.parser().evaluate('1 + 1')).toBe('mine');
  });

  it('keeps a user value under an internal name', () => {
    const a = create({ ...all, GL4_A: 99 }) as unknown as Record<string, unknown>;
    expect(a.GL4_A).toBe(99);
    const b = create({ GL4_A: 99 }) as unknown as Record<string, unknown>;
    expect(b.GL4_A).toBe(99);
  });
});

describe('the expression scope of a compat instance hides the internal names (#1216)', () => {
  const resolving = COMPAT_INTERNAL_NAMES.filter(resolvesInFunctionsEvaluate);

  it('the functions package evaluate still resolves them', () => {
    expect(resolving.length).toBeGreaterThan(60);
  });

  it('math.evaluate and math.compile do not resolve an internal name', () => {
    const math = create(all);
    for (const key of resolving) {
      expect(() => math.evaluate(key)).toThrow();
      expect(() => math.compile(key).evaluate()).toThrow();
    }
  });

  it('math.import can define a name of the list', () => {
    const math = create(all);
    math.import({ GL4_A: 5 });
    expect(math.evaluate('GL4_A')).toBe(5);
  });

  it('math.parser() evaluates in the scope of its instance', () => {
    const math = create(all);
    const parser = math.parser();
    for (const key of resolving) expect(() => parser.evaluate(key)).toThrow();
    expect(() => math.parser({ unsafe: true }).evaluate('GL4_A')).toThrow();
    parser.set('x', 3);
    expect(parser.evaluate('x^2 + LN2')).toBe(9 + Math.LN2);
    math.import({ triple1216: (value: number) => 3 * value });
    expect(parser.evaluate('triple1216(x)')).toBe(9);
    expect(math.parser().evaluate('triple1216(2)')).toBe(6);
  });

  it('keeps the mathjs constants and functions', () => {
    const math = create(all);
    expect(math.evaluate('LN2')).toBe(Math.LN2);
    expect(math.evaluate('sin(0)')).toBe(0);
  });
});

describe('the MathInstance type omits the internal names (#1216)', () => {
  it('rejects internal names and keeps EARTH_RADIUS_KM', () => {
    const math = create(all);
    // @ts-expect-error GL4_A is internal
    void math.GL4_A;
    // @ts-expect-error factory_abs is internal
    void math.factory_abs;
    const radius: number = math.EARTH_RADIUS_KM;
    const ln2: number = math.LN2;
    type Hidden = Extract<keyof MathInstance, (typeof COMPAT_INTERNAL_NAMES)[number]>;
    const none: [Hidden] extends [never] ? true : false = true;
    expect([radius, ln2, none]).toEqual([mathFunctions.EARTH_RADIUS_KM, Math.LN2, true]);
  });
});

const KNOWN_MISSING_PARITY = 85;
