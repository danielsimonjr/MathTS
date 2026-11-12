import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { fraction } from '../src/shims.js';

type G32bApi = {
  fraction: (n: number, d: number) => unknown;
  config: (c: { matrix: string }) => void;
  size: (x: unknown) => { constructor: { name: string } };
  zeros: (...dims: number[]) => unknown;
  createUnit: (name: string, def: string) => void;
  evaluate: (expr: string) => unknown;
  unit: (
    v: number,
    u: string
  ) => {
    to: (u: string) => { toString(): string; toNumber(): number };
  };
};

describe('dogfood G32b formatting and units', () => {
  const mt = create(all) as unknown as G32bApi;

  it('#743 Fraction toString and toJSON match mathjs style', () => {
    expect(String(fraction(0.1))).toBe('0.1');
    const third = mt.fraction(1, 3) as unknown as { n: number; d: number };
    expect(String(third)).toBe('1/3');
    const j = JSON.parse(JSON.stringify(third));
    expect(j).toEqual({ mathjs: 'Fraction', n: 1, d: 3 });
  });

  it('#744 size formats as [2, 3] when config.matrix is Matrix', () => {
    mt.config({ matrix: 'Matrix' });
    const s = mt.size(mt.zeros(2, 3));
    expect(String(s)).toBe('[2, 3]');
    expect(s.constructor.name).toBe('MathJSDenseMatrix');
  });

  it('#739 createUnit furlong is idempotent when definition matches', () => {
    expect(() => mt.createUnit('furlong', '220 yard')).not.toThrow();
    expect(String(mt.evaluate('1 furlong to meter'))).toContain('201.168');
  });

  it('#742 litre to millilitre is exactly 1000 mL', () => {
    const u: { toString(): string; toNumber(): number } = mt.unit(1, 'L').to('mL');
    expect(String(u)).toBe('1000 mL');
    expect(u.toNumber()).toBe(1000);
  });
});
