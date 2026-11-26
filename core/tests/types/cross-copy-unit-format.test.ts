/**
 * A Unit formats a value of a second copy of core as it formats a value of its own copy (#1033).
 *
 * A second copy loads when a package manager fails to dedupe. `instanceof` fails across copies,
 * so a formatter that tests with `instanceof` prints a Fraction value as a decimal.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { Fraction, Unit } from '../../src/index.js';

type Core = typeof import('../../src/index.js');
let core2: Core;

beforeAll(async () => {
  // The built bundle has its own classes, so `dist` is a second copy of the `src` classes under
  // both bun test and vitest. The `test` task of turbo builds core first.
  core2 = (await import('../../dist/index.js')) as unknown as Core;
});

describe('Unit format with a value of a second copy of core', () => {
  it('is a real second copy', () => {
    expect(core2.Fraction).not.toBe(Fraction);
  });

  it('prints a Fraction value as the ratio', () => {
    const own = new Unit(new Fraction(1, 8), 'S').toString();
    const foreign = new Unit(new core2.Fraction(1, 8) as never, 'S').toString();
    expect(own).toBe('1/8 S');
    expect(foreign).toBe(own);
  });
});
