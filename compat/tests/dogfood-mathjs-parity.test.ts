/**
 * Dogfood issues #889, #891, #892 — compat output against the mathjs oracle.
 *
 * The compat package is imported by name (built dist), as a consumer does.
 * The oracle is the mathjs devDependency of this package.
 */

import { describe, it, expect } from 'vitest';
import { create, all } from '@danielsimonjr/mathts-compat';
import { create as mjCreate, all as mjAll } from 'mathjs';

/** Both libraries seen through one loose shape: this file compares output, not types. */
type Lib = Record<string, (...args: unknown[]) => { toString(): string }>;

describe('dogfood mathjs parity (#889, #891, #892)', () => {
  it('#891 matrix toString matches mathjs for 1xn, nx1 and 2x2', () => {
    const mt = create(all);
    const mj = mjCreate(mjAll);
    expect(mt.matrix([[1, 2]]).toString()).toBe(mj.matrix([[1, 2]]).toString());
    expect(mt.matrix([[1], [2]]).toString()).toBe(mj.matrix([[1], [2]]).toString());
    expect(
      mt
        .matrix([
          [1, 2],
          [3, 4],
        ])
        .toString()
    ).toBe(
      mj
        .matrix([
          [1, 2],
          [3, 4],
        ])
        .toString()
    );
    expect(mt.matrix([[1, 2]]).toString()).toBe('[[1, 2]]');
  });

  it('#892 fraction mode evaluate("1/3").toString() matches mathjs 0.(3)', () => {
    const mt = create(all, { number: 'Fraction' });
    const mj = mjCreate(mjAll, { number: 'Fraction' });
    const mtFrac = mt.evaluate('1/3') as { toString(): string };
    const mjFrac = mj.evaluate('1/3') as { toString(): string };
    expect(mtFrac.toString()).toBe(mjFrac.toString());
    expect(mtFrac.toString()).toBe('0.(3)');
  });

  it('#889 scalar sin has the same parity as mathjs', () => {
    const mt = create(all);
    const mj = mjCreate(mjAll);
    for (const x of [0, 0.5, -1.25, Math.PI]) {
      expect(mt.sin(x)).toBe(mj.sin(x));
    }
    // The speed property is pinned by tests/unary-fast-path.test.ts (a counter, not a clock).
  });

  describe('#891 matrix toString: every entry type matches mathjs', () => {
    const mt = create(all) as unknown as Lib;
    const mj = mjCreate(mjAll) as unknown as Lib;
    const cases: Record<string, (m: Lib) => { toString(): string }> = {
      threeD: (m) =>
        m.matrix([
          [
            [1, 2],
            [3, 4],
          ],
          [
            [5, 6],
            [7, 8],
          ],
        ]),
      empty2d: (m) => m.matrix([[]]),
      empty: (m) => m.matrix([]),
      vector: (m) => m.matrix([1, 2, 3]),
      sparse: (m) =>
        m.sparse([
          [1, 0],
          [0, 2],
        ]),
      complex: (m) => m.matrix([[m.complex(1, 2), 3]]),
      fraction: (m) => m.matrix([[m.fraction(1, 3), 2]]),
      unit: (m) => m.matrix([[m.unit('5 cm'), 2]]),
      bignumber: (m) => m.matrix([[m.bignumber('0.1'), 2]]),
      strings: (m) => m.matrix([['a', 'b']]),
      booleans: (m) => m.matrix([[true, false]]),
    };
    for (const [name, make] of Object.entries(cases)) {
      it(name, () => {
        expect(make(mt).toString()).toBe(make(mj).toString());
      });
    }
  });

  it('#889 edge inputs of the unary fast path match mathjs', () => {
    const mt = create(all) as unknown as Lib;
    const mj = mjCreate(mjAll) as unknown as Lib;
    const show = (f: () => unknown) => {
      try {
        return String(f());
      } catch {
        return 'ERR';
      }
    };
    for (const fn of ['asin', 'acos', 'log', 'sqrt', 'sin', 'atan'] as const) {
      for (const x of [Infinity, -Infinity]) {
        expect(
          show(() => mt[fn](x)),
          `${fn}(${x})`
        ).toBe(show(() => mj[fn](x)));
      }
    }
  });

  it('matches the mathjs result type for NaN in asin, acos and log', () => {
    const mt = create(all) as unknown as Lib;
    const mj = mjCreate(mjAll) as unknown as Lib;
    for (const fn of ['asin', 'acos', 'log'] as const) {
      expect(mt.typeOf(mt[fn](NaN)), fn).toBe(mj.typeOf(mj[fn](NaN)));
      expect(String(mt[fn](NaN))).toBe(String(mj[fn](NaN)));
    }
  });
});

describe('compat prod of a sparse matrix (#985)', () => {
  // Oracle (mathjs 15.2.0; run from the package root, node_modules/mathjs installed):
  //   node -e "const {createRequire}=require('module');
  //     const m=createRequire(process.cwd()+'/node_modules/mathjs/package.json')('mathjs');
  //     console.log(m.prod(m.sparse([1,0,2])), m.prod(m.sparse([[1,0],[0,2]])),
  //       m.prod(m.sparse([[2,1],[3,4]])), m.sum(m.sparse([1,0,2])))"
  // Output: 0 0 24 3
  it('a 1-D sparse matrix with an implicit zero has product 0', () => {
    const math = create(all);
    expect(math.prod(math.sparse([1, 0, 2] as never) as never)).toBe(0);
  });

  it('a 2-D sparse matrix with an implicit zero has product 0', () => {
    const math = create(all);
    const s = math.sparse([
      [1, 0],
      [0, 2],
    ] as never);
    expect(math.prod(s as never)).toBe(0);
  });

  it('a sparse matrix with no zero keeps the full product', () => {
    const math = create(all);
    const s = math.sparse([
      [2, 1],
      [3, 4],
    ] as never);
    expect(math.prod(s as never)).toBe(24);
  });

  it('sum of the same sparse matrix is unchanged', () => {
    const math = create(all);
    expect(math.sum(math.sparse([1, 0, 2] as never) as never)).toBe(3);
  });
});

describe('compat sparse matrix iteration matches mathjs (#985)', () => {
  type Fns = Record<string, (...args: unknown[]) => unknown>;
  const mt = create(all) as unknown as Fns;
  const mj = mjCreate(mjAll) as unknown as Fns;
  const arr = (x: unknown) => (x as { toArray(): unknown }).toArray();
  const data = [
    [1, 0],
    [0, 2],
  ];

  // Oracle: live mathjs 15.2.0. log10 = [[0,-Infinity],[-Infinity,0.30103]]; not = [[0,true],[true,0]];
  // boolean = [[true,0],[0,true]] (the zero test keeps false unstored).
  it.each([
    'ceil',
    'floor',
    'abs',
    'log10',
    'log2',
    'bitNot',
    'factorial',
    'not',
    'boolean',
    'string',
  ])('%s of a sparse matrix has the mathjs values', (name) => {
    expect(arr(mt[name](mt.sparse(data)))).toEqual(arr(mj[name](mj.sparse(data))));
  });

  it('sum, min, max and prod of a sparse matrix equal mathjs', () => {
    for (const name of ['sum', 'min', 'max', 'prod']) {
      expect(mt[name](mt.sparse(data))).toBe(mj[name](mj.sparse(data)));
    }
  });

  it('forEach visits every element column by column', () => {
    const seen: unknown[] = [];
    mt.forEach(mt.sparse(data), (v: unknown, i: unknown) => seen.push([v, i]));
    expect(seen).toEqual([
      [1, [0, 0]],
      [0, [1, 0]],
      [0, [0, 1]],
      [2, [1, 1]],
    ]);
  });

  it('map visits the implicit zeros', () => {
    const f = (v: unknown, i: unknown) =>
      (i as number[])[0] * 10 + (i as number[])[1] + (v as number);
    expect(arr(mt.map(mt.sparse(data), f))).toEqual([
      [1, 1],
      [10, 13],
    ]);
  });

  it('matrixFromFunction builds a sparse matrix and calls the generator for every cell', () => {
    // mathjs: 4 calls, in the order [0,0] [1,0] [0,1] [1,1].
    const calls: number[][] = [];
    const m = mt.matrixFromFunction(
      [2, 2],
      (i: unknown) => {
        calls.push(i as number[]);
        return (i as number[])[0] + (i as number[])[1] + 1;
      },
      'sparse'
    ) as { toArray(): unknown; storage(): string };
    expect(m.toArray()).toEqual([
      [1, 2],
      [2, 3],
    ]);
    expect(m.storage()).toBe('sparse');
    expect(calls).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]);
  });
});
