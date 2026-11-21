/**
 * The order of `MATHTS_CONVERSIONS` decides the signature of a mixed call: typed-function prefers
 * the conversion that comes first. mathjs lists `number to BigNumber` before every conversion to
 * Complex (core/function/typed.js), so a BigNumber and a number reach the BigNumber signature.
 */
import { describe, it, expect } from 'vitest';
import { createMathTSTyped, MATHTS_CONVERSIONS, BigNumber } from '../src/index.js';

const position = (from: string, to: string): number =>
  MATHTS_CONVERSIONS.findIndex((c) => c.from === from && c.to === to);

describe('conversion order of MATHTS_CONVERSIONS (mathjs core/function/typed.js)', () => {
  it('number to BigNumber comes before number to Complex and BigNumber to Complex', () => {
    expect(position('number', 'BigNumber')).toBeGreaterThanOrEqual(0);
    expect(position('number', 'BigNumber')).toBeLessThan(position('number', 'Complex'));
    expect(position('number', 'BigNumber')).toBeLessThan(position('BigNumber', 'Complex'));
  });

  it('a BigNumber and a number reach the BigNumber signature, in both orders', () => {
    const typed = createMathTSTyped();
    const f = typed('f', {
      'BigNumber, BigNumber': () => 'BigNumber, BigNumber',
      'Complex, number': () => 'Complex, number',
      'number, number': () => 'number, number',
    }) as (a: unknown, b: unknown) => string;
    expect(f(BigNumber.fromNumber(8), 3)).toBe('BigNumber, BigNumber');
    expect(f(3, BigNumber.fromNumber(8))).toBe('BigNumber, BigNumber');
  });
});
