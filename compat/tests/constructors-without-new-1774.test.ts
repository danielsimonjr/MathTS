import { describe, expect, it } from 'vitest';
import { all as referenceAll, create as createReference } from 'mathjs';
import { all, create } from '../src/index.js';

/**
 * #1774 — the public constructor symbols match mathjs 15.3.0 when `new` is
 * missing: the callable classes (`Complex`, `BigNumber`) build an instance,
 * the guard classes (`Parser`, `Index`, `Range`, `Spa`, `ArgumentsError`,
 * `DimensionError`) throw the mathjs SyntaxError.
 */
describe('constructors without new (#1774)', () => {
  const math = create(all);
  const reference = createReference(referenceAll);

  /** The sign-aware text of a Complex value, so `-0` reads differently from `0`. */
  const polarText = (value: { re: number; im: number }): string =>
    `${Object.is(value.re, -0) ? '-0' : value.re}|${Object.is(value.im, -0) ? '-0' : value.im}`;

  describe('Complex is callable without new', () => {
    it('builds from every complex.js constructor form', () => {
      const forms: [unknown, number | undefined, string][] = [
        [2, 3, '2|3'],
        [undefined, undefined, '0|0'],
        [{ re: 1, im: 2 }, undefined, '1|2'],
        [{ r: 1, phi: 1 }, undefined, `${Math.cos(1)}|${Math.sin(1)}`],
        [[2, 3], undefined, '2|3'],
        ['2+3i', undefined, '2|3'],
        [' 2 + 3i ', undefined, '2|3'],
        ['-2-+3i', undefined, '-2|-3'],
        ['2.2e-1-3.2e-1i', undefined, '0.22|-0.32'],
        ['2.', undefined, '2|0'],
        ['.2i', undefined, '0|0.2'],
        ['3I', undefined, '0|3'],
        ['-i', undefined, '0|-1'],
        ['2 + -i', undefined, '2|-1'],
        [0, undefined, '0|0'],
      ];
      for (const [value, imaginary, expected] of forms) {
        expect(polarText(math.Complex(value, imaginary))).toBe(expected);
      }
    });

    it('throws Invalid Param like complex.js', () => {
      const invalids: unknown[] = [
        {},
        { r: 1 },
        { phi: 1 },
        '',
        '2r',
        'str',
        '3e + 4i',
        '3e1.2i',
        '2ia',
      ];
      const construct = math.Complex as unknown as (...args: unknown[]) => unknown;
      for (const bad of invalids) {
        expect(() => construct(bad)).toThrow(SyntaxError);
        expect(() => construct(bad)).toThrow(/Invalid Param/);
      }
    });

    it('keeps instanceof, the markers and the reference value', () => {
      const value = math.Complex(2, 3);
      expect(value).toBeInstanceOf(math.Complex);
      expect(math.isComplex(value)).toBe(true);
      expect(String(new math.Complex(3, -4))).toBe(String(reference.complex(3, -4)));
      expect(String(new math.Complex('1+2i'))).toBe(String(reference.complex('1+2i')));
    });

    it('fromPolar follows the mathjs argument rules', () => {
      expect(polarText(math.Complex.fromPolar({ r: 0, phi: 4 }))).toBe('-0|-0');
      expect(polarText(math.Complex.fromPolar({ r: 5, phi: 0 }))).toBe('5|0');
      expect(math.Complex.fromPolar({ r: 1, phi: Math.PI }).re).toBe(-1);
      expect(math.Complex.fromPolar(1, 1).equals(math.Complex.fromPolar({ r: 1, phi: 1 }))).toBe(
        true
      );
      expect(math.Complex.fromPolar(1, math.unit(90, 'deg')).im).toBeCloseTo(1);
      const fromPolar = math.Complex.fromPolar as unknown as (...args: unknown[]) => unknown;
      expect(() => fromPolar(1)).toThrow(/Input has to be an object with r and phi keys/);
      expect(() => fromPolar(1, 'x')).toThrow(/Phi is not a number nor an angle unit/);
      expect(() => fromPolar('x', 1)).toThrow(/Radius r is not a number/);
      expect(() => fromPolar(1, 2, 3)).toThrow(/Wrong number of arguments in function fromPolar/);
    });
  });

  it('BigNumber is callable without new', () => {
    const value = math.BigNumber(2);
    expect(value.toString()).toBe('2');
    expect(value).toBeInstanceOf(math.BigNumber);
    expect(math.isBigNumber(math.BigNumber(2))).toBe(true);
    expect(math.bignumber(2)).toBeInstanceOf(math.BigNumber);
  });

  describe('guard classes throw the mathjs SyntaxError without new', () => {
    const guards: Record<string, unknown> = {
      Index: math.Index,
      Range: math.Range,
      Spa: math.Spa,
      ArgumentsError: math.ArgumentsError,
      DimensionError: math.DimensionError,
    };

    for (const [name, symbol] of Object.entries(guards)) {
      const ctor = symbol as new (...args: never[]) => object;
      const call = ctor as unknown as (...args: never[]) => unknown;
      const referenceCtor = (reference as unknown as Record<string, unknown>)[
        name
      ] as abstract new (...args: never[]) => object;
      const referenceCall = referenceCtor as unknown as (...args: never[]) => unknown;

      it(`${name}() throws the mathjs SyntaxError like mathjs`, () => {
        expect(() => call()).toThrow(SyntaxError);
        expect(() => call()).toThrow(/Constructor must be called with the new operator/);
        expect(() => referenceCall()).toThrow(SyntaxError);
      });

      it(`new ${name}(...) still constructs`, () => {
        expect(new ctor()).toBeInstanceOf(ctor);
      });
    }
  });

  it('ArgumentsError and DimensionError keep their mathjs surface', () => {
    const argsError = new math.ArgumentsError('myfunction', 1, 2, 3);
    expect(argsError).toBeInstanceOf(math.ArgumentsError);
    expect(argsError).toBeInstanceOf(Error);
    expect(argsError.fn).toBe('myfunction');
    expect(argsError.count).toBe(1);
    expect(argsError.min).toBe(2);
    expect(argsError.max).toBe(3);
    expect(argsError.toString()).toBe(
      'ArgumentsError: Wrong number of arguments in function myfunction (1 provided, 2-3 expected)'
    );

    const dimError = new math.DimensionError([2, 3], [1, 3], '<');
    expect(dimError).toBeInstanceOf(math.DimensionError);
    expect(dimError).toBeInstanceOf(Error);
    expect(dimError.relation).toBe('<');
    expect(dimError.toString()).toBe('DimensionError: Dimension mismatch ([2, 3] < [1, 3])');
  });

  it('Parser() throws the mathjs SyntaxError on the instance and the named export', () => {
    const construct = math.Parser as unknown as (...args: unknown[]) => unknown;
    expect(() => construct()).toThrow(SyntaxError);
    expect(() => construct()).toThrow(/Constructor must be called with the new operator/);
    const parser = new math.Parser();
    expect(parser.evaluate('2 + 3')).toBe(5);
  });

  it('pinv of a BigNumber keeps the compat BigNumber type', () => {
    expect(math.pinv(math.bignumber(4))).toEqual(math.bignumber(0.25));
  });

  it('arithmetic on nested arrays with BigNumber leaves stays typed', () => {
    expect(math.multiply([[math.bignumber(4)]], [[math.bignumber(0.25)]])).toEqual([
      [math.bignumber(1)],
    ]);
    expect(math.multiply([[4]], [[0.25]])).toEqual([[1]]);
  });
});
