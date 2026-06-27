import { describe, it, expect } from 'vitest';
import { parseWorkbook, serializeWorkbook } from '../src/parser.js';
import type { Workbook, Cell } from '../src/types.js';

function wb(cells: Cell[]): Workbook {
  return {
    version: '1.0',
    metadata: { title: 'Round Trip', author: 'Tester' },
    runtime: { engine: 'mathts', execution: 'sequential' },
    cells,
  };
}

/** Serialize then parse; return the reparsed workbook (asserting parse success). */
function roundTrip(workbook: Workbook): Workbook {
  const yaml = serializeWorkbook(workbook);
  const result = parseWorkbook(yaml);
  expect(result.success).toBe(true);
  return result.workbook!;
}

describe('serializeWorkbook round-trip', () => {
  it('preserves version, metadata, runtime', () => {
    const out = roundTrip(wb([{ id: 'a', type: 'code', content: '1' }]));
    expect(out.version).toBe('1.0');
    expect(out.metadata.title).toBe('Round Trip');
    expect(out.metadata.author).toBe('Tester');
    expect(out.runtime.engine).toBe('mathts');
    expect(out.runtime.execution).toBe('sequential');
  });

  it('preserves cell id, type, content, dependsOn, metadata', () => {
    const out = roundTrip(
      wb([
        { id: 'a', type: 'code', content: '10' },
        { id: 'b', type: 'code', content: 'a * 2', dependsOn: ['a'], metadata: { note: 'doubles a' } },
        { id: 'doc', type: 'markdown', content: '# Title' },
      ])
    );
    expect(out.cells.map((c) => c.id)).toEqual(['a', 'b', 'doc']);
    expect(out.cells[1]).toMatchObject({ id: 'b', type: 'code', content: 'a * 2' });
    expect(out.cells[1].dependsOn).toEqual(['a']);
    expect(out.cells[1].metadata).toMatchObject({ note: 'doubles a' });
    expect(out.cells[2].type).toBe('markdown');
  });

  it('preserves multi-line content including leading/trailing whitespace and blank lines', () => {
    const content = 'line one\n  indented two\n\nline four with trailing   \n';
    const out = roundTrip(wb([{ id: 'm', type: 'markdown', content }]));
    expect(out.cells[0].content).toBe(content);
  });

  it('round-trips a primitive number/boolean/string output and an error', () => {
    const out = roundTrip(
      wb([
        { id: 'n', type: 'code', content: '5', output: 5 },
        { id: 'b', type: 'code', content: 'true', output: true },
        { id: 'e', type: 'code', content: 'oops', error: 'bad thing' },
      ])
    );
    expect(out.cells[0].output).toBe(5);
    expect(out.cells[1].output).toBe(true);
    expect(out.cells[2].error).toBe('bad thing');
  });

  it('round-trips an object output (plain shape)', () => {
    const out = roundTrip(wb([{ id: 'o', type: 'code', content: '{a:1}', output: { a: 1, b: [2, 3] } }]));
    expect(out.cells[0].output).toEqual({ a: 1, b: [2, 3] });
  });

  // The load-bearing assumption behind "raw best-effort" outputs: a YAML
  // serializer must QUOTE strings that would otherwise re-type.
  it('keeps string outputs that look like other types as strings', () => {
    const out = roundTrip(
      wb([
        { id: 's1', type: 'code', content: 'x', output: 'true' },
        { id: 's2', type: 'code', content: 'x', output: '123' },
        { id: 's3', type: 'code', content: 'x', output: 'null' },
        { id: 's4', type: 'code', content: 'x', output: '[1,2]' },
      ])
    );
    expect(out.cells[0].output).toBe('true');
    expect(out.cells[1].output).toBe('123');
    expect(out.cells[2].output).toBe('null');
    expect(out.cells[3].output).toBe('[1,2]');
  });
});

describe('serializeWorkbook robustness', () => {
  it('drops metadata keys that collide with type/reserved keys (no bricked re-parse)', () => {
    // Hand-built (not parser-produced) workbook with hostile metadata.
    const hostile: Workbook = {
      version: '1.0',
      metadata: {},
      runtime: { engine: 'mathts', execution: 'reactive' },
      cells: [
        {
          id: 'a',
          type: 'code',
          content: '1',
          metadata: { markdown: 'evil', id: 'evil', output: 'evil', note: 'kept' },
        },
      ],
    };
    const out = roundTrip(hostile); // must not throw / must parse cleanly
    expect(out.cells[0].type).toBe('code');
    expect(out.cells[0].id).toBe('a');
    expect(out.cells[0].metadata).toMatchObject({ note: 'kept' });
    expect(out.cells[0].metadata).not.toHaveProperty('markdown');
  });

  it('rejects a serialized output object carrying a prototype-pollution key on re-parse', () => {
    const danger: Workbook = {
      version: '1.0',
      metadata: {},
      runtime: { engine: 'mathts', execution: 'reactive' },
      cells: [{ id: 'a', type: 'code', content: '1', output: { ['__proto__']: { polluted: true } } as object }],
    };
    const yaml = serializeWorkbook(danger);
    const result = parseWorkbook(yaml);
    // Either the guard rejects it, or the key simply doesn't survive — never pollutes.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    if (result.success) {
      expect(result.workbook!.cells[0].output).not.toHaveProperty('polluted');
    } else {
      expect(result.errors!.join(' ').toLowerCase()).toContain('prototype pollution');
    }
  });
});
