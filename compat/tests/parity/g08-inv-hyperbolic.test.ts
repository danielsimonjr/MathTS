import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectSame } from './differential.js';

// Issue rows: #1558 (acoth/acsc/asec at 0), #1559 (asech branch cut), #1560 (Complex acsch).

describe('G08 issue rows', () => {
  it('#1558: acoth(0), acsc(0), asec(0)', () => {
    expectSame('acoth(0)', undefined, (L) => (L.acoth as (v: unknown) => unknown)(0));
    expectSame('acsc(0)', undefined, (L) => (L.acsc as (v: unknown) => unknown)(0));
    expectSame('asec(0)', undefined, (L) => (L.asec as (v: unknown) => unknown)(0));
    // acot(0) already matches mathjs and must stay a real π/2.
    expectSame('acot(0)', undefined, (L) => (L.acot as (v: unknown) => unknown)(0));
  });

  it('#1559: asech branch cut for x > 1', () => {
    expectSame('asech(7.25)', undefined, (L) => (L.asech as (v: unknown) => unknown)(7.25));
    expectSame('asech(2)', undefined, (L) => (L.asech as (v: unknown) => unknown)(2));
    expectSame('asech(-2)', undefined, (L) => (L.asech as (v: unknown) => unknown)(-2));
    expectSame('asech(complex(2, 0))', undefined, (L) =>
      (L.asech as (v: unknown) => unknown)((L.complex as (re: number, im: number) => unknown)(2, 0))
    );
    expectSame('asech(complex(-2, 0))', undefined, (L) =>
      (L.asech as (v: unknown) => unknown)(
        (L.complex as (re: number, im: number) => unknown)(-2, 0)
      )
    );
  });

  it('#1560: Complex acsch', () => {
    expectSame('acsch(complex(1, 2))', undefined, (L) =>
      (L.acsch as (v: unknown) => unknown)((L.complex as (re: number, im: number) => unknown)(1, 2))
    );
    expectSame('acsch(complex(0.5, 0))', undefined, (L) =>
      (L.acsch as (v: unknown) => unknown)(
        (L.complex as (re: number, im: number) => unknown)(0.5, 0)
      )
    );
    expectSame('acsch(2)', undefined, (L) => (L.acsch as (v: unknown) => unknown)(2));
  });
});

// Grid: ±1, ±Infinity, NaN and representative domain points for the eight inverse
// trig/hyperbolic functions, on number, BigNumber, and Complex inputs. Signed zero on
// the imaginary part is compared through format at precision 14, as the issues capture.
const FNS = ['acoth', 'acsc', 'asec', 'asech', 'acsch', 'acosh', 'asinh', 'atanh'] as const;
const NUMBERS = [0, 1, -1, Infinity, -Infinity, NaN, 2, -2, 7.25, 0.5, -0.5];

describe('G08 differential grid', () => {
  for (const fn of FNS) {
    for (const x of NUMBERS) {
      it(`${fn}(${x})`, () => {
        expectSame(`${fn}(${x})`, undefined, (L) => (L[fn] as (v: unknown) => unknown)(x));
      });
      it(`${fn}(bignumber(${x}))`, () => {
        expectSame(`${fn}(bignumber(${x}))`, undefined, (L) =>
          (L[fn] as (v: unknown) => unknown)((L.bignumber as (v: unknown) => unknown)(x))
        );
      });
      it(`${fn}(complex(${x}, 0))`, () => {
        expectSame(`${fn}(complex(${x}, 0))`, undefined, (L) =>
          (L[fn] as (v: unknown) => unknown)(
            (L.complex as (re: number, im: number) => unknown)(x, 0)
          )
        );
      });
    }
    // Both sides of the branch cut, as #1559 asks: a fix must not flip asech while
    // breaking acosh on the same cut.
    it(`${fn} on both sides of its cut`, () => {
      expectSame(`${fn}(-0.5)`, undefined, (L) => (L[fn] as (v: unknown) => unknown)(-0.5));
      expectSame(`${fn}(0.5)`, undefined, (L) => (L[fn] as (v: unknown) => unknown)(0.5));
      expectSame(`${fn}(-2)`, undefined, (L) => (L[fn] as (v: unknown) => unknown)(-2));
      expectSame(`${fn}(2)`, undefined, (L) => (L[fn] as (v: unknown) => unknown)(2));
    });
  }

  it('acsc/asec/acoth on complex(1, 2) keep the general complex value', () => {
    expectSame('acsc(complex(1, 2))', undefined, (L) =>
      (L.acsc as (v: unknown) => unknown)((L.complex as (re: number, im: number) => unknown)(1, 2))
    );
    expectSame('asec(complex(1, 2))', undefined, (L) =>
      (L.asec as (v: unknown) => unknown)((L.complex as (re: number, im: number) => unknown)(1, 2))
    );
    expectSame('acoth(complex(1, 2))', undefined, (L) =>
      (L.acoth as (v: unknown) => unknown)((L.complex as (re: number, im: number) => unknown)(1, 2))
    );
    expectSame('asech(complex(1, 2))', undefined, (L) =>
      (L.asech as (v: unknown) => unknown)((L.complex as (re: number, im: number) => unknown)(1, 2))
    );
  });
});

// The static method-call test: every `.acsch(`/`.asech(`/`.acoth(`/`.acsc(`/`.asec(`
// call in functions/src/trigonometry must name a method that core's Complex type
// actually implements (root cause of #1560 was calling `x.acsch()` on a type that
// has no such method, which throws only at runtime).
describe('G08 static Complex-method check', () => {
  const METHODS = ['acsch', 'asech', 'acoth', 'acsc', 'asec'] as const;
  const trigDir = join(import.meta.dirname, '..', '..', '..', 'functions', 'src', 'trigonometry');
  const complexTs = readFileSync(
    join(import.meta.dirname, '..', '..', '..', 'core', 'src', 'types', 'complex.ts'),
    'utf8'
  );

  for (const method of METHODS) {
    it(`core Complex implements ${method} when trigonometry calls it`, () => {
      const callers: string[] = [];
      for (const file of ['acoth.ts', 'acsc.ts', 'asec.ts', 'asech.ts', 'acsch.ts', 'acot.ts']) {
        const src = readFileSync(join(trigDir, file), 'utf8');
        if (new RegExp(`\\.${method}\\(`).test(src)) callers.push(file);
      }
      if (callers.length === 0) return; // no caller: nothing to check
      expect(
        new RegExp(`${method}\\s*\\(`).test(complexTs),
        `functions/src/trigonometry (${callers.join(', ')}) calls .${method}() but core/src/types/complex.ts does not implement it`
      ).toBe(true);
    });
  }
});
