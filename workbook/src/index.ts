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
export { addCell, editCell, removeCell, moveCell, renameCell, setMetadata } from './edit';
export type { CellPosition, RemoveResult } from './edit';

// Machine contract
export { SCHEMA_VERSION, VERSION } from './contract';

// Serve session + JSON-RPC router
export { Session } from './session';
export { handleRequest } from './rpc';

// SVG math typesetting (MathML → SVG)
export { mathMLToSVG } from './svg-math';
export type { MathSvgOptions } from './svg-math';

// Kill-able worker-thread execution with a hard timeout
export { runWorkbookWithTimeout, WorkbookTimeoutError } from './timeout-runner';
export type {
  RunWorkbookWithTimeoutOptions,
  SerializedCellResult,
  SerializedRunResult,
} from './timeout-runner';
