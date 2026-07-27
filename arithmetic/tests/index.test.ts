import { describe, it, expect } from 'vitest';
import * as arithmetic from '../src/index.js';

describe('arithmetic/src/index.ts', () => {
  it('should export core arithmetic functions', () => {
    // Check that at least the foundational expected members are exported.
    // The exact list may grow as more mathematical operations are added.
    const coreExports = [
      'add',
      'subtract'
    ];

    for (const name of coreExports) {
      expect(arithmetic).toHaveProperty(name);
      expect(arithmetic[name as keyof typeof arithmetic]).toBeDefined();
    }
  });

  it('should not be empty', () => {
    const actualExports = Object.keys(arithmetic);
    expect(actualExports.length).toBeGreaterThan(0);
  });
});
