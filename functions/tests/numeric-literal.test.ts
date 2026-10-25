import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileScalar } from '../src/scalar-compile.js';
import { NUMERIC_LITERAL, ScalarEvalError, evaluateScalar, scalar } from '../src/scalar-eval.js';
import * as barrel from '../src/index.js';

const accepted: Array<[string, number]> = [
  ['1', 1],
  ['+1.5', 1.5],
  ['-.5', -0.5],
  ['1e-3', 0.001],
  ['1.', 1],
  ['.5e+2', 50],
  ['2', 2],
  ['1e3', 1000],
];

const rejectedNoMatch = ['', '.', 'e5', '1e', '0x10', ' 1', 'Infinity', 'NaN', '1_0'] as const;

const rejectedMatchNotFinite = '1e309';

function expectNoValue(name: string): void {
  expect(() => evaluateScalar(scalar.symbol(name))).toThrow(ScalarEvalError);
  expect(() => evaluateScalar(scalar.symbol(name))).toThrow(/no value/);
  expect(() => compileScalar(scalar.symbol(name), { variables: [] })).toThrow(ScalarEvalError);
  expect(() => compileScalar(scalar.symbol(name), { variables: [] })).toThrow(/no value/);
}

describe('NUMERIC_LITERAL', () => {
  it('accepts decimal spellings in both evaluators', () => {
    for (const [name, value] of accepted) {
      expect(NUMERIC_LITERAL.test(name)).toBe(true);
      expect(Number.isFinite(Number(name))).toBe(true);
      expect(evaluateScalar(scalar.symbol(name))).toBe(value);
      const batch = compileScalar(scalar.symbol(name), { variables: [] }).evaluate([]);
      expect(batch.valid[0]).toBe(1);
      expect(batch.values[0]).toBe(value);
    }
  });

  it('rejects non-matching and non-finite literal spellings', () => {
    for (const name of rejectedNoMatch) {
      expect(NUMERIC_LITERAL.test(name)).toBe(false);
      expectNoValue(name);
    }
    expect(NUMERIC_LITERAL.test(rejectedMatchNotFinite)).toBe(true);
    expect(Number.isFinite(Number(rejectedMatchNotFinite))).toBe(false);
    expectNoValue(rejectedMatchNotFinite);
  });

  it('prefers scope/constants over numeric literal binding', () => {
    expect(evaluateScalar(scalar.symbol('2'), { '2': 9 })).toBe(9);
    expect(
      compileScalar(scalar.symbol('2'), { variables: [], constants: { '2': 9 } }).evaluate([])
        .values[0]
    ).toBe(9);
  });

  it('is defined once in scalar-eval and imported by scalar-compile; not on the barrel', () => {
    const evalPath = fileURLToPath(new URL('../src/scalar-eval.ts', import.meta.url));
    const compilePath = fileURLToPath(new URL('../src/scalar-compile.ts', import.meta.url));
    const evalSrc = readFileSync(evalPath, 'utf8');
    const compileSrc = readFileSync(compilePath, 'utf8');
    const localDef = ['const', ' NUMERIC_LITERAL'].join('');
    const exportDef = ['export ', localDef].join('');
    expect(evalSrc.split(exportDef).length - 1).toBe(1);
    expect(compileSrc.includes(localDef)).toBe(false);
    expect(compileSrc).toContain('NUMERIC_LITERAL');
    expect(compileSrc).toContain("from './scalar-eval.js'");
    expect(barrel).not.toHaveProperty('NUMERIC_LITERAL');
  });
});
