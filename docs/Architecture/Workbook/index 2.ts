/**
 * MathTS Scientific Workbook Runtime
 * 
 * Main entry point for the .mtsw workbook format
 */

// Re-export types
export * from './types';

// Re-export parser
export {
  parseWorkbook,
  serializeWorkbook,
  stripOutputs,
  getCellById,
  getCellIds,
  validateReferences,
  type SerializeOptions,
} from './parser/index';

// Re-export runtime
export {
  buildDependencyGraph,
  topologicalSort,
  getDependents,
  getDependencies,
  markStale,
  updateStatus,
  getReadyCells,
  hasCycle,
  toMermaid,
} from './runtime/graph';

export {
  WorkbookExecutor,
  createExecutor,
} from './runtime/executor';

// ============================================================================
// High-Level API
// ============================================================================

import { readFileSync, writeFileSync } from 'fs';
import { parseWorkbook, serializeWorkbook, stripOutputs } from './parser/index';
import { createExecutor } from './runtime/executor';
import type { Workbook, CellOutput, ParseResult } from './types';

/**
 * Load a workbook from a file
 */
export function loadWorkbook(path: string): ParseResult {
  const content = readFileSync(path, 'utf-8');
  return parseWorkbook(content);
}

/**
 * Save a workbook to a file
 */
export function saveWorkbook(
  workbook: Workbook,
  path: string,
  options?: { includeOutputs?: boolean }
): void {
  const content = serializeWorkbook(workbook, options);
  writeFileSync(path, content, 'utf-8');
}

/**
 * Run a workbook and return outputs
 */
export async function runWorkbook(
  workbook: Workbook,
  options?: { onEvent?: (event: unknown) => void }
): Promise<Map<string, CellOutput>> {
  const executor = createExecutor(workbook);
  
  if (options?.onEvent) {
    executor.on(options.onEvent);
  }

  return executor.runAll();
}

/**
 * Load and run a workbook file
 */
export async function runWorkbookFile(
  path: string,
  options?: { onEvent?: (event: unknown) => void }
): Promise<{ workbook: Workbook; outputs: Map<string, CellOutput> }> {
  const result = loadWorkbook(path);
  
  if (!result.success || !result.workbook) {
    throw new Error(`Failed to parse workbook: ${result.errors?.map(e => e.message).join(', ')}`);
  }

  const outputs = await runWorkbook(result.workbook, options);
  
  return { workbook: result.workbook, outputs };
}
