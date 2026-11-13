import { describe, it, expect } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import { solve, evaluate } from '../src/index.js';

type Root = number | string | Complex;
type SolveFn = (
  equation: string,
  variable: string,
  options?: { numeric?: boolean; range?: [number, number] }
) => Root[] & { period?: string };
const solveWith = solve as unknown as SolveFn;

describe('#884 solve returns the exact solution set; the numeric scan is opt-in', () => {
  describe('periodic forms: principal roots plus the period', () => {
    it('sin(x)=0 is 0 and pi, period 2*pi', () => {
      const r = solveWith('sin(x)=0', 'x');
      expect([...r]).toEqual(['0', 'pi']);
      expect(r.period).toBe('2*pi');
    });

    it('accepts the expression form and the equation form alike', () => {
      expect([...solveWith('sin(x)', 'x')]).toEqual([...solveWith('sin(x)=0', 'x')]);
      expect([...solveWith('2*sin(x)-1', 'x')]).toEqual([...solveWith('sin(x)=1/2', 'x')]);
    });

    it('cos(x)=0 is pi/2 and 3*pi/2', () => {
      const r = solveWith('cos(x)', 'x');
      expect([...r]).toEqual(['pi/2', '3*pi/2']);
      expect(r.period).toBe('2*pi');
    });

    it('tan(x)=0 is 0, period pi', () => {
      const r = solveWith('tan(x)', 'x');
      expect([...r]).toEqual(['0']);
      expect(r.period).toBe('pi');
    });

    it('special values give exact multiples of pi', () => {
      expect([...solveWith('sin(x)=1/2', 'x')]).toEqual(['pi/6', '5*pi/6']);
      expect([...solveWith('sin(x)=-1/2', 'x')]).toEqual(['-pi/6', '7*pi/6']);
      expect([...solveWith('sin(x)=1', 'x')]).toEqual(['pi/2']);
      expect([...solveWith('sin(x)=-1', 'x')]).toEqual(['-pi/2']);
      expect([...solveWith('cos(x)=1', 'x')]).toEqual(['0']);
      expect([...solveWith('cos(x)=-1', 'x')]).toEqual(['pi']);
      expect([...solveWith('cos(x)=1/2', 'x')]).toEqual(['pi/3', '5*pi/3']);
      expect([...solveWith('tan(x)=1', 'x')]).toEqual(['pi/4']);
    });

    it('other values stay symbolic, never a rounded float', () => {
      expect([...solveWith('sin(x)=1/3', 'x')]).toEqual(['asin(1/3)', 'pi - asin(1/3)']);
      expect([...solveWith('tan(x)=2', 'x')]).toEqual(['atan(2)']);
    });

    it('an affine argument changes the roots and the period', () => {
      const double = solveWith('sin(2*x)=0', 'x');
      expect([...double]).toEqual(['0', 'pi/2']);
      expect(double.period).toBe('pi');
      const half = solveWith('sin(x/2)=0', 'x');
      expect([...half]).toEqual(['0', '2*pi']);
      expect(half.period).toBe('4*pi');
      const shifted = solveWith('sin(x+1)=0', 'x');
      expect([...shifted]).toEqual(['-1', 'pi - 1']);
      expect(shifted.period).toBe('2*pi');
    });
  });

  describe('single-root forms', () => {
    it('exp, log, sqrt and abs', () => {
      expect([...solveWith('exp(x)=2', 'x')]).toEqual(['log(2)']);
      expect([...solveWith('exp(x)=1', 'x')]).toEqual(['0']);
      expect([...solveWith('exp(x)=0', 'x')]).toEqual([]);
      expect([...solveWith('log(x)=0', 'x')]).toEqual(['1']);
      expect([...solveWith('log(x)=2', 'x')]).toEqual(['exp(2)']);
      expect([...solveWith('sqrt(x)=3', 'x')]).toEqual(['9']);
      expect([...solveWith('sqrt(x)=-1', 'x')]).toEqual([]);
      expect([...solveWith('abs(x)=3', 'x')]).toEqual(['-3', '3']);
      expect([...solveWith('abs(x)=0', 'x')]).toEqual(['0']);
      expect([...solveWith('abs(x)=-1', 'x')]).toEqual([]);
    });
  });

  describe('every exact root satisfies the equation', () => {
    const cases: Array<[string, string, string]> = [
      ['sin(x)=0', 'sin(x)', '0'],
      ['cos(x)=0', 'cos(x)', '0'],
      ['sin(x)=1/2', 'sin(x)', '1/2'],
      ['sin(x)=-1/2', 'sin(x)', '-1/2'],
      ['sin(x)=1/3', 'sin(x)', '1/3'],
      ['cos(x)=1/3', 'cos(x)', '1/3'],
      ['cos(x)=-3/4', 'cos(x)', '-3/4'],
      ['tan(x)=2', 'tan(x)', '2'],
      ['3*sin(2*x+1)=1', '3*sin(2*x+1)', '1'],
      ['exp(x)=5', 'exp(x)', '5'],
      ['log(x)=-1', 'log(x)', '-1'],
      ['sqrt(x)=2', 'sqrt(x)', '2'],
      ['sin(x/2)=1/3', 'sin(x/2)', '1/3'],
      ['sin(-2*x)=1/3', 'sin(-2*x)', '1/3'],
      ['sin(pi*x)=1/3', 'sin(pi*x)', '1/3'],
      ['sin(2*pi*x+1)=1/3', 'sin(2*pi*x+1)', '1/3'],
      ['cos(pi*x/2)=-3/4', 'cos(pi*x/2)', '-3/4'],
      ['tan(-pi*x)=2', 'tan(-pi*x)', '2'],
      ['exp(pi*x)=5', 'exp(pi*x)', '5'],
      ['log(-x)=-1', 'log(-x)', '-1'],
      ['abs(pi*x)=3', 'abs(pi*x)', '3'],
      ['abs(2*x-1)=3', 'abs(2*x-1)', '3'],
    ];
    for (const [equation, lhs, rhs] of cases) {
      it(`${equation}`, () => {
        const roots = solveWith(equation, 'x');
        expect(roots.length).toBeGreaterThan(0);
        for (const root of roots) {
          const value = Number(evaluate(String(root)));
          expect(Number(evaluate(lhs, { x: value }))).toBeCloseTo(Number(evaluate(rhs)), 9);
        }
      });
    }
  });

  describe('the exact set matches the opt-in scan over the same range', () => {
    const range: [number, number] = [-12, 12];
    const cases: Array<[string, string]> = [
      ['sin(x)=0', 'x'],
      ['cos(x)=1/2', 'x'],
      ['sin(x)=-1/2', 'x'],
      ['tan(x)=1', 'x'],
      ['sin(2*x)=1/2', 'x'],
      ['sin(x/2)=0', 'x'],
      ['sin(pi*x)=0', 'x'],
      ['sin(2*pi*x)=1/2', 'x'],
      ['cos(pi*x)=1/2', 'x'],
    ];
    for (const [equation, variable] of cases) {
      it(`${equation} on [${range}]`, () => {
        const exact = solveWith(equation, variable);
        // A missing or zero period would make the loop below run from -Infinity to Infinity, and
        // vitest cannot time out a synchronous loop. Fail here instead of hanging.
        const periodValue = Number(evaluate(exact.period ?? '0'));
        expect(Number.isFinite(periodValue) && periodValue > 0).toBe(true);
        const expanded: number[] = [];
        for (const root of exact) {
          const base = Number(evaluate(String(root)));
          const kMin = Math.floor((range[0] - base) / periodValue) - 1;
          const kMax = Math.ceil((range[1] - base) / periodValue) + 1;
          for (let k = kMin; k <= kMax; k++) {
            const v = base + k * periodValue;
            if (v >= range[0] && v <= range[1]) expanded.push(v);
          }
        }
        expanded.sort((a, b) => a - b);
        const scanned = solveWith(equation, variable, { numeric: true, range }) as number[];
        expect(scanned.length).toBe(expanded.length);
        scanned.forEach((v, i) => expect(v).toBeCloseTo(expanded[i], 7));
      });
    }
  });

  describe('the shape is read from the syntax tree, not from sample values', () => {
    // sin(2*pi*x) is 0 at every integer and half-integer. A test that samples only those points
    // reads it as the zero polynomial and answers [] for sin(2*pi*x)=0.
    it('sin(2*pi*x)=0 is 0 and 1/2, period 1', () => {
      const r = solveWith('sin(2*pi*x)=0', 'x');
      expect([...r]).toEqual(['0', '1/2']);
      expect(r.period).toBe('1');
    });

    it('cos(2*pi*x)=1 is 0, period 1', () => {
      const r = solveWith('cos(2*pi*x)=1', 'x');
      expect([...r]).toEqual(['0']);
      expect(r.period).toBe('1');
    });

    it('sin(2*pi*x)=x has no closed form and fails loudly, never [0]', () => {
      expect(() => solveWith('sin(2*pi*x)=x', 'x')).toThrow(/numeric: true, range/);
    });

    it('a cubic with an irrational constant has three finite roots, not NaN', () => {
      // The sampled fit gave coefficients with rounding noise, and the cubic formula returned NaN.
      const roots = solveWith('x^3-e', 'x');
      expect(roots).toHaveLength(3);
      expect(roots[0]).toBeCloseTo(Math.cbrt(Math.E), 12);
      for (const root of roots.slice(1)) {
        const { re, im } = root as Complex;
        expect(Number.isFinite(re) && Number.isFinite(im)).toBe(true);
        expect(re).toBeCloseTo(-Math.cbrt(Math.E) / 2, 12);
      }
    });

    it('a polynomial of degree 4 with an irrational coefficient has its real roots', () => {
      const r = solveWith('pi*x^4-1', 'x') as number[];
      expect(r).toHaveLength(2);
      expect(r[1]).toBeCloseTo(Math.PI ** -0.25, 12);
      expect(r[0]).toBeCloseTo(-(Math.PI ** -0.25), 12);
      expect(solveWith('x^4-e', 'x')).toHaveLength(2);
    });

    it('a coefficient with pi is still a polynomial coefficient', () => {
      const linear = solveWith('pi*x-1', 'x') as number[];
      expect(linear).toHaveLength(1);
      expect(linear[0]).toBeCloseTo(1 / Math.PI, 14);
      const quadratic = solveWith('sqrt(2)*x^2-1', 'x') as number[];
      expect(quadratic).toHaveLength(2);
      expect(quadratic[1]).toBeCloseTo(2 ** -0.25, 12);
    });
  });

  describe('a coefficient of pi gives rational roots', () => {
    it('sin(pi*x)=0 is 0 and 1, period 2', () => {
      const r = solveWith('sin(pi*x)=0', 'x');
      expect([...r]).toEqual(['0', '1']);
      expect(r.period).toBe('2');
    });

    it('special values give rational roots', () => {
      expect([...solveWith('sin(pi*x)=1/2', 'x')]).toEqual(['1/6', '5/6']);
      expect([...solveWith('sin(2*pi*x)=1/2', 'x')]).toEqual(['1/12', '5/12']);
      expect([...solveWith('sin(-pi*x)=0', 'x')]).toEqual(['0', '-1']);
    });

    it('other values stay symbolic and divide by pi in the text', () => {
      const r = solveWith('sin(pi*x)=1/3', 'x');
      expect([...r]).toEqual(['asin(1/3)/pi', '(pi - asin(1/3))/pi']);
      expect(r.period).toBe('2');
      expect([...solveWith('exp(pi*x)=2', 'x')]).toEqual(['log(2)/pi']);
    });
  });

  describe('exact text carries no rounded digit', () => {
    it('a constant with no exact text is declined, not printed as a decimal', () => {
      for (const equation of [
        'sin(x)=sqrt(2)/3', // asin(0.4714045207910317) would pretend to be exact
        'sin(x+pi/4)=0', // an offset of pi/4 has no exact text here
        'cos(sqrt(2)*x)=0', // the scale sqrt(2) has no exact text here
        'exp(x)=pi',
        'log(x)=sqrt(2)',
        'abs(x)=sqrt(2)',
        'sqrt(x)=pi',
      ]) {
        expect(() => solveWith(equation, 'x'), equation).toThrow(/numeric: true, range/);
      }
    });

    it('a decimal that a person typed is kept as typed', () => {
      expect([...solveWith('sin(x)=0.1+0.2', 'x')]).toEqual(['asin(3/10)', 'pi - asin(3/10)']);
      expect([...solveWith('sin(x)=0.123456789', 'x')]).toEqual([
        'asin(0.123456789)',
        'pi - asin(0.123456789)',
      ]);
    });

    it('no root text of any supported form holds a long decimal', () => {
      for (const equation of [
        'sin(x)=1/3',
        'sin(pi*x)=1/3',
        'sin(2*pi*x+1)=1/7',
        'cos(x/3)=2/5',
        'tan(3*x-1)=7',
        'exp(2*x)=3',
        'log(x/2)=5',
        'sqrt(3*x)=7/2',
        'abs(pi*x-2)=1/3',
      ]) {
        const roots = solveWith(equation, 'x');
        expect(roots.length, equation).toBeGreaterThan(0);
        for (const root of roots) expect(String(root), equation).not.toMatch(/\d\.\d{5,}/);
        if (roots.period) expect(roots.period, equation).not.toMatch(/\d\.\d{5,}/);
      }
    });

    it('an argument that is scaled keeps the text readable', () => {
      expect([...solveWith('sin(x/2)=1/3', 'x')]).toEqual(['2*asin(1/3)', '2*(pi - asin(1/3))']);
      expect([...solveWith('sin(3*x-1)=1/3', 'x')]).toEqual([
        '(asin(1/3) + 1)/3',
        '(pi - asin(1/3) + 1)/3',
      ]);
      expect([...solveWith('sin(-x)=1/3', 'x')]).toEqual(['-asin(1/3)', '-(pi - asin(1/3))']);
    });
  });

  describe('the exact roots are the real roots', () => {
    it('a value that the function never takes on the real line gives []', () => {
      expect([...solveWith('sin(x)=2', 'x')]).toEqual([]);
      expect([...solveWith('cos(x)=-2', 'x')]).toEqual([]);
      expect([...solveWith('exp(x)=-1', 'x')]).toEqual([]);
      expect([...solveWith('exp(x)=0', 'x')]).toEqual([]);
      expect([...solveWith('sqrt(x)=-1', 'x')]).toEqual([]);
      expect([...solveWith('abs(x)=-1', 'x')]).toEqual([]);
    });

    it('[] carries no period', () => {
      expect(solveWith('sin(x)=2', 'x').period).toBeUndefined();
    });
  });

  describe('root types by form', () => {
    it('a polynomial gives numbers and the elementary forms give text', () => {
      expect(solveWith('x^2-9', 'x')).toEqual([-3, 3]);
      expect(solveWith('abs(x)=3', 'x')).toEqual(['-3', '3']);
    });
  });

  describe('forms without a closed form fail loudly', () => {
    it('names the numeric opt-in in the error', () => {
      for (const equation of [
        'sin(x)=x',
        'sin(x)^2=1/4',
        'x*sin(x)',
        'sinh(x)=1',
        '1/x=2',
        'exp(x)=x^2',
        'sin(x)+cos(x)=0',
      ]) {
        expect(() => solveWith(equation, 'x')).toThrow(/numeric: true, range/);
      }
    });
  });

  describe('the numeric scan is opt-in and bounded', () => {
    it('sin(x)=0 on [-10, 10] has seven roots', () => {
      const r = solveWith('sin(x)=0', 'x', { numeric: true, range: [-10, 10] });
      expect(r).toHaveLength(7);
      expect(r.every((v) => typeof v === 'number')).toBe(true);
    });

    it('finds the roots of a form without a closed form', () => {
      const r = solveWith('cos(x)-x', 'x', { numeric: true, range: [0, 1] }) as number[];
      expect(r).toHaveLength(1);
      expect(r[0]).toBeCloseTo(0.7390851332151607, 10);
    });

    it('does not look outside the range', () => {
      const r = solveWith('sin(x)=0', 'x', { numeric: true, range: [1, 3] });
      expect(r).toEqual([]);
    });

    it('requires a finite, ordered range', () => {
      expect(() => solveWith('sin(x)=0', 'x', { numeric: true })).toThrow(/range/);
      expect(() => solveWith('sin(x)=0', 'x', { numeric: true, range: [3, 1] })).toThrow(/range/);
      expect(() => solveWith('sin(x)=0', 'x', { numeric: true, range: [0, Infinity] })).toThrow(
        /range/
      );
      expect(() => solveWith('sin(x)=0', 'x', { range: [0, 1] })).toThrow(/numeric/);
    });
  });

  describe('polynomials keep their results', () => {
    it('degree 1 to 3 stay exact', () => {
      expect(solveWith('2*x-6', 'x')).toEqual([3]);
      expect(solveWith('x^2-4', 'x')).toEqual([-2, 2]);
      expect(solveWith('x^2-2', 'x')).toEqual(['-sqrt(2)', 'sqrt(2)']);
    });

    it('a linear or quadratic root keeps full precision, not ten digits', () => {
      expect(solveWith('3*x-1', 'x')).toEqual([1 / 3]);
      expect((solveWith('x/3-1/7', 'x') as number[])[0]).toBeCloseTo(3 / 7, 15);
      expect(solveWith('0.1*x-0.3', 'x')).toEqual([3]);
      expect(solveWith('3*x^2-4*x+1', 'x')).toEqual([1 / 3, 1]);
      expect(solveWith('9*x^2-1', 'x')).toEqual([-1 / 3, 1 / 3]);
    });

    it('a radical root keeps its exact text, and a decimal never appears in it', () => {
      expect(solveWith('x^2-2', 'x')).toEqual(['-sqrt(2)', 'sqrt(2)']);
      for (const equation of ['2*x^2-3*x+1/3', 'x^2/3-1/9']) {
        for (const root of solveWith(equation, 'x')) expect(typeof root).toBe('number');
      }
    });

    it('a polynomial with small coefficients is not read as a constant', () => {
      expect(solveWith('1e-10*x-1e-10', 'x')).toEqual([1]);
      expect(solveWith('1e-12*x^2-1e-12', 'x')).toEqual([-1, 1]);
      // rounding noise of a sum is negligible next to its terms
      expect(solveWith('0.1*x^2-0.3*x^2+0.2*x^2+x-2', 'x')).toEqual([2]);
    });

    it('degree 4 and above are real roots by Sturm isolation, not a scan window', () => {
      expect(solveWith('x^4-5*x^2+4', 'x')).toEqual([-2, -1, 1, 2]);
      expect(solveWith('x^5-5*x^3+4*x', 'x')).toEqual([-2, -1, 0, 1, 2]);
      expect(solveWith('x^4+1', 'x')).toEqual([]);
      expect(solveWith('(x-1)^2*(x+2)^2', 'x')).toEqual([-2, 1]);
    });

    it('a root far outside the old scan window is found', () => {
      const r = solveWith('(x-5000)*(x^3+1)', 'x') as number[];
      expect(r).toHaveLength(2);
      expect(r[0]).toBe(-1);
      expect(r[1]).toBeCloseTo(5000, 8);
    });
  });
});
