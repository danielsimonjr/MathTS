import { describe, it, expect } from 'vitest';
import { Range, createRangeClass } from '../src/index.js';

/**
 * Range is a first-class core numeric type (a lazy start:step:end sequence,
 * mathjs parity), wired into the public surface 2026-07-05 — previously the
 * complete `createRangeClass` factory lived in `core/src/types/matrix/Range.ts`
 * but was reachable only from its own test. These pins prove it is now exported
 * from the package index alongside Complex/Fraction/BigNumber.
 */
describe('core public API — Range', () => {
  it('exports a ready-made Range class', () => {
    const r = new Range(2, 6);
    expect(r.toArray()).toEqual([2, 3, 4, 5]);
  });

  it('exports the createRangeClass factory', () => {
    const R = createRangeClass({});
    const r = new R(0, 10, 2);
    expect(r.toArray()).toEqual([0, 2, 4, 6, 8]);
    expect(r.size()).toEqual([5]);
  });
});
