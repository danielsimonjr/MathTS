/**
 * Workbook type definitions
 */

/**
 * Supported cell types
 */
export type CellType =
  | 'markdown'
  | 'code'
  | 'tensor'
  | 'equation'
  | 'visualization'
  | 'data'
  | 'test'
  | 'export';

/**
 * Execution modes
 */
export type ExecutionMode = 'reactive' | 'sequential' | 'manual';

/**
 * Workbook metadata
 */
export interface WorkbookMetadata {
  title?: string;
  author?: string;
  description?: string;
  tags?: string[];
  created?: string;
  modified?: string;
}

/**
 * Runtime configuration
 */
export interface RuntimeConfig {
  engine: 'mathts' | 'custom';
  execution: ExecutionMode;
  timeout?: number;
}

/**
 * Individual cell in a workbook
 */
export interface Cell {
  id: string;
  type: CellType;
  content: string;
  dependsOn?: string[];
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Complete workbook structure
 */
export interface Workbook {
  version: string;
  metadata: WorkbookMetadata;
  runtime: RuntimeConfig;
  cells: Cell[];
}

/**
 * Parse result with validation
 */
export interface ParseResult {
  success: boolean;
  workbook?: Workbook;
  errors?: string[];
  warnings?: string[];
}

/**
 * Workbook execution events
 */
export interface WorkbookEvent {
  type: 'cell:start' | 'cell:success' | 'cell:error' | 'cell:stale' | 'workbook:complete';
  cellId?: string;
  output?: unknown;
  error?: string;
  timestamp: number;
}

/**
 * Result of executing a single cell in a run report.
 */
export interface CellResult {
  id: string;
  type: CellType;
  status: 'success' | 'error' | 'pass' | 'fail';
  output?: unknown;
  error?: string;
}

/**
 * Aggregated result of running an entire workbook (continue-on-error).
 */
export interface RunResult {
  cells: CellResult[];
  ok: boolean;
}

/**
 * Dependency graph node
 */
export interface DependencyNode {
  id: string;
  dependencies: string[];
  dependents: string[];
}

/**
 * Dependency graph
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  executionOrder: string[];
}
