/**
 * #889 speed property, tested without a clock: a lone number never enters the config
 * wrapper (runWithConfig) or the typed function. The functions package is wrapped with
 * counters; the compat instance is built on the wrapped package.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The suite runs under both bun test and vitest. vitest hoists vi.mock above every
// top-level binding and passes importOriginal; bun does neither. So the factory reads
// only globalThis: the counters live there, and under bun the real module is copied
// there before the mock is registered. compat is imported dynamically, after the mock.
type Counts = { runWithConfig: number; typed: Record<string, number> };
type FastPathGlobal = { __fpCounts?: Counts; __fpOrig?: Record<string, unknown> };
const g = globalThis as FastPathGlobal;
const KEYS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'abs', 'exp', 'log'] as const;

if (typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined') {
  g.__fpOrig = { ...(await import('@danielsimonjr/mathts-functions')) };
}

vi.mock('@danielsimonjr/mathts-functions', async (importOriginal?: () => Promise<unknown>) => {
  const gg = globalThis as FastPathGlobal;
  const orig = (gg.__fpOrig ??
    ({ ...((await importOriginal!()) as object) } as Record<string, unknown>)) as Record<
    string,
    unknown
  >;
  const c: Counts = (gg.__fpCounts ??= { runWithConfig: 0, typed: {} });
  const out: Record<string, unknown> = { ...orig };
  for (const k of ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'abs', 'exp', 'log']) {
    out[k] = new Proxy(orig[k] as (...a: unknown[]) => unknown, {
      apply(target, thisArg, args) {
        c.typed[k] = (c.typed[k] ?? 0) + 1;
        return Reflect.apply(target, thisArg, args);
      },
    });
  }
  out.runWithConfig = (...args: unknown[]) => {
    c.runWithConfig += 1;
    return (orig.runWithConfig as (...a: unknown[]) => unknown)(...args);
  };
  return out;
});

const { create, all } = await import('../src/index.js');
const counts = (g.__fpCounts ??= { runWithConfig: 0, typed: {} });

const total = () => counts.runWithConfig + Object.values(counts.typed).reduce((a, b) => a + b, 0);

describe('unary number fast path (#889)', () => {
  beforeEach(() => {
    counts.runWithConfig = 0;
    counts.typed = {};
  });

  for (const key of KEYS) {
    it(`${key}(number) in the real domain skips the config wrapper and the typed function`, () => {
      // A custom config makes every wrapped call enter runWithConfig, so a wrapper entry shows.
      const mt = create(all, { precision: 32 });
      const f = (mt as unknown as Record<string, (x: unknown) => unknown>)[key];
      for (const x of [0.5, 0, 1]) f(x);
      expect(total()).toBe(0);
    });

    it(`${key} still reaches the typed function for a non-number argument`, () => {
      const mt = create(all);
      const f = (mt as unknown as Record<string, (x: unknown) => unknown>)[key];
      f(mt.complex(0.5, 0.25));
      expect(counts.typed[key]).toBeGreaterThan(0);
    });
  }

  it('a number outside the real domain (sqrt(-1), asin(2)) reaches the typed function', () => {
    const mt = create(all);
    mt.sqrt(-1);
    mt.asin(2);
    expect(counts.typed.sqrt).toBe(1);
    expect(counts.typed.asin).toBe(1);
  });

  it('config() after creation still reaches the wrapper for non-number input', () => {
    const mt = create(all);
    mt.config({ number: 'BigNumber', precision: 32 });
    counts.runWithConfig = 0;
    mt.sin(0.5);
    expect(counts.runWithConfig).toBe(0);
    mt.sin(mt.bignumber(0.5));
    expect(counts.runWithConfig).toBeGreaterThan(0);
  });
});
