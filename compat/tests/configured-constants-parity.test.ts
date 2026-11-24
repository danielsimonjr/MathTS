import { describe, expect, it } from 'vitest';
import { all as oracleAll, create as createOracle } from 'mathjs';
import { BigNumber, Unit } from '@danielsimonjr/mathts-core';
import { all, create } from '../src/index.js';
import { MATHJS_UNIT_CONSTANTS } from '../src/parity-names.generated.js';

describe('mathjs 15.2 instance constants and configuration', () => {
  it('matches own names and configured scalar constants', () => {
    for (const number of ['number', 'BigNumber', 'Fraction'] as const) {
      const math = create(all, { number, precision: 20 });
      const oracle = createOracle(oracleAll, { number, precision: 20 });
      expect(Object.keys(math).sort()).toEqual(Object.keys(oracle).sort());
      const constants = oracle as unknown as Record<string, unknown>;
      for (const key of [
        'E',
        'PI',
        'e',
        'pi',
        'tau',
        'phi',
        'SQRT2',
        'SQRT1_2',
        'LN2',
        'LN10',
        'LOG2E',
        'LOG10E',
        'Infinity',
        'NaN',
        'fineStructure',
        'sackurTetrode',
        'weakMixingAngle',
        'efimovFactor',
      ] as const) {
        expect(typeof math[key]).toBe(typeof constants[key]);
        expect(String(math[key])).toBe(String(constants[key]));
        expect(String(math.evaluate(key))).toBe(String(oracle.evaluate(key)));
      }
    }
  });

  it('shares live instance settings across direct reads, compiled expressions and imports', () => {
    const math = create(all, { number: 'BigNumber', precision: 20 });
    const peer = create(all, { number: 'BigNumber', precision: 7 });
    const compiled = math.compile('PI');
    expect(String(compiled.evaluate())).toBe(String(math.PI));
    expect(String(peer.PI)).toBe('3.141593');
    math.config({ precision: 28 });
    expect(String(compiled.evaluate())).toBe(String(math.PI));
    expect(String(math.PI)).toBe('3.141592653589793238462643383');
    expect(String(peer.PI)).toBe('3.141593');
    math.import({ PI: 3 }, { override: true });
    expect(math.evaluate('PI')).toBe(3);
    expect(math.evaluate('PI', { PI: 2 })).toBe(2);
    expect(peer.PI).toBeInstanceOf(BigNumber);
  });

  it('matches physical values using native Unit objects', () => {
    const math = create(all);
    const oracle = createOracle(oracleAll);
    const constants = oracle as unknown as Record<string, typeof oracle.speedOfLight>;
    for (const [name, , units] of MATHJS_UNIT_CONSTANTS) {
      const expected = constants[name].toNumber(units);
      const direct = math[name];
      const evaluated = math.evaluate(name);
      for (const value of [direct, evaluated]) {
        expect(value).toBeInstanceOf(Unit);
        expect(Number((value as typeof direct).toNumeric(units)) / expected).toBeCloseTo(1, 14);
      }
    }
  });

  it('uses BigNumber magnitudes for all configured physical constants', () => {
    const math = create(all);
    const oracle = createOracle(oracleAll);
    const constants = oracle as unknown as Record<string, typeof oracle.speedOfLight>;
    const compiled = math.compile('planckConstant');

    for (const precision of [10, 40]) {
      math.config({ number: 'BigNumber', precision });
      oracle.config({ number: 'BigNumber', precision });
      for (const [name, , units] of MATHJS_UNIT_CONSTANTS) {
        const expected = constants[name].toNumeric(units);
        const value = math[name].toNumeric(units);
        expect(value).toBeInstanceOf(BigNumber);
        expect(Number(value) / Number(expected)).toBeCloseTo(1, 8);
      }
      const evaluated = compiled.evaluate() as typeof math.planckConstant;
      expect(evaluated.toNumeric('J s')).toBeInstanceOf(BigNumber);
    }

    math.config({ number: 'Fraction' });
    expect(typeof math.planckConstant.toNumeric('J s')).toBe('number');
  });

  it('exposes live config properties and emits the same changes as mathjs', () => {
    const math = create(all);
    const oracle = createOracle(oracleAll);
    const actual: unknown[] = [];
    const expected: unknown[] = [];
    math.on('config', (current, previous, changes) =>
      actual.push([
        (current as { precision: number }).precision,
        (previous as { precision: number }).precision,
        changes,
      ])
    );
    const configOracle = oracle as unknown as {
      on(
        event: 'config',
        callback: (
          current: { precision: number },
          previous: { precision: number },
          changes: unknown
        ) => void
      ): void;
      config: typeof oracle.config & {
        precision: number;
        MATRIX_OPTIONS: string[];
        NUMBER_OPTIONS: string[];
      };
    };
    configOracle.on('config', (current, previous, changes) =>
      expected.push([current.precision, previous.precision, changes])
    );
    math.config({ precision: 23 });
    oracle.config({ precision: 23 });
    expect(math.config.precision).toBe(configOracle.config.precision);
    expect(actual).toEqual(expected);
    expect(math.config.MATRIX_OPTIONS).toEqual(configOracle.config.MATRIX_OPTIONS);
    expect(math.config.NUMBER_OPTIONS).toEqual(configOracle.config.NUMBER_OPTIONS);
  });
});
