/**
 * Regression tests for mathjs 15.3.0 `format` / `print` parity (#1778).
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

const math = create(all);

describe('#1778 format precision and notation', () => {
  it('engineering notation does not inherit config precision for plain numbers', () => {
    expect(math.format(0.1234567, { notation: 'engineering' })).toBe('123.4567e-3');
    expect(math.format(math.bignumber(0.1234567), { notation: 'engineering' })).toBe('123.4567e-3');
  });

  it('fixed complex parts stay compact without explicit precision', () => {
    const value = math.divide(math.complex(6, 9), 3);
    expect(math.format(value, { notation: 'fixed' })).toBe('2 + 3i');
    expect(math.format(math.complex(2, 3), { precision: 64 })).toBe('2 + 3i');
  });

  it('format(bignumber) without options uses instance precision', () => {
    const inst = create(all, { number: 'BigNumber', precision: 5 });
    expect(inst.format(inst.bignumber('1.23456789'))).toBe('1.2346');
  });

  it('rejects wrong arity like mathjs', () => {
    expect(() => math.format()).toThrow(/Too few arguments/);
    expect(() => math.format(1, 2, 3)).toThrow(/Too many arguments/);
  });
});

describe('#1778 print templates', () => {
  it('leaves trailing period after matrix placeholders', () => {
    expect(math.print('Hello $0.', math.matrix(['user']))).toBe('Hello user.');
    expect(
      math.print(
        'Values: $0, $1',
        math.matrix([
          [1, 2],
          [3, 4],
        ])
      )
    ).toBe('Values: [1, 2], [3, 4]');
  });

  it('rejects wrong arity like mathjs', () => {
    expect(() => math.print()).toThrow(/Too few arguments/);
    expect(() => math.print('')).toThrow(/Too few arguments/);
    expect(() => math.print('', {}, 6, 2)).toThrow(/Too many arguments/);
  });

  it('evaluate print uses one-based template indices via the transform', () => {
    expect(math.evaluate("print('I like $1', ['pizza'])")).toBe('I like pizza');
    expect(math.evaluate("print('I like $food', {food:'pizza'})")).toBe('I like pizza');
  });
});
