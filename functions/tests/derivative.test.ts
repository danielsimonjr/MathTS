import { describe, it, expect } from 'vitest';
import { derivative, parse } from '../src/index.js';

describe('derivative', () => {
  it('should compute derivative with order 0 (return original expression)', () => {
    const expr = 'x^3 + 2*x';
    const result = derivative(expr, 'x', { order: 0 });
    expect(result.toString()).toBe(parse(expr).toString());
  });

  it('should compute derivative with order 1 (default)', () => {
    const expr = 'x^3';
    const result = derivative(expr, 'x');
    expect(result.toString()).toBe('3 * x ^ 2');

    const resultOrder1 = derivative(expr, 'x', { order: 1 });
    expect(resultOrder1.toString()).toBe('3 * x ^ 2');
  });

  it('should compute derivative with order 2', () => {
    const expr = 'x^3';
    const result = derivative(expr, 'x', { order: 2 });
    expect(result.toString()).toBe('6 * x');
  });

  it('should compute derivative with order 3', () => {
    const expr = 'x^3';
    const result = derivative(expr, 'x', { order: 3 });
    expect(result.toString()).toBe('6');
  });

  it('should throw an error for negative order', () => {
    expect(() => {
      derivative('x^3', 'x', { order: -1 });
    }).toThrow(TypeError('Option "order" must be a non-negative integer'));
  });

  it('should throw an error for non-integer order', () => {
    expect(() => {
      derivative('x^3', 'x', { order: 1.5 });
    }).toThrow(TypeError('Option "order" must be a non-negative integer'));
  });
});
