import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import * as compat from '../src/index.js';

describe('named MathJS symbols', () => {
  it('exposes the expected type predicates and constructors for units and syntax trees', () => {
    const math = compat.create(compat.all);
    const unit = new compat.Unit(2, 'm');
    const symbol = new compat.SymbolNode('x');
    expect(compat.isUnit(unit)).toBe(oracle.isUnit(new oracle.Unit(2, 'm')));
    expect(compat.isUnit(math.unit('2 m'))).toBe(true);
    expect(compat.isSymbolNode(symbol)).toBe(oracle.isSymbolNode(new oracle.SymbolNode('x')));
    expect(compat.isOperatorNode(math.parse('1+2'))).toBe(true);
    expect(compat.isCollection(math.matrix([1, 2]))).toBe(true);
  });

  it('can construct a dependency factory from a named import', () => {
    const fixture = compat.factory('answer', [], () => 42);
    const math = compat.create({ fixture }) as unknown as { answer: number };
    expect(math.answer).toBe(42);
  });
});
