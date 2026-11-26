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

  it('exports the MathJS documentation catalog and fraction help', () => {
    const upstreamDocs = Reflect.get(oracle, 'docs') as typeof compat.docs;
    expect(Object.keys(oracle).filter((name) => !Object.hasOwn(compat, name))).toEqual([]);
    expect(Object.keys(compat.docs).sort()).toEqual(Object.keys(upstreamDocs).sort());
    const math = compat.create(compat.all);
    for (const name of ['num', 'den'] as const) {
      const doc = compat.docs[name] as { name: string };
      const upstream = upstreamDocs[name] as { name: string };
      expect(doc.name).toBe(upstream.name);
      expect(compat.help(name).toJSON().name).toBe(name);
      const call = `${name}(fraction(-2, 3))`;
      expect(math.evaluate(call)).toBe(oracle.evaluate(call));
    }
    expect(Object.hasOwn(compat.create(compat.all), 'docs')).toBe(
      Object.hasOwn(oracle.create(oracle.all), 'docs')
    );
  });

  it('can construct a dependency factory from a named import', () => {
    const fixture = compat.factory('answer', [], () => 42);
    const math = compat.create({ fixture }) as unknown as { answer: number };
    expect(math.answer).toBe(42);
  });
});
