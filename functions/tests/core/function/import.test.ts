import { describe, it, expect, vi } from 'vitest';
import { importFactory } from '../../../src/core/function/import.js';
import { factory } from '../../../src/utils/factory.js';

describe('importFactory', () => {
  it('should support non-lazy factories', () => {
    // Mock typed function
    const typed = vi.fn((...args) => args);
    const _load = vi.fn((factory) => factory.fn);

    const math = {
      expression: {
        transform: {},
        mathWithTransform: {},
      },
      emit: vi.fn(),
    };

    const importedFactories = {};

    const mathImport = importFactory(typed as any, _load, math as any, importedFactories);

    let factoryCalled = false;
    const nonLazyFactory = factory(
      'myFunction',
      [],
      () => {
        factoryCalled = true;
        return () => 42;
      },
      { lazy: false }
    );

    expect(factoryCalled).toBe(false);

    mathImport([nonLazyFactory]);

    expect(factoryCalled).toBe(true);
    expect((math as any).myFunction()).toBe(42);
  });
});
