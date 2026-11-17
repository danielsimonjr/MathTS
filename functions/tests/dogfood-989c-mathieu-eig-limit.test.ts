import { describe, it, expect } from 'vitest';
import { mathieuA } from '../src/special/mathieu.js';

// mathieuA builds an eigenproblem; a huge q made the QR iteration run for ever (#989).
describe('mathieuA with a huge q (#989)', () => {
  it('throws RangeError where the eigensolver does not converge', () => {
    expect(() => mathieuA(3, 1e200)).toThrow(RangeError);
  });
  it('still returns a finite characteristic value for a normal q', () => {
    expect(Number.isFinite(mathieuA(3, 1))).toBe(true);
  });
});
