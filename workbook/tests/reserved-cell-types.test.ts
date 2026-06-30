import { describe, it, expect } from 'vitest';
import { parseWorkbook } from '../src/parser.js';

/**
 * GC13 — reserved-but-unsupported cell types (`tensor`, `export`) are valid keys
 * in CELL_TYPE_KEYS but have no executor. They must be rejected at PARSE time
 * with a clear message, not throw "Unsupported cell type" mid-run.
 */
describe('GC13: reserved cell types rejected at parse time', () => {
  for (const type of ['tensor', 'export']) {
    it(`rejects a '${type}' cell with a clear message`, () => {
      const result = parseWorkbook(`cells:\n  - id: c1\n    ${type}: "something"\n`);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e) => e.includes(`'${type}' is reserved but not yet supported`))).toBe(
        true
      );
    });
  }

  it('still accepts a supported (code) cell', () => {
    const result = parseWorkbook('cells:\n  - id: c1\n    code: "1 + 1"\n');
    expect((result.errors ?? []).some((e) => e.includes('reserved'))).toBe(false);
  });
});
