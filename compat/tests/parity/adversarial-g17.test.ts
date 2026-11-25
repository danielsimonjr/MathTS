import { describe, it, expect } from 'vitest';
import { create, all } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';

/**
 * Adversarial G17 probes (#1582): does the *compat* surface drop BigNumber, Fraction,
 * Complex and Unit structural zeros from a SparseMatrix the way mathjs 15.3.0 does?
 *
 * Every case is differential: it runs on the mathjs 15.3.0 oracle and on compat and
 * asserts the two agree. A failing case is a live compat↔mathjs divergence.
 *
 * Scope note (Daniel's policy, 2026-11-25): native MathTS bugs (wrong sparse storage,
 * typed sparse arithmetic) are fixed in `functions/`; compat stays a thin wrapper and
 * must still match mathjs 15.3.0 on this surface, quirks included.
 *
 * The comparison is semantic, not byte-for-byte on `toJSON`. `toArray()` fills every
 * unstored cell with the number `0`, so a dropped typed zero reads back as `n:0` while a
 * stored one reads back as `BN:0` / `Fr:0/1` / `U:n:0@…`. Comparing that reading isolates
 * G17's storage decision from two unrelated compat quirks: a Fraction serializes `n` as a
 * number where mathjs uses a string, and the CSC arrays can order entries within a column
 * differently.
 */

type Instance = ReturnType<typeof create> & ReturnType<typeof createCompat>;
type AnyMatrix = {
  density?(): number;
  toArray(): unknown[];
};

const oracle = (config: Record<string, unknown> = {}): Instance =>
  create(all, config) as unknown as Instance;
const compat = (config: Record<string, unknown> = {}): Instance =>
  createCompat(compatAll, config) as unknown as Instance;

/**
 * Call a method on any receiver (an instance function, or a matrix method) through a loose
 * surface. The published types describe number matrices, so a matrix of Unit values needs
 * a call the compiler will not narrow.
 */
function call<T = unknown>(receiver: unknown, name: string, ...args: unknown[]): T {
  const fn = (receiver as Record<string, unknown>)[name];
  if (typeof fn !== 'function') throw new TypeError(`.${name} is not a function`);
  return (fn as (...a: unknown[]) => T).apply(receiver, args);
}

/** Build a sparse matrix from nested data of any scalar type. */
const sp = (L: Instance, data: unknown[][]): AnyMatrix => call<AnyMatrix>(L, 'sparse', data);

/** Canonical form of one leaf so serialization quirks do not mask storage. */
function leaf(v: unknown): string {
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'number') return Object.is(v, -0) ? 'n:-0' : `n:${v}`;
  if (typeof v === 'string') return `s:${v}`;
  if (typeof v === 'boolean') return `b:${v}`;
  if (Array.isArray(v)) return `[${v.map(leaf).join(',')}]`;
  const o = v as {
    type?: string;
    mathjs?: string;
    toJSON?: () => Record<string, unknown>;
  };
  const json = typeof o.toJSON === 'function' ? o.toJSON() : (v as Record<string, unknown>);
  const tag = (json.mathjs as string) ?? o.type ?? o.mathjs;
  if (tag === 'BigNumber') return `BN:${String(json.value)}`;
  if (tag === 'Fraction') return `Fr:${String(json.n)}/${String(json.d)}`;
  if (tag === 'Complex') return `Cx:${String(json.re)},${String(json.im)}`;
  if (tag === 'Unit') return `U:${leaf(json.value)}@${String(json.unit)}`;
  return JSON.stringify(json);
}

/** The storage decision as the caller observes it, row by row. */
function reading(m: AnyMatrix): string[] {
  return m.toArray().map((row) => leaf(row));
}

function expectSameReading(label: string, run: (L: Instance) => unknown, config = {}): void {
  it(label, () => {
    const grid = (L: Instance) => reading(run(L) as AnyMatrix);
    expect(grid(compat(config))).toEqual(grid(oracle(config)));
  });
}

function expectSameDensity(label: string, run: (L: Instance) => unknown, config = {}): void {
  it(label, () => {
    const densityOf = (L: Instance) => (run(L) as AnyMatrix).density!();
    expect(densityOf(compat(config))).toBe(densityOf(oracle(config)));
  });
}

describe('G17 Unit zeros are structural in a sparse matrix (#1582)', () => {
  // The issue's own repro: `unit(sparse([[1, 0], [0, 2]]))` must have density 0.5.
  expectSameDensity('#1582 unit(sparse([[1, 0], [0, 2]])).density()', (L) =>
    call(
      L,
      'unit',
      sp(L, [
        [1, 0],
        [0, 2],
      ])
    )
  );

  expectSameReading('#1582 a dropped cell of unit(sparse(...)) reads back as the number 0', (L) =>
    call(
      L,
      'unit',
      sp(L, [
        [1, 0],
        [0, 2],
      ])
    )
  );

  expectSameDensity('a Unit whose value is zero is not stored (cm)', (L) =>
    sp(L, [
      [call(L, 'unit', '1 cm'), call(L, 'unit', '0 cm')],
      [call(L, 'unit', '0 cm'), call(L, 'unit', '2 cm')],
    ])
  );

  expectSameReading('a Unit whose value is zero is not stored (cm) — cells', (L) =>
    sp(L, [
      [call(L, 'unit', '1 cm'), call(L, 'unit', '0 cm')],
      [call(L, 'unit', '0 cm'), call(L, 'unit', '2 cm')],
    ])
  );
});

describe('G17 typed-object zeros are structural in a sparse constructor (#1582)', () => {
  // Number literals under `number: 'BigNumber'` are converted by the constructor, which
  // already drops them; passing BigNumber/Fraction/Complex *objects* is the hostile path.
  expectSameDensity('BigNumber objects: sparse([[3, 0], [5, 0]]).density()', (L) =>
    sp(L, [
      [call(L, 'bignumber', 3), call(L, 'bignumber', 0)],
      [call(L, 'bignumber', 5), call(L, 'bignumber', 0)],
    ])
  );

  expectSameReading('BigNumber objects: cells', (L) =>
    sp(L, [
      [call(L, 'bignumber', 3), call(L, 'bignumber', 0)],
      [call(L, 'bignumber', 5), call(L, 'bignumber', 0)],
    ])
  );

  expectSameDensity('Fraction objects: sparse([[3, 0], [5, 0]]).density()', (L) =>
    sp(L, [
      [call(L, 'fraction', 3), call(L, 'fraction', 0)],
      [call(L, 'fraction', 5), call(L, 'fraction', 0)],
    ])
  );

  expectSameReading('Fraction objects: cells', (L) =>
    sp(L, [
      [call(L, 'fraction', 3), call(L, 'fraction', 0)],
      [call(L, 'fraction', 5), call(L, 'fraction', 0)],
    ])
  );

  expectSameDensity('Complex(0, 0) entries: density()', (L) =>
    sp(L, [
      [call(L, 'complex', 3, 0), call(L, 'complex', 0, 0)],
      [call(L, 'complex', 5, 0), call(L, 'complex', 0, 0)],
    ])
  );

  expectSameReading('Complex(0, 0) entries: cells', (L) =>
    sp(L, [
      [call(L, 'complex', 3, 0), call(L, 'complex', 0, 0)],
      [call(L, 'complex', 5, 0), call(L, 'complex', 0, 0)],
    ])
  );
});

describe('G17 set / subset removal of a typed zero (#1582)', () => {
  expectSameReading('set([0, 0], BigNumber 0) on an existing entry removes it', (L) => {
    const m = sp(L, [[call(L, 'bignumber', 1), call(L, 'bignumber', 2)]]);
    call(m, 'set', [0, 0], call(L, 'bignumber', 0));
    return m;
  });

  expectSameReading('set([0, 0], Fraction 0) on an existing entry removes it', (L) => {
    const m = sp(L, [[call(L, 'fraction', 1), call(L, 'fraction', 2)]]);
    call(m, 'set', [0, 0], call(L, 'fraction', 0));
    return m;
  });

  expectSameReading('set([0, 0], unit("0 cm")) on an existing entry removes it', (L) => {
    const m = sp(L, [[call(L, 'unit', '1 cm'), call(L, 'unit', '2 cm')]]);
    call(m, 'set', [0, 0], call(L, 'unit', '0 cm'));
    return m;
  });

  expectSameReading('subset replace with a BigNumber 0 removes the entry', (L) => {
    const m = sp(L, [[call(L, 'bignumber', 1), call(L, 'bignumber', 2)]]);
    call(m, 'subset', call(L, 'index', 0, 0), call(L, 'bignumber', 0), true);
    return m;
  });

  expectSameReading('set([1, 0], unit("0 cm")) into a fresh cell stores nothing', (L) => {
    const m = sp(L, [[call(L, 'unit', '1 cm')]]);
    call(m, 'set', [1, 0], call(L, 'unit', '0 cm'));
    return m;
  });
});

describe('G17 resize / diag with a typed-zero default (#1582)', () => {
  expectSameReading('resize([2, 3], BigNumber 0) fills nothing', (L) => {
    const m = sp(L, [[call(L, 'bignumber', 1), call(L, 'bignumber', 2)]]);
    call(m, 'resize', [2, 3], call(L, 'bignumber', 0));
    return m;
  });

  expectSameReading('resize([2, 3], Fraction 0) fills nothing', (L) => {
    const m = sp(L, [[call(L, 'fraction', 1), call(L, 'fraction', 2)]]);
    call(m, 'resize', [2, 3], call(L, 'fraction', 0));
    return m;
  });

  expectSameReading('resize([2, 2], unit("0 cm")) fills nothing', (L) => {
    const m = sp(L, [[call(L, 'unit', '1 cm')]]);
    call(m, 'resize', [2, 2], call(L, 'unit', '0 cm'));
    return m;
  });

  expectSameReading('diag of BigNumber values drops the zero', (L) =>
    call(
      L,
      'diag',
      [call(L, 'bignumber', 1), call(L, 'bignumber', 0), call(L, 'bignumber', 3)],
      'sparse'
    )
  );

  expectSameReading('diag of Fraction values drops the zero', (L) =>
    call(
      L,
      'diag',
      [call(L, 'fraction', 1), call(L, 'fraction', 0), call(L, 'fraction', 3)],
      'sparse'
    )
  );

  expectSameReading('diag of Unit values drops the zero', (L) =>
    call(
      L,
      'diag',
      [call(L, 'unit', '1 cm'), call(L, 'unit', '0 cm'), call(L, 'unit', '3 cm')],
      'sparse'
    )
  );

  expectSameReading('diag of Complex zeros drops them', (L) =>
    call(
      L,
      'diag',
      [call(L, 'complex', 1, 0), call(L, 'complex', 0, 0), call(L, 'complex', 3, 0)],
      'sparse'
    )
  );
});

describe('G17 derivations of a sparse carrying typed zeros (#1582)', () => {
  const withZeros = (L: Instance) =>
    sp(L, [
      [call(L, 'bignumber', 1), call(L, 'bignumber', 0)],
      [call(L, 'bignumber', 0), call(L, 'bignumber', 4)],
    ]);

  expectSameReading('reshape keeps a sparse matrix free of typed zeros', (L) =>
    call(withZeros(L), 'reshape', [4, 1])
  );

  expectSameReading('transpose keeps a sparse matrix free of typed zeros', (L) =>
    call(L, 'transpose', withZeros(L))
  );

  expectSameReading('clone keeps a sparse matrix free of typed zeros', (L) =>
    call(withZeros(L), 'clone')
  );

  expectSameReading('map(identity) keeps a sparse matrix free of typed zeros', (L) =>
    call(withZeros(L), 'map', (v: unknown) => v)
  );

  expectSameReading('valueOf() fills the dropped cell with the number 0', (L) => {
    const vo = call(sp(L, [[call(L, 'bignumber', 1), call(L, 'bignumber', 0)]]), 'valueOf') as
      unknown[] | AnyMatrix;
    return Array.isArray(vo) ? ({ toArray: () => vo } as AnyMatrix) : vo;
  });

  expectSameReading('concat fills a dropped typed zero with the number 0', (L) =>
    call(
      L,
      'concat',
      sp(L, [[call(L, 'bignumber', 1), call(L, 'bignumber', 0)]]),
      sp(L, [[call(L, 'bignumber', 2), call(L, 'bignumber', 0)]])
    )
  );

  it('forEach(skipZeros = true) visits only the stored cells', () => {
    const visits = (L: Instance) => {
      const out: string[] = [];
      call<void>(
        sp(L, [[call(L, 'bignumber', 1), call(L, 'bignumber', 0)]]),
        'forEach',
        (v: unknown) => out.push(leaf(v)),
        true
      );
      return out;
    };
    expect(visits(compat())).toEqual(visits(oracle()));
  });

  it('forEach(skipZeros = false) still passes the number 0 for a dropped cell', () => {
    const visits = (L: Instance) => {
      const out: string[] = [];
      call<void>(
        sp(L, [[call(L, 'bignumber', 1), call(L, 'bignumber', 0)]]),
        'forEach',
        (v: unknown) => out.push(leaf(v)),
        false
      );
      return out;
    };
    expect(visits(compat())).toEqual(visits(oracle()));
  });

  expectSameReading('bignumber("-0") is a structural zero', (L) =>
    sp(L, [
      [call(L, 'bignumber', '-0'), call(L, 'bignumber', 0)],
      [call(L, 'bignumber', 1), call(L, 'bignumber', 2)],
    ])
  );

  expectSameReading('a mixed BigNumber/number matrix keeps a number zero a number', (L) =>
    sp(L, [
      [1, call(L, 'bignumber', 0)],
      [call(L, 'bignumber', 3), 2],
    ])
  );

  it('a valueless unit in a sparse constructor has the same outcome', () => {
    const outcome = (L: Instance) => {
      try {
        return `ok ${JSON.stringify(reading(sp(L, [[call(L, 'unit', 'cm'), call(L, 'unit', '1 cm')]])))}`;
      } catch (e) {
        return `throw ${(e as Error).name}`;
      }
    };
    expect(outcome(compat())).toBe(outcome(oracle()));
  });
});

describe('G17 arithmetic whose result is a typed zero (#1582)', () => {
  const bn = (L: Instance, x: number) => call(L, 'bignumber', x);

  expectSameReading('add of two sparse BigNumber matrices drops the zero cells', (L) =>
    call(
      L,
      'add',
      sp(L, [
        [bn(L, 1), bn(L, 0)],
        [bn(L, 0), bn(L, 2)],
      ]),
      sp(L, [
        [bn(L, 0), bn(L, 1)],
        [bn(L, 1), bn(L, 0)],
      ])
    )
  );

  expectSameReading('subtract of a BigNumber sparse matrix from itself is empty', (L) => {
    const a = sp(L, [[bn(L, 1), bn(L, 2)]]);
    return call(L, 'subtract', a, a);
  });

  expectSameReading('multiply of two sparse BigNumber matrices drops the zeros', (L) =>
    call(
      L,
      'multiply',
      sp(L, [
        [bn(L, 1), bn(L, 0)],
        [bn(L, 0), bn(L, 1)],
      ]),
      sp(L, [
        [bn(L, 0), bn(L, 2)],
        [bn(L, 3), bn(L, 0)],
      ])
    )
  );

  // Unit arithmetic over a sparse matrix is where the storage decision also decides
  // whether the element-wise walk ever sees a Unit paired with a number zero.
  expectSameReading('add of two sparse Unit matrices drops the zero cells', (L) =>
    call(
      L,
      'add',
      sp(L, [[call(L, 'unit', '1 cm'), call(L, 'unit', '0 cm')]]),
      sp(L, [[call(L, 'unit', '0 cm'), call(L, 'unit', '1 cm')]])
    )
  );

  expectSameReading('multiply of a sparse Unit row by a Unit column', (L) =>
    call(
      L,
      'multiply',
      sp(L, [[call(L, 'unit', '1 cm'), call(L, 'unit', '0 cm')]]),
      call(L, 'matrix', [call(L, 'unit', '1 cm'), call(L, 'unit', '2 cm')])
    )
  );

  expectSameReading('multiply of a sparse Unit row by a number column', (L) =>
    call(
      L,
      'multiply',
      sp(L, [[call(L, 'unit', '1 cm'), call(L, 'unit', '0 cm')]]),
      call(L, 'matrix', [1, 2])
    )
  );
});

describe('G17 controls: a number sparse matrix is unchanged', () => {
  // These must pass on both trees. A number uses the exact `=== 0`, so the dogfood-1169
  // pins hold and tiny values such as 1e-100 stay stored.
  it('sparse([[3, 0], [5, 0]]).density() is 0.5', () => {
    expect(
      compat()
        .sparse([
          [3, 0],
          [5, 0],
        ])
        .density()
    ).toBe(0.5);
  });

  it('a tiny number 1e-100 stays stored (exact === 0, not absTol)', () => {
    expect(
      compat()
        .sparse([
          [1e-100, 0],
          [1, 1],
        ])
        .density()
    ).toBe(0.75);
  });

  it('negative zero is not stored', () => {
    expect(
      compat()
        .sparse([
          [3, -0],
          [5, 0],
        ])
        .density()
    ).toBe(0.5);
  });

  it('number literals under number: "BigNumber" are dropped (already matches)', () => {
    const L = compat({ number: 'BigNumber' });
    expect(
      L.sparse([
        [3, 0],
        [5, 0],
      ]).density()
    ).toBe(0.5);
  });
});
