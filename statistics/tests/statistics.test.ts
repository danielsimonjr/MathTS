import { describe, it, expect } from 'vitest';
import * as mod from '../src/index.js';

/**
 * Re-export of the statistics typed-function domain from
 * `@danielsimonjr/mathts-functions`. These assert the domain operations are
 * present and callable (they take arrays / typed inputs, so behaviour is covered
 * by the functions package's own tests).
 */
describe('@danielsimonjr/mathts-statistics re-export surface', () => {
  it('exposes the statistics operations', () => {
    for (const fn of ['parallelStatMean', 'parallelStatVariance', 'parallelStatStd', 'quickSelect', 'medianSelect']) {
      expect(typeof (mod as Record<string, any>)[fn]).toBe('function');
    }
  });
});
