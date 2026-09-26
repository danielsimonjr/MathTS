/**
 * Smoke test for workbook/src/index.ts (package entry barrel)
 *
 * Asserts that a representative sample of named exports from the public
 * API are present and have the expected types.
 */
import { describe, it, expect } from 'vitest';
import * as wb from '../src/index.js';
import type {
  Workbook,
  Cell,
  CellType,
  ExecutionMode,
  WorkbookMetadata,
  RuntimeConfig,
  ParseResult,
  WorkbookEvent,
} from '../src/index.js';

describe('workbook/src/index.ts – package entry smoke test', () => {
  it('exports VERSION as a non-empty string', () => {
    expect(typeof wb.VERSION).toBe('string');
    expect(wb.VERSION.length).toBeGreaterThan(0);
  });

  it('exports parser functions', () => {
    expect(typeof wb.parseWorkbook).toBe('function');
    expect(typeof wb.serializeWorkbook).toBe('function');
    expect(typeof wb.stripOutputs).toBe('function');
  });

  it('exports dependency graph functions', () => {
    expect(typeof wb.buildDependencyGraph).toBe('function');
    expect(typeof wb.topologicalSort).toBe('function');
    expect(typeof wb.getDependents).toBe('function');
  });

  it('exports WorkbookExecutor and createExecutor', () => {
    expect(typeof wb.WorkbookExecutor).toBe('function');
    expect(typeof wb.createExecutor).toBe('function');
  });

  it('exports the new v1 helpers (formatResult, toMermaid, detectCycles, detectCellType)', () => {
    expect(typeof wb.formatResult).toBe('function');
    expect(typeof wb.toMermaid).toBe('function');
    expect(typeof wb.detectCycles).toBe('function');
    expect(typeof wb.detectCellType).toBe('function');
  });

  it('exports getAncestors and the SCHEMA_VERSION contract constant', () => {
    expect(typeof wb.getAncestors).toBe('function');
    expect(wb.SCHEMA_VERSION).toEqual({ major: 1, minor: 0 });
  });

  it('type-only exports are importable (compile-time check)', () => {
    // Annotating real values checks the imported types exist and have the documented shape.
    const cellType: CellType = 'code';
    const execution: ExecutionMode = 'reactive';
    const metadata: WorkbookMetadata = { title: 'Smoke' };
    const runtime: RuntimeConfig = { engine: 'mathts', execution };
    const cell: Cell = { id: 'a', type: cellType, content: '1 + 1' };
    const workbook: Workbook = { version: '1.0', metadata, runtime, cells: [cell] };
    const parsed: ParseResult = { success: true, workbook };
    const event: WorkbookEvent = { type: 'cell:start', cellId: cell.id, timestamp: 0 };
    expect(parsed.workbook?.cells[0]?.type).toBe('code');
    expect(parsed.workbook?.runtime.execution).toBe('reactive');
    expect(event.cellId).toBe('a');
  });
});
