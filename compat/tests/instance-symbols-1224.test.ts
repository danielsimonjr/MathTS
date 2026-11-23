import { describe, expect, it } from 'vitest';
import { all as referenceAll, create as createReference } from 'mathjs';
import { all, create } from '../src/index.js';

describe('mathjs instance symbols (#997, #1224)', () => {
  const math = create(all);
  const reference = createReference(referenceAll);

  it('exposes every own name of the reference instance', () => {
    expect(Object.keys(reference).filter((name) => !Object.hasOwn(math, name))).toEqual([]);
    expect(math.PI).toBe(math.pi);
    expect(math.E).toBe(math.e);
    expect(math.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('reuses the runtime constructors for values produced by the instance', () => {
    const m = math.matrix([[1, 2]]);
    const s = math.sparse([[1, 0]]);
    expect(m).toBeInstanceOf(math.Matrix);
    expect(m).toBeInstanceOf(math.DenseMatrix);
    expect(s).toBeInstanceOf(math.SparseMatrix);
    expect(math.isDenseMatrix(m)).toBe(true);
    expect(math.isSparseMatrix(s)).toBe(true);
    const node = math.parse('1 + 2');
    expect(node).toBeInstanceOf(math.Node);
    expect(node).toBeInstanceOf(math.OperatorNode);
    expect(math.isOperatorNode(node)).toBe(true);
    const range = new math.Range(0, 3);
    expect(math.isRange(range)).toBe(true);
    expect(math.isRange({ isRange: true })).toBe(false);
    const { Range: ReferenceRange } = reference as unknown as { Range: typeof math.Range };
    expect(math.isRange(new ReferenceRange(0, 3))).toBe(true);
    expect(math.unit('1 m')).toBeInstanceOf(math.Unit);
    expect(math.isUnit(new math.Unit(1, 'm'))).toBe(true);
    expect(math.index(0)).toBeInstanceOf(math.Index);
    expect(math.help('sin')).toBeInstanceOf(math.Help);
    expect(math.isChain(math.chain(1))).toBe(true);
    expect(String(new math.Complex('1+2i'))).toBe(String(reference.complex('1+2i')));
  });

  it('extracts reduced bigint fraction parts from scalar and collection values', () => {
    expect(math.num(math.fraction(-8, 6))).toBe(-4n);
    expect(math.den(math.fraction(-8, 6))).toBe(3n);
    expect(math.num([true, 10n, 0.42])).toEqual([1n, 10n, 21n]);
    expect(math.num(math.bignumber('0.333333333333333333') as never)).toBe(333333333333333333n);
    const matrix = math.sparse([[0.5, 0]]);
    expect((math.den(matrix) as { toArray(): unknown }).toArray()).toEqual([[2n, 1n]]);
    expect(math.evaluate('den(fraction(8, 6))')).toBe(3n);
  });

  it('binds the Parser, factory imports and event listeners to one instance', () => {
    const instance = math.create(all);
    const names: unknown[] = [];
    const listener = (name: unknown) => names.push(name);
    instance.once('import', listener);
    instance.import(instance.factory('triple', [], () => (x: number) => x * 3));
    instance.import({ quadruple: (x: number) => x * 4 });
    expect(names).toEqual(['triple']);
    const parser = new instance.Parser();
    expect(parser.evaluate('triple(4)')).toBe(12);
    expect(instance.parser()).toBeInstanceOf(instance.Parser);
    expect(() => math.evaluate('triple(4)')).toThrow();
  });
});
