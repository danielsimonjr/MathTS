import { describe, it, expect, beforeEach } from 'vitest';
import type { UnaryFastPathGlobal } from './unary-fast-path-mock.js';

const KEYS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'abs', 'exp', 'log'] as const;

export async function registerUnaryFastPathSuite(
  create: (typeof import('../../src/index.js'))['create'],
  all: (typeof import('../../src/index.js'))['all']
) {
  const g = globalThis as UnaryFastPathGlobal;
  const counts = (g.__fpCounts ??= { runWithConfig: 0, typed: {} });

  const total = () => counts.runWithConfig + Object.values(counts.typed).reduce((a, b) => a + b, 0);

  describe('unary number fast path (#889)', () => {
    beforeEach(() => {
      counts.runWithConfig = 0;
      counts.typed = {};
    });

    for (const key of KEYS) {
      it(`${key}(number) in the real domain skips the config wrapper and the typed function`, () => {
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
}
