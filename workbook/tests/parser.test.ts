import { describe, it, expect } from 'vitest';
import { parseWorkbook, serializeWorkbook, stripOutputs, detectCellType } from '../src/parser.js';
import type { Workbook } from '../src/types.js';

describe('parseWorkbook', () => {
  it('should return error for empty content', () => {
    const result = parseWorkbook('');
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Empty workbook content');
  });

  it('should return error for whitespace-only content', () => {
    const result = parseWorkbook('   \n  \t  ');
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Empty workbook content');
  });

  it('should return success with default workbook for non-empty content', () => {
    const result = parseWorkbook('some content');
    expect(result.success).toBe(true);
    expect(result.workbook).toBeDefined();
    expect(result.workbook!.version).toBe('1.0');
    expect(result.workbook!.metadata.title).toBe('Untitled Workbook');
    expect(result.workbook!.runtime.engine).toBe('mathts');
    expect(result.workbook!.runtime.execution).toBe('reactive');
    expect(result.workbook!.cells).toEqual([]);
  });

  it('should not include errors or warnings on clean parse', () => {
    const result = parseWorkbook('valid content');
    expect(result.errors).toBeUndefined();
    expect(result.warnings).toBeUndefined();
  });
});

describe('serializeWorkbook', () => {
  it('should throw not-yet-implemented error', () => {
    const workbook: Workbook = {
      version: '1.0',
      metadata: {},
      runtime: { engine: 'mathts', execution: 'reactive' },
      cells: [],
    };
    expect(() => serializeWorkbook(workbook)).toThrow('serializeWorkbook not yet implemented');
  });
});

describe('stripOutputs', () => {
  it('should remove output and error from cells', () => {
    const workbook: Workbook = {
      version: '1.0',
      metadata: { title: 'Test' },
      runtime: { engine: 'mathts', execution: 'reactive' },
      cells: [
        { id: 'a', type: 'code', content: 'x = 1', output: 42, error: undefined },
        { id: 'b', type: 'code', content: 'y = 2', output: 'result', error: 'some error' },
      ],
    };
    const stripped = stripOutputs(workbook);
    expect(stripped.cells[0].output).toBeUndefined();
    expect(stripped.cells[0].error).toBeUndefined();
    expect(stripped.cells[1].output).toBeUndefined();
    expect(stripped.cells[1].error).toBeUndefined();
  });

  it('should preserve cell content and metadata', () => {
    const workbook: Workbook = {
      version: '1.0',
      metadata: { title: 'Test' },
      runtime: { engine: 'mathts', execution: 'reactive' },
      cells: [{ id: 'a', type: 'code', content: 'x = 1', output: 42, metadata: { key: 'val' } }],
    };
    const stripped = stripOutputs(workbook);
    expect(stripped.cells[0].id).toBe('a');
    expect(stripped.cells[0].content).toBe('x = 1');
    expect(stripped.cells[0].metadata).toEqual({ key: 'val' });
  });

  it('should preserve workbook-level metadata', () => {
    const workbook: Workbook = {
      version: '2.0',
      metadata: { title: 'My Book', author: 'Test' },
      runtime: { engine: 'mathts', execution: 'sequential' },
      cells: [],
    };
    const stripped = stripOutputs(workbook);
    expect(stripped.version).toBe('2.0');
    expect(stripped.metadata.title).toBe('My Book');
    expect(stripped.runtime.execution).toBe('sequential');
  });
});

describe('detectCellType', () => {
  it('should detect markdown type', () => {
    expect(detectCellType({ markdown: '# Title' })).toBe('markdown');
  });

  it('should detect code type', () => {
    expect(detectCellType({ code: 'x = 1' })).toBe('code');
  });

  it('should detect tensor type', () => {
    expect(detectCellType({ tensor: [1, 2, 3] })).toBe('tensor');
  });

  it('should detect equation type', () => {
    expect(detectCellType({ equation: 'E = mc^2' })).toBe('equation');
  });

  it('should detect visualization type', () => {
    expect(detectCellType({ visualization: {} })).toBe('visualization');
  });

  it('should detect data type', () => {
    expect(detectCellType({ data: {} })).toBe('data');
  });

  it('should detect test type', () => {
    expect(detectCellType({ test: 'assert x == 1' })).toBe('test');
  });

  it('should detect export type', () => {
    expect(detectCellType({ export: 'result' })).toBe('export');
  });

  it('should default to code for unknown keys', () => {
    expect(detectCellType({ unknown: 'value' })).toBe('code');
  });

  it('should default to code for empty object', () => {
    expect(detectCellType({})).toBe('code');
  });
});
