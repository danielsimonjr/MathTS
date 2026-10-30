import { describe, expect, it } from 'vitest';
import { createScalarBuilder } from '@danielsimonjr/mathts-expression';
import { Fraction, toSiDimensionVector } from '@danielsimonjr/mathts-core';
import { gravitationConstant } from '../src/factories/index.js';
import {
  inferScalarDimension,
  solveParameterDimensions,
  type RationalDimension,
} from '../src/scalar-dimension.js';

const scalar = createScalarBuilder();

function si(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: number
): RationalDimension {
  return [
    new Fraction(BigInt(a), 1n),
    new Fraction(BigInt(b), 1n),
    new Fraction(BigInt(c), 1n),
    new Fraction(BigInt(d), 1n),
    new Fraction(BigInt(e), 1n),
    new Fraction(BigInt(f), 1n),
    new Fraction(BigInt(g), 1n),
  ];
}

function expectDimension(actual: RationalDimension, expected: RationalDimension): void {
  for (let i = 0; i < 7; i++) {
    expect(actual[i].equals(expected[i]), `component ${i}`).toBe(true);
  }
}

describe('inferScalarDimension', () => {
  it('maps gravitationConstant to [3, -1, -2, 0, 0, 0, 0]', () => {
    const gDim = toSiDimensionVector(gravitationConstant.dimensions);
    expectDimension(gDim, si(3, -1, -2, 0, 0, 0, 0));
  });

  it('infers Newton force G * m1 * m2 / r^2', () => {
    const gDim = toSiDimensionVector(gravitationConstant.dimensions);
    const dims = {
      G: gDim,
      m1: si(0, 1, 0, 0, 0, 0, 0),
      m2: si(0, 1, 0, 0, 0, 0, 0),
      r: si(1, 0, 0, 0, 0, 0, 0),
    };
    const tree = scalar.op('/', [
      scalar.op('*', [scalar.symbol('G'), scalar.symbol('m1'), scalar.symbol('m2')]),
      scalar.op('^', [scalar.symbol('r'), scalar.number(2)]),
    ]);
    const result = inferScalarDimension(tree, dims);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expectDimension(result.dimension, si(1, 1, -2, 0, 0, 0, 0));
    }
  });

  it('infers kinetic energy (1/2) * m * v^2', () => {
    const dims = {
      m: si(0, 1, 0, 0, 0, 0, 0),
      v: si(1, 0, -1, 0, 0, 0, 0),
    };
    const tree = scalar.op('*', [
      scalar.number(0.5),
      scalar.symbol('m'),
      scalar.op('^', [scalar.symbol('v'), scalar.number(2)]),
    ]);
    const result = inferScalarDimension(tree, dims);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expectDimension(result.dimension, si(2, 1, -2, 0, 0, 0, 0));
    }
  });

  it('infers pendulum period 2 * (L / g) ^ 0.5', () => {
    const dims = {
      L: si(1, 0, 0, 0, 0, 0, 0),
      g: si(1, 0, -2, 0, 0, 0, 0),
    };
    const tree = scalar.op('*', [
      scalar.number(2),
      scalar.op('^', [
        scalar.op('/', [scalar.symbol('L'), scalar.symbol('g')]),
        scalar.number(0.5),
      ]),
    ]);
    const result = inferScalarDimension(tree, dims);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expectDimension(result.dimension, si(0, 0, 1, 0, 0, 0, 0));
      expect(result.dimension[2].equals(new Fraction(1n, 1n))).toBe(true);
    }
  });

  it('reports add-mismatch for x + t', () => {
    const dims = {
      x: si(1, 0, 0, 0, 0, 0, 0),
      t: si(0, 0, 1, 0, 0, 0, 0),
    };
    const tree = scalar.op('+', [scalar.symbol('x'), scalar.symbol('t')]);
    expect(inferScalarDimension(tree, dims)).toEqual({
      ok: false,
      violation: 'add-mismatch',
      path: [],
    });
  });

  it('reports transcendental violation for sin(x) with length x', () => {
    const dims = { x: si(1, 0, 0, 0, 0, 0, 0) };
    const tree = scalar.call('sin', scalar.symbol('x'));
    expect(inferScalarDimension(tree, dims)).toEqual({
      ok: false,
      violation: 'transcendental-arg-not-dimensionless',
      path: [],
    });
  });

  it('reports non-literal exponent on a dimensional base', () => {
    const dims = {
      x: si(1, 0, 0, 0, 0, 0, 0),
      n: si(0, 0, 0, 0, 0, 0, 0),
    };
    const tree = scalar.op('^', [scalar.symbol('x'), scalar.symbol('n')]);
    expect(inferScalarDimension(tree, dims)).toEqual({
      ok: false,
      violation: 'non-literal-exponent-on-dimensional-base',
      path: [],
    });
  });

  it('reports unknown-symbol under a sum at child index 1', () => {
    const dims = { x: si(1, 0, 0, 0, 0, 0, 0) };
    const tree = scalar.op('+', [scalar.symbol('x'), scalar.symbol('q')]);
    expect(inferScalarDimension(tree, dims)).toEqual({
      ok: false,
      violation: 'unknown-symbol',
      path: [1],
    });
  });

  it('treats constructor on a null-prototype map as unknown', () => {
    const dims = Object.create(null) as Record<string, RationalDimension>;
    dims.x = si(1, 0, 0, 0, 0, 0, 0);
    const tree = scalar.op('+', [scalar.symbol('x'), scalar.symbol('constructor')]);
    expect(inferScalarDimension(tree, dims)).toEqual({
      ok: false,
      violation: 'unknown-symbol',
      path: [1],
    });
  });

  it('treats empty + as dimensionless', () => {
    expect(inferScalarDimension(scalar.op('+', []), {})).toEqual({
      ok: true,
      dimension: si(0, 0, 0, 0, 0, 0, 0),
    });
  });

  it('throws TypeError when a dims entry is not length 7', () => {
    const bad = [new Fraction(1n, 1n)] as unknown as RationalDimension;
    expect(() => inferScalarDimension(scalar.symbol('x'), { x: bad })).toThrow(TypeError);
  });
});

describe('solveParameterDimensions', () => {
  const force = si(1, 1, -2, 0, 0, 0, 0);
  const kilogram = si(0, 1, 0, 0, 0, 0, 0);

  it('solves PySR physics example M * c for c = m s^-2', () => {
    const tree = scalar.op('*', [scalar.symbol('M'), scalar.symbol('c')]);
    const result = solveParameterDimensions(tree, { M: kilogram }, force, ['c']);
    expect(result).toEqual({
      solved: {
        c: si(1, 0, -2, 0, 0, 0, 0),
      },
    });
  });

  it('is inconsistent with dimensionlessOnly on the PySR example', () => {
    const tree = scalar.op('*', [scalar.symbol('M'), scalar.symbol('c')]);
    expect(
      solveParameterDimensions(tree, { M: kilogram }, force, ['c'], {
        dimensionlessOnly: true,
      })
    ).toEqual({ inconsistent: true });
  });

  it('is underdetermined for c1 * c2 with a force target', () => {
    const tree = scalar.op('*', [scalar.symbol('c1'), scalar.symbol('c2')]);
    expect(solveParameterDimensions(tree, {}, force, ['c1', 'c2'])).toEqual({
      underdetermined: ['c1', 'c2'],
    });
  });

  it('is underdetermined when a parameter is an exponent', () => {
    const tree = scalar.op('^', [scalar.symbol('x'), scalar.symbol('c')]);
    expect(solveParameterDimensions(tree, { x: si(1, 0, 0, 0, 0, 0, 0) }, force, ['c'])).toEqual({
      underdetermined: ['c'],
    });
  });

  it('is inconsistent when a fixed symbol dimension disagrees with the target', () => {
    const tree = scalar.symbol('t');
    expect(
      solveParameterDimensions(tree, { t: si(0, 0, 1, 0, 0, 0, 0) }, si(1, 0, 0, 0, 0, 0, 0), [])
    ).toEqual({ inconsistent: true });
  });
});
