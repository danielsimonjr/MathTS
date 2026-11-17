import { describe, it, expect } from 'vitest';
import { mathieuA } from '../src/special/mathieu.js';

// mathieuA builds an eigenproblem; a huge q made the QR iteration run for ever (#989).
describe('mathieuA with a huge q (#989)', () => {
  it('returns a finite negative characteristic value for q = 1e200', () => {
    const a = mathieuA(3, 1e200);
    expect(Number.isFinite(a)).toBe(true);
    expect(a).toBeLessThan(0);
  });
  it('still returns a finite characteristic value for a normal q', () => {
    expect(Number.isFinite(mathieuA(3, 1))).toBe(true);
  });
});
