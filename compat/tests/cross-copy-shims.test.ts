/**
 * The constructor shims return a value of a second copy of core unchanged (#1033).
 *
 * A second copy loads when a package manager fails to dedupe. `instanceof` fails across copies,
 * so a shim that tests with `instanceof` wraps the value again and loses its parts or digits.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { bignumber, complex, fraction } from '../src/shims.js';

type Core = typeof import('@danielsimonjr/mathts-core');
let core2: Core;

beforeAll(async () => {
  // A copy of the built core bundle in a new folder has its own classes under both bun test and
  // vitest. The helper is untyped, so the test imports it through a URL that the type checker does
  // not read.
  const helper = new URL('../../tools/test/second-core-copy.mjs', import.meta.url).href;
  const { importSecondCoreCopy } = (await import(helper)) as {
    importSecondCoreCopy(name: string): Promise<unknown>;
  };
  core2 = (await importSecondCoreCopy('compat-shims')) as Core;
});

describe('the shims with a value of a second copy of core', () => {
  it('complex keeps both parts', () => {
    const z = complex(new core2.Complex(3, 4) as never) as unknown as { re: number; im: number };
    expect([z.re, z.im]).toEqual([3, 4]);
  });

  it('fraction keeps a denominator above 2^53', () => {
    const d = 2n ** 60n + 1n;
    const f = fraction(new core2.Fraction(1n, d) as never) as unknown as {
      numerator: bigint;
      denominator: bigint;
    };
    expect([f.numerator, f.denominator]).toEqual([1n, d]);
  });

  it('bignumber keeps every digit', () => {
    const digits = '1.000000000000000000000000000002';
    expect(String(bignumber(new core2.BigNumber(digits) as never))).toBe(digits);
  });
});

describe('the test setup', () => {
  it('loads a real second copy of core', async () => {
    const core1 = await import('@danielsimonjr/mathts-core');
    expect(core2.Complex).not.toBe(core1.Complex);
  });
});
