import { describe, it, expect } from 'vitest';
import { create, all } from 'mathjs';
import { create as createCompat, all as compatAll } from '../../src/index.js';
import { show } from './oracle.js';

type L = ReturnType<typeof createCompat> & ReturnType<typeof create>;

const FINITE_SAMPLES: [number, number][] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [3, -4],
  [1e-150, 1e-150],
  [1e100, 1e100],
  [-2.5, 0.75],
  [Math.PI, Math.E],
];

const NON_FINITE_PARTS = [NaN, Infinity, -Infinity, 0, 1, -1, 1e300];

function pair(): { mj: L; compat: L } {
  return {
    mj: create(all, {}) as unknown as L,
    compat: createCompat(compatAll, {}) as unknown as L,
  };
}

function cmp(label: string, run: (l: L) => unknown): void {
  const { mj, compat } = pair();
  const om = (() => {
    try {
      return { ok: true, text: show(mj, run(mj)) };
    } catch (e) {
      const err = e as Error;
      return { ok: false, text: `${err.name}: ${err.message.slice(0, 90)}` };
    }
  })();
  const ct = (() => {
    try {
      return { ok: true, text: show(compat, run(compat)) };
    } catch (e) {
      const err = e as Error;
      return { ok: false, text: `${err.name}: ${err.message.slice(0, 90)}` };
    }
  })();
  expect(ct, label).toEqual(om);
}

describe('Complex arithmetic matches mathjs 15.3.0 on non-finite operands (#1589)', () => {
  for (const re of NON_FINITE_PARTS) {
    for (const im of NON_FINITE_PARTS) {
      const tag = `complex(${re},${im})`;
      it(`add ${tag} × scalar 2`, () =>
        cmp(`add ${tag}`, (l) =>
          (l.add as (a: unknown, b: unknown) => unknown)(
            (l.complex as (r: number, i: number) => unknown)(re, im),
            2
          )
        ));
      it(`multiply ${tag} × scalar 2`, () =>
        cmp(`mul ${tag}`, (l) =>
          (l.multiply as (a: unknown, b: unknown) => unknown)(
            (l.complex as (r: number, i: number) => unknown)(re, im),
            2
          )
        ));
      it(`subtract ${tag} - 1`, () =>
        cmp(`sub ${tag}`, (l) =>
          (l.subtract as (a: unknown, b: unknown) => unknown)(
            (l.complex as (r: number, i: number) => unknown)(re, im),
            1
          )
        ));
      it(`divide ${tag} / 2`, () =>
        cmp(`div ${tag}`, (l) =>
          (l.divide as (a: unknown, b: unknown) => unknown)(
            (l.complex as (r: number, i: number) => unknown)(re, im),
            2
          )
        ));
      it(`dotMultiply ${tag} with self`, () =>
        cmp(`dot ${tag}`, (l) =>
          (l.dotMultiply as (a: unknown, b: unknown) => unknown)(
            (l.complex as (r: number, i: number) => unknown)(re, im),
            (l.complex as (r: number, i: number) => unknown)(re, im)
          )
        ));
      it(`pow ${tag} ^ ${tag}`, () =>
        cmp(`pow ${tag}`, (l) =>
          (l.pow as (a: unknown, b: unknown) => unknown)(
            (l.complex as (r: number, i: number) => unknown)(re, im),
            (l.complex as (r: number, i: number) => unknown)(re, im)
          )
        ));
    }
  }
});

describe('Complex arithmetic unchanged on finite operands (#1589 regression)', () => {
  for (const [re, im] of FINITE_SAMPLES) {
    const tag = `complex(${re},${im})`;
    it(`add/multiply finite ${tag}`, () => {
      cmp(`add ${tag}`, (l) =>
        (l.add as (a: unknown, b: unknown) => unknown)(
          (l.complex as (r: number, i: number) => unknown)(re, im),
          (l.complex as (r: number, i: number) => unknown)(1, 2)
        )
      );
      cmp(`mul ${tag}`, (l) =>
        (l.multiply as (a: unknown, b: unknown) => unknown)(
          (l.complex as (r: number, i: number) => unknown)(re, im),
          (l.complex as (r: number, i: number) => unknown)(2, -1)
        )
      );
    });
  }
});
