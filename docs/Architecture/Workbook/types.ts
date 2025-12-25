/**
 * MathTS Scientific Workbook - Core Types
 * 
 * Type definitions for the .mtsw workbook format
 */

// ============================================================================
// Workbook Structure
// ============================================================================

export interface Workbook {
  version: string;
  metadata?: WorkbookMetadata;
  runtime?: RuntimeConfig;
  cells: Cell[];
  outputs?: Record<string, CellOutput>;
}

export interface WorkbookMetadata {
  title?: string;
  author?: string;
  created?: string;
  modified?: string;
  description?: string;
  tags?: string[];
  license?: string;
}

export interface RuntimeConfig {
  engine: 'mathts' | 'python' | 'julia';
  version?: string;
  packages?: string[];
  execution: 'reactive' | 'sequential' | 'manual';
}

// ============================================================================
// Cell Types
// ============================================================================

export type Cell =
  | MarkdownCell
  | CodeCell
  | TensorCell
  | EquationCell
  | VisualizationCell
  | DataCell
  | TestCell
  | ExportCell;

export type CellType = Cell['type'];

interface BaseCell {
  id: string;
  metadata?: CellMetadata;
  depends_on?: string[];
}

export interface CellMetadata {
  collapsed?: boolean;
  tags?: string[];
  execution_count?: number;
  [key: string]: unknown;
}

// Markdown Cell
export interface MarkdownCell extends BaseCell {
  type: 'markdown';
  markdown: string;
}

// Code Cell (TypeScript/MathTS)
export interface CodeCell extends BaseCell {
  type: 'code';
  code: string;
  language?: 'typescript' | 'javascript';
  output?: InlineCellOutput;
}

// Tensor Cell (Einstein notation)
export interface TensorCell extends BaseCell {
  type: 'tensor';
  tensor: string;
  notation?: 'einstein' | 'index-free' | 'component';
}

// Equation Cell (LaTeX math)
export interface EquationCell extends BaseCell {
  type: 'equation';
  equation: string;
  format?: 'latex' | 'asciimath' | 'mathml';
  label?: string;
  numbered?: boolean;
}

// Visualization Cell (Three.js / D3)
export interface VisualizationCell extends BaseCell {
  type: 'visualization';
  visualization: string;
  renderer?: 'threejs' | 'd3' | 'plotly' | 'canvas';
  interactive?: boolean;
  export_formats?: ('png' | 'svg' | 'pdf' | 'gltf')[];
}

// Data Cell (embedded data)
export interface DataCell extends BaseCell {
  type: 'data';
  data: string;
  format?: 'yaml' | 'json' | 'csv' | 'toml';
  schema?: string;
}

// Test Cell (assertions)
export interface TestCell extends BaseCell {
  type: 'test';
  test: string;
  timeout?: number;
  critical?: boolean;
}

// Export Cell (publication output)
export interface ExportCell extends BaseCell {
  type: 'export';
  export: string;
  on_save?: boolean;
}

// ============================================================================
// Cell Outputs
// ============================================================================

export interface CellOutput {
  result?: OutputResult;
  stdout?: string;
  stderr?: string;
  figures?: FigureOutput[];
  execution_time_ms?: number;
  executed_at?: string;
  error?: ErrorOutput;
}

export interface InlineCellOutput {
  stdout?: string;
  result?: unknown;
  execution_time_ms?: number;
}

export interface OutputResult {
  type: 'tensor' | 'matrix' | 'scalar' | 'symbolic' | 'object';
  value?: unknown;
  shape?: number[];
  data_ref?: string;  // Path to cached binary data
  latex?: string;     // LaTeX representation
}

export interface FigureOutput {
  id: string;
  format: 'png' | 'svg' | 'pdf' | 'gltf';
  data_ref?: string;
  data_base64?: string;
  width?: number;
  height?: number;
}

export interface ErrorOutput {
  name: string;
  message: string;
  stack?: string;
  cell_id: string;
  line?: number;
}

// ============================================================================
// Dependency Graph
// ============================================================================

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, Set<string>>;  // id -> set of dependent ids
}

export interface DependencyNode {
  id: string;
  cell: Cell;
  status: CellStatus;
  lastExecuted?: number;
  dependencies: string[];
  dependents: string[];
}

export type CellStatus = 
  | 'pending'      // Not yet executed
  | 'running'      // Currently executing
  | 'success'      // Executed successfully
  | 'error'        // Execution failed
  | 'stale';       // Needs re-execution (dependency changed)

// ============================================================================
// Runtime Context
// ============================================================================

export interface ExecutionContext {
  workbook: Workbook;
  graph: DependencyGraph;
  scope: Map<string, unknown>;  // Exported variables by cell id
  outputs: Map<string, CellOutput>;
  config: RuntimeConfig;
}

// ============================================================================
// Events
// ============================================================================

export type WorkbookEvent =
  | { type: 'cell:start'; cellId: string }
  | { type: 'cell:success'; cellId: string; output: CellOutput }
  | { type: 'cell:error'; cellId: string; error: ErrorOutput }
  | { type: 'cell:stale'; cellIds: string[] }
  | { type: 'workbook:ready' }
  | { type: 'workbook:error'; error: Error };

export type WorkbookEventHandler = (event: WorkbookEvent) => void;

// ============================================================================
// Parser Result
// ============================================================================

export interface ParseResult {
  success: boolean;
  workbook?: Workbook;
  errors?: ParseError[];
  warnings?: ParseWarning[];
}

export interface ParseError {
  message: string;
  line?: number;
  column?: number;
  cellId?: string;
}

export interface ParseWarning {
  message: string;
  line?: number;
  cellId?: string;
}
