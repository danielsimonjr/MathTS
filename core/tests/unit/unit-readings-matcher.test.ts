import { describe, it, expect, afterEach } from 'vitest';
import { Unit } from '../../src/index.js';
import { unitReadingSearchSteps } from '../../src/types/unit/Unit.js';
import type { UnitDef, PrefixTable } from '../../src/types/unit/unit-types.js';

type Factor = { name: string; power: number; end: number };

const isDigit = (ch: string | undefined): boolean => ch !== undefined && ch >= '0' && ch <= '9';
const find = (name: string) => Unit._findUnit(name, true);

function isPrefixRepeat(left: string, right: string): boolean {
  if (left !== right) return false;
  const hit = find(left + right);
  return hit !== null && hit.prefix.name === left && hit.unit.name === right;
}

// The reference: the exhaustive search that `Unit.readings` used before the per-token matcher.
// It asks `Unit._findUnit` for every substring. The new search must give the same list in the same order.
function referenceReadings(token: string): Factor[][] {
  const result: Factor[][] = [];
  const factors: Factor[] = [];
  function addFactor(name: string, power: number, next: number): void {
    const prev = factors[factors.length - 1];
    if (prev !== undefined && prev.name === name && isPrefixRepeat(prev.name, name)) return;
    factors.push({ name, power, end: next });
    if (next === token.length) {
      if (factors.length >= 2) result.push(factors.slice());
    } else {
      addFactors(next);
    }
    factors.pop();
  }
  function addFactors(start: number): void {
    for (let end = start + 1; end <= token.length; end++) {
      const name = token.slice(start, end);
      if (find(name) === null) continue;
      addFactor(name, 1, end);
      if (end < token.length && isDigit(token[end]) && token[end] !== '0') {
        let digitEnd = end + 1;
        while (isDigit(token[digitEnd])) digitEnd++;
        addFactor(name, Number.parseInt(token.slice(end, digitEnd), 10), digitEnd);
      }
      if (token[end] === '^') {
        let digitEnd = end + 1;
        if (token[digitEnd] === '+' || token[digitEnd] === '-') digitEnd++;
        const digitStart = digitEnd;
        while (isDigit(token[digitEnd])) digitEnd++;
        if (digitEnd > digitStart) {
          addFactor(name, Number.parseInt(token.slice(end + 1, digitEnd), 10), digitEnd);
        }
      }
    }
  }
  addFactors(0);
  return result;
}

const spell = (r: ReadonlyArray<{ name: string; power: number }>): string =>
  r.map((f) => (f.power === 1 ? f.name : `${f.name}^${f.power}`)).join('*');
// The reference names keep a micro sign. `Unit.readings` spells the micro prefix as `u`.
const reference = (token: string): string[] =>
  referenceReadings(token).map((r) => spell(r).replace(/[µμ]/g, 'u'));
const actual = (token: string): string[] => Unit.readings(token).map(spell);

// A small seeded generator (mulberry32), so the corpus is the same on every run.
function generator(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
// Writes each caret power of the token as a superscript power.
const superscript = (token: string): string =>
  token.replace(/\^([+-]?)(\d+)/g, (_m, sign: string, digits: string) => {
    const mark = sign === '-' ? '⁻' : sign === '+' ? '⁺' : '';
    return mark + [...digits].map((d) => SUPERSCRIPTS[Number(d)]).join('');
  });

function corpus(count: number): string[] {
  const next = generator(20261110);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)];
  const names = Object.keys(Unit.UNITS).filter((n) => /^[A-Za-z]{1,6}$/.test(n));
  const prefixes = ['', '', '', 'k', 'm', 'M', 'u', 'µ', 'μ', 'n', 'G', 'da', 'c', 'd', 'h', 'p'];
  const powers = ['', '', '', '2', '3', '10', '^2', '^-1', '^+3', '^12', '0', '01', '^', '^-'];
  const tokens: string[] = [];
  while (tokens.length < count) {
    const parts = 2 + Math.floor(next() * 3);
    let token = '';
    for (let i = 0; i < parts; i++) token += pick(prefixes) + pick(names) + pick(powers);
    tokens.push(token);
  }
  return tokens;
}

// Each token costs one exhaustive search in the reference, so the run time grows with the corpus
// and with the load of the machine, and the test timeout is fixed. The default run reads the first
// 750 tokens of the seeded corpus (the generator is sequential, so they are a prefix of the full
// corpus). `UNIT_ORACLE_FULL=1` runs all 3,000.
const FULL_CORPUS = process.env.UNIT_ORACLE_FULL === '1';
const FULL_CORPUS_SIZE = 3000;
const CORPUS_SIZE = FULL_CORPUS ? FULL_CORPUS_SIZE : 750;
// The full run is a manual check, so it gets a long timeout. The default run keeps the config timeout.
const FULL_TIMEOUT = FULL_CORPUS ? 600_000 : undefined;

describe('Unit.readings: the per-token matcher gives the readings of the exhaustive search', () => {
  it(
    'agrees on a seeded corpus of glued tokens',
    () => {
      const differences: string[] = [];
      const seen = { readable: 0, ambiguous: 0, raised: 0 };
      // The coverage of the default run, in the test log: how much of the full corpus it checks.
      console.info(
        `[unit-oracle] Unit.readings: ${CORPUS_SIZE} of ${FULL_CORPUS_SIZE} tokens ` +
          `(${((100 * CORPUS_SIZE) / FULL_CORPUS_SIZE).toFixed(1)}%)${FULL_CORPUS ? ', full corpus' : ''}`
      );
      for (const token of corpus(CORPUS_SIZE)) {
        const want = reference(token);
        if (want.length > 0) seen.readable++;
        if (want.length > 1) seen.ambiguous++;
        if (JSON.stringify(actual(token)) !== JSON.stringify(want)) differences.push(token);
        const raised = superscript(token);
        if (raised !== token) {
          seen.raised++;
          if (JSON.stringify(actual(raised)) !== JSON.stringify(want)) differences.push(raised);
        }
      }
      expect(differences).toEqual([]);
      // The sample must keep readable, ambiguous and superscript tokens, so that it cannot shrink to a trivial check.
      expect(seen.readable).toBeGreaterThanOrEqual(100);
      expect(seen.ambiguous).toBeGreaterThanOrEqual(80);
      expect(seen.raised).toBeGreaterThanOrEqual(400);
    },
    FULL_TIMEOUT
  );

  it('agrees on spellings with a sign, a micro sign and a repeated prefix', () => {
    for (const token of ['minK', 'mmK', 'mmm', 'NN', 'µmK', 'μAs', 'µµm', 'mµm', 'uuK', 'mAs']) {
      expect(actual(token), token).toEqual(reference(token));
    }
    // A sign spelling is rewritten before the search: the reference reads the rewritten text.
    expect(actual('kΩK')).toEqual(reference('kohmK'));
    expect(actual('°CK')).toEqual(reference('degCK'));
    expect(actual('ÅK')).toEqual(reference('angstromK'));
  });

  it('lists each reading one time, in ascending order of the first cut', () => {
    expect(actual('minK')).toEqual(['m*in*K', 'mi*nK', 'min*K']);
    expect(actual('mlyK')).toEqual(['m*l*yK', 'm*ly*K', 'ml*yK', 'mly*K']);
  });

  it('uses the unrestricted prefix set, and Unit.parse keeps the restricted set', () => {
    // `ly` and `pc` take only the prefixes k and larger in Unit.parse.
    expect(actual('mpcK')).toEqual(['m*pc*K', 'mpc*K']);
    expect(actual('klyK')).toEqual(['kl*yK', 'kly*K']);
    expect(() => Unit.parse('1 lyK')).toThrow('Unit "lyK" is ambiguous: l*yK or ly*K.');
    expect(() => Unit.parse('1 mlyK')).toThrow('Unit "mlyK" not found.');
    expect(() => Unit.parse('1 mpcK')).toThrow('Unit "mpcK" not found.');
  });
});

describe('Unit.readings: units and prefixes that change after the first call', () => {
  const created: string[] = [];
  const direct: string[] = [];
  const prefixKeys: string[] = [];
  let savedPrefixes: PrefixTable | undefined;
  afterEach(() => {
    for (const name of created.splice(0)) Unit.deleteUnit(name);
    for (const name of direct.splice(0)) delete Unit.UNITS[name];
    for (const key of prefixKeys.splice(0)) delete Unit.PREFIXES.SHORT[key];
    if (savedPrefixes !== undefined) {
      Unit.UNITS.m.prefixes = savedPrefixes;
      savedPrefixes = undefined;
    }
  });
  const directUnit = (name: string, prefixes: PrefixTable | undefined): void => {
    Unit.UNITS[name] = { ...Unit.UNITS.K, name, prefixes } as UnitDef;
    direct.push(name);
  };

  it('reads a unit of createUnit, its alias and its prefixes, and drops the unit after deleteUnit', () => {
    expect(actual('zorkK')).toEqual([]);
    Unit.createUnit({ zork: { definition: '3 K', prefixes: 'short', aliases: ['zorks'] } });
    created.push('zork', 'zorks');
    for (const token of ['zorkK', 'kzorkK', 'zorksK', 'Kzork2', 'µzorkK']) {
      expect(actual(token), token).toEqual(reference(token));
      expect(actual(token).length, token).toBeGreaterThan(0);
    }
    for (const name of created.splice(0)) Unit.deleteUnit(name);
    expect(actual('zorkK')).toEqual([]);
  });

  it('reads a name that is written directly to UNITS', () => {
    expect(actual('qwxK')).toEqual([]);
    directUnit('qwx', Unit.PREFIXES.SHORT);
    expect(actual('qwxK')).toEqual(['qwx*K']);
    expect(actual('kqwxK')).toEqual(reference('kqwxK'));
    expect(actual('kqwxK')).toContain('kqwx*K');
    delete Unit.UNITS.qwx;
    expect(actual('qwxK')).toEqual([]);
  });

  it('reads an exact name whose prefix table has no empty prefix', () => {
    directUnit('qwy', {});
    expect(actual('qwyK')).toEqual(['qwy*K']);
    expect(actual('kqwyK')).toEqual([]);
  });

  it('reads an exact name that has no prefix table', () => {
    directUnit('qwz', undefined);
    expect(actual('qwzK')).toEqual(['qwz*K']);
  });

  it('reads a prefix that is longer than each built-in prefix', () => {
    Unit.PREFIXES.SHORT.kilomega = { name: 'kilomega', value: 1e9, scientific: true };
    prefixKeys.push('kilomega');
    expect(actual('kilomegamK')).toEqual(reference('kilomegamK'));
    expect(actual('kilomegamK')).toContain('kilomegam*K');
  });

  it('reads the prefix table of the unit at the time of the call', () => {
    expect(actual('kmK')).toContain('km*K');
    savedPrefixes = Unit.UNITS.m.prefixes;
    Unit.UNITS.m.prefixes = Unit.PREFIXES.NONE;
    expect(actual('kmK')).not.toContain('km*K');
  });

  it('applies the prefix-repeat rule with the prefix table at the time of the call', () => {
    expect(actual('mmK')).toContain('mm*K');
    expect(actual('mmK')).not.toContain('m*m*K');
    savedPrefixes = Unit.UNITS.m.prefixes;
    Unit.UNITS.m.prefixes = Unit.PREFIXES.NONE;
    expect(actual('mmK')).not.toContain('mm*K');
    expect(actual('mmK')).toContain('m*m*K');
  });

  it('reads a repeated name when the doubled name is a unit that has no prefix table', () => {
    directUnit('qv', Unit.PREFIXES.SHORT);
    directUnit('qvqv', undefined);
    expect(actual('qvqvK')).toEqual(['qv*qv*K', 'qvqv*K']);
  });
});

describe('Unit.readings: the search does not repeat work on a token with no reading', () => {
  const steps = (token: string): number => {
    const before = unitReadingSearchSteps();
    expect(Unit.readings(token)).toEqual([]);
    return unitReadingSearchSteps() - before;
  };
  it('grows with the square of the token length, not with the count of partial readings', () => {
    const short = steps('K' + 'mK'.repeat(7) + 'j');
    const long = steps('K' + 'mK'.repeat(14) + 'j');
    // The length doubles (16 to 30 characters). A quadratic search gives a ratio of about 4.
    // The exhaustive search gives a ratio above 100.
    expect(long / short).toBeLessThan(8);
  });
  it('counts the steps of Unit.parse also', () => {
    const before = unitReadingSearchSteps();
    expect(() => Unit.parse('1 KmKmKj')).toThrow('not found');
    expect(unitReadingSearchSteps()).toBeGreaterThan(before);
  });
});
