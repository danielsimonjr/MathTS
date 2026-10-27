import { describe, it, expect } from 'vitest';
import { createSeededRng } from '@danielsimonjr/mathts-core';
import { fitScalarParameters, levenbergMarquardt, scalar, ScalarEvalError } from '../src/index.js';

function expModelNode() {
  const a = scalar.symbol('a');
  const b = scalar.symbol('b');
  const c = scalar.symbol('c');
  const x = scalar.symbol('x');
  const negB = scalar.op('*', [scalar.number(-1), b]);
  const bx = scalar.op('*', [negB, x]);
  return scalar.op('+', [scalar.op('*', [a, scalar.call('exp', bx)]), c]);
}

describe('fitScalarParameters', () => {
  it('recovers planted noise-free a*exp(-b*x)+c', () => {
    const node = expModelNode();
    const xs = new Float64Array([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    const a0 = 1.7;
    const b0 = 0.3;
    const c0 = 0.4;
    const ys = new Float64Array(xs.length);
    for (let i = 0; i < xs.length; i++) {
      ys[i] = a0 * Math.exp(-b0 * xs[i]) + c0;
    }
    const r = fitScalarParameters(node, [xs], ys, ['x'], {
      parameters: ['a', 'b', 'c'],
      initial: [1, 1, 1],
      restarts: 0,
    });
    expect(r.validRows).toBe(8);
    expect(r.loss).toBeLessThan(1e-18);
    expect(Math.abs(r.parameters[0] - a0)).toBeLessThan(1e-8);
    expect(Math.abs(r.parameters[1] - b0)).toBeLessThan(1e-8);
    expect(Math.abs(r.parameters[2] - c0)).toBeLessThan(1e-8);
  });

  it('noisy recovery within 3 standard errors', () => {
    const node = expModelNode();
    const n = 40;
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    const a0 = 1.7;
    const b0 = 0.3;
    const c0 = 0.4;
    const rng = createSeededRng(20261027);
    for (let i = 0; i < n; i++) {
      xs[i] = i / 10;
      ys[i] = a0 * Math.exp(-b0 * xs[i]) + c0 + 0.01 * rng.normal();
    }
    const r = fitScalarParameters(node, [xs], ys, ['x'], {
      parameters: ['a', 'b', 'c'],
      initial: [a0, b0, c0],
      restarts: 0,
    });
    expect(r.standardErrors).not.toBeNull();
    const se = r.standardErrors!;
    for (let j = 0; j < 3; j++) {
      expect(Math.abs(r.parameters[j] - [a0, b0, c0][j])).toBeLessThanOrEqual(3 * se[j]);
    }
  });

  it('closed-form slope a*x', () => {
    const node = scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]);
    const x = new Float64Array([1, 2, 3]);
    const y = new Float64Array([2, 4, 7]);
    const r = fitScalarParameters(node, [x], y, ['x'], {
      parameters: ['a'],
      restarts: 0,
    });
    const expected = 31 / 14;
    expect(Math.abs(r.parameters[0] - expected)).toBeLessThanOrEqual(1e-12);
    expect(r.validRows).toBe(3);
  });

  it('weighted slope', () => {
    const node = scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]);
    const x = new Float64Array([1, 2]);
    const y = new Float64Array([1, 1]);
    const w = new Float64Array([1, 3]);
    const r = fitScalarParameters(node, [x], y, ['x'], {
      parameters: ['a'],
      weights: w,
      restarts: 0,
    });
    expect(r.validRows).toBe(2);
    expect(Math.abs(r.parameters[0] - 7 / 13)).toBeLessThanOrEqual(1e-12);
  });

  it('custom loss matches closed-form slope', () => {
    const node = scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]);
    const x = new Float64Array([1, 2, 3]);
    const y = new Float64Array([2, 4, 7]);
    const r = fitScalarParameters(node, [x], y, ['x'], {
      parameters: ['a'],
      loss: (pred, obs, w) => w * (pred - obs) ** 2,
      restarts: 0,
    });
    expect(Math.abs(r.parameters[0] - 31 / 14)).toBeLessThanOrEqual(1e-8);
  });

  it('standard errors for linear model', () => {
    const node = scalar.op('+', [
      scalar.symbol('a'),
      scalar.op('*', [scalar.symbol('b'), scalar.symbol('x')]),
    ]);
    const x = new Float64Array([0, 1, 2, 3]);
    const y = new Float64Array([1, 2, 2, 3]);
    const r = fitScalarParameters(node, [x], y, ['x'], {
      parameters: ['a', 'b'],
      restarts: 0,
    });
    expect(Math.abs(r.parameters[0] - 1.1)).toBeLessThanOrEqual(1e-10);
    expect(Math.abs(r.parameters[1] - 0.6)).toBeLessThanOrEqual(1e-10);
    expect(Math.abs(r.loss - 0.2)).toBeLessThanOrEqual(1e-10);
    expect(r.standardErrors).not.toBeNull();
    expect(Math.abs(r.standardErrors![0] - Math.sqrt(0.07))).toBeLessThanOrEqual(1e-10);
    expect(Math.abs(r.standardErrors![1] - Math.sqrt(0.02))).toBeLessThanOrEqual(1e-10);

    const r1 = fitScalarParameters(node, [x], y, ['x'], {
      parameters: ['a', 'b'],
      loss: 'l1',
      restarts: 0,
    });
    expect(r1.standardErrors).toBeNull();
  });

  it('drops invalid rows', () => {
    const node = scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]);
    let r = fitScalarParameters(
      node,
      [new Float64Array([1, -2, 3])],
      new Float64Array([2, NaN, 6]),
      ['x'],
      { parameters: ['a'], restarts: 0 }
    );
    expect(r.validRows).toBe(2);
    expect(Math.abs(r.parameters[0] - 2)).toBeLessThanOrEqual(1e-12);
    expect(r.loss).toBe(0);

    const lnNode = scalar.op('+', [scalar.call('ln', scalar.symbol('x')), scalar.symbol('a')]);
    r = fitScalarParameters(
      lnNode,
      [new Float64Array([-1, 1, Math.E])],
      new Float64Array([50, 0, 1]),
      ['x'],
      { parameters: ['a'], restarts: 0 }
    );
    expect(r.validRows).toBe(2);
    expect(Math.abs(r.parameters[0])).toBeLessThanOrEqual(1e-12);
    expect(r.loss).toBe(0);

    r = fitScalarParameters(
      node,
      [new Float64Array([1, 2, 3])],
      new Float64Array([2, 4, 7]),
      ['x'],
      { parameters: ['a'], weights: new Float64Array([1, 0, 1]), restarts: 0 }
    );
    expect(r.validRows).toBe(2);
  });

  it('fixed parameter and bounds', () => {
    const node = scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]);
    const x = new Float64Array([1, 2, 3]);
    const y = new Float64Array([2, 4, 7]);
    let r = fitScalarParameters(node, [x], y, ['x'], {
      parameters: ['a'],
      bounds: [[2, 2]],
      restarts: 0,
    });
    expect(r.parameters[0]).toBe(2);
    expect(r.loss).toBe(1);
    expect(r.standardErrors![0]).toBe(0);
    expect(r.evaluations).toBe(1);

    const yLin = new Float64Array([2, 4, 6]);
    for (const algorithm of ['lm', 'bfgs', 'nelder-mead'] as const) {
      r = fitScalarParameters(node, [x], yLin, ['x'], {
        parameters: ['a'],
        bounds: [[1.5, 2.5]],
        algorithm,
        restarts: 0,
      });
      expect(Math.abs(r.parameters[0] - 2)).toBeLessThanOrEqual(1e-6);
    }

    r = fitScalarParameters(node, [x], yLin, ['x'], {
      parameters: ['a'],
      bounds: [[0, 1]],
      algorithm: 'bfgs',
      restarts: 0,
    });
    expect(Math.abs(r.parameters[0] - 1)).toBeLessThanOrEqual(1e-8);
    expect(r.loss).toBe(14);
  });

  it('determinism with seeded restarts', () => {
    const node = expModelNode();
    const xs = new Float64Array([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    const ys = new Float64Array(xs.length);
    for (let i = 0; i < xs.length; i++) {
      ys[i] = 1.7 * Math.exp(-0.3 * xs[i]) + 0.4;
    }
    const rng1 = createSeededRng(11);
    const rng2 = createSeededRng(11);
    const opts = {
      parameters: ['a', 'b', 'c'],
      initial: [1, 1, 1],
      restarts: 2,
    };
    const r1 = fitScalarParameters(node, [xs], ys, ['x'], { ...opts, rng: rng1 });
    const r2 = fitScalarParameters(node, [xs], ys, ['x'], { ...opts, rng: rng2 });
    for (let j = 0; j < 3; j++) {
      expect(Object.is(r1.parameters[j], r2.parameters[j])).toBe(true);
    }
    expect(r1.loss).toBe(r2.loss);
    expect(r1.evaluations).toBe(r2.evaluations);
    expect(r1.converged).toBe(r2.converged);
    expect(r1.validRows).toBe(r2.validRows);
    const drawAfterFit = rng1.next();
    expect(drawAfterFit).toBe(rng2.next());

    const rng3 = createSeededRng(11);
    for (let k = 0; k < 2 * 3 * 2; k++) {
      rng3.next();
    }
    expect(rng3.next()).toBe(drawAfterFit);

    const idle = createSeededRng(42);
    fitScalarParameters(node, [xs], ys, ['x'], {
      parameters: ['a', 'b', 'c'],
      restarts: 0,
      rng: idle,
    });
    expect(idle.next()).toBe(0.6011037519201636);
  });

  it('error cases', () => {
    const node = scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]);
    const x = new Float64Array([1]);
    const y = new Float64Array([1]);
    expect(() => fitScalarParameters(node, [x], y, ['x'], { parameters: ['a'] })).toThrow(
      TypeError
    );
    expect(() =>
      fitScalarParameters(node, [x], y, ['x'], {
        parameters: ['a'],
        restarts: -1,
        rng: createSeededRng(1),
      })
    ).toThrow(RangeError);
    expect(() =>
      fitScalarParameters(node, [x], y, ['x'], {
        parameters: ['a'],
        restarts: 1.5,
        rng: createSeededRng(1),
      })
    ).toThrow(RangeError);
    expect(() =>
      fitScalarParameters(node, [x], y, ['x'], {
        parameters: ['a'],
        loss: 'mae' as 'l2',
        restarts: 0,
      })
    ).toThrow(RangeError);
    expect(() =>
      fitScalarParameters(node, [x], y, ['x'], {
        parameters: ['a'],
        loss: 'l1',
        algorithm: 'lm',
        restarts: 0,
      })
    ).toThrow(RangeError);
    expect(() =>
      fitScalarParameters(node, [x], y, ['x'], {
        parameters: ['a', 'b'],
        initial: [1],
        restarts: 0,
      })
    ).toThrow(RangeError);
    expect(() =>
      fitScalarParameters(node, [x], y, ['x'], {
        parameters: ['a'],
        weights: new Float64Array([-1]),
        restarts: 0,
      })
    ).toThrow(RangeError);
    expect(() =>
      fitScalarParameters(node, [x], y, ['x'], {
        parameters: ['a'],
        bounds: [[2, 1]],
        restarts: 0,
      })
    ).toThrow(RangeError);
    expect(() =>
      fitScalarParameters(node, [x], y, ['x'], {
        parameters: ['a'],
        initial: [NaN],
        restarts: 0,
      })
    ).toThrow(RangeError);
    expect(() =>
      fitScalarParameters(node, [x], new Float64Array([NaN]), ['x'], {
        parameters: ['a'],
        restarts: 0,
      })
    ).toThrow(RangeError);

    expect(() =>
      fitScalarParameters(scalar.symbol('z'), [x], y, ['x'], {
        parameters: ['a'],
        restarts: 0,
      })
    ).toThrow(ScalarEvalError);

    const both = scalar.op('*', [scalar.symbol('a'), scalar.symbol('x')]);
    expect(() =>
      fitScalarParameters(both, [x], y, ['x'], { parameters: ['a', 'x'], restarts: 0 })
    ).toThrow(ScalarEvalError);

    const r0 = fitScalarParameters(node, [x], y, ['x'], {
      parameters: ['a'],
      initial: [1],
      maxIterations: 0,
      restarts: 0,
    });
    expect(r0.parameters[0]).toBe(1);
    expect(r0.converged).toBe(false);
    expect(r0.evaluations).toBeGreaterThanOrEqual(1);

    const lnOnly = scalar.call('ln', scalar.symbol('x'));
    const rEmpty = fitScalarParameters(
      lnOnly,
      [new Float64Array([1, Math.E])],
      new Float64Array([0, 1]),
      ['x'],
      { parameters: [], restarts: 0 }
    );
    expect(rEmpty.parameters.length).toBe(0);
    expect(rEmpty.loss).toBe(0);
    expect(rEmpty.validRows).toBe(2);
  });
});

describe('levenbergMarquardt jacobian option', () => {
  const t = [0, 0.5, 1, 1.5, 2, 2.5, 3];
  const y = t.map((ti) => 2.5 * Math.exp(0.5 * ti));

  it('uses analytic jacobian to recover parameters', () => {
    let jacCalls = 0;
    const r = levenbergMarquardt(
      (p) => t.map((ti, i) => p[0] * Math.exp(p[1] * ti) - y[i]),
      [1, 1],
      {
        jacobian: (p) => {
          jacCalls++;
          return t.map((ti) => {
            const e = Math.exp(p[1] * ti);
            return [e, p[0] * ti * e];
          });
        },
      }
    );
    expect(jacCalls).toBeGreaterThan(0);
    expect(Math.abs(r.x[0] - 2.5)).toBeLessThan(1e-8);
    expect(Math.abs(r.x[1] - 0.5)).toBeLessThan(1e-8);
  });

  it('zero jacobian leaves start unchanged', () => {
    const x0 = [1, 1];
    const r = levenbergMarquardt((p) => t.map((ti, i) => p[0] * Math.exp(p[1] * ti) - y[i]), x0, {
      jacobian: () => t.map(() => [0, 0]),
    });
    expect(Object.is(r.x[0], x0[0])).toBe(true);
    expect(Object.is(r.x[1], x0[1])).toBe(true);
  });
});
