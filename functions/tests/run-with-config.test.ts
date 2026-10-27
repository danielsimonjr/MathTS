import { describe, it, expect, afterEach } from 'vitest';
import { BigNumber, Fraction } from '@danielsimonjr/mathts-core';
import { config, runWithConfig, evaluate } from '../src/index.js';

afterEach(() => {
  config({ number: 'number' });
});

describe('runWithConfig', () => {
  it('restores the config stack after a throw', () => {
    expect(() => {
      runWithConfig({ number: 'Fraction' }, () => {
        expect(evaluate('1/2')).toBeInstanceOf(Fraction);
        throw new Error('abort');
      });
    }).toThrow('abort');

    const one = evaluate('1');
    expect(typeof one).toBe('number');
    expect(config().number).toBe('number');
  });

  it('nested overlays pop in LIFO order', () => {
    runWithConfig({ number: 'BigNumber' }, () => {
      expect(evaluate('1')).toBeInstanceOf(BigNumber);
      runWithConfig({ number: 'Fraction' }, () => {
        expect(evaluate('1/2')).toBeInstanceOf(Fraction);
      });
      expect(evaluate('2')).toBeInstanceOf(BigNumber);
    });
    expect(config().number).toBe('number');
  });
});
