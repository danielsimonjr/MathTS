import { describe, it, expect } from 'vitest';
import { parseWorkbook, serializeWorkbook, stripOutputs, detectCellType } from '../src/parser.js';
import type { Workbook } from '../src/types.js';

describe('parseWorkbook', () => {
  const SAMPLE = `
version: "1.0"
metadata:
  title: "Sample"
  author: "Tester"
runtime:
  engine: mathts
  execution: sequential
cells:
  - code: "2 + 3"
    id: a
  - code: "a * 2"
    id: b
    depends_on: [a]
  - test: "b == 10"
    id: checkB
    depends_on: [b]
`;

  describe('input guards', () => {
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

    it('should error when the top-level document is not a mapping', () => {
      const result = parseWorkbook('just a scalar string');
      expect(result.success).toBe(false);
      expect(result.errors!.some((e) => e.includes('must be a YAML mapping'))).toBe(true);
    });

    it('should error when cells is present but not a list', () => {
      const result = parseWorkbook('cells: not-a-list');
      expect(result.success).toBe(false);
      expect(result.errors!.some((e) => e.includes('"cells" must be a list'))).toBe(true);
    });
  });

  describe('happy path', () => {
    it('should parse version, metadata, runtime and cells', () => {
      const result = parseWorkbook(SAMPLE);
      expect(result.success).toBe(true);
      const wb = result.workbook!;
      expect(wb.version).toBe('1.0');
      expect(wb.metadata.title).toBe('Sample');
      expect(wb.metadata.author).toBe('Tester');
      expect(wb.runtime.engine).toBe('mathts');
      expect(wb.runtime.execution).toBe('sequential');
      expect(wb.cells).toHaveLength(3);
    });

    it('should map cell id, type, content and dependsOn', () => {
      const wb = parseWorkbook(SAMPLE).workbook!;
      expect(wb.cells[0]).toMatchObject({ id: 'a', type: 'code', content: '2 + 3' });
      expect(wb.cells[1]).toMatchObject({ id: 'b', type: 'code', content: 'a * 2' });
      expect(wb.cells[1].dependsOn).toEqual(['a']);
      expect(wb.cells[2]).toMatchObject({ id: 'checkB', type: 'test', content: 'b == 10' });
      expect(wb.cells[2].dependsOn).toEqual(['b']);
    });

    it('should default version/runtime when omitted', () => {
      const result = parseWorkbook('cells:\n  - code: "1"\n    id: a');
      expect(result.success).toBe(true);
      const wb = result.workbook!;
      expect(wb.version).toBe('1.0');
      expect(wb.runtime.engine).toBe('mathts');
      expect(wb.runtime.execution).toBe('reactive');
    });

    it('should warn (not error) when there are no cells', () => {
      const result = parseWorkbook('version: "1.0"\nmetadata:\n  title: Empty');
      expect(result.success).toBe(true);
      expect(result.workbook!.cells).toEqual([]);
      expect(result.warnings!.some((w) => w.toLowerCase().includes('no cells'))).toBe(true);
    });

    it('should collect non-reserved, non-type keys into metadata', () => {
      const wb = parseWorkbook('cells:\n  - code: "1"\n    id: a\n    note: hello').workbook!;
      expect(wb.cells[0].metadata).toMatchObject({ note: 'hello' });
    });

    it('should preserve structured data-cell content as a string', () => {
      const wb = parseWorkbook('cells:\n  - data: |\n      x: 1\n      y: 2\n    id: d').workbook!;
      expect(typeof wb.cells[0].content).toBe('string');
      expect(wb.cells[0].content).toContain('x: 1');
    });
  });

  describe('validation errors', () => {
    it('should error on a cell missing an id', () => {
      const result = parseWorkbook('cells:\n  - code: "1"');
      expect(result.success).toBe(false);
      expect(result.errors!.some((e) => e.toLowerCase().includes('missing "id"'))).toBe(true);
    });

    it('should error on a duplicate cell id', () => {
      const result = parseWorkbook('cells:\n  - code: "1"\n    id: a\n  - code: "2"\n    id: a');
      expect(result.success).toBe(false);
      expect(result.errors!.some((e) => e.includes('Duplicate cell id'))).toBe(true);
    });

    it('should error on an invalid (non-identifier) cell id', () => {
      const result = parseWorkbook('cells:\n  - code: "1"\n    id: sum-calc');
      expect(result.success).toBe(false);
      expect(result.errors!.some((e) => e.includes('valid identifier'))).toBe(true);
    });

    it('should error when a cell has no recognized type key', () => {
      const result = parseWorkbook('cells:\n  - id: a\n    note: nothing');
      expect(result.success).toBe(false);
      expect(result.errors!.some((e) => e.includes('no recognized type key'))).toBe(true);
    });

    it('should error when a cell has more than one type key', () => {
      const result = parseWorkbook('cells:\n  - code: "1"\n    markdown: "x"\n    id: a');
      expect(result.success).toBe(false);
      expect(result.errors!.some((e) => e.includes('multiple type keys'))).toBe(true);
    });

    it('should error on a dangling depends_on reference', () => {
      const result = parseWorkbook('cells:\n  - code: "1"\n    id: a\n    depends_on: [ghost]');
      expect(result.success).toBe(false);
      expect(result.errors!.some((e) => e.includes('unknown cell "ghost"'))).toBe(true);
    });

    it('should not return a workbook when validation fails', () => {
      const result = parseWorkbook('cells:\n  - code: "1"\n    id: sum-calc');
      expect(result.workbook).toBeUndefined();
    });
  });

  describe('security hardening', () => {
    it('should reject a mapping containing a prototype-pollution key', () => {
      const result = parseWorkbook('cells: []\nmetadata:\n  constructor: evil');
      expect(result.success).toBe(false);
      expect(result.errors!.some((e) => e.toLowerCase().includes('prototype pollution'))).toBe(true);
    });

    it('should not produce a function from a js/function tag', () => {
      const result = parseWorkbook('cells:\n  - code: !!js/function "function(){return 1}"\n    id: a');
      // Either an error, or content coerced to a non-function string — never an executable function.
      if (result.success) {
        expect(typeof result.workbook!.cells[0].content).toBe('string');
      } else {
        expect(result.errors!.length).toBeGreaterThan(0);
      }
    });
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
