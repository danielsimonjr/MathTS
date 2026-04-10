import { describe, it, expect } from 'vitest';
import {
  polyval,
  polyadd,
  polymul,
  polyder,
  polynomialGCD,
  polynomialLCM,
  polynomialQuotient,
  polynomialRemainder,
  degree,
  coefficientList,
  discriminant,
  differences,
  expand,
  factor,
  collect,
  substitute,
  variables,
  cancel,
  together,
  apart,
  trigExpand,
  trigReduce,
  trigToExp,
  expToTrig,
  tangentLine,
  reduce,
  combine,
  complexExpand,
  normalForm,
  powerExpand,
  fullSimplify,
  element,
  eliminate,
  symbolicPartialDerivative,
  functionExpand,
  resultant,
} from '../src/typed/algebra.js';

// =============================================================================
// Polynomial Operations
// =============================================================================

describe('polyval', () => {
  it('should evaluate constant polynomial', () => {
    expect(polyval([5], 10)).toBe(5);
  });

  it('should evaluate linear polynomial', () => {
    // 2 + 3x at x=4 => 2 + 12 = 14
    expect(polyval([2, 3], 4)).toBe(14);
  });

  it('should evaluate quadratic polynomial', () => {
    // 1 + 2x + 3x^2 at x=2 => 1 + 4 + 12 = 17
    expect(polyval([1, 2, 3], 2)).toBe(17);
  });

  it('should evaluate at x=0', () => {
    expect(polyval([7, 3, 1], 0)).toBe(7);
  });

  it('should return 0 for empty coefficients', () => {
    expect(polyval([], 5)).toBe(0);
  });

  it('should handle negative coefficients', () => {
    // 1 + 0x - x^2 at x=3 => 1 + 0 - 9 = -8
    expect(polyval([1, 0, -1], 3)).toBe(-8);
  });
});

describe('polyadd', () => {
  it('should add same-degree polynomials', () => {
    expect(polyadd([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
  });

  it('should add different-degree polynomials', () => {
    expect(polyadd([1, 2], [3, 4, 5])).toEqual([4, 6, 5]);
  });

  it('should trim trailing zeros', () => {
    expect(polyadd([1, 2, 3], [-1, -2, -3])).toEqual([0]);
  });
});

describe('polymul', () => {
  it('should multiply (1+x)*(1+x) = 1+2x+x^2', () => {
    expect(polymul([1, 1], [1, 1])).toEqual([1, 2, 1]);
  });

  it('should multiply by constant', () => {
    expect(polymul([1, 2, 3], [2])).toEqual([2, 4, 6]);
  });

  it('should multiply (x-1)*(x+1) = x^2-1', () => {
    expect(polymul([-1, 1], [1, 1])).toEqual([-1, 0, 1]);
  });

  it('should handle empty arrays', () => {
    expect(polymul([], [1, 2])).toEqual([0]);
  });
});

describe('polyder', () => {
  it('should compute first derivative', () => {
    // d/dx(1 + 2x + 3x^2) = 2 + 6x
    expect(polyder([1, 2, 3])).toEqual([2, 6]);
  });

  it('should compute second derivative', () => {
    // d^2/dx^2(1 + 2x + 3x^2 + 4x^3) = 6 + 24x
    expect(polyder([1, 2, 3, 4], 2)).toEqual([6, 24]);
  });

  it('should return [0] for constant', () => {
    expect(polyder([5])).toEqual([0]);
  });

  it('should return [0] for over-differentiation', () => {
    expect(polyder([1, 2], 5)).toEqual([0]);
  });

  it('should throw for negative order', () => {
    expect(() => polyder([1, 2], -1)).toThrow();
  });
});

describe('polynomialGCD', () => {
  it('should find GCD of x^2-1 and x-1', () => {
    // GCD is x-1 (monic)
    const gcd = polynomialGCD([-1, 0, 1], [-1, 1]);
    expect(gcd.length).toBe(2);
    expect(gcd[1]).toBe(1); // monic
    expect(gcd[0]).toBeCloseTo(-1, 10);
  });

  it('should return monic result for coprime polynomials', () => {
    // x+1 and x+2 are coprime
    const gcd = polynomialGCD([1, 1], [2, 1]);
    expect(gcd).toEqual([1]);
  });
});

describe('polynomialLCM', () => {
  it('should compute LCM of (x-1) and (x+1)', () => {
    const lcm = polynomialLCM([-1, 1], [1, 1]);
    // LCM should be x^2-1 (monic)
    expect(lcm.length).toBe(3);
    expect(lcm[2]).toBe(1);
    expect(lcm[0]).toBeCloseTo(-1, 10);
  });
});

describe('polynomialQuotient / polynomialRemainder', () => {
  it('should divide x^2-1 by x-1 giving x+1 remainder 0', () => {
    const q = polynomialQuotient([-1, 0, 1], [-1, 1]);
    expect(q.length).toBe(2);
    expect(q[0]).toBeCloseTo(1, 10);
    expect(q[1]).toBeCloseTo(1, 10);

    const r = polynomialRemainder([-1, 0, 1], [-1, 1]);
    expect(r).toEqual([0]);
  });

  it('should handle non-exact division', () => {
    // (x^2 + 1) / (x - 1) = x + 1 remainder 2
    const q = polynomialQuotient([1, 0, 1], [-1, 1]);
    expect(q[0]).toBeCloseTo(1, 10);
    expect(q[1]).toBeCloseTo(1, 10);

    const r = polynomialRemainder([1, 0, 1], [-1, 1]);
    expect(r[0]).toBeCloseTo(2, 10);
  });
});

describe('degree', () => {
  it('should return 2 for quadratic', () => {
    expect(degree([1, 2, 3])).toBe(2);
  });

  it('should return 0 for constant', () => {
    expect(degree([5])).toBe(0);
  });

  it('should return 0 for zero polynomial', () => {
    expect(degree([0])).toBe(0);
  });

  it('should ignore trailing zeros', () => {
    expect(degree([1, 2, 0, 0])).toBe(1);
  });
});

describe('coefficientList', () => {
  it('should trim trailing zeros', () => {
    expect(coefficientList([1, 2, 0, 0])).toEqual([1, 2]);
  });

  it('should preserve non-zero coefficients', () => {
    expect(coefficientList([0, 1, 2])).toEqual([0, 1, 2]);
  });
});

describe('discriminant', () => {
  it('should compute discriminant of quadratic x^2-1', () => {
    // coeffs: [-1, 0, 1] => a=1, b=0, c=-1 => disc = 0 - 4*1*(-1) = 4
    expect(discriminant([-1, 0, 1])).toBe(4);
  });

  it('should compute discriminant of x^2+x+1 (negative)', () => {
    // a=1, b=1, c=1 => disc = 1 - 4 = -3
    expect(discriminant([1, 1, 1])).toBe(-3);
  });

  it('should return 1 for linear polynomial', () => {
    expect(discriminant([1, 2])).toBe(1);
  });

  it('should throw for constant', () => {
    expect(() => discriminant([5])).toThrow();
  });

  it('should compute cubic discriminant', () => {
    // x^3 - 3x + 2 = (x-1)^2(x+2) => discriminant = 0
    expect(discriminant([2, -3, 0, 1])).toBeCloseTo(0, 8);
  });
});

describe('differences', () => {
  it('should compute first differences of squares', () => {
    expect(differences([1, 4, 9, 16])).toEqual([3, 5, 7]);
  });

  it('should compute second differences of squares', () => {
    expect(differences([1, 4, 9, 16], 2)).toEqual([2, 2]);
  });

  it('should compute third differences of cubes', () => {
    expect(differences([0, 1, 8, 27, 64], 3)).toEqual([6, 6]);
  });

  it('should return empty for over-differencing', () => {
    expect(differences([1, 2], 5)).toEqual([]);
  });

  it('should throw for negative order', () => {
    expect(() => differences([1, 2], -1)).toThrow();
  });
});

// =============================================================================
// Expression Manipulation
// =============================================================================

describe('variables', () => {
  it('should extract variables from expression', () => {
    expect(variables('x^2 + 2*y + sin(z)')).toEqual(['x', 'y', 'z']);
  });

  it('should exclude math keywords', () => {
    expect(variables('pi * r^2')).toEqual(['r']);
  });

  it('should handle expression with no variables', () => {
    expect(variables('sin(pi) + cos(e)')).toEqual([]);
  });

  it('should sort alphabetically', () => {
    expect(variables('c + b + a')).toEqual(['a', 'b', 'c']);
  });
});

describe('substitute', () => {
  it('should substitute single variable', () => {
    expect(substitute('x^2 + y', { x: '3', y: '1' })).toBe('3^2 + 1');
  });

  it('should substitute with expressions', () => {
    expect(substitute('a*b + c', { a: '(x+1)' })).toBe('(x+1)*b + c');
  });

  it('should not replace partial matches', () => {
    expect(substitute('xy + x', { x: '1' })).toBe('xy + 1');
  });
});

describe('expand', () => {
  it('should expand (a+b)*(c+d)', () => {
    const result = expand('(a+b)*(c+d)');
    expect(result).toContain('a*c');
    expect(result).toContain('a*d');
    expect(result).toContain('b*c');
    expect(result).toContain('b*d');
  });

  it('should expand (x)^2 into (x)*(x)', () => {
    const result = expand('(a+b)^2');
    expect(result).toContain('a*a');
  });
});

describe('factor', () => {
  it('should factor out common numeric coefficient', () => {
    expect(factor('6*x + 4*y')).toBe('2*(3*x + 2*y)');
  });

  it('should return unchanged if no common factor', () => {
    expect(factor('3*x + 5*y')).toBe('3*x + 5*y');
  });
});

describe('collect', () => {
  it('should collect like terms', () => {
    const result = collect('2*x + 3*x + 5', 'x');
    expect(result).toContain('5*x');
    expect(result).toContain('5');
  });
});

describe('cancel', () => {
  it('should cancel numeric fractions', () => {
    expect(cancel('6/4')).toBe('3/2');
  });

  it('should simplify to integer', () => {
    expect(cancel('10/5')).toBe('2');
  });
});

describe('together', () => {
  it('should combine two fractions', () => {
    // 1/2 + 1/3 = 5/6
    expect(together('1/2 + 1/3')).toBe('5/6');
  });
});

describe('apart', () => {
  it('should decompose improper fraction', () => {
    // 7/3 => 2 + 1/3
    expect(apart('7/3')).toBe('2 + 1/3');
  });

  it('should handle exact division', () => {
    expect(apart('6/3')).toBe('2');
  });
});

describe('trigExpand', () => {
  it('should expand sin(2*x)', () => {
    expect(trigExpand('sin(2*x)')).toBe('2*sin(x)*cos(x)');
  });

  it('should expand cos(2*x)', () => {
    expect(trigExpand('cos(2*x)')).toBe('cos(x)^2 - sin(x)^2');
  });

  it('should expand sin(a+b)', () => {
    const result = trigExpand('sin(a+b)');
    expect(result).toBe('sin(a)*cos(b) + cos(a)*sin(b)');
  });
});

describe('trigReduce', () => {
  it('should reduce sin(x)*cos(x)', () => {
    expect(trigReduce('sin(x)*cos(x)')).toBe('sin(2*x)/2');
  });

  it('should reduce sin^2 + cos^2 to 1', () => {
    expect(trigReduce('sin(x)^2 + cos(x)^2')).toBe('1');
  });

  it('should reduce cos^2 - sin^2', () => {
    expect(trigReduce('cos(x)^2 - sin(x)^2')).toBe('cos(2*x)');
  });
});

describe('trigToExp', () => {
  it('should convert sin to exponential', () => {
    const result = trigToExp('sin(x)');
    expect(result).toContain('exp(i*x)');
    expect(result).toContain('exp(-i*x)');
  });

  it('should convert cos to exponential', () => {
    const result = trigToExp('cos(x)');
    expect(result).toContain('exp(i*x)');
  });
});

describe('expToTrig', () => {
  it('should convert exp(i*x) to trig', () => {
    expect(expToTrig('exp(i*x)')).toBe('(cos(x) + i*sin(x))');
  });

  it('should convert exp(-i*x) to trig', () => {
    expect(expToTrig('exp(-i*x)')).toBe('(cos(x) - i*sin(x))');
  });
});

// =============================================================================
// Other Functions
// =============================================================================

describe('tangentLine', () => {
  it('should compute tangent to x^2 at x=3', () => {
    const [slope, intercept] = tangentLine((x) => x ** 2, 3);
    expect(slope).toBeCloseTo(6, 4);
    expect(intercept).toBeCloseTo(-9, 4);
  });

  it('should compute tangent to x^3 at x=1', () => {
    const [slope, intercept] = tangentLine((x) => x ** 3, 1);
    expect(slope).toBeCloseTo(3, 4);
    expect(intercept).toBeCloseTo(-2, 4);
  });
});

describe('reduce', () => {
  it('should evaluate numeric expression', () => {
    expect(reduce('2 + 3')).toBe('5');
  });

  it('should evaluate with exponents', () => {
    expect(reduce('2^3')).toBe('8');
  });

  it('should pass through non-numeric expressions', () => {
    expect(reduce('x + y')).toBe('x + y');
  });
});

describe('combine', () => {
  it('should combine two expressions', () => {
    expect(combine('x^2', '2*y')).toBe('x^2 + 2*y');
  });
});

describe('complexExpand', () => {
  it('should replace i^2 with -1', () => {
    expect(complexExpand('a + b*i^2')).toBe('a + b*(-1)');
  });

  it('should replace i*i with -1', () => {
    expect(complexExpand('a + b*i*i')).toBe('a + b*(-1)');
  });
});

describe('normalForm', () => {
  it('should sort terms alphabetically', () => {
    expect(normalForm('c + a + b')).toBe('a + b + c');
  });
});

describe('powerExpand', () => {
  it('should expand (a*b)^3', () => {
    expect(powerExpand('(a*b)^3')).toBe('a^3 * b^3');
  });

  it('should expand (a^2)^3', () => {
    expect(powerExpand('(a^2)^3')).toBe('a^6');
  });
});

describe('fullSimplify', () => {
  it('should remove multiplication by 1', () => {
    expect(fullSimplify('1 * x')).toBe('x');
  });

  it('should remove addition of 0', () => {
    expect(fullSimplify('x + 0')).toBe('x');
  });

  it('should simplify x^1 to x', () => {
    expect(fullSimplify('x^1')).toBe('x');
  });

  it('should simplify x^0 to 1', () => {
    expect(fullSimplify('x^0')).toBe('1');
  });
});

describe('element', () => {
  it('should extract element at index', () => {
    expect(element([10, 20, 30], 1)).toBe(20);
  });

  it('should throw for out of bounds', () => {
    expect(() => element([1, 2], 5)).toThrow();
  });

  it('should throw for negative index', () => {
    expect(() => element([1, 2], -1)).toThrow();
  });
});

describe('eliminate', () => {
  it('should eliminate variable from system', () => {
    const result = eliminate(
      ['2*x + 3*y = 5', 'x + y = 2'],
      'x',
    );
    expect(result.length).toBe(1);
    expect(result[0]).toContain('x eliminated');
  });

  it('should preserve equations without the variable', () => {
    const result = eliminate(['x + y = 1', 'z = 3', 'x - y = 0'], 'x');
    expect(result).toContain('z = 3');
  });
});

describe('symbolicPartialDerivative', () => {
  it('should differentiate x^2', () => {
    expect(symbolicPartialDerivative('x^2', 'x')).toBe('2*x^1');
  });

  it('should differentiate 3*x^2 + 2*y with respect to x', () => {
    expect(symbolicPartialDerivative('3*x^2 + 2*y', 'x')).toBe(
      '6*x^1 + 0',
    );
  });

  it('should differentiate sin(x)', () => {
    expect(symbolicPartialDerivative('sin(x)', 'x')).toBe('cos(x)');
  });

  it('should differentiate cos(x)', () => {
    expect(symbolicPartialDerivative('cos(x)', 'x')).toBe('-sin(x)');
  });

  it('should differentiate exp(x)', () => {
    expect(symbolicPartialDerivative('exp(x)', 'x')).toBe('exp(x)');
  });

  it('should differentiate ln(x)', () => {
    expect(symbolicPartialDerivative('ln(x)', 'x')).toBe('1/x');
  });

  it('should handle bare variable', () => {
    expect(symbolicPartialDerivative('x', 'x')).toBe('1');
  });
});

describe('functionExpand', () => {
  it('should expand exp(a+b)', () => {
    expect(functionExpand('exp(a+b)')).toBe('exp(a)*exp(b)');
  });

  it('should expand ln(a*b)', () => {
    expect(functionExpand('ln(a*b)')).toBe('ln(a) + ln(b)');
  });

  it('should expand ln(a/b)', () => {
    expect(functionExpand('ln(a/b)')).toBe('ln(a) - ln(b)');
  });

  it('should expand ln(a^3)', () => {
    expect(functionExpand('ln(a^3)')).toBe('3*ln(a)');
  });
});

describe('resultant', () => {
  it('should be 0 for polynomials sharing a root', () => {
    // x^2 - 1 and x - 1 share root x=1
    expect(resultant([-1, 0, 1], [-1, 1])).toBeCloseTo(0, 10);
  });

  it('should be non-zero for coprime polynomials', () => {
    // x+1 and x+2 are coprime
    expect(resultant([1, 1], [2, 1])).not.toBeCloseTo(0);
  });

  it('should handle constant polynomials', () => {
    expect(resultant([3], [5])).toBe(1);
  });
});
