import { describe, it, expect } from 'vitest';
import { compileExpr, createInstanceEvaluator, evaluate } from '../src/factories/evaluate.js';

/**
 * The module-level `evaluate` / `compileExpr` and the instance pair from
 * `createInstanceEvaluator` share one body. Each test runs the same call on both and compares.
 */
describe('instance evaluator matches the module-level evaluator', () => {
  const instance = createInstanceEvaluator({ twice: (v: number) => 2 * v });

  it('evaluates one expression and an array of expressions', () => {
    expect(instance.evaluate('2 * x^2 + sin(y)', { x: 1.7, y: 0.3 })).toBe(
      evaluate('2 * x^2 + sin(y)', { x: 1.7, y: 0.3 })
    );
    expect(instance.evaluate(['1/3', 'sqrt(2) * pi'])).toEqual(evaluate(['1/3', 'sqrt(2) * pi']));
  });

  it('sees the imported scope only on the instance', () => {
    expect(instance.evaluate('twice(x) / 4', { x: 3 })).toBe(1.5);
    expect(instance.compile('twice(x) + y').evaluate({ x: 3, y: 1 })).toBe(7);
    expect(() => evaluate('twice(3)')).toThrow();
  });

  it('applies the physics and unsafe options', () => {
    const physics = { physics: true, charge: 'scalar' } as const;
    expect(instance.evaluate('1 - e0^2', {}, physics)).toBe(evaluate('1 - e0^2', {}, physics));
    expect(instance.compile('1 - e0^2', physics).evaluate()).toBe(
      compileExpr('1 - e0^2', physics).evaluate()
    );
    expect(instance.evaluate('twice(1) + 2', {}, { unsafe: true })).toBe(4);
    expect(instance.compile('x / 7', { unsafe: true }).evaluate({ x: 1 })).toBe(
      compileExpr('x / 7', { unsafe: true }).evaluate({ x: 1 })
    );
  });

  it('keeps the throw order: evaluate checks options first, compile parses first', () => {
    const bad = { charge: 'bad' } as unknown as { charge: 'unit' };
    for (const run of [evaluate, instance.evaluate]) {
      expect(() => run('1 +', {}, bad)).toThrow(TypeError);
      expect(() => run('1 +', {}, bad)).toThrow('charge must be "unit" or "scalar"');
    }
    for (const compile of [compileExpr, instance.compile]) {
      expect(() => compile('1 +', bad)).toThrow(SyntaxError);
      expect(() => compile('1', bad)).toThrow('charge must be "unit" or "scalar"');
    }
  });
});

describe('createInstanceEvaluator hidden names (#1216)', () => {
  it('does not resolve a hidden name, safe or unsafe; the module scope keeps it', () => {
    const hidden = createInstanceEvaluator({}, ['GL4_A', 'sin']);
    expect(() => hidden.evaluate('GL4_A')).toThrow();
    expect(() => hidden.evaluate('sin(0)')).toThrow();
    expect(() => hidden.evaluate('sin(0)', {}, { unsafe: true })).toThrow();
    expect(() => hidden.compile('GL4_A').evaluate()).toThrow();
    expect(hidden.evaluate('cos(0)')).toBe(1);
    expect(evaluate('sin(0)')).toBe(0);
    expect(() => evaluate('GL4_A')).not.toThrow();
  });

  it('resolves an imported name that is in the hidden list', () => {
    const imported = createInstanceEvaluator({ GL4_A: 5 }, ['GL4_A']);
    expect(imported.evaluate('GL4_A')).toBe(5);
  });
});
