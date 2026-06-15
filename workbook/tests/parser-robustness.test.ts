import { describe, it, expect } from 'vitest';
import { parseWorkbook, stripOutputs, detectCellType } from '../src/parser.js';
import type { Workbook } from '../src/types.js';

/**
 * Robustness / error-path coverage for the workbook parser.
 *
 * These exercise the defensive `catch` branch in `parseWorkbook` (which is
 * otherwise unreachable through normal string input) and edge cases of the
 * cell-type detection + output-stripping helpers.
 */
describe('parseWorkbook - error handling', () => {
  it('should catch and report errors when content is null', () => {
    // `null.trim()` throws a TypeError, which must be caught and surfaced as a
    // structured parse failure rather than propagating.
    const result = parseWorkbook(null as unknown as string);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    expect(result.errors![0]).toContain('Parse error:');
  });

  it('should catch and report errors when content is undefined', () => {
    const result = parseWorkbook(undefined as unknown as string);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain('Parse error:');
  });

  it('should not return a workbook when parsing fails', () => {
    const result = parseWorkbook(null as unknown as string);
    expect(result.workbook).toBeUndefined();
  });

  it('should surface a non-Error thrown value via String() coercion', () => {
    // Force a thrown primitive by passing an object whose trim() throws a string.
    const hostile = {
      trim() {
        throw new Error('boom');
      },
    };
    const result = parseWorkbook(hostile as unknown as string);
    expect(result.success).toBe(false);
    expect(result.errors![0]).toContain('boom');
  });
});

describe('detectCellType - precedence', () => {
  it('should pick markdown first when multiple type keys are present', () => {
    // typeKeys order places markdown before code, so markdown wins.
    expect(detectCellType({ code: 'x = 1', markdown: '# T' })).toBe('markdown');
  });

  it('should pick code over data when both present (code precedes data)', () => {
    expect(detectCellType({ data: {}, code: 'y = 2' })).toBe('code');
  });

  it('should respect tensor precedence over equation', () => {
    expect(detectCellType({ equation: 'E=mc^2', tensor: [1] })).toBe('tensor');
  });
});

describe('stripOutputs - immutability', () => {
  it('should not mutate the original workbook', () => {
    const workbook: Workbook = {
      version: '1.0',
      metadata: { title: 'Orig' },
      runtime: { engine: 'mathts', execution: 'reactive' },
      cells: [{ id: 'a', type: 'code', content: 'x = 1', output: 99, error: 'oops' }],
    };
    const stripped = stripOutputs(workbook);
    // Original retains its output/error; stripped copy is cleared.
    expect(workbook.cells[0].output).toBe(99);
    expect(workbook.cells[0].error).toBe('oops');
    expect(stripped.cells[0].output).toBeUndefined();
    expect(stripped.cells[0].error).toBeUndefined();
    expect(stripped).not.toBe(workbook);
    expect(stripped.cells[0]).not.toBe(workbook.cells[0]);
  });

  it('should handle a workbook with no cells', () => {
    const workbook: Workbook = {
      version: '1.0',
      metadata: {},
      runtime: { engine: 'mathts', execution: 'manual' },
      cells: [],
    };
    const stripped = stripOutputs(workbook);
    expect(stripped.cells).toEqual([]);
  });
});
