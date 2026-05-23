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

  it('type-only exports are importable (compile-time check)', () => {
    type _CheckWorkbook = Workbook;
    type _CheckCell = Cell;
    type _CheckCellType = CellType;
    type _CheckExecutionMode = ExecutionMode;
    type _CheckWorkbookMetadata = WorkbookMetadata;
    type _CheckRuntimeConfig = RuntimeConfig;
    type _CheckParseResult = ParseResult;
    type _CheckWorkbookEvent = WorkbookEvent;
    expect(true).toBe(true);
  });
});
