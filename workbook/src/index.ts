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
} from './types.js';

// Parser
export { parseWorkbook, serializeWorkbook, stripOutputs, detectCellType } from './parser.js';

// Dependency graph
export {
  buildDependencyGraph,
  topologicalSort,
  getDependents,
  detectCycles,
  getAncestors,
  toMermaid,
} from './graph.js';

// Executor
export { WorkbookExecutor, createExecutor } from './executor.js';

// Result formatting
export { formatResult } from './formatter.js';

// Cell mutation (pure, immutable)
export { addCell, editCell, removeCell, moveCell, renameCell, setMetadata } from './edit.js';
export type { CellPosition, RemoveResult } from './edit.js';

// Machine contract
export { SCHEMA_VERSION, VERSION } from './contract.js';

// Serve session + JSON-RPC router
export { Session } from './session.js';
export { handleRequest } from './rpc.js';

// SVG math typesetting (MathML → SVG)
export { mathMLToSVG } from './svg-math.js';
export type { MathSvgOptions } from './svg-math.js';

// Kill-able worker-thread execution with a hard timeout
export { runWorkbookWithTimeout, WorkbookTimeoutError } from './timeout-runner.js';
export type {
  RunWorkbookWithTimeoutOptions,
  SerializedCellResult,
  SerializedRunResult,
} from './timeout-runner.js';
