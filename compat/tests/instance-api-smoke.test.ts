import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { isCompatMathInstance } from '../src/instance-api.js';
import { createCompatRandomInstance } from '../src/mathjs-parity-errors.js';

describe('instance-api smoke', () => {
  it('marks compat instances and guards random arity', () => {
    const math = create(all);
    expect(isCompatMathInstance(math)).toBe(true);
    expect(isCompatMathInstance({})).toBe(false);
    const rnd = createCompatRandomInstance(math.random.bind(math));
    const matrixArg = math.matrix([
      [1, 2],
      [3, 4],
    ]);
    expect(() => rnd(matrixArg, 1, 2, 3)).toThrow(/Too many arguments/);
    expect(rnd(matrixArg, 2, 3)).toBeDefined();
    math.import({ customApiSmoke: () => 1 });
    expect(typeof (math as Record<string, unknown>).customApiSmoke).toBe('function');
    const parser = math.parser();
    expect(parser.evaluate('2+2')).toBe(4);
  });
});