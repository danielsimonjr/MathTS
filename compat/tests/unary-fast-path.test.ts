/**
 * #889 speed property, tested without a clock: a lone number never enters the config
 * wrapper (runWithConfig) or the typed function. The functions package is wrapped with
 * counters; the compat instance is built on the wrapped package.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { KEYS, counts } = vi.hoisted(() => ({
  KEYS: ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'abs', 'exp', 'log'] as const,
  counts: { runWithConfig: 0, typed: {} as Record<string, number> },
}));

vi.mock('@danielsimonjr/mathts-functions', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>();
  const out: Record<string, unknown> = { ...orig };
  for (const k of KEYS) {
    out[k] = new Proxy(orig[k] as (...a: unknown[]) => unknown, {
      apply(target, thisArg, args) {
        counts.typed[k] = (counts.typed[k] ?? 0) + 1;
        return Reflect.apply(target, thisArg, args);
      },
    });
  }
  out.runWithConfig = (...args: unknown[]) => {
    counts.runWithConfig += 1;
    return (orig.runWithConfig as (...a: unknown[]) => unknown)(...args);
  };
  return out;
});

import { create, all } from '../src/index.js';

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
