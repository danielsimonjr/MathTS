import { describe, it, expect, afterEach } from 'vitest';
import { Unit } from '../../src/index.js';
import { UNIT_PREFIX_SET_UNRESTRICTED } from '../../src/types/unit/unit-table.js';
import type { UnitDef, PrefixDef, PrefixTable } from '../../src/types/unit/unit-types.js';

type Found = { unit: string; prefix: string } | null;

const MICRO_SIGN = /[µμ]/;

// The reference: the linear scan over every UNITS key that `_findUnit` used before the
// last-character index. The new lookup must give the same unit and prefix for every string.
function referenceFind(str: string, unrestricted: boolean): Found {
  const UNITS = Unit.UNITS;
  const PREFIXES = Unit.PREFIXES;
  const wide = (table: PrefixTable | undefined): PrefixTable | undefined => {
    for (const [key, w] of Object.entries(UNIT_PREFIX_SET_UNRESTRICTED)) {
      if (table === PREFIXES[key]) return PREFIXES[w!];
    }
    return table;
  };
  if (Object.hasOwn(UNITS, str)) return { unit: UNITS[str].name, prefix: '' };
  for (const name in UNITS) {
    if (!Object.hasOwn(UNITS, name) || !str.endsWith(name)) continue;
    const unit = UNITS[name];
    let prefixName = str.substring(0, str.length - name.length);
    if (MICRO_SIGN.test(prefixName)) {
      if (prefixName.length !== 1) continue;
      prefixName = 'u';
    }
    const prefixes = unrestricted ? wide(unit.prefixes) : unit.prefixes;
    if (prefixes !== undefined && Object.hasOwn(prefixes, prefixName)) {
      return { unit: unit.name, prefix: prefixes[prefixName].name };
    }
  }
  return null;
}

function find(str: string, unrestricted = false): Found {
  const res = Unit._findUnit(str, unrestricted);
  return res === null ? null : { unit: res.unit.name, prefix: res.prefix.name };
}

// mulberry32: a small seeded generator, so the token set is the same on every run.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function corpus(): string[] {
  const keys = Object.keys(Unit.UNITS);
  const prefixSymbols = [
    ...new Set(
      Object.values(Unit.PREFIXES).flatMap((t) => Object.keys(t as Record<string, PrefixDef>))
    ),
  ];
  const out = new Set<string>(['', 'xyzzy', 'qq', 'µ', 'μm', 'µm', 'µµm', 'μs', 'µkm', 'toString']);
  for (const k of keys) {
    out.add(k);
    out.add('µ' + k);
    out.add('μ' + k);
    for (const p of prefixSymbols) out.add(p + k);
  }
  const rnd = mulberry32(20261108);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  for (let t = 0; t < 200; t++) {
    let token = '';
    const parts = 2 + Math.floor(rnd() * 3);
    for (let j = 0; j < parts; j++) token += (rnd() < 0.4 ? pick(prefixSymbols) : '') + pick(keys);
    for (let i = 0; i < token.length; i++) {
      for (let j = i + 1; j <= token.length; j++) out.add(token.slice(i, j));
    }
  }
  return [...out];
}

describe('_findUnit (last-character index)', () => {
  const created: string[] = [];
  afterEach(() => {
    for (const name of created.splice(0)) Unit.deleteUnit(name);
  });

  it('gives the same unit and prefix as the linear scan, restricted and unrestricted', () => {
    const strings = corpus();
    expect(strings.length).toBeGreaterThan(10000);
    const mismatches: string[] = [];
    for (const s of strings) {
      for (const unrestricted of [false, true]) {
        const got = find(s, unrestricted);
        const want = referenceFind(s, unrestricted);
        if (JSON.stringify(got) !== JSON.stringify(want)) {
          mismatches.push(`${JSON.stringify(s)} ${unrestricted}: ${JSON.stringify(got)}`);
        }
      }
    }
    expect(mismatches.slice(0, 20)).toEqual([]);
  });

  it('reads a single micro sign as the micro prefix, and refuses two', () => {
    expect(find('µm')).toEqual({ unit: 'm', prefix: 'u' });
    expect(find('μm')).toEqual({ unit: 'm', prefix: 'u' });
    expect(find('µµm')).toBeNull();
  });

  it('uses the unrestricted prefix set only when it is asked for', () => {
    // A unit with a restricted set, and a prefix that only the unrestricted set has.
    const restricted = Object.entries(UNIT_PREFIX_SET_UNRESTRICTED)[0]!;
    const narrow = Unit.PREFIXES[restricted[0]] as Record<string, PrefixDef>;
    const wideSet = Unit.PREFIXES[restricted[1]!] as Record<string, PrefixDef>;
    const name = Object.keys(Unit.UNITS).find((k) => Unit.UNITS[k].prefixes === narrow)!;
    const p = Object.keys(wideSet).find((k) => k !== '' && !Object.hasOwn(narrow, k))!;
    expect(name).toBeDefined();
    expect(p).toBeDefined();
    expect(find(p + name, false)).toEqual(referenceFind(p + name, false));
    expect(find(p + name, true)).toEqual({ unit: name, prefix: p });
    expect(find(p + name, false)).not.toEqual(find(p + name, true));
  });

  it('keeps insertion order: the earlier name wins when two names both match', () => {
    Unit.createUnitSingle('am', { definition: '1 m', prefixes: 'short' });
    created.push('am');
    // 'dam' is da + m (m comes first in UNITS) and also d + am.
    expect(find('dam')).toEqual({ unit: 'm', prefix: 'da' });
    expect(find('kam')).toEqual({ unit: 'am', prefix: 'k' });
    Unit.deleteUnit('am');
    created.pop();
    expect(find('dam')).toEqual({ unit: 'm', prefix: 'da' });
    expect(find('kam')).toBeNull();
  });

  it('matches an exact unit name before any prefix split', () => {
    Unit.createUnitSingle('dam', { definition: '1 m' });
    created.push('dam');
    expect(find('dam')).toEqual({ unit: 'dam', prefix: '' });
    Unit.deleteUnit('dam');
    created.pop();
    expect(find('dam')).toEqual({ unit: 'm', prefix: 'da' });
  });

  it('follows the new insertion order after a unit is deleted and created again', () => {
    // 'dazb' is da + zb and also d + azb. The name that is earlier in UNITS wins.
    Unit.createUnitSingle('zb', { definition: '1 m', prefixes: 'short' });
    Unit.createUnitSingle('azb', { definition: '1 m', prefixes: 'short' });
    created.push('zb', 'azb');
    expect(find('dazb')).toEqual({ unit: 'zb', prefix: 'da' });
    Unit.deleteUnit('zb');
    Unit.createUnitSingle('zb', { definition: '1 m', prefixes: 'short' });
    expect(find('dazb')).toEqual({ unit: 'azb', prefix: 'd' });
    expect(find('dazb')).toEqual(referenceFind('dazb', false));
  });

  it('does not track a direct delete and re-add of a name (documented limit)', () => {
    Unit.createUnitSingle('zc', { definition: '1 m', prefixes: 'short' });
    Unit.createUnitSingle('azc', { definition: '1 m', prefixes: 'short' });
    created.push('zc', 'azc');
    expect(find('dazc')).toEqual({ unit: 'zc', prefix: 'da' });
    const def = Unit.UNITS['zc'];
    delete Unit.UNITS['zc'];
    Unit.UNITS['zc'] = def; // 'zc' is now after 'azc' in insertion order
    expect(referenceFind('dazc', false)).toEqual({ unit: 'azc', prefix: 'd' });
    // The index keeps the old order. Unit.deleteUnit and Unit.createUnitSingle are tracked.
    expect(find('dazc')).toEqual({ unit: 'zc', prefix: 'da' });
  });

  it('never finds an empty-string key written directly (documented limit)', () => {
    Unit.UNITS[''] = { ...Unit.UNITS['m'], name: 'EMPTY' };
    try {
      expect(referenceFind('k', false)).toEqual({ unit: 'EMPTY', prefix: 'k' });
      expect(find('k')).toBeNull();
    } finally {
      delete Unit.UNITS[''];
    }
  });

  it('drops a remembered hit when its UNITS entry is replaced directly', () => {
    Unit.createUnitSingle('zd', { definition: '1 m', prefixes: 'short' });
    created.push('zd');
    const first = Unit._findUnit('kzd');
    expect(first?.unit.name).toBe('zd');
    const replacement: UnitDef = { ...Unit.UNITS['zd'], value: 2 };
    Unit.UNITS['zd'] = replacement;
    expect(Unit._findUnit('kzd')?.unit).toBe(replacement);
  });

  it('finds a unit written straight into Unit.UNITS, after a miss on it', () => {
    expect(find('kzzq')).toBeNull();
    const def: UnitDef = { ...Unit.UNITS['m'], name: 'zzq' };
    Unit.UNITS['zzq'] = def;
    created.push('zzq');
    expect(find('kzzq')).toEqual({ unit: 'zzq', prefix: 'k' });
    expect(find('zzq')).toEqual({ unit: 'zzq', prefix: '' });
  });
});
