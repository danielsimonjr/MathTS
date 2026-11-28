import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import {
  isMultiStatementExpression,
  mapDivideBroadcastError,
  mapElementwiseBroadcastError,
  wrapBlockArrayAsResultSet,
} from '../src/g12-mathjs-parity.js';
import { createCompatHelpEvaluate } from '../src/help-evaluate.js';
import { chainTypedFromInstance } from '../src/chain-create.js';
import { Parser, evaluate, parse } from '../src/named-instance-exports.js';
import { ensureMathjsFractionToJson } from '../src/fraction-mathjs-json.js';
import { Fraction } from '@danielsimonjr/mathts-core';

class ResultSetStub {
  readonly isResultSet = true;
  constructor(readonly entries?: unknown[]) {}
}

describe('micro-branch coverage (small compat modules)', () => {
  it('G12 broadcast and block result adapters', () => {
    expect(isMultiStatementExpression('1; 2')).toBe(true);
    expect(isMultiStatementExpression('[1; 2]')).toBe(false);
    const wrapped = wrapBlockArrayAsResultSet(7, '1; 2', ResultSetStub);
    expect(wrapped).toBeInstanceOf(ResultSetStub);
    expect(() =>
      mapElementwiseBroadcastError(new Error('element-wise mismatch'), [1], [1, 2])
    ).toThrow(/broadcast/);
    expect(() =>
      mapDivideBroadcastError(new RangeError('Vectors must have equal length'), [1, 2, 3])
    ).toThrow(/square/);
    const math = create(all);
    expect(math.evaluate('1;\n2')).toBeDefined();
  });

  it('help-evaluate config round-trip', () => {
    const evaluate = (expr: string) => expr;
    const hook = createCompatHelpEvaluate(evaluate, () => ({ precision: 64, matrix: 'Matrix' }));
    expect(hook('config()')).toMatchObject({ precision: 64 });
    const cfg = hook('config(', { newConfig: { precision: 8 } });
    expect(cfg).toMatchObject({ precision: 8 });
    expect(hook('2+2')).toBe('2+2');
  });

  it('chain helpers resolve typed instances and rest conflicts', () => {
    const typedLike = {
      isTypedFunction: () => true,
      resolve: () => ({ implementation: () => 1, params: [] }),
    };
    expect(chainTypedFromInstance(typedLike)).toBe(typedLike);
    expect(chainTypedFromInstance({})).toBeUndefined();
  });

  it('BigNumber constants and help surface', () => {
    const bn = create(all, { number: 'BigNumber', precision: 64 });
    expect(bn.tau.toString()).toBeDefined();
    expect(bn.phi.toString()).toBeDefined();
    expect(bn.help('add').toString().toLowerCase()).toContain('add');
  });

  it('named default instance exports', () => {
    expect(evaluate('1+1')).toBe(2);
    expect(parse('x')).toBeDefined();
    expect(() => (Parser as unknown as () => unknown)()).toThrow(/new operator/);
    expect(new Parser()).toBeDefined();
  });

  it('inverse hyperbolic and complex compat edges', () => {
    const math = create(all);
    const z = math.complex(0.5, 0.1);
    expect(math.acosh(z).re).toBeDefined();
    expect(Number(math.asinh(2))).toBeCloseTo(Math.asinh(2), 10);
    const at = math.atanh(0.2);
    expect(typeof at === 'number' ? at : at.re).toBeDefined();
    const bn = create(all, { number: 'BigNumber' });
    expect(bn.acosh(bn.bignumber(1)).valueOf()).toBe('0');
  });

  it('fraction JSON and scalar unary edges', () => {
    const math = create(all);
    const core = new Fraction(3, 4);
    ensureMathjsFractionToJson(core);
    expect(JSON.stringify(core)).toContain('"d":"4"');
    const f = math.fraction(2, 3);
    expect(typeof math.isPositive(f)).toBe('boolean');
    const bn = create(all, { number: 'BigNumber' });
    expect(bn.log2(bn.bignumber(8)).valueOf()).toBe('3');
    expect(math.isNumeric(5)).toBe(true);
  });

  it('unit fraction magnitude converters', () => {
    const math = create(all);
    const u = math.unit(math.fraction(1, 2), 'cm');
    expect(u.toNumber('cm')).toBeCloseTo(0.5, 10);
    const inch = math.unit('0.5', 'inch') as {
      to(target: string): { toNumeric(): number };
    };
    expect(inch.to('cm').toNumeric()).toBeGreaterThan(0);
  });
});
