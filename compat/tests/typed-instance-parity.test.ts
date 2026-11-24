import { describe, expect, it } from 'vitest';
import { all as oracleAll, create as createOracle } from 'mathjs';
import { all, create } from '../src/index.js';

describe('compat typed registries', () => {
  it('keeps custom registrations and conversions in the owning instance', () => {
    const math = create(all);
    const other = create(all);
    const oracle = createOracle(oracleAll);
    const otherOracle = createOracle(oracleAll);
    const oracleTyped = oracle.typed as typeof math.typed;
    const box = { value: 7 };
    const boxType = {
      name: 'CompatBox',
      test: (value: unknown) => value === box,
    };
    const toNumber = { from: 'CompatBox', to: 'number', convert: () => box.value };
    math.typed.addType(boxType);
    math.typed.addConversion(toNumber);
    oracleTyped.addType(boxType);
    oracleTyped.addConversion(toNumber);

    const signatures = { CompatBox: () => 'box' };
    expect(math.typed('inspect', signatures)(box)).toBe(oracleTyped('inspect', signatures)(box));
    expect(() => otherOracle.typed('inspect', signatures)).toThrow();
    expect(() => other.typed('inspect', signatures)).toThrow();
    expect(math.typed.convert(box, 'number')).toBe(oracleTyped.convert(box, 'number'));
    expect(() => other.typed.convert(box, 'number')).toThrow();

    math.import({ inspect: math.typed('inspect', signatures) });
    expect(math.evaluate('inspect(box)', { box })).toBe('box');
  });

  it('retains the factory Node signatures and string conversion', () => {
    const math = create(all);
    const inspect = math.typed('inspect', {
      Node: (node: { toString(): string }) => node.toString(),
    });
    expect(inspect(math.parse('x+1'))).toBe('x + 1');
    expect(inspect('x+1')).toBe('x + 1');
  });
});
