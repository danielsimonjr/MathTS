import { describe, it, expect, vi } from 'vitest';
import { importFactory } from '../../../src/core/function/import.js';
import { factory, type FactoryFunction } from '../../../src/utils/factory.js';

type ImportFactoryArgs = Parameters<typeof importFactory>;

describe('importFactory', () => {
  it('should support non-lazy factories', () => {
    // Mock typed function
    const typed = vi.fn((...args) => args);
    const _load = vi.fn((factory: FactoryFunction) => factory.fn);

    const math: ImportFactoryArgs[2] = {
      expression: {
        transform: {},
        mathWithTransform: {},
      },
      emit: vi.fn(),
    };

    const importedFactories: ImportFactoryArgs[3] = {};

    const mathImport = importFactory(
      typed as unknown as ImportFactoryArgs[0],
      _load,
      math,
      importedFactories
    );

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
    expect((math.myFunction as () => number)()).toBe(42);
  });
});
