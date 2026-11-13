import { describe, it, expect } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import { solve, solveExact, evaluate, PolynomialDegreeError } from '../src/index.js';
import type { ExactSolution } from '../src/index.js';

type Root = number | string | Complex;
type SolveFn = (
  equation: string,
  variable: string,
  options?: { numeric?: boolean; range?: [number, number] }
) => Root[];
const solveWith = solve as unknown as SolveFn;
const exact = (equation: string): ExactSolution => solveExact(equation, 'x');

describe('#884 solve returns a finite solution set; solveExact returns the periodic one', () => {
  describe('periodic forms: solveExact gives the principal roots plus the period', () => {
    it('sin(x)=0 is 0 and pi, period 2*pi', () => {
      expect(exact('sin(x)=0')).toEqual({ roots: ['0', 'pi'], period: '2*pi' });
    });

    it('accepts the expression form and the equation form alike', () => {
      expect(exact('sin(x)')).toEqual(exact('sin(x)=0'));
      expect(exact('2*sin(x)-1')).toEqual(exact('sin(x)=1/2'));
    });

    it('cos(x)=0 is pi/2 and 3*pi/2', () => {
      expect(exact('cos(x)')).toEqual({ roots: ['pi/2', '3*pi/2'], period: '2*pi' });
    });

    it('tan(x)=0 is 0, period pi', () => {
      expect(exact('tan(x)')).toEqual({ roots: ['0'], period: 'pi' });
    });

    it('special values give exact multiples of pi', () => {
      expect(exact('sin(x)=1/2').roots).toEqual(['pi/6', '5*pi/6']);
      expect(exact('sin(x)=-1/2').roots).toEqual(['-pi/6', '7*pi/6']);
      expect(exact('sin(x)=1').roots).toEqual(['pi/2']);
      expect(exact('sin(x)=-1').roots).toEqual(['-pi/2']);
      expect(exact('cos(x)=1').roots).toEqual(['0']);
      expect(exact('cos(x)=-1').roots).toEqual(['pi']);
      expect(exact('cos(x)=1/2').roots).toEqual(['pi/3', '5*pi/3']);
      expect(exact('tan(x)=1').roots).toEqual(['pi/4']);
    });

    it('other values stay symbolic, never a rounded float', () => {
      expect(exact('sin(x)=1/3').roots).toEqual(['asin(1/3)', 'pi - asin(1/3)']);
      expect(exact('tan(x)=2').roots).toEqual(['atan(2)']);
    });

    it('an affine argument changes the roots and the period', () => {
      expect(exact('sin(2*x)=0')).toEqual({ roots: ['0', 'pi/2'], period: 'pi' });
      expect(exact('sin(x/2)=0')).toEqual({ roots: ['0', '2*pi'], period: '4*pi' });
      expect(exact('sin(x+1)=0')).toEqual({ roots: ['-1', 'pi - 1'], period: '2*pi' });
    });

    it('a finite set has the period null, not a missing field', () => {
      expect(exact('exp(x)=2')).toEqual({ roots: ['log(2)'], period: null });
      expect(exact('sin(x)=2')).toEqual({ roots: [], period: null });
      expect(Object.keys(exact('exp(x)=2'))).toEqual(['roots', 'period']);
    });
  });

  describe('solve does not return a window of a periodic set', () => {
    it('throws an error that names solveExact', () => {
      for (const equation of [
        'sin(x)=0',
        'cos(x)=1/3',
        'tan(x)=1',
        'sin(x)=1',
        '2*sin(3*x+pi/4)=1',
      ]) {
        expect(() => solveWith(equation, 'x'), equation).toThrow(/solveExact/);
      }
      expect(() => solveWith('sin(x)=0', 'x')).toThrow(/period 2\*pi/);
    });

    it('still names the numeric scan as the other way out', () => {
      expect(() => solveWith('sin(x)=0', 'x')).toThrow(/numeric: true, range/);
    });

    it('returns [] when the function never takes the value', () => {
      expect(solveWith('sin(x)=2', 'x')).toEqual([]);
      expect(solveWith('cos(x)=-2', 'x')).toEqual([]);
    });
  });

  describe('the solution set survives data transport', () => {
    // The period is a field of a plain object, not a hidden property of an array: a hidden
    // property is lost in JSON, structuredClone and a worker boundary, and the caller would hold
    // a window of the solutions with no way to know.
    it('JSON round trip keeps roots and period', () => {
      const solution = exact('sin(x)=0');
      expect(JSON.parse(JSON.stringify(solution))).toEqual({ roots: ['0', 'pi'], period: '2*pi' });
      expect(JSON.parse(JSON.stringify(exact('exp(x)=2')))).toEqual({
        roots: ['log(2)'],
        period: null,
      });
    });

    it('structuredClone keeps roots and period', () => {
      expect(structuredClone(exact('cos(x)=1/2'))).toEqual({
        roots: ['pi/3', '5*pi/3'],
        period: '2*pi',
      });
    });

    it('holds only strings and null', () => {
      const solution = exact('sin(x)=1/3');
      expect(Array.isArray(solution.roots)).toBe(true);
      expect(solution.roots.every((r) => typeof r === 'string')).toBe(true);
      expect(typeof solution.period).toBe('string');
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
      ['2*sin(3*x+pi/4)=1', '2*sin(3*x+pi/4)', '1'],
      ['sin(x+pi/4)=0', 'sin(x+pi/4)', '0'],
      ['cos(2*x-pi/3)=1/2', 'cos(2*x-pi/3)', '1/2'],
      ['tan(x-3*pi/8)=1', 'tan(x-3*pi/8)', '1'],
      ['sin(pi*x+pi/4)=1/3', 'sin(pi*x+pi/4)', '1/3'],
      ['sin(x+pi/4)=1/3', 'sin(x+pi/4)', '1/3'],
      ['exp(x+pi/4)=5', 'exp(x+pi/4)', '5'],
      ['abs(x-pi/4)=3', 'abs(x-pi/4)', '3'],
    ];
    for (const [equation, lhs, rhs] of cases) {
      it(`${equation}`, () => {
        const { roots } = exact(equation);
        expect(roots.length).toBeGreaterThan(0);
        for (const root of roots) {
          const value = Number(evaluate(root));
          expect(Number(evaluate(lhs, { x: value }))).toBeCloseTo(Number(evaluate(rhs)), 9);
        }
      });
    }
  });

  describe('an offset of a fraction of pi gives exact text', () => {
    it('2*sin(3*x+pi/4)=1 is -pi/36 and 7*pi/36, period 2*pi/3', () => {
      expect(exact('2*sin(3*x+pi/4)=1')).toEqual({
        roots: ['-pi/36', '7*pi/36'],
        period: '2*pi/3',
      });
    });

    it('a special value and a pi offset give multiples of pi', () => {
      expect(exact('sin(x+pi/4)=0')).toEqual({ roots: ['-pi/4', '3*pi/4'], period: '2*pi' });
      expect(exact('cos(2*x-pi/3)=1/2')).toEqual({ roots: ['pi/3', 'pi'], period: 'pi' });
      expect(exact('tan(x-3*pi/8)=1').roots).toEqual(['5*pi/8']);
    });

    it('a coefficient of pi and an offset of pi give fractions', () => {
      expect(exact('sin(pi*x+pi/4)=0')).toEqual({ roots: ['-1/4', '3/4'], period: '2' });
    });

    it('a value with no special angle keeps the offset in the text', () => {
      expect(exact('sin(x+pi/4)=1/3').roots).toEqual(['asin(1/3) - pi/4', 'pi - asin(1/3) - pi/4']);
      expect(exact('abs(x-pi/4)=3').roots).toEqual(['-3 + pi/4', '3 + pi/4']);
    });

    it('a decimal that only looks like pi/4 is still a typed decimal', () => {
      expect(exact('sin(x+0.7853981634)=0').roots).toEqual(['-0.7853981634', 'pi - 0.7853981634']);
    });

    it('matches the opt-in scan over a range', () => {
      const scanned = solveWith('2*sin(3*x+pi/4)=1', 'x', { numeric: true, range: [-1, 1] });
      const fromText = [-Math.PI / 36, (7 * Math.PI) / 36].concat([
        -Math.PI / 36 + (2 * Math.PI) / 3,
        (7 * Math.PI) / 36 - (2 * Math.PI) / 3,
        (7 * Math.PI) / 36 - (4 * Math.PI) / 3,
      ]);
      const inRange = fromText.filter((v) => v >= -1 && v <= 1).sort((a, b) => a - b);
      expect(scanned).toHaveLength(inRange.length);
      (scanned as number[]).forEach((v, i) => expect(v).toBeCloseTo(inRange[i], 9));
    });
  });

  describe('the exact set matches the opt-in scan over the same range', () => {
    const range: [number, number] = [-12, 12];
    const cases: string[] = [
      'sin(x)=0',
      'cos(x)=1/2',
      'sin(x)=-1/2',
      'tan(x)=1',
      'sin(2*x)=1/2',
      'sin(x/2)=0',
      'sin(pi*x)=0',
      'sin(2*pi*x)=1/2',
      'cos(pi*x)=1/2',
      'sin(x+pi/4)=1/2',
    ];
    for (const equation of cases) {
      it(`${equation} on [${range}]`, () => {
        const solution = exact(equation);
        // A missing or zero period would make the loop below run from -Infinity to Infinity, and
        // vitest cannot time out a synchronous loop. Fail here instead of hanging.
        const periodValue = Number(evaluate(solution.period ?? '0'));
        expect(Number.isFinite(periodValue) && periodValue > 0).toBe(true);
        const expanded: number[] = [];
        for (const root of solution.roots) {
          const base = Number(evaluate(root));
          const kMin = Math.floor((range[0] - base) / periodValue) - 1;
          const kMax = Math.ceil((range[1] - base) / periodValue) + 1;
          for (let k = kMin; k <= kMax; k++) {
            const v = base + k * periodValue;
            if (v >= range[0] && v <= range[1]) expanded.push(v);
          }
        }
        expanded.sort((a, b) => a - b);
        const scanned = solveWith(equation, 'x', { numeric: true, range }) as number[];
        expect(scanned.length).toBe(expanded.length);
        scanned.forEach((v, i) => expect(v).toBeCloseTo(expanded[i], 7));
      });
    }
  });

  describe('the shape is read from the syntax tree, not from sample values', () => {
    // sin(2*pi*x) is 0 at every integer and half-integer. A test that samples only those points
    // reads it as the zero polynomial and answers [] for sin(2*pi*x)=0.
    it('sin(2*pi*x)=0 is 0 and 1/2, period 1', () => {
      expect(exact('sin(2*pi*x)=0')).toEqual({ roots: ['0', '1/2'], period: '1' });
    });

    it('cos(2*pi*x)=1 is 0, period 1', () => {
      expect(exact('cos(2*pi*x)=1')).toEqual({ roots: ['0'], period: '1' });
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
      expect(exact('sin(pi*x)=0')).toEqual({ roots: ['0', '1'], period: '2' });
    });

    it('special values give rational roots', () => {
      expect(exact('sin(pi*x)=1/2').roots).toEqual(['1/6', '5/6']);
      expect(exact('sin(2*pi*x)=1/2').roots).toEqual(['1/12', '5/12']);
      expect(exact('sin(-pi*x)=0').roots).toEqual(['0', '-1']);
    });

    it('other values stay symbolic and divide by pi in the text', () => {
      expect(exact('sin(pi*x)=1/3')).toEqual({
        roots: ['asin(1/3)/pi', '(pi - asin(1/3))/pi'],
        period: '2',
      });
      expect([...solveWith('exp(pi*x)=2', 'x')]).toEqual(['log(2)/pi']);
    });
  });

  describe('exact text carries no rounded digit', () => {
    const declined: Array<[string, RegExp]> = [
      // asin(0.4714045207910317) would pretend to be exact
      ['sin(x)=sqrt(2)/3', /the value 0\.47140452079103\d* that sin must take has no exact text/],
      ['cos(sqrt(2)*x)=0', /the coefficient 1\.4142135623730951 of x inside cos/],
      ['exp(x)=pi', /the value 3\.14159\d* that exp must take has no exact text/],
      ['log(x)=sqrt(2)', /the value 1\.41421\d* that log must take has no exact text/],
      ['abs(x)=sqrt(2)', /the value 1\.41421\d* that abs must take has no exact text/],
      ['sqrt(x)=pi', /the value 3\.14159\d* that sqrt must take has no exact text/],
      ['sin(x+1/sqrt(7))=0', /the offset 0\.3779644730092272 inside sin/],
    ];

    it('a constant with no exact text is declined with its name, not printed as a decimal', () => {
      for (const [equation, message] of declined) {
        expect(() => solveWith(equation, 'x'), equation).toThrow(message);
        expect(() => solveExact(equation, 'x'), equation).toThrow(message);
      }
    });

    it('the message states what an exact constant is', () => {
      expect(() => solveExact('sin(x)=sqrt(2)/3', 'x')).toThrow(
        /integer, a fraction with a denominator up to 100000, or a decimal of at most 12 digits/
      );
    });

    it('a decimal that a person typed is kept as typed', () => {
      expect(exact('sin(x)=0.1+0.2').roots).toEqual(['asin(3/10)', 'pi - asin(3/10)']);
      expect(exact('sin(x)=0.123456789').roots).toEqual([
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
        'sin(x+pi/4)=1/3',
      ]) {
        const { roots, period } = exact(equation);
        expect(roots.length, equation).toBeGreaterThan(0);
        for (const root of roots) expect(root, equation).not.toMatch(/\d\.\d{5,}/);
        if (period) expect(period, equation).not.toMatch(/\d\.\d{5,}/);
      }
    });

    it('an argument that is scaled keeps the text readable', () => {
      expect(exact('sin(x/2)=1/3').roots).toEqual(['2*asin(1/3)', '2*(pi - asin(1/3))']);
      expect(exact('sin(3*x-1)=1/3').roots).toEqual([
        '(asin(1/3) + 1)/3',
        '(pi - asin(1/3) + 1)/3',
      ]);
      expect(exact('sin(-x)=1/3').roots).toEqual(['-asin(1/3)', '-(pi - asin(1/3))']);
    });
  });

  describe('the exact roots are the real roots', () => {
    it('a value that the function never takes on the real line gives []', () => {
      expect(solveWith('sin(x)=2', 'x')).toEqual([]);
      expect(solveWith('cos(x)=-2', 'x')).toEqual([]);
      expect(solveWith('exp(x)=-1', 'x')).toEqual([]);
      expect(solveWith('exp(x)=0', 'x')).toEqual([]);
      expect(solveWith('sqrt(x)=-1', 'x')).toEqual([]);
      expect(solveWith('abs(x)=-1', 'x')).toEqual([]);
    });

    it('[] carries no period', () => {
      expect(exact('sin(x)=2').period).toBeNull();
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

    it('solveExact says that the form is not supported, and points to solve', () => {
      expect(() => solveExact('sin(x)=x', 'x')).toThrow(/not of the form a\*F\(p\*x \+ q\) = b/);
      expect(() => solveExact('x^2-2', 'x')).toThrow(/Use solve for a polynomial/);
      expect(() => solveExact(42, 'x')).toThrow(TypeError);
    });

    it('a text that is not an expression is a syntax error, not a missing closed form', () => {
      expect(() => solveWith('x +* 2', 'x')).toThrow(SyntaxError);
      expect(() => solveExact('x +* 2', 'x')).toThrow(SyntaxError);
      expect(() => solveWith('x = 1 = 2', 'x')).toThrow(/at most one '='/);
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

    it('finds a root of any size: the scan stops on the width of the bracket, not on |f|', () => {
      // |f| is below 1e-14 everywhere within 1e-7 of these roots.
      const squares = solveWith('x^2-1e-20', 'x', { numeric: true, range: [-1, 1] }) as number[];
      expect(squares).toHaveLength(2);
      expect(squares[0]).toBeCloseTo(-1e-10, 24);
      expect(squares[1]).toBeCloseTo(1e-10, 24);
      expect(solveWith('x-1e-10', 'x', { numeric: true, range: [-1, 1] })).toEqual([1e-10]);
      const scaled = solveWith('1e-20*x-1e-30', 'x', { numeric: true, range: [-1, 1] }) as number[];
      expect(scaled).toHaveLength(1);
      expect(scaled[0]).toBeCloseTo(1e-10, 24);
    });

    it('does not turn a root near an integer into the integer', () => {
      expect(solveWith('x-1.000000001', 'x', { numeric: true, range: [0, 2] })).toEqual([
        1.000000001,
      ]);
      expect(solveWith('x-1', 'x', { numeric: true, range: [0, 2] })).toEqual([1]);
    });

    it('keeps a root that touches zero on a grid point', () => {
      expect(solveWith('(x-1)^2', 'x', { numeric: true, range: [-1, 3] })).toEqual([1]);
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

    it('a polynomial in another variable gets the same radical text', () => {
      expect(solve('t^2-2', 't')).toEqual(['-sqrt(2)', 'sqrt(2)']);
    });

    it('a polynomial with small coefficients is not read as a constant', () => {
      expect(solveWith('1e-10*x-1e-10', 'x')).toEqual([1]);
      expect(solveWith('1e-12*x^2-1e-12', 'x')).toEqual([-1, 1]);
      // rounding noise of a sum is negligible next to its terms
      expect(solveWith('0.1*x^2-0.3*x^2+0.2*x^2+x-2', 'x')).toEqual([2]);
    });

    it('the rounding noise of a sum of constants is zero, also inside a coefficient', () => {
      // 0.1 + 0.2 - 0.3 is 5.55e-17 in floating point
      expect(solveWith('0.1+0.2-0.3+x', 'x')).toEqual([0]);
      expect(solveWith('(0.1+0.2-0.3)*x + 1', 'x')).toEqual([]);
      expect(() => solveWith('(0.1+0.2-0.3)*x', 'x')).toThrow(/identity/);
      expect(solveWith('(2+3)*x - 10', 'x')).toEqual([2]);
      expect(solveWith('sqrt(2)*sqrt(2)*x - 2', 'x')).toEqual([1]);
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

  describe('a large or small root is a root, not a coefficient that rounds away', () => {
    // The degree came from the size of each coefficient next to the largest one, so the leading 1
    // of x^2 - 1e12 was "negligible" and the equation read as a constant: [].
    it('x^2-1e12 is +-1e6', () => {
      expect(solveWith('x^2-1e12', 'x')).toEqual([-1e6, 1e6]);
      expect(solveWith('x^2=1e12', 'x')).toEqual([-1e6, 1e6]);
    });

    it('x^2-1e20 is +-1e10 and x^2-1e300 does not overflow', () => {
      expect(solveWith('x^2-1e20', 'x')).toEqual([-1e10, 1e10]);
      expect(solveWith('x^2-1e300', 'x')).toEqual([-1e150, 1e150]);
    });

    it('a cubic and a quartic with a large constant keep their leading term', () => {
      const cubic = solveWith('x^3-1e18', 'x');
      expect(cubic[0]).toBeCloseTo(1e6, 6);
      expect(cubic).toHaveLength(3);
      expect(solveWith('x^4-1e24', 'x')).toEqual([-1e6, 1e6]);
    });

    it('x^2-1e-18 and x^2-1e-20 are +-1e-9 and +-1e-10, not 0', () => {
      expect(solveWith('x^2-1e-18', 'x')).toEqual([-1e-9, 1e-9]);
      expect(solveWith('x^2-1e-20', 'x')).toEqual([-1e-10, 1e-10]);
    });

    it('a tiny linear equation keeps its root', () => {
      expect(solveWith('x-1e-10', 'x')).toEqual([1e-10]);
      const scaled = solveWith('1e-20*x-1e-30', 'x') as number[];
      expect(scaled).toHaveLength(1);
      expect(scaled[0]).toBeCloseTo(1e-10, 24);
    });

    it('a tiny cubic and quartic keep their roots', () => {
      const cubic = solveWith('x^3-1e-30', 'x');
      expect(cubic).toHaveLength(3);
      expect(cubic[0]).toBeCloseTo(1e-10, 20);
      const quartic = solveWith('x^4-1e-40', 'x') as number[];
      expect(quartic[0]).toBeCloseTo(-1e-10, 20);
      expect(quartic[1]).toBeCloseTo(1e-10, 20);
    });

    it('two roots that differ by 1e-10 stay two roots', () => {
      expect(solveWith('x*(x-1e-10)', 'x')).toEqual([0, 1e-10]);
    });

    it('imaginary roots of a tiny quadratic stay complex', () => {
      const roots = solveWith('x^2+1e-20', 'x') as Complex[];
      expect(roots).toHaveLength(2);
      expect(roots[0].re).toBe(0);
      expect(roots[0].im).toBeCloseTo(1e-10, 20);
      expect(roots[1].im).toBeCloseTo(-1e-10, 20);
    });
  });

  describe('a root snaps to an integer only when the integer is a root', () => {
    it('does not snap x-1e-10 to 0', () => {
      expect(solveWith('x-1e-10', 'x')).toEqual([1e-10]);
    });

    it('does not snap x-1.000000001 to 1', () => {
      expect(solveWith('x-1.000000001', 'x')).toEqual([1.000000001]);
      expect(solveWith('x+0.999999999', 'x')).toEqual([-0.999999999]);
    });

    it('does not snap a root of a quadratic or a quartic near an integer', () => {
      expect(solveWith('(x-1.000000001)*(x+3)', 'x')).toEqual([-3, 1.000000001]);
      const quartic = solveWith('(x-1.000000001)*(x+3)*(x^2+1)', 'x');
      expect(quartic).toEqual([-3, 1.000000001]);
    });

    it('snaps a root that is an integer to within the rounding of the method', () => {
      expect(solveWith('0.1*x-0.3', 'x')).toEqual([3]);
      expect(solveWith('x^3-6*x^2+11*x-6', 'x')).toEqual([1, 2, 3]);
      expect(solveWith('x^5-5*x^4+10*x^3-10*x^2+5*x-1', 'x')).toEqual([1]);
    });

    it('turns -0 into 0', () => {
      const roots = solveWith('x^2-x', 'x');
      expect(roots).toEqual([0, 1]);
      expect(Object.is(roots[0], 0)).toBe(true);
    });
  });

  describe('an identity has no finite list of solutions: it throws, and [] means no real root', () => {
    it('x^2-x^2, 0*x and x=x throw an error that names the identity', () => {
      for (const equation of ['x^2-x^2', '0*x', '0*x=0', 'x=x', '(x+1)^2=x^2+2*x+1', '5-5']) {
        expect(() => solveWith(equation, 'x'), equation).toThrow(/every value of x is a solution/);
        expect(() => solveWith(equation, 'x'), equation).toThrow(/identity/);
      }
    });

    it('an equation with no real root gives [], so [] never means an identity', () => {
      expect(solveWith('1=2', 'x')).toEqual([]);
      expect(solveWith('x-x+1', 'x')).toEqual([]);
      expect(solveWith('x^4+1', 'x')).toEqual([]);
    });

    it('a noise-level coefficient is zero: 0.1x^2-0.3x^2+0.2x^2 is an identity with x-x', () => {
      expect(() => solveWith('0.1*x^2-0.3*x^2+0.2*x^2', 'x')).toThrow(/identity/);
    });
  });

  describe('an error gives the real reason', () => {
    it('a degree above the limit says so, and the limit', () => {
      expect(() => solveWith('x^1001=1', 'x')).toThrow(/degree above 1000/);
      expect(() => solveWith('(x+1)^1001', 'x')).toThrow(/degree above 1000/);
      expect(() => solveWith('x^1001=1', 'x')).not.toThrow(/no closed-form/);
    });

    it('the degree error is a public class, a RangeError that a caller can test with instanceof', () => {
      // toThrow(undefined) passes for any error, so check that the class exists
      expect(typeof PolynomialDegreeError).toBe('function');
      expect(new PolynomialDegreeError()).toBeInstanceOf(RangeError);
      expect(() => solveWith('x^1001=1', 'x')).toThrow(PolynomialDegreeError);
    });

    it('a huge power of a constant does not hang', () => {
      const started = Date.now();
      expect(solveWith('(x^0)^1e9*x', 'x')).toEqual([0]);
      expect(() => solveWith('(x+1)^1000000000', 'x')).toThrow(/degree above 1000/);
      expect(Date.now() - started).toBeLessThan(2000);
    });

    it('a non-polynomial with a high power is not blamed on the degree', () => {
      expect(() => solveWith('x^1001+sin(x)', 'x')).toThrow(/no closed-form/);
    });

    it('the numeric scan still works above the degree limit', () => {
      expect(solveWith('x^1001=1', 'x', { numeric: true, range: [0, 2] })).toEqual([1]);
    });
  });
});
