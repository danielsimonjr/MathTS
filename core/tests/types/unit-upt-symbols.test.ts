/**
 * Vendored UPT unit symbols (blob 6acf72b69f29e28534fa03dd76b6e41e17a6808b,
 * universal-physics-tensor/data/units.json). Walks every symbol without fetching at runtime.
 */
import { describe, it, expect } from 'vitest';
import { Unit } from '../../src/types/unit';
import {
  exactScaleToNumber,
  getUnitRow,
  readUnitScale,
  unitRowValue,
  LN2_EXACT_SCALE,
  readScaleExpression,
  namedExactScale,
  toSiDimensionVector,
} from '../../src/index';
import uptFixture from '../fixtures/upt-units-symbols.json';

type UptSymbolRow = { symbol: string; scale: string; dimension: Record<string, number> };
const { blob, symbols } = uptFixture as unknown as {
  blob: string;
  source: string;
  symbols: readonly UptSymbolRow[];
};

/** UPT dimension keys in the `[L, M, T, I, Θ, N, J]` order of `toSiDimensionVector`. */
const UPT_DIMENSION_ORDER = ['L', 'M', 'T', 'I', 'Theta', 'N', 'J'] as const;

/**
 * UPT treats angle, solid angle and information as dimensionless; MathTS tracks them as extra
 * exponents (`Unit.dimensions` indexes 7 ANGLE, 8 BIT, 9 SOLID_ANGLE). A symbol is listed here
 * only when it is expected to carry one, so any other symbol with a stray extra exponent fails.
 */
const MATHTS_EXTRA_DIMENSIONS: Readonly<Record<string, readonly [number, number, number]>> = {
  rad: [1, 0, 0],
  deg: [1, 0, 0],
  arcsec: [1, 0, 0],
  arcmin: [1, 0, 0],
  mas: [1, 0, 0],
  uas: [1, 0, 0],
  bit: [0, 1, 0],
  sr: [0, 0, 1],
  lm: [0, 0, 1],
  lx: [0, 0, 1],
};

/**
 * Symbols whose scale differs on purpose. UPT `bit` is the information bit (ln 2 nat); MathTS
 * `bit` is the storage bit and stays separate (`1 byte = 8 bit`).
 */
const SCALE_EXCEPTIONS: ReadonlySet<string> = new Set(['bit']);

/** UPT `constant-rows.ts` spellings referenced in the vendored scale expressions. */
const UPT_REGISTRY_SCALES: Readonly<Record<string, string>> = Object.freeze({
  e: '1.602176634e-19',
  m_u: '1.66053906892e-27',
  M_sun: '1.989e30',
  Msun_iau: '1.988409870698051e30',
});

function uptScaleResolver(name: string) {
  if (Object.prototype.hasOwnProperty.call(UPT_REGISTRY_SCALES, name)) {
    return readUnitScale(UPT_REGISTRY_SCALES[name]!);
  }
  const fromNamed = namedExactScale(name);
  if (fromNamed !== undefined) return fromNamed;
  const row = getUnitRow(name);
  if (row !== undefined) return readUnitScale(row.scale);
  return undefined;
}

function uptScaleNumber(scale: string): number {
  return exactScaleToNumber(readScaleExpression(scale, uptScaleResolver));
}

describe('UPT units.json symbol walk', () => {
  it('pins the vendored blob SHA', () => {
    expect(blob).toBe('6acf72b69f29e28534fa03dd76b6e41e17a6808b');
    expect(symbols.length).toBe(104);
  });

  it('keeps storage bit separate from UPT information bit (ln2 nat)', () => {
    expect(new Unit(1, 'byte').to('bit').toString()).toBe('8 bit');
    expect(getUnitRow('bit')!.base).toBe('BIT');
    expect(unitRowValue('bit')).toBe(1);
    expect(uptScaleNumber('ln2')).toBe(exactScaleToNumber(LN2_EXACT_SCALE));
  });

  it('parses every UPT symbol with Unit and matches its scale and SI dimension', () => {
    for (const { symbol, scale, dimension } of symbols) {
      const unit = new Unit(1, symbol);

      if (!SCALE_EXCEPTIONS.has(symbol)) {
        expect(unit.value, `${symbol} scale`).toBe(uptScaleNumber(scale));
      }

      const extra = MATHTS_EXTRA_DIMENSIONS[symbol] ?? [0, 0, 0];
      expect(
        [unit.dimensions[7], unit.dimensions[8], unit.dimensions[9]],
        `${symbol} angle, bit, solid-angle exponents`
      ).toEqual([...extra]);

      const exponents = toSiDimensionVector(unit.dimensions, { ignoreExtra: true }).map((f) =>
        f.toNumber()
      );
      const expected = UPT_DIMENSION_ORDER.map((key) => dimension[key] ?? 0);
      expect(exponents, `${symbol} dimension`).toEqual(expected);
    }
  });

  it('only allow-lists symbols that UPT lists', () => {
    const listed = new Set(symbols.map((row) => row.symbol));
    for (const symbol of [...Object.keys(MATHTS_EXTRA_DIMENSIONS), ...SCALE_EXCEPTIONS]) {
      expect(listed.has(symbol), symbol).toBe(true);
    }
  });
});

describe('UPT ln2 exact scale pin', () => {
  it('readScaleExpression(ln2) equals LN2_EXACT_SCALE', () => {
    expect(readScaleExpression('ln2')).toEqual(LN2_EXACT_SCALE);
    expect(exactScaleToNumber(LN2_EXACT_SCALE)).toBe(Math.LN2);
  });
});
