import { describe, it, expect } from 'vitest';
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';
import { initTypeBridge } from '../src/typed/typed-bridge.js';

describe('Typed Bridge', () => {
  it('should initialize without error', () => {
    expect(() => initTypeBridge()).not.toThrow();
  });

  it('native Complex passes mathjs duck-type check after bridge init', () => {
    initTypeBridge();
    const z = new Complex(1, 2);
    expect(typeof z === 'object' && (z as any).isComplex === true).toBe(true);
  });

  it('native Fraction passes mathjs duck-type check', () => {
    initTypeBridge();
    const f = new Fraction(1, 3);
    expect(typeof f === 'object' && (f as any).isFraction === true).toBe(true);
  });

  it('native BigNumber passes mathjs duck-type check', () => {
    initTypeBridge();
    const b = new BigNumber(42);
    expect(typeof b === 'object' && (b as any).isBigNumber === true).toBe(true);
  });
});
