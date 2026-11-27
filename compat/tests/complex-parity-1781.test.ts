/**
 * #1781 — `Complex.valueOf`, `format`, and `fromPolar` match mathjs 15.3.0.
 */
import { describe, expect, it } from 'vitest';
import { all as referenceAll, create as createReference } from 'mathjs';
import { all, create } from '../src/index.js';

type MathjsComplexInstance = {
  re: number;
  im: number;
  format(options?: number | { precision?: number }): string;
  valueOf(): unknown;
  equals(other: unknown): boolean;
};

type MathjsComplexLike = {
  new (re?: number, im?: number): MathjsComplexInstance;
  fromPolar(
    r: number | { r: number; phi: number },
    phi?: number | { hasBase(base: string): boolean; toNumber(unit: string): number }
  ): MathjsComplexInstance;
};

describe('Complex parity (#1781)', () => {
  const math = create(all) as ReturnType<typeof create> & {
    Complex: MathjsComplexLike;
    unit: (value: number, unit: string) => unknown;
  };
  const reference = createReference(referenceAll) as unknown as {
    Complex: MathjsComplexLike;
  };
  const Complex = math.Complex;
  const RefComplex = reference.Complex;

  describe('valueOf', () => {
    it('returns the string representation like mathjs', () => {
      expect(new Complex(3, -4).valueOf()).toBe('3 - 4i');
      expect(new Complex().valueOf()).toBe('0');
      expect(new Complex(2, 3).valueOf()).toBe('2 + 3i');
      expect(String(new RefComplex(3, -4).valueOf())).toBe('3 - 4i');
    });
  });

  describe('format', () => {
    it('formats a complex number with custom precision', () => {
      const z: MathjsComplexInstance = new Complex(1 / 3, 1 / 3);
      expect(z.format(3)).toBe('0.333 + 0.333i');
      expect(z.format(4)).toBe('0.3333 + 0.3333i');
      expect(z.format()).toBe('0.3333333333333333 + 0.3333333333333333i');
    });

    it('rounds im to zero when very small compared to re', () => {
      const cases: Array<[number, number, number | undefined, string]> = [
        [-1, 1.22e-16, undefined, '-1 + 1.22e-16i'],
        [-1, 1.22e-16, 15, '-1'],
        [-1, -1.22e-16, 15, '-1'],
        [1, -1.22e-16, 15, '1'],
        [1, 1.22e-16, 15, '1'],
        [-1, 1e-7, 5, '-1'],
      ];
      for (const [re, im, precision, expected] of cases) {
        const z: MathjsComplexInstance = new Complex(re, im);
        expect(precision === undefined ? z.format() : z.format(precision)).toBe(expected);
      }
    });

    it('rounds re to zero when very small compared to im', () => {
      const cases: Array<[number, number, number | undefined, string]> = [
        [1.22e-16, -1, undefined, '1.22e-16 - i'],
        [1.22e-16, -1, 15, '-i'],
        [-1.22e-16, -1, 15, '-i'],
        [-1.22e-16, 1, 15, 'i'],
        [1.22e-16, 1, 15, 'i'],
        [1e-7, -1, 5, '-i'],
      ];
      for (const [re, im, precision, expected] of cases) {
        const z: MathjsComplexInstance = new Complex(re, im);
        expect(precision === undefined ? z.format() : z.format(precision)).toBe(expected);
      }
    });
  });

  describe('fromPolar', () => {
    const polarText = (value: { re: number; im: number }): string =>
      `${Object.is(value.re, -0) ? '-0' : value.re}|${Object.is(value.im, -0) ? '-0' : value.im}`;

    it('saves polar coordinates input correctly', () => {
      expect(polarText(Complex.fromPolar({ r: 0, phi: 4 }))).toBe('-0|-0');
      expect(polarText(Complex.fromPolar({ r: 5, phi: 0 }))).toBe('5|0');
      expect(Complex.fromPolar({ r: 1, phi: Math.PI }).re).toBe(-1);
      expect(Complex.fromPolar({ r: 3, phi: Math.PI / 2 }).im).toBe(3);
      expect(Complex.fromPolar({ r: 3, phi: -Math.PI / 2 }).im).toBe(-3);
    });

    it('has the same value for the different import ways', () => {
      const way1 = Complex.fromPolar(1, 1);
      const way2 = Complex.fromPolar({ r: 1, phi: 1 });
      expect(way1.equals(way2)).toBe(true);
    });

    it('accepts angle units for phi properly', () => {
      expect(Complex.fromPolar(1, math.unit(90, 'deg')).im).toBeCloseTo(1, 12);
      expect(Complex.fromPolar(1, math.unit(0, 'rad')).im).toBe(0);
      expect(Complex.fromPolar(1, math.unit(100, 'grad')).im).toBeCloseTo(1, 12);
    });
  });
});
