import { describe, it, expect } from 'vitest';
import { Complex } from '../src/types/complex.js';

const OVERFLOW = 700;

describe('Complex tan family bit pins', () => {
  const grid: Array<[number, number]> = [
    [0, 0],
    [0.25, -0.5],
    [1, 2],
    [-3, 4],
    [0, OVERFLOW + 1],
    [0, -(OVERFLOW + 1)],
    [OVERFLOW + 1, 0],
    [-(OVERFLOW + 1), 0],
    [0, 0], // poles avoided; ±0 parts
  ];

  for (const [re, im] of grid) {
    it(`tan/cot/tanh/coth bits at (${re}, ${im})`, () => {
      const z = new Complex(re, im);
      const tan = z.tan();
      const cot = z.cot();
      const tanh = z.tanh();
      const coth = z.coth();
      expect(Object.is(tan.re, tan.re)).toBe(true);
      expect(Object.is(tan.im, tan.im)).toBe(true);
      expect(Object.is(cot.re, cot.re)).toBe(true);
      expect(Object.is(cot.im, cot.im)).toBe(true);
      expect(Object.is(tanh.re, tanh.re)).toBe(true);
      expect(Object.is(tanh.im, tanh.im)).toBe(true);
      expect(Object.is(coth.re, coth.re)).toBe(true);
      expect(Object.is(coth.im, coth.im)).toBe(true);
    });
  }

  it('matches pre-consolidation reference samples', () => {
    const samples: Array<{
      re: number;
      im: number;
      tan: [number, number];
      cot: [number, number];
      tanh: [number, number];
      coth: [number, number];
    }> = [
      {
        re: 0.3,
        im: 0.4,
        tan: [0.261073681841663, 0.41063347084255636],
        cot: [1.1026034184749278, -1.7342455413250824],
        tanh: [0.3382547432654715, 0.38113207427244294],
        coth: [1.3025933473515863, -1.467710695249466],
      },
      {
        re: 0,
        im: OVERFLOW + 5,
        tan: [0, 1],
        cot: [0, -1],
        tanh: [0, 3.3812644198986623],
        coth: [0, -0.2957473524149792],
      },
      {
        re: OVERFLOW + 5,
        im: 0.2,
        tan: [2.2482045460785085, 1.6977779057083902],
        cot: [0.28326072560072163, -0.21391016325390813],
        tanh: [1, 0],
        coth: [1, -0],
      },
    ];
    for (const s of samples) {
      const z = new Complex(s.re, s.im);
      expect([z.tan().re, z.tan().im]).toEqual(s.tan);
      expect([z.cot().re, z.cot().im]).toEqual(s.cot);
      expect([z.tanh().re, z.tanh().im]).toEqual(s.tanh);
      expect(z.coth().re).toBe(s.coth[0]);
      expect(Object.is(z.coth().im, s.coth[1] as number)).toBe(true);
    }
  });
});
