/**
 * CHALLENGER (G02) — native findings against PR #1759, branch
 * `cursor/g02-bind-factories-d797`.
 *
 * These are FALSIFYING tests. They encode the correct native behavior and are
 * expected to FAIL on the builder head. They are not a request to change any
 * native output to match mathjs: where mathjs and NumPy disagree, NumPy /
 * SciPy / fraction.js wins for a critical library (Daniel, 2026-11-25).
 *
 * Finding N1 — `functions/src/statistics/variance.ts` (critical library) was
 * changed to mathjs's `diff * diff` complex square. The variance of complex
 * data is `E[|x - mu|^2]`, a real, non-negative number: NumPy
 * `np.var([1+2j, 2], ddof=1)` is `2.5` and `np.var([1+0j, 0+1j, -1+2j])` is
 * `2.0`. The pre-PR native code (mean squared modulus) agreed with NumPy; the
 * PR replaces a correct result with mathjs's quirk. `variance`/`std` of
 * Complex data must stay real, and the change belongs in `compat/`.
 *
 * Finding N2 — the same edit narrowed the published `variance`/`std` overloads
 * in `functions/types/public-overloads.generated.d.ts`: the varargs form and
 * `ExactData<bigint>` now resolve to `unknown`, where `origin/main` published
 * `number`. The two edited native type-pin tests hide that by casting
 * (`as number`), although one of them states "No cast: the typecheck of this
 * file fails when the public types reject these calls".
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Complex, Fraction } from '@danielsimonjr/mathts-core';
import { std, variance } from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('N1: the variance and std of Complex data are real (NumPy), not mathjs complex squares', () => {
  it('variance(complex(1, 2), 2) is the real NumPy value 2.5', () => {
    // np.var([1+2j, 2], ddof=1) == 2.5. A Complex return is wrong even though its
    // |z| happens to be a plausible number: `toBeCloseTo` would coerce it.
    const v = variance(new Complex(1, 2), 2);
    expect(v).not.toBeInstanceOf(Complex);
    expect(typeof v).toBe('number');
    if (typeof v !== 'number') throw new Error('expected a number');
    expect(v).toBe(2.5);
  });

  it('variance of a Complex list is a real, non-negative number', () => {
    // np.var([1+0j, 0+1j, -1+2j], ddof=1) == 2.0
    const v = variance([new Complex(1, 0), new Complex(0, 1), new Complex(-1, 2)]);
    expect(typeof v).toBe('number');
    if (typeof v !== 'number') throw new Error('expected a number');
    expect(v).toBeCloseTo(2, 12);
  });

  it('std of a Complex list is the real NumPy value', () => {
    // np.std([1+2j, 3+4j], ddof=1) == 2.0
    const s = std([new Complex(1, 2), new Complex(3, 4)]);
    expect(typeof s).toBe('number');
    if (typeof s !== 'number') throw new Error('expected a number');
    expect(s).toBeCloseTo(2, 12);
  });
});

describe('N2: the published variance/std overloads keep their number returns', () => {
  const generated = readFileSync(
    join(HERE, '..', 'types', 'public-overloads.generated.d.ts'),
    'utf8'
  );

  /** The `export interface <name>Callable { ... }` block of the generated file. */
  const blockOf = (name: string): string => {
    const start = generated.indexOf(`export interface ${name}Callable {`);
    expect(start, `${name}Callable is generated`).toBeGreaterThanOrEqual(0);
    const end = generated.indexOf('\n}', start);
    return generated.slice(start, end);
  };

  it('the varargs form of variance/std returns number, not unknown', () => {
    for (const name of ['Variance', 'Std']) {
      const block = blockOf(name);
      const rest = block.split('\n').find((line) => line.includes('...rest:'));
      expect(rest, `${name}Callable has a rest overload`).toBeDefined();
      // The values of a varargs reduction are numbers at runtime; publishing `unknown`
      // forces every consumer to cast (the two edited native tests do exactly that).
      if (rest === undefined) throw new Error(`${name}Callable is missing a rest overload`);
      expect(rest).toContain('): number;');
    }
  });

  it('a bigint ExactData overload returning number exists for variance and std', () => {
    for (const name of ['Variance', 'Std']) {
      const block = blockOf(name);
      const bigintOverload = block
        .split('\n')
        .filter((line) => line.includes('ExactData<') && line.includes('bigint'))
        .find((line) => line.includes('): number;'));
      expect(bigintOverload, `${name}Callable keeps a bigint -> number overload`).toBeDefined();
    }
  });

  it('the #1049 exact-type overloads survive (Fraction and BigNumber stay exact)', () => {
    const block = blockOf('Variance');
    expect(block).toContain('<T extends Fraction | BigNumber>(a: ExactData<T>): T;');
    expect(new Fraction(1, 2)).toBeInstanceOf(Fraction);
  });
});

describe('N3: the two edited native type-pin tests no longer prove the public types', () => {
  const read = (rel: string): string => readFileSync(join(HERE, '..', '..', rel), 'utf8');

  it('typed-arrays-variadic-1046 keeps its no-cast public-type pins', () => {
    // The file's own comment: "No cast: the typecheck of this file fails when the
    // public types reject these calls." The PR adds `as number` to three of the four
    // pins, so the file no longer typechecks the public surface at all.
    const src = read('functions/tests/typed-arrays-variadic-1046.test.ts');
    expect(src).not.toMatch(/const fromBytes = variance\(new Uint8Array\(\[1, 3\]\)\) as number/);
    expect(src).not.toMatch(/const fromValues = mean\(1, 2, 3\) as number/);
    expect(src).not.toMatch(/const fromStd = std\(1, 2, 3\) as number/);
  });

  it('reductions-exact-public-types-1049 keeps its uncast number pin for variance(bigint list)', () => {
    // The old pin was `const vi: number = variance(I);` (I a bigint list). It now
    // reads `const vi = variance(I) as number;`, which no longer asserts anything.
    const src = read('functions/tests/reductions-exact-public-types-1049.test.ts');
    expect(src).not.toMatch(/const vi = variance\(I\) as number/);
    expect(src).toMatch(/const vi: number = variance\(I\)/);
  });
});
