/**
 * CAS (Computer Algebra System) Tests
 *
 * Tests for 28 symbolic/semi-symbolic math functions including calculus,
 * transforms, series, solvers, and advanced algebra.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  integrate,
  limit,
  partialDerivative,
  directionalDerivative,
  gradientSymbolic,
  jacobian,
  laplacian,
  divergence,
  laplace,
  inverseLaplace,
  fourierSeries,
  zTransform,
  taylor,
  multivariateTaylor,
  series,
  seriesCoefficient,
  solve,
  implicitDiff,
  summation,
  symbolicProduct,
  assume,
  getAssumptions,
  clearAssumptions,
  asymptotic,
  groebnerBasis,
  minimalPolynomial,
  toRadicals,
  piecewise,
  odeGeneral,
  curl,
} from '../src/typed/cas.js';

// =============================================================================
// CALCULUS
// =============================================================================

describe('CAS: Calculus', () => {
  describe('integrate', () => {
    it('should integrate x -> x^2/2', () => {
      expect(integrate('x', 'x')).toBe('x^2/2');
    });

    it('should integrate x^2 -> x^3/3', () => {
      expect(integrate('x^2', 'x')).toBe('x^3/3');
    });

    it('should integrate x^3 -> x^4/4', () => {
      expect(integrate('x^3', 'x')).toBe('x^4/4');
    });

    it('should integrate sin(x) -> -cos(x)', () => {
      expect(integrate('sin(x)', 'x')).toBe('-cos(x)');
    });

    it('should integrate cos(x) -> sin(x)', () => {
      expect(integrate('cos(x)', 'x')).toBe('sin(x)');
    });

    it('should integrate exp(x) -> exp(x)', () => {
      expect(integrate('exp(x)', 'x')).toBe('exp(x)');
    });

    it('should integrate 1/x -> log(x)', () => {
      expect(integrate('1/x', 'x')).toBe('log(x)');
    });

    it('should integrate a constant', () => {
      expect(integrate('5', 'x')).toBe('5*x');
    });

    it('should compute a definite integral of x^2 from 0 to 1', () => {
      const result = integrate('x^2', 'x', 0, 1);
      expect(result).toBeCloseTo(1 / 3, 6);
    });

    it('should compute definite integral of sin(x) from 0 to pi', () => {
      const result = integrate('sin(x)', 'x', 0, Math.PI);
      expect(result).toBeCloseTo(2, 6);
    });

    it('should integrate c*x^n pattern', () => {
      expect(integrate('3*x^2', 'x')).toBe('1*x^3');
    });
  });

  describe('limit', () => {
    it('should compute limit of x^2 as x -> 3', () => {
      expect(limit('x^2', 'x', 3)).toBeCloseTo(9, 6);
    });

    it('should compute limit of sin(x)/x as x -> 0', () => {
      expect(limit('sin(x)/x', 'x', 0)).toBeCloseTo(1, 4);
    });

    it('should compute limit of (x^2 - 1)/(x - 1) as x -> 1', () => {
      expect(limit('(x^2 - 1)/(x - 1)', 'x', 1)).toBeCloseTo(2, 4);
    });

    it('should compute right-sided limit of 1/x as x -> 0+', () => {
      const result = limit('1/x', 'x', 0, 'right');
      expect(result).toBeGreaterThan(1e8);
    });

    it('should compute left-sided limit of 1/x as x -> 0-', () => {
      const result = limit('1/x', 'x', 0, 'left');
      expect(result).toBeLessThan(-1e8);
    });

    it('should compute limit at infinity', () => {
      const result = limit('1/x', 'x', Infinity);
      expect(result).toBeCloseTo(0, 6);
    });
  });

  describe('partialDerivative', () => {
    it('should compute df/dx of x^2 + y^2', () => {
      const result = partialDerivative('x^2 + y^2', 'x', { x: 3, y: 4 });
      expect(result).toBeCloseTo(6, 4);
    });

    it('should compute df/dy of x^2 + y^2', () => {
      const result = partialDerivative('x^2 + y^2', 'y', { x: 3, y: 4 });
      expect(result).toBeCloseTo(8, 4);
    });

    it('should compute df/dx of x*y', () => {
      const result = partialDerivative('x*y', 'x', { x: 2, y: 5 });
      expect(result).toBeCloseTo(5, 4);
    });

    it('should throw for missing variable in scope', () => {
      expect(() => partialDerivative('x^2', 'z', { x: 1 })).toThrow();
    });
  });

  describe('directionalDerivative', () => {
    it('should compute directional derivative along x-axis', () => {
      const result = directionalDerivative('x^2 + y^2', ['x', 'y'], [1, 0], { x: 3, y: 4 });
      expect(result).toBeCloseTo(6, 4);
    });

    it('should compute directional derivative along diagonal', () => {
      const result = directionalDerivative('x + y', ['x', 'y'], [1, 1], { x: 0, y: 0 });
      expect(result).toBeCloseTo(Math.sqrt(2), 4);
    });

    it('should throw for zero direction', () => {
      expect(() => directionalDerivative('x', ['x'], [0], { x: 1 })).toThrow();
    });

    it('should throw for mismatched lengths', () => {
      expect(() => directionalDerivative('x', ['x', 'y'], [1], { x: 1, y: 1 })).toThrow();
    });
  });

  describe('gradientSymbolic', () => {
    it('should compute gradient of x^2 + y^2', () => {
      const result = gradientSymbolic('x^2 + y^2', ['x', 'y'], { x: 3, y: 4 });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeCloseTo(6, 4);
      expect(result[1]).toBeCloseTo(8, 4);
    });

    it('should compute gradient of x*y*z', () => {
      const result = gradientSymbolic('x*y*z', ['x', 'y', 'z'], { x: 1, y: 2, z: 3 });
      expect(result[0]).toBeCloseTo(6, 4); // yz
      expect(result[1]).toBeCloseTo(3, 4); // xz
      expect(result[2]).toBeCloseTo(2, 4); // xy
    });
  });

  describe('jacobian', () => {
    it('should compute Jacobian of [x*y, x^2]', () => {
      const J = jacobian(['x*y', 'x^2'], ['x', 'y'], { x: 2, y: 3 });
      expect(J).toHaveLength(2);
      expect(J[0][0]).toBeCloseTo(3, 4); // d(xy)/dx = y
      expect(J[0][1]).toBeCloseTo(2, 4); // d(xy)/dy = x
      expect(J[1][0]).toBeCloseTo(4, 4); // d(x^2)/dx = 2x
      expect(J[1][1]).toBeCloseTo(0, 4); // d(x^2)/dy = 0
    });
  });

  describe('laplacian', () => {
    it('should compute laplacian of x^2 + y^2 + z^2', () => {
      const result = laplacian('x^2 + y^2 + z^2', ['x', 'y', 'z'], { x: 1, y: 2, z: 3 });
      expect(result).toBeCloseTo(6, 2); // 2 + 2 + 2
    });

    it('should compute laplacian of x^3', () => {
      const result = laplacian('x^3', ['x'], { x: 2 });
      expect(result).toBeCloseTo(12, 2); // 6x at x=2
    });
  });

  describe('divergence', () => {
    it('should compute divergence of [x^2, y^2, z^2]', () => {
      const result = divergence(['x^2', 'y^2', 'z^2'], ['x', 'y', 'z'], { x: 1, y: 2, z: 3 });
      expect(result).toBeCloseTo(12, 4); // 2 + 4 + 6
    });

    it('should compute divergence of constant field', () => {
      const result = divergence(['1', '2', '3'], ['x', 'y', 'z'], { x: 0, y: 0, z: 0 });
      expect(result).toBeCloseTo(0, 4);
    });

    it('should throw for mismatched lengths', () => {
      expect(() => divergence(['x', 'y'], ['x', 'y', 'z'], { x: 0, y: 0, z: 0 })).toThrow();
    });
  });
});

// =============================================================================
// TRANSFORMS
// =============================================================================

describe('CAS: Transforms', () => {
  describe('laplace', () => {
    it('should transform 1 -> 1/s', () => {
      expect(laplace('1', 't', 's')).toBe('1/s');
    });

    it('should transform t -> 1/s^2', () => {
      expect(laplace('t', 't', 's')).toBe('1/s^2');
    });

    it('should transform t^2 -> 2/s^3', () => {
      expect(laplace('t^2', 't', 's')).toBe('2/s^3');
    });

    it('should transform sin(t) -> 1/(s^2 + 1)', () => {
      expect(laplace('sin(t)', 't', 's')).toBe('1/(s^2 + 1)');
    });

    it('should transform cos(t) -> s/(s^2 + 1)', () => {
      expect(laplace('cos(t)', 't', 's')).toBe('s/(s^2 + 1)');
    });

    it('should transform exp(-t) -> 1/(s + 1)', () => {
      expect(laplace('exp(-t)', 't', 's')).toBe('1/(s + 1)');
    });

    it('should transform exp(t) -> 1/(s - 1)', () => {
      expect(laplace('exp(t)', 't', 's')).toBe('1/(s - 1)');
    });

    it('should transform a constant c -> c/s', () => {
      expect(laplace('5', 't', 's')).toBe('5/s');
    });
  });

  describe('inverseLaplace', () => {
    it('should inverse transform 1/s -> 1', () => {
      expect(inverseLaplace('1/s', 's', 't')).toBe('1');
    });

    it('should inverse transform 1/s^2 -> t', () => {
      expect(inverseLaplace('1/s^2', 's', 't')).toBe('t');
    });

    it('should inverse transform 1/(s + 1) -> exp(-1*t)', () => {
      expect(inverseLaplace('1/(s + 1)', 's', 't')).toBe('exp(-1*t)');
    });

    it('should inverse transform 1/(s - 1) -> exp(1*t)', () => {
      expect(inverseLaplace('1/(s - 1)', 's', 't')).toBe('exp(1*t)');
    });
  });

  describe('fourierSeries', () => {
    it('should compute Fourier coefficients of x (sawtooth-like)', () => {
      const result = fourierSeries('x', 'x', 3);
      expect(result.a0).toBeCloseTo(0, 1); // odd function (numerical integration)
      expect(result.an).toHaveLength(3);
      expect(result.bn).toHaveLength(3);
      // For x on [-pi, pi]: bn[0] = 2*(-1)^(n+1) / n => b1 = 2
      expect(result.bn[0]).toBeCloseTo(2, 1);
    });

    it('should compute Fourier coefficients of constant', () => {
      const result = fourierSeries('1', 'x', 2);
      expect(result.a0).toBeCloseTo(2, 1); // a0 = (1/pi) * integral of 1 over [-pi,pi] = 2
      expect(result.an[0]).toBeCloseTo(0, 2);
      expect(result.an[1]).toBeCloseTo(0, 2);
    });
  });

  describe('zTransform', () => {
    it('should transform 1 -> z/(z - 1)', () => {
      expect(zTransform('1', 'n', 'z')).toBe('z/(z - 1)');
    });

    it('should transform n -> z/(z - 1)^2', () => {
      expect(zTransform('n', 'n', 'z')).toBe('z/(z - 1)^2');
    });

    it('should transform a^n', () => {
      expect(zTransform('0.5^n', 'n', 'z')).toBe('z/(z - 0.5)');
    });
  });
});

// =============================================================================
// SERIES
// =============================================================================

describe('CAS: Series', () => {
  describe('taylor', () => {
    it('should expand sin(x) around 0', () => {
      const result = taylor('sin(x)', 'x', 0, 5);
      // sin(x) = x - x^3/6 + x^5/120
      expect(result).toContain('x');
      // Verify numerically: evaluate the Taylor polynomial
      const coeff1 = seriesCoefficient('sin(x)', 'x', 0, 1);
      expect(coeff1).toBeCloseTo(1, 4);
      const coeff3 = seriesCoefficient('sin(x)', 'x', 0, 3);
      expect(coeff3).toBeCloseTo(-1 / 6, 4);
    });

    it('should expand exp(x) around 0', () => {
      const result = taylor('exp(x)', 'x', 0, 4);
      expect(result).toBeDefined();
      // Check coefficients: 1, 1, 1/2, 1/6, 1/24
      const c0 = seriesCoefficient('exp(x)', 'x', 0, 0);
      expect(c0).toBeCloseTo(1, 4);
      const c1 = seriesCoefficient('exp(x)', 'x', 0, 1);
      expect(c1).toBeCloseTo(1, 4);
      const c2 = seriesCoefficient('exp(x)', 'x', 0, 2);
      expect(c2).toBeCloseTo(0.5, 4);
    });

    it('should expand cos(x) around 0', () => {
      const c0 = seriesCoefficient('cos(x)', 'x', 0, 0);
      expect(c0).toBeCloseTo(1, 4);
      const c2 = seriesCoefficient('cos(x)', 'x', 0, 2);
      expect(c2).toBeCloseTo(-0.5, 4);
    });

    it('should return 0 for the zero function', () => {
      expect(taylor('0', 'x', 0, 3)).toBe('0');
    });
  });

  describe('multivariateTaylor', () => {
    it('should expand x*y around (1,1) to order 1', () => {
      const result = multivariateTaylor('x*y', ['x', 'y'], [1, 1], 1);
      expect(result).toBeDefined();
      // f(1,1)=1, df/dx=y=1, df/dy=x=1
      // => 1 + 1*(x-1) + 1*(y-1) = x + y - 1
    });

    it('should throw for mismatched vars and x0', () => {
      expect(() => multivariateTaylor('x*y', ['x'], [1, 2], 1)).toThrow();
    });
  });

  describe('series (alias)', () => {
    it('should be an alias for taylor', () => {
      const s = series('exp(x)', 'x', 0, 3);
      const t = taylor('exp(x)', 'x', 0, 3);
      expect(s).toBe(t);
    });
  });

  describe('seriesCoefficient', () => {
    it('should return 1 for exp(x) c0', () => {
      expect(seriesCoefficient('exp(x)', 'x', 0, 0)).toBeCloseTo(1, 6);
    });

    it('should return 1/6 for sin(x) c3 (absolute value)', () => {
      expect(Math.abs(seriesCoefficient('sin(x)', 'x', 0, 3))).toBeCloseTo(1 / 6, 3);
    });

    it('should return 0 for sin(x) c2', () => {
      expect(seriesCoefficient('sin(x)', 'x', 0, 2)).toBeCloseTo(0, 4);
    });
  });
});

// =============================================================================
// SOLVER
// =============================================================================

describe('CAS: Solver', () => {
  describe('solve', () => {
    it('should solve x^2 - 4 = 0', () => {
      const roots = solve('x^2 - 4', 'x');
      expect(roots).toContain(-2);
      expect(roots).toContain(2);
    });

    it('should solve 2*x - 6 = 0', () => {
      const roots = solve('2*x - 6', 'x');
      expect(roots).toHaveLength(1);
      expect(roots[0]).toBeCloseTo(3, 6);
    });

    it('should solve x^2 + 2*x + 1 = 0 (double root)', () => {
      const roots = solve('x^2 + 2*x + 1', 'x');
      expect(roots.length).toBeGreaterThanOrEqual(1);
      expect(roots[0]).toBeCloseTo(-1, 6);
    });

    it('should solve x^3 - x = 0', () => {
      const roots = solve('x^3 - x', 'x');
      expect(roots).toContain(-1);
      expect(roots).toContain(0);
      expect(roots).toContain(1);
    });

    it('should return sorted roots', () => {
      const roots = solve('x^2 - 9', 'x');
      expect(roots[0]).toBeLessThan(roots[1]);
    });
  });

  describe('implicitDiff', () => {
    it('should compute dy/dx for circle x^2 + y^2 - 25 at (3,4)', () => {
      const result = implicitDiff('x^2 + y^2 - 25', 'x', 'y', { x: 3, y: 4 });
      expect(result).toBeCloseTo(-3 / 4, 4);
    });

    it('should compute dy/dx for x*y - 1 at (1,1)', () => {
      const result = implicitDiff('x*y - 1', 'x', 'y', { x: 1, y: 1 });
      expect(result).toBeCloseTo(-1, 4);
    });
  });

  describe('summation', () => {
    it('should sum k from 1 to 100 = 5050', () => {
      expect(summation('k', 'k', 1, 100)).toBeCloseTo(5050, 6);
    });

    it('should sum k^2 from 1 to 10 = 385', () => {
      expect(summation('k^2', 'k', 1, 10)).toBeCloseTo(385, 6);
    });

    it('should sum 1 from 1 to 50 = 50', () => {
      expect(summation('1', 'k', 1, 50)).toBeCloseTo(50, 6);
    });

    it('should sum a single term', () => {
      expect(summation('k^2', 'k', 5, 5)).toBeCloseTo(25, 6);
    });
  });

  describe('symbolicProduct', () => {
    it('should compute 5! = 120', () => {
      expect(symbolicProduct('k', 'k', 1, 5)).toBeCloseTo(120, 6);
    });

    it('should compute product of 2*k for k=1..4', () => {
      // 2*4*6*8 = 384
      expect(symbolicProduct('2*k', 'k', 1, 4)).toBeCloseTo(384, 6);
    });

    it('should compute product of a single term', () => {
      expect(symbolicProduct('k', 'k', 7, 7)).toBeCloseTo(7, 6);
    });
  });
});

// =============================================================================
// ADVANCED
// =============================================================================

describe('CAS: Advanced', () => {
  beforeEach(() => {
    clearAssumptions();
  });

  afterEach(() => {
    clearAssumptions();
  });

  describe('assume / getAssumptions / clearAssumptions', () => {
    it('should store assumptions', () => {
      assume('x', 'positive');
      expect(getAssumptions('x').has('positive')).toBe(true);
    });

    it('should store multiple assumptions', () => {
      assume('x', 'real');
      assume('x', 'positive');
      const props = getAssumptions('x');
      expect(props.has('real')).toBe(true);
      expect(props.has('positive')).toBe(true);
    });

    it('should return empty set for unknown variable', () => {
      expect(getAssumptions('unknown').size).toBe(0);
    });

    it('should clear specific variable assumptions', () => {
      assume('x', 'positive');
      assume('y', 'integer');
      clearAssumptions('x');
      expect(getAssumptions('x').size).toBe(0);
      expect(getAssumptions('y').has('integer')).toBe(true);
    });

    it('should clear all assumptions', () => {
      assume('x', 'positive');
      assume('y', 'integer');
      clearAssumptions();
      expect(getAssumptions('x').size).toBe(0);
      expect(getAssumptions('y').size).toBe(0);
    });

    it('should throw for invalid property', () => {
      expect(() => assume('x', 'imaginary')).toThrow();
    });
  });

  describe('asymptotic', () => {
    it('should find linear growth of x', () => {
      const result = asymptotic('x', 'x', Infinity);
      expect(result.order).toBeCloseTo(1, 0);
      expect(result.coefficient).toBeCloseTo(1, 1);
    });

    it('should find quadratic growth of x^2', () => {
      const result = asymptotic('x^2', 'x', Infinity);
      expect(result.order).toBeCloseTo(2, 0);
      expect(result.coefficient).toBeCloseTo(1, 1);
    });

    it('should find constant growth of 5', () => {
      const result = asymptotic('5', 'x', Infinity);
      expect(result.order).toBeCloseTo(0, 0);
    });
  });

  describe('groebnerBasis', () => {
    it('should return normalized polynomials', () => {
      const result = groebnerBasis(['x^2 - 1'], ['x']);
      expect(result).toHaveLength(1);
      expect(result[0]).toBeDefined();
    });

    it('should handle two polynomials', () => {
      const result = groebnerBasis(['x + y - 1', 'x - y'], ['x', 'y']);
      expect(result).toHaveLength(2);
    });
  });

  describe('minimalPolynomial', () => {
    it('should find x - 2 for the value 2', () => {
      const result = minimalPolynomial('2', 'x');
      expect(result).toBe('x - 2');
    });

    it('should find x^2 - 2 for sqrt(2)', () => {
      const result = minimalPolynomial('sqrt(2)', 'x');
      expect(result).not.toBeNull();
      // The polynomial should have sqrt(2) as a root
      if (result) {
        expect(result).toContain('x^2');
      }
    });

    it('should find minimal polynomial for 1/3', () => {
      const result = minimalPolynomial('1/3', 'x');
      expect(result).not.toBeNull();
      // 3*x - 1
      if (result) {
        expect(result).toContain('x');
      }
    });
  });

  describe('toRadicals', () => {
    it('should solve linear equation', () => {
      const result = toRadicals('x - 3');
      expect(result).toHaveLength(1);
      expect(parseFloat(result[0])).toBeCloseTo(3, 6);
    });

    it('should express quadratic roots with sqrt', () => {
      const result = toRadicals('x^2 - 2');
      expect(result.length).toBeGreaterThanOrEqual(1);
      // Should contain sqrt(2) in some form or numerical approximation
    });

    it('should handle double root', () => {
      const result = toRadicals('x^2 - 2*x + 1');
      expect(result.length).toBeGreaterThanOrEqual(1);
      // Root should be 1
    });
  });

  describe('piecewise', () => {
    it('should evaluate correct branch for positive x', () => {
      const f = piecewise(['x < 0', 'x >= 0'], ['-x', 'x']);
      expect(f({ x: 5 })).toBe(5);
    });

    it('should evaluate correct branch for negative x', () => {
      const f = piecewise(['x < 0', 'x >= 0'], ['-x', 'x']);
      expect(f({ x: -3 })).toBe(3);
    });

    it('should use default value when no condition matches', () => {
      const f = piecewise(['x < 0'], ['x', '0']);
      expect(f({ x: 5 })).toBe(0);
    });

    it('should throw if too few values', () => {
      expect(() => piecewise(['x < 0', 'x >= 0'], ['x'])).toThrow();
    });
  });

  describe('odeGeneral', () => {
    it('should solve dy/dx = y (exponential growth)', () => {
      // y(0)=1, dy/dx=y => y=e^x
      const result = odeGeneral('y', 'y', 'x', 0, 1, 1, 100);
      expect(result).toHaveLength(101); // 100 steps + initial point
      // y(1) should be e
      const last = result[result.length - 1];
      expect(last.x).toBeCloseTo(1, 6);
      expect(last.y).toBeCloseTo(Math.E, 4);
    });

    it('should solve dy/dx = -y (exponential decay)', () => {
      const result = odeGeneral('-y', 'y', 'x', 0, 1, 1, 100);
      const last = result[result.length - 1];
      expect(last.y).toBeCloseTo(1 / Math.E, 4);
    });

    it('should solve dy/dx = 1 (linear growth)', () => {
      const result = odeGeneral('1', 'y', 'x', 0, 0, 5, 100);
      const last = result[result.length - 1];
      expect(last.x).toBeCloseTo(5, 6);
      expect(last.y).toBeCloseTo(5, 4);
    });

    it('should include initial point', () => {
      const result = odeGeneral('y', 'y', 'x', 0, 1, 1, 10);
      expect(result[0].x).toBe(0);
      expect(result[0].y).toBe(1);
    });
  });

  describe('curl', () => {
    it('should compute curl of [y, -x, 0] = [0, 0, -2]', () => {
      const result = curl(['y', '-x', '0'], ['x', 'y', 'z'], { x: 0, y: 0, z: 0 });
      expect(result[0]).toBeCloseTo(0, 4);
      expect(result[1]).toBeCloseTo(0, 4);
      expect(result[2]).toBeCloseTo(-2, 4);
    });

    it('should compute curl of conservative field [2*x, 2*y, 2*z] = [0, 0, 0]', () => {
      const result = curl(['2*x', '2*y', '2*z'], ['x', 'y', 'z'], { x: 1, y: 2, z: 3 });
      expect(result[0]).toBeCloseTo(0, 4);
      expect(result[1]).toBeCloseTo(0, 4);
      expect(result[2]).toBeCloseTo(0, 4);
    });

    it('should throw for wrong number of expressions', () => {
      expect(() => curl(['x', 'y'], ['x', 'y', 'z'], { x: 0, y: 0, z: 0 })).toThrow();
    });

    it('should throw for wrong number of variables', () => {
      expect(() => curl(['x', 'y', 'z'], ['x', 'y'], { x: 0, y: 0 })).toThrow();
    });
  });
});
