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

describe('inferScalarDimension edge cases', () => {
  const length = si(1, 0, 0, 0, 0, 0, 0);
  const time = si(0, 0, 1, 0, 0, 0, 0);
  const none = si(0, 0, 0, 0, 0, 0, 0);

  it('keeps a cube root exact: (x^3) ^ 0.3333333333333333 is a length', () => {
    const tree = scalar.op('^', [
      scalar.op('^', [scalar.symbol('x'), scalar.number(3)]),
      scalar.number(0.3333333333333333),
    ]);
    const result = inferScalarDimension(tree, { x: length });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dimension[0].equals(new Fraction(1n, 1n))).toBe(true);
    }
  });

  it('checks every child of a sum, not just the first pair', () => {
    const tree = scalar.op('+', [scalar.symbol('x'), scalar.symbol('x'), scalar.symbol('t')]);
    expect(inferScalarDimension(tree, { x: length, t: time })).toEqual({
      ok: false,
      violation: 'add-mismatch',
      path: [],
    });
  });

  it('walks the exponent: an unknown symbol there is reported at its path', () => {
    const tree = scalar.op('^', [scalar.number(2), scalar.symbol('n')]);
    expect(inferScalarDimension(tree, {})).toEqual({
      ok: false,
      violation: 'unknown-symbol',
      path: [1],
    });
  });

  it('walks the exponent: a violation inside it is reported', () => {
    const exponent = scalar.op('+', [scalar.symbol('x'), scalar.symbol('t')]);
    const tree = scalar.op('^', [scalar.number(2), exponent]);
    expect(inferScalarDimension(tree, { x: length, t: time })).toEqual({
      ok: false,
      violation: 'add-mismatch',
      path: [1],
    });
  });

  it('rejects a dimensional exponent even on a dimensionless base', () => {
    const tree = scalar.op('^', [scalar.number(2), scalar.symbol('x')]);
    expect(inferScalarDimension(tree, { x: length })).toEqual({
      ok: false,
      violation: 'transcendental-arg-not-dimensionless',
      path: [],
    });
  });

  it('accepts a dimensionless symbol exponent on a dimensionless base', () => {
    const tree = scalar.op('^', [scalar.number(2), scalar.symbol('n')]);
    expect(inferScalarDimension(tree, { n: none })).toEqual({ ok: true, dimension: none });
  });

  it('does not throw on a NaN or infinite literal exponent', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const dimensionlessBase = scalar.op('^', [scalar.symbol('n'), scalar.number(value)]);
      expect(inferScalarDimension(dimensionlessBase, { n: none })).toEqual({
        ok: true,
        dimension: none,
      });
      const dimensionalBase = scalar.op('^', [scalar.symbol('x'), scalar.number(value)]);
      expect(inferScalarDimension(dimensionalBase, { x: length })).toEqual({
        ok: false,
        violation: 'non-literal-exponent-on-dimensional-base',
        path: [],
      });
    }
  });

  it('passes abs through and makes transcendental results dimensionless', () => {
    const abs = scalar.call('abs', scalar.symbol('x'));
    expect(inferScalarDimension(abs, { x: length })).toEqual({ ok: true, dimension: length });
    const ratio = scalar.call('log', scalar.op('/', [scalar.symbol('x'), scalar.symbol('x')]));
    expect(inferScalarDimension(ratio, { x: length })).toEqual({ ok: true, dimension: none });
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

describe('solveParameterDimensions equation emission', () => {
  const length = si(1, 0, 0, 0, 0, 0, 0);
  const time = si(0, 0, 1, 0, 0, 0, 0);
  const none = si(0, 0, 0, 0, 0, 0, 0);
  const force = si(1, 1, -2, 0, 0, 0, 0);

  it('solves a parameter added to a length: x + c is a length', () => {
    const tree = scalar.op('+', [scalar.symbol('x'), scalar.symbol('c')]);
    expect(solveParameterDimensions(tree, { x: length }, length, ['c'])).toEqual({
      solved: { c: length },
    });
  });

  it('solves the argument of a transcendental call: sin(c * t) makes c one over time', () => {
    const tree = scalar.call('sin', scalar.op('*', [scalar.symbol('c'), scalar.symbol('t')]));
    expect(solveParameterDimensions(tree, { t: time }, none, ['c'])).toEqual({
      solved: { c: si(0, 0, -1, 0, 0, 0, 0) },
    });
  });

  it('solves exp(c) with c dimensionless', () => {
    const tree = scalar.call('exp', scalar.symbol('c'));
    expect(solveParameterDimensions(tree, {}, none, ['c'])).toEqual({ solved: { c: none } });
  });

  it('solves two parameters tied by a sum and the target: c1 + c2 is a force', () => {
    const tree = scalar.op('+', [scalar.symbol('c1'), scalar.symbol('c2')]);
    expect(solveParameterDimensions(tree, {}, force, ['c1', 'c2'])).toEqual({
      solved: { c1: force, c2: force },
    });
  });

  it('solves a parameter base under a symbol exponent: c ^ n is dimensionless only for c = 1', () => {
    const tree = scalar.op('^', [scalar.symbol('c'), scalar.symbol('n')]);
    expect(solveParameterDimensions(tree, { n: none }, none, ['c'])).toEqual({
      solved: { c: none },
    });
  });

  it('is inconsistent when the sum fixes the root to the wrong dimension', () => {
    const tree = scalar.op('+', [scalar.symbol('x'), scalar.symbol('c')]);
    expect(solveParameterDimensions(tree, { x: length }, time, ['c'])).toEqual({
      inconsistent: true,
    });
  });

  it('is inconsistent, not underdetermined, when two equations contradict', () => {
    // c1*c2 must equal a length (from x) and a time (from y): no values exist,
    // although c1 and c2 are not individually fixed.
    const product = scalar.op('*', [scalar.symbol('c1'), scalar.symbol('c2')]);
    const tree = scalar.op('*', [
      scalar.op('+', [scalar.symbol('x'), product]),
      scalar.op('+', [scalar.symbol('y'), product]),
    ]);
    expect(solveParameterDimensions(tree, { x: length, y: time }, none, ['c1', 'c2'])).toEqual({
      inconsistent: true,
    });
  });

  it('keeps the c1 * c2 pair underdetermined when the equations agree', () => {
    const product = scalar.op('*', [scalar.symbol('c1'), scalar.symbol('c2')]);
    const tree = scalar.op('+', [scalar.symbol('x'), product]);
    expect(solveParameterDimensions(tree, { x: length }, length, ['c1', 'c2'])).toEqual({
      underdetermined: ['c1', 'c2'],
    });
  });

  it('dimensionlessOnly makes x + c inconsistent for a length', () => {
    const tree = scalar.op('+', [scalar.symbol('x'), scalar.symbol('c')]);
    expect(
      solveParameterDimensions(tree, { x: length }, length, ['c'], { dimensionlessOnly: true })
    ).toEqual({ inconsistent: true });
  });

  it('reports a symbol that is neither a dimension nor a parameter as inconsistent', () => {
    const tree = scalar.op('+', [scalar.symbol('x'), scalar.symbol('ghost')]);
    expect(solveParameterDimensions(tree, { x: length }, length, ['c'])).toEqual({
      inconsistent: true,
    });
  });

  it('walks a symbol exponent made of known dimensions', () => {
    const tree = scalar.op('^', [scalar.number(2), scalar.symbol('x')]);
    expect(solveParameterDimensions(tree, { x: length }, none, ['c'])).toEqual({
      inconsistent: true,
    });
  });

  it('returns a parameter named __proto__ as an own key', () => {
    const tree = scalar.op('*', [scalar.symbol('M'), scalar.symbol('__proto__')]);
    const result = solveParameterDimensions(tree, { M: si(0, 1, 0, 0, 0, 0, 0) }, force, [
      '__proto__',
    ]);
    expect('solved' in result).toBe(true);
    if ('solved' in result) {
      expect(Object.keys(result.solved)).toEqual(['__proto__']);
      expect(Object.getPrototypeOf(result.solved)).toBe(Object.prototype);
    }
  });
});
