/**
 * #1781 — `Complex.valueOf`, `format`, and `fromPolar` match mathjs 15.3.0.
 */
import { describe, expect, it } from 'vitest';
import { Complex as CoreComplex } from '@danielsimonjr/mathts-core';
import { all as referenceAll, create as createReference } from 'mathjs';
import { Complex as NamedComplex, all, create } from '../src/index.js';

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

  describe('core prototype isolation', () => {
    it('does not mutate native @danielsimonjr/mathts-core Complex.prototype', () => {
      const native = new CoreComplex(3, -4);
      expect(native.valueOf()).toBe(5);
      expect(Number(native)).toBe(5);

      const fromFn = math.complex(3, -4);
      expect(fromFn.valueOf()).toBe('3 - 4i');
      expect(fromFn instanceof math.Complex).toBe(true);
      expect(fromFn instanceof CoreComplex).toBe(true);

      const fromCtor = new math.Complex(3, -4);
      expect(fromCtor.valueOf()).toBe('3 - 4i');
      expect(fromCtor instanceof math.Complex).toBe(true);
      expect(fromCtor instanceof CoreComplex).toBe(true);

      expect(math.Complex.fromPolar(5, 0).valueOf()).toBe('5');
      expect(math.complex().valueOf()).toBe('0');
    });
  });

  describe('named Complex export', () => {
    it('matches create(all).Complex including fromPolar, valueOf, and format', () => {
      const fromNew = new NamedComplex(3, -4);
      const fromCall = NamedComplex(3, -4);
      expect(fromNew.valueOf()).toBe('3 - 4i');
      expect(fromCall.valueOf()).toBe('3 - 4i');
      expect(fromNew instanceof math.Complex).toBe(true);
      expect(fromNew instanceof NamedComplex).toBe(true);
      expect(fromNew instanceof CoreComplex).toBe(true);
      expect((new NamedComplex(1 / 3, 1 / 3) as unknown as MathjsComplexInstance).format(3)).toBe(
        '0.333 + 0.333i'
      );
      expect(NamedComplex.fromPolar({ r: 5, phi: 0 }).valueOf()).toBe('5');
      expect(
        NamedComplex.fromPolar(
          1,
          math.unit(90, 'deg') as { hasBase(base: string): boolean; toNumber(unit: string): number }
        ).im
      ).toBeCloseTo(1, 12);
    });
  });
});
