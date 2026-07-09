import { describe, it, expect } from 'vitest';
import * as mod from '../src/index.js';

/**
 * Re-export of the signal typed-function domain from
 * `@danielsimonjr/mathts-functions`. These assert the domain operations are
 * present and callable (they take arrays / typed inputs, so behaviour is covered
 * by the functions package's own tests).
 */
describe('@danielsimonjr/mathts-signal re-export surface', () => {
  it('exposes the signal operations', () => {
    for (const fn of ['parallelFFT', 'parallelIFFT', 'convolve', 'correlate', 'dct', 'welchPSD']) {
      expect(typeof (mod as Record<string, unknown>)[fn]).toBe('function');
    }
  });
});
