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
} from '../../src/index';
import uptFixture from '../fixtures/upt-units-symbols.json';

type UptSymbolRow = { symbol: string; scale: string; dimension: Record<string, number> };
const { blob, symbols } = uptFixture as unknown as {
  blob: string;
  source: string;
  symbols: readonly UptSymbolRow[];
};

/** Same normalizations as `Unit.ts` before parsing (UPT fixture uses a few unicode spellings). */
function normalizeUnitSpellings(s: string): string {
  return s
    .replace(/℃/g, 'degC')
    .replace(/°C/g, 'degC')
    .replace(/°F/g, 'degF')
    .replace(/°R/g, 'degR')
    .replace(/°/g, 'deg')
    .replace(/[µμ]/g, 'u')
    .replace(/[ΩΩ]/g, 'ohm')
    .replace(/Å/g, 'angstrom');
}

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

  it('matches UPT scales for every symbol except storage bit', () => {
    for (const { symbol, scale } of symbols) {
      if (symbol === 'bit') continue;
      const normalized = normalizeUnitSpellings(symbol);
      expect(getUnitRow(normalized), symbol).toBeDefined();
      const mathts = unitRowValue(normalized);
      const upt = uptScaleNumber(scale);
      expect(mathts, `${symbol} scale`).toBe(upt);
    }
  });
});

describe('UPT ln2 exact scale pin', () => {
  it('readScaleExpression(ln2) equals LN2_EXACT_SCALE', () => {
    expect(readScaleExpression('ln2')).toEqual(LN2_EXACT_SCALE);
    expect(exactScaleToNumber(LN2_EXACT_SCALE)).toBe(Math.LN2);
  });
});
