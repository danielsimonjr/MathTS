/**
 * The exact-reduction seam names the caller and the registering module when nothing is
 * registered (#1039).
 */
import { describe, expect, it, vi } from 'vitest';

describe('exactReductions', () => {
  it('names the function and the module that registers the reductions', async () => {
    // A fresh module instance has no registration.
    vi.resetModules();
    const fresh = await import('../src/typed/exact-reductions.js');
    expect(() => fresh.exactReductions('sum')).toThrow(
      /^sum: the exact reductions are not registered; .*factories/
    );
  });
});
