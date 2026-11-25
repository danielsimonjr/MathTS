import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { create, all, type MathJsInstance as OracleInstance } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';
import { expectSame } from './differential.js';
import { pair } from './oracle.js';
import { zeta as nativeZeta } from '@danielsimonjr/mathts-functions';

/**
 * #1585 — compat matches mathjs 15.3.0 on zeta, symbolicEqual, and range; native
 * `@danielsimonjr/mathts-functions` keeps the more accurate implementations.
 */

type Instance = ReturnType<typeof createCompat> & OracleInstance;
type Run = (L: Record<string, unknown>) => unknown;

const run =
  (fn: (L: Instance) => unknown): Run =>
  (L) =>
    fn(L as unknown as Instance);

describe('g18: compat matches mathjs (#1585)', () => {
  it('zeta(-3) matches the oracle', () => {
    expectSame(
      'zeta(-3)',
      {},
      run((lib) => lib.zeta(-3))
    );
  });

  it('zeta(NaN) matches the oracle', () => {
    expectSame(
      'zeta(NaN)',
      {},
      run((lib) => lib.zeta(NaN))
    );
  });

  it('zeta(-2) matches the oracle', () => {
    expectSame(
      'zeta(-2)',
      {},
      run((lib) => lib.zeta(-2))
    );
  });

  it('zeta(complex(1, 2)) matches the oracle', () => {
    expectSame(
      'zeta(complex(1,2))',
      {},
      run((lib) => lib.zeta(lib.complex(1, 2)))
    );
  });

  it('zeta(bignumber(4)) matches the oracle', () => {
    expectSame(
      'zeta(bignumber(4))',
      {},
      run((lib) => lib.zeta(lib.bignumber(4)))
    );
  });

  it('zeta(bigint) type and value match the oracle', () => {
    expectSame(
      'zeta(2n)',
      {},
      run((lib) => lib.zeta(2n))
    );
  });

  it('zeta(Fraction) throws like the oracle', () => {
    const { mathjs, compat } = pair({});
    const zetaOf = (L: { [k: string]: unknown }) =>
      (L['zeta'] as (s: unknown) => unknown)(
        (L['fraction'] as (n: number, d: number) => unknown)(4, 1)
      );
    expect(() => zetaOf(mathjs)).toThrow();
    expect(() => zetaOf(compat)).toThrow();
  });

  it('symbolicEqual polynomial identity matches the oracle (number config)', () => {
    expectSame(
      'symbolicEqual expand',
      {},
      run((lib) => lib.evaluate('symbolicEqual("(x+y)^2", "x^2+2*x*y+y^2")'))
    );
  });

  it("[BigNumber cfg] symbolicEqual('x*y', 'y*x') matches the oracle", () => {
    expectSame(
      'symbolicEqual commute bn',
      { number: 'BigNumber' },
      run((lib) => lib.evaluate('symbolicEqual("x*y", "y*x")'))
    );
  });

  it("[BigNumber cfg] range('4:10') function call matches the oracle", () => {
    expectSame(
      'range str',
      { number: 'BigNumber' },
      run((lib) => lib.range('4:10'))
    );
  });

  it("[BigNumber cfg] range('4:10', true) matches the oracle (string includeEnd bug)", () => {
    expectSame(
      'range str incl',
      { number: 'BigNumber' },
      run((lib) => lib.range('4:10', true))
    );
  });

  it('[BigNumber cfg] evaluate(\'range("4:10")\') matches the oracle', () => {
    expectSame(
      'range eval bn',
      { number: 'BigNumber' },
      run((lib) => lib.evaluate('range("4:10")'))
    );
  });

  it('documents native MathTS accuracy in docs/api/compat.md', () => {
    const doc = readFileSync(new URL('../../../docs/api/compat.md', import.meta.url), 'utf8');
    expect(doc).toMatch(/^## Native MathTS differences \(compat matches mathjs\)$/m);
    for (const name of [
      'zeta(-3)',
      'zeta(complex(1, 2))',
      'zeta(bignumber(4))',
      'symbolicEqual',
      'range',
    ]) {
      expect(doc).toContain(name);
    }
    expect(doc).toContain('#1585');
  });

  it('native zeta(-3) is unchanged after creating a compat instance', () => {
    const before = nativeZeta(-3);
    createCompat(compatAll, {});
    create(all, {});
    expect(nativeZeta(-3)).toBe(before);
    expect(nativeZeta(-3)).toBeCloseTo(1 / 120, 14);
  });
});
