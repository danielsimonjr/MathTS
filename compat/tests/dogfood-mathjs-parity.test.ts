/**
 * Dogfood issues #889, #891, #892 — compat output against the mathjs oracle.
 *
 * The compat package is imported by name (built dist), as a consumer does.
 * The oracle is the mathjs devDependency of this package.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { create, all } from '@danielsimonjr/mathts-compat';
import { create as mjCreate, all as mjAll } from 'mathjs';

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

  it('#889 scalar sin has the same parity as mathjs and a ratio gate', () => {
    const mt = create(all);
    const mj = mjCreate(mjAll);
    for (const x of [0, 0.5, -1.25, Math.PI]) {
      expect(mt.sin(x)).toBe(mj.sin(x));
    }
    // The timed check is the compat-sin entry of the wall-clock gate runner
    // (tools/test/wall-clock-gates.json), not a wall-clock assertion here.
    const gates = JSON.parse(
      readFileSync(new URL('../../tools/test/wall-clock-gates.json', import.meta.url), 'utf8')
    ) as { gates: { name: string; limit: number }[] };
    const sinGate = gates.gates.find((g) => g.name === 'compat-sin');
    expect(sinGate?.limit).toBeLessThanOrEqual(3);
  });
});
