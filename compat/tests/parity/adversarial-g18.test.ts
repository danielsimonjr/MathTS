import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { create as createCompat, all as compatAll } from '@danielsimonjr/mathts-compat';
import { create, all, type MathJsInstance as OracleInstance } from 'mathjs';
import { zeta as nativeZeta, bignumber as nativeBignumber } from '@danielsimonjr/mathts-functions';
import { INTENTIONAL } from './intentional.js';
import { GAPS } from './known-gaps/index.js';
import { expectSame } from './differential.js';
import { show } from './oracle.js';
import { sweepPool } from './sweep.js';

/**
 * Adversarial probes for G18 / #1585 under the Nov 25 policy: compat must match
 * mathjs 15.3.0; native MathTS keeps higher accuracy where it diverges.
 */

type Instance = ReturnType<typeof createCompat> & OracleInstance;
type ShowInstance = Parameters<typeof show>[0];
type Run = (L: Record<string, unknown>) => unknown;
const run =
  (fn: (L: Instance) => unknown): Run =>
  (L) =>
    fn(L as unknown as Instance);

const arr = (v: unknown): string =>
  JSON.stringify((v as { toArray(): unknown[] }).toArray().map(String));

describe('g18 adversarial: zeta and symbolicEqual parity', () => {
  it('F1: docs do not claim false "full double precision" for zeta(-3) in compat', () => {
    const doc = readFileSync(new URL('../../../docs/api/compat.md', import.meta.url), 'utf8');
    expect(doc).not.toMatch(/exact value `1\/120` to full\s+double precision/);
    const L = createCompat(compatAll, {});
    const O = create(all, {});
    expect(show(L as unknown as ShowInstance, L.zeta(-3))).toBe(
      show(O as unknown as ShowInstance, O.zeta(-3))
    );
  });

  it('F2: pool sweep actually calls unary zeta', () => {
    const O = create(all, {});
    const L = createCompat(compatAll, {});
    expect(O.zeta.length).toBe(2);
    expect(show(L as unknown as ShowInstance, L.zeta(-3))).toBe(
      show(O as unknown as ShowInstance, O.zeta(-3))
    );
    const { labels, arities } = sweepPool({ only: ['zeta'] });
    expect([...(arities.get('zeta') ?? [])]).toEqual(expect.arrayContaining([1, 2]));
    expect(labels.has('zeta: (number -3)')).toBe(false);
  });

  it('F3: symbolicEqual matches mathjs on polynomial identities (number config)', () => {
    expectSame(
      'F3 poly',
      {},
      run((lib) => lib.evaluate('symbolicEqual("(x+y)^2", "x^2+2*x*y+y^2")'))
    );
    expectSame(
      'F3 poly2',
      {},
      run((lib) => lib.evaluate('symbolicEqual("x^2-y^2", "(x-y)*(x+y)")'))
    );
  });

  it('F4: zeta(Fraction) throws on compat like mathjs', () => {
    const L = createCompat(compatAll, {});
    const O = create(all, {});
    const oracleZeta = O.zeta as (s: unknown) => unknown;
    const compatZeta = L.zeta as (s: unknown) => unknown;
    expect(() => oracleZeta(O.fraction(4, 1))).toThrow();
    expect(() => compatZeta(L.fraction(4, 1))).toThrow();
  });

  it('F5: zeta(bigint) matches mathjs type and value', () => {
    expectSame(
      'F5 zeta 2n',
      {},
      run((lib) => lib.zeta(2n))
    );
  });

  it('F6: zeta(NaN) and zeta(-2) match mathjs in compat', () => {
    expectSame(
      'F6 NaN',
      {},
      run((lib) => lib.zeta(NaN))
    );
    expectSame(
      'F6 -2',
      {},
      run((lib) => lib.zeta(-2))
    );
  });

  it('F9: docs describe Re(s)==1 NaN, not "critical strip" falsehood', () => {
    const strip = create(all, {}).zeta(create(all, {}).complex(0.5, 2)) as {
      re: number;
      im: number;
    };
    expect(Number.isNaN(strip.re)).toBe(false);
    const doc = readFileSync(new URL('../../../docs/api/compat.md', import.meta.url), 'utf8');
    expect(doc).not.toMatch(/NaN \+ NaNi`? for complex arguments in the critical strip/);
    expect(doc).toMatch(/Re\(s\) = 1|line Re\(s\) = 1/i);
  });
});

describe('g18 adversarial: range and bookkeeping', () => {
  const B = createCompat(compatAll, { number: 'BigNumber' }) as Instance;
  const OB = create(all, { number: 'BigNumber' }) as Instance;

  it('F8: native BigNumber zeta(4) is closer to π⁴/90 than mathjs; documented', () => {
    const piRef = 1.082323233711138;
    const nativeErr = Math.abs(Number(String(nativeZeta(nativeBignumber(4)))) - piRef);
    const oracleErr = Math.abs(
      (OB.zeta(OB.bignumber(4)) as { toNumber(): number }).toNumber() - piRef
    );
    expect(nativeErr < oracleErr).toBe(true);
    const doc = readFileSync(new URL('../../../docs/api/compat.md', import.meta.url), 'utf8');
    expect(doc).toMatch(/pi\^4\/90|π⁴\/90/);
  });

  it('F10: BigNumber range function excludes end like mathjs (not native inclusive mistake)', () => {
    expect(arr(B.range('4:10'))).toBe(arr(OB.range('4:10')));
    expect(arr(B.range('4:10'))).toBe(JSON.stringify(['4', '5', '6', '7', '8', '9']));
  });

  it('F10b: explicit includeEnd on BigNumber string range matches mathjs bug', () => {
    expect(arr(B.range('4:10', true))).toBe(arr(OB.range('4:10', true)));
  });

  it('number string range still honors includeEnd (not the BigNumber _strRange quirk)', () => {
    const N = createCompat(compatAll) as Instance;
    const ON = create(all) as Instance;
    expect(arr(N.range('4:10', true))).toBe(arr(ON.range('4:10', true)));
    expect(arr(N.range('4:10', true))).toBe(JSON.stringify(['4', '5', '6', '7', '8', '9', '10']));
    expect(arr(N.evaluate('range(3, 7)'))).toBe(arr(ON.evaluate('range(3, 7)')));
    expect('signatures' in N.range).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(N.range, 'signatures')).toBe(true);
    expect(Object.keys(N.range).includes('signatures')).toBe(true);
  });

  it('F7: known-gaps drops #1585 zeta/symbolicEqual doc examples', () => {
    // Split per-issue JSON under known-gaps/; GAPS is the merged record.
    const gaps = GAPS;
    const flat = new Set(Object.values(gaps).flat());
    const removed = [
      '{} zeta(4)',
      '{"number":"BigNumber"} zeta(4)',
      '{"matrix":"Array"} zeta(4)',
      '{} zeta(0.2)',
      '{"number":"BigNumber"} symbolicEqual("x*y","y*x")',
    ];
    for (const label of removed) {
      expect(flat.has(label)).toBe(false);
    }
    expect(JSON.stringify(gaps)).not.toMatch(/1585/);
    expect(INTENTIONAL['1585'] ?? []).toHaveLength(0);
  });
});
