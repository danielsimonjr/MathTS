/**
 * @danielsimonjr/mathts-workbook - Scientific workbook runtime
 * @packageDocumentation
 */

// Types
export type {
  Workbook,
  Cell,
  CellType,
  ExecutionMode,
  WorkbookMetadata,
  RuntimeConfig,
  ParseResult,
  WorkbookEvent,
  CellResult,
  RunResult,
} from './types';

// Parser
export { parseWorkbook, serializeWorkbook, stripOutputs, detectCellType } from './parser';

// Dependency graph
export {
  buildDependencyGraph,
  topologicalSort,
  getDependents,
  detectCycles,
  getAncestors,
  toMermaid,
} from './graph';

// Executor
export { WorkbookExecutor, createExecutor } from './executor';

// Result formatting
export { formatResult } from './formatter';

// Cell mutation (pure, immutable)
export { addCell, editCell, removeCell, moveCell, renameCell } from './edit';
export type { CellPosition, RemoveResult } from './edit';

// Machine contract
export { SCHEMA_VERSION } from './contract';

// Version
export const VERSION = '0.1.0';
