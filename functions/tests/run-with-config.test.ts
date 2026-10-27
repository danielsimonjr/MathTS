import { describe, it, expect, afterEach } from 'vitest';
import { BigNumber, Fraction } from '@danielsimonjr/mathts-core';
import { config, runWithConfig, evaluate, range } from '../src/index.js';
import { factoryScope } from '../src/factories/scope.js';
import { DEFAULT_CONFIG } from '../src/core/config.js';

afterEach(() => {
  config({ number: 'number', matrix: 'Matrix' });
});

const factoryConfig = factoryScope.config as typeof DEFAULT_CONFIG;

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

  it('partial overlay merges with DEFAULT_CONFIG (matrix stays Matrix)', () => {
    // Independent oracle: DEFAULT_CONFIG.matrix is 'Matrix'; a missing overlay
    // key must not become undefined (that would send range() down the Array path).
    const out = runWithConfig({ number: 'Fraction' }, () => {
      expect(evaluate('1/2')).toBeInstanceOf(Fraction);
      return range(1, 4);
    });
    expect(Array.isArray(out)).toBe(false);
    expect(typeof (out as { toArray?: unknown }).toArray).toBe('function');
    expect(evaluate('1/2')).not.toBeInstanceOf(Fraction);
  });

  it('nested overlay replaces rather than stack-merging parent keys', () => {
    runWithConfig({ number: 'BigNumber', matrix: 'Array' }, () => {
      expect(Array.isArray(range(1, 4))).toBe(true);
      runWithConfig({ number: 'Fraction' }, () => {
        // Inner overlay does not inherit matrix:'Array' from the parent.
        expect(Array.isArray(range(1, 4))).toBe(false);
        expect(evaluate('1/2')).toBeInstanceOf(Fraction);
      });
      expect(Array.isArray(range(1, 4))).toBe(true);
    });
  });

  it('config() ignores the overlay and still reads DEFAULT_CONFIG', () => {
    runWithConfig({ number: 'Fraction' }, () => {
      expect(config().number).toBe('number');
      expect(evaluate('1/2')).toBeInstanceOf(Fraction);
    });
  });

  it('a returned Promise continuation does not see the overlay', async () => {
    const pending = runWithConfig({ number: 'Fraction' }, () =>
      Promise.resolve().then(() => evaluate('1/2'))
    );
    const value = await pending;
    expect(typeof value).toBe('number');
    expect(value).toBe(0.5);
    expect(value).not.toBeInstanceOf(Fraction);
  });

  it('Object.keys / spread / JSON.stringify see merged overlay values', () => {
    const baseKeys = Object.keys(DEFAULT_CONFIG).sort();
    expect(Object.keys(factoryConfig).sort()).toEqual(baseKeys);

    runWithConfig({ number: 'Fraction' }, () => {
      expect(Object.keys(factoryConfig).sort()).toEqual(baseKeys);
      const spread = { ...factoryConfig };
      expect(spread.number).toBe('Fraction');
      expect(spread.matrix).toBe(DEFAULT_CONFIG.matrix);
      expect(spread.relTol).toBe(DEFAULT_CONFIG.relTol);
      const parsed = JSON.parse(JSON.stringify(factoryConfig)) as {
        number: string;
        matrix: string;
      };
      expect(parsed.number).toBe('Fraction');
      expect(parsed.matrix).toBe(DEFAULT_CONFIG.matrix);
    });
  });

  it('writes during an overlay stay on the overlay, not DEFAULT_CONFIG', () => {
    const overlay: { number: 'Fraction'; matrix?: 'Array' } = { number: 'Fraction' };
    runWithConfig(overlay, () => {
      (factoryConfig as { matrix: string }).matrix = 'Array';
      expect(Array.isArray(range(1, 4))).toBe(true);
    });
    expect(overlay.matrix).toBe('Array');
    expect(config().matrix).toBe('Matrix');
    expect(DEFAULT_CONFIG.matrix).toBe('Matrix');
  });

  it('Object.assign onto the proxy during an overlay does not mutate DEFAULT_CONFIG', () => {
    const overlay: { number: 'BigNumber' } = { number: 'BigNumber' };
    runWithConfig(overlay, () => {
      Object.assign(factoryConfig, { number: 'Fraction' });
      expect(evaluate('1/2')).toBeInstanceOf(Fraction);
    });
    expect(overlay.number).toBe('Fraction');
    expect(config().number).toBe('number');
  });

  it('assignment during an overlay does not define extra keys on DEFAULT_CONFIG', () => {
    const overlay: { number: string } = { number: 'Fraction' };
    runWithConfig(overlay, () => {
      (factoryConfig as { number: string }).number = 'BigNumber';
      expect(evaluate('1')).toBeInstanceOf(BigNumber);
    });
    expect(overlay.number).toBe('BigNumber');
    expect(Object.hasOwn(DEFAULT_CONFIG, 'scratch')).toBe(false);
    expect(config().number).toBe('number');
  });
});
