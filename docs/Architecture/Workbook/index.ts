/**
 * MathTS Scientific Workbook - YAML Parser
 *
 * Parses .mtsw YAML files into typed Workbook structures
 */

import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';
import type {
  Workbook,
  Cell,
  CellType,
  ParseResult,
  ParseError,
  ParseWarning,
  MarkdownCell,
  CodeCell,
  TensorCell,
  EquationCell,
  VisualizationCell,
  DataCell,
  TestCell,
  ExportCell,
} from './types';

// ============================================================================
// Parser
// ============================================================================

export function parseWorkbook(yamlContent: string): ParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];

  try {
    const raw = parseYAML(yamlContent);

    if (!raw || typeof raw !== 'object') {
      return {
        success: false,
        errors: [{ message: 'Invalid YAML: expected object at root' }],
      };
    }

    // Validate version
    if (!raw.version) {
      warnings.push({ message: 'Missing version field, defaulting to "1.0"' });
      raw.version = '1.0';
    }

    // Parse cells
    if (!Array.isArray(raw.cells)) {
      return {
        success: false,
        errors: [{ message: 'Missing or invalid "cells" array' }],
      };
    }

    const cells: Cell[] = [];
    for (let i = 0; i < raw.cells.length; i++) {
      const result = parseCell(raw.cells[i], i);
      if (result.error) {
        errors.push(result.error);
      } else if (result.cell) {
        cells.push(result.cell);
        if (result.warning) {
          warnings.push(result.warning);
        }
      }
    }

    if (errors.length > 0) {
      return { success: false, errors, warnings };
    }

    const workbook: Workbook = {
      version: raw.version,
      metadata: raw.metadata,
      runtime: raw.runtime ?? {
        engine: 'mathts',
        execution: 'reactive',
      },
      cells,
      outputs: raw.outputs,
    };

    return {
      success: true,
      workbook,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (e) {
    return {
      success: false,
      errors: [
        {
          message: `YAML parse error: ${e instanceof Error ? e.message : String(e)}`,
        },
      ],
    };
  }
}

// ============================================================================
// Cell Parser
// ============================================================================

interface CellParseResult {
  cell?: Cell;
  error?: ParseError;
  warning?: ParseWarning;
}

function parseCell(raw: unknown, index: number): CellParseResult {
  if (!raw || typeof raw !== 'object') {
    return {
      error: { message: `Cell ${index}: expected object`, cellId: `cell-${index}` },
    };
  }

  const obj = raw as Record<string, unknown>;

  // Detect cell type from keys
  const cellType = detectCellType(obj);
  if (!cellType) {
    return {
      error: {
        message: `Cell ${index}: unknown cell type. Expected one of: markdown, code, tensor, equation, visualization, data, test, export`,
        cellId: obj.id as string | undefined,
      },
    };
  }

  // Generate ID if missing
  let id = obj.id as string | undefined;
  let warning: ParseWarning | undefined;
  if (!id) {
    id = `${cellType}-${index}`;
    warning = {
      message: `Cell ${index}: missing id, auto-generated "${id}"`,
      cellId: id,
    };
  }

  // Parse based on type
  switch (cellType) {
    case 'markdown':
      return {
        cell: {
          type: 'markdown',
          id,
          markdown: obj.markdown as string,
          metadata: obj.metadata as Cell['metadata'],
          depends_on: obj.depends_on as string[] | undefined,
        } as MarkdownCell,
        warning,
      };

    case 'code':
      return {
        cell: {
          type: 'code',
          id,
          code: obj.code as string,
          language: (obj.language as 'typescript' | 'javascript') ?? 'typescript',
          metadata: obj.metadata as Cell['metadata'],
          depends_on: obj.depends_on as string[] | undefined,
          output: obj.output as CodeCell['output'],
        } as CodeCell,
        warning,
      };

    case 'tensor':
      return {
        cell: {
          type: 'tensor',
          id,
          tensor: obj.tensor as string,
          notation: (obj.notation as TensorCell['notation']) ?? 'einstein',
          metadata: obj.metadata as Cell['metadata'],
          depends_on: obj.depends_on as string[] | undefined,
        } as TensorCell,
        warning,
      };

    case 'equation':
      return {
        cell: {
          type: 'equation',
          id,
          equation: obj.equation as string,
          format: (obj.format as EquationCell['format']) ?? 'latex',
          label: obj.label as string | undefined,
          numbered: obj.numbered as boolean | undefined,
          metadata: obj.metadata as Cell['metadata'],
          depends_on: obj.depends_on as string[] | undefined,
        } as EquationCell,
        warning,
      };

    case 'visualization':
      return {
        cell: {
          type: 'visualization',
          id,
          visualization: obj.visualization as string,
          renderer: (obj.type ?? obj.renderer) as VisualizationCell['renderer'],
          interactive: obj.interactive as boolean | undefined,
          export_formats: obj.export_formats as VisualizationCell['export_formats'],
          metadata: obj.metadata as Cell['metadata'],
          depends_on: obj.depends_on as string[] | undefined,
        } as VisualizationCell,
        warning,
      };

    case 'data':
      return {
        cell: {
          type: 'data',
          id,
          data: obj.data as string,
          format: (obj.format as DataCell['format']) ?? 'yaml',
          schema: obj.schema as string | undefined,
          metadata: obj.metadata as Cell['metadata'],
          depends_on: obj.depends_on as string[] | undefined,
        } as DataCell,
        warning,
      };

    case 'test':
      return {
        cell: {
          type: 'test',
          id,
          test: obj.test as string,
          timeout: obj.timeout as number | undefined,
          critical: obj.critical as boolean | undefined,
          metadata: obj.metadata as Cell['metadata'],
          depends_on: obj.depends_on as string[] | undefined,
        } as TestCell,
        warning,
      };

    case 'export':
      return {
        cell: {
          type: 'export',
          id,
          export: obj.export as string,
          on_save: obj.on_save as boolean | undefined,
          metadata: obj.metadata as Cell['metadata'],
          depends_on: obj.depends_on as string[] | undefined,
        } as ExportCell,
        warning,
      };

    default:
      return {
        error: { message: `Cell ${index}: unhandled type "${cellType}"` },
      };
  }
}

function detectCellType(obj: Record<string, unknown>): CellType | null {
  const typeKeys: CellType[] = [
    'markdown',
    'code',
    'tensor',
    'equation',
    'visualization',
    'data',
    'test',
    'export',
  ];

  for (const key of typeKeys) {
    if (key in obj && typeof obj[key] === 'string') {
      return key;
    }
  }

  return null;
}

// ============================================================================
// Serializer
// ============================================================================

export function serializeWorkbook(workbook: Workbook, options?: SerializeOptions): string {
  const { includeOutputs = false, includeMetadata = true } = options ?? {};

  const doc: Record<string, unknown> = {
    version: workbook.version,
  };

  if (includeMetadata && workbook.metadata) {
    doc.metadata = workbook.metadata;
  }

  if (workbook.runtime) {
    doc.runtime = workbook.runtime;
  }

  // Serialize cells
  doc.cells = workbook.cells.map((cell) => serializeCell(cell, includeOutputs));

  // Include outputs if requested
  if (includeOutputs && workbook.outputs) {
    doc.outputs = workbook.outputs;
  }

  return stringifyYAML(doc, {
    lineWidth: 0, // No line wrapping
    defaultStringType: 'BLOCK_LITERAL', // Use | for multiline strings
  });
}

function serializeCell(cell: Cell, includeOutputs: boolean): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Add the content field based on type
  switch (cell.type) {
    case 'markdown':
      result.markdown = cell.markdown;
      break;
    case 'code':
      result.code = cell.code;
      if (cell.language && cell.language !== 'typescript') {
        result.language = cell.language;
      }
      if (includeOutputs && cell.output) {
        result.output = cell.output;
      }
      break;
    case 'tensor':
      result.tensor = cell.tensor;
      if (cell.notation && cell.notation !== 'einstein') {
        result.notation = cell.notation;
      }
      break;
    case 'equation':
      result.equation = cell.equation;
      if (cell.format && cell.format !== 'latex') {
        result.format = cell.format;
      }
      if (cell.label) result.label = cell.label;
      if (cell.numbered) result.numbered = cell.numbered;
      break;
    case 'visualization':
      result.visualization = cell.visualization;
      if (cell.renderer) result.type = cell.renderer;
      if (cell.interactive) result.interactive = cell.interactive;
      if (cell.export_formats) result.export_formats = cell.export_formats;
      break;
    case 'data':
      result.data = cell.data;
      if (cell.format && cell.format !== 'yaml') {
        result.format = cell.format;
      }
      if (cell.schema) result.schema = cell.schema;
      break;
    case 'test':
      result.test = cell.test;
      if (cell.timeout) result.timeout = cell.timeout;
      if (cell.critical) result.critical = cell.critical;
      break;
    case 'export':
      result.export = cell.export;
      if (cell.on_save) result.on_save = cell.on_save;
      break;
  }

  // Add common fields
  result.id = cell.id;

  if (cell.depends_on && cell.depends_on.length > 0) {
    result.depends_on = cell.depends_on;
  }

  if (cell.metadata && Object.keys(cell.metadata).length > 0) {
    result.metadata = cell.metadata;
  }

  return result;
}

export interface SerializeOptions {
  includeOutputs?: boolean;
  includeMetadata?: boolean;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Strip outputs from workbook (for Git commits)
 */
export function stripOutputs(workbook: Workbook): Workbook {
  return {
    ...workbook,
    cells: workbook.cells.map((cell) => {
      if (cell.type === 'code') {
        const { output, ...rest } = cell;
        return rest as CodeCell;
      }
      return cell;
    }),
    outputs: undefined,
  };
}

/**
 * Get cell by ID
 */
export function getCellById(workbook: Workbook, id: string): Cell | undefined {
  return workbook.cells.find((c) => c.id === id);
}

/**
 * Get all cell IDs
 */
export function getCellIds(workbook: Workbook): string[] {
  return workbook.cells.map((c) => c.id);
}

/**
 * Validate cell ID references
 */
export function validateReferences(workbook: Workbook): ParseError[] {
  const errors: ParseError[] = [];
  const ids = new Set(getCellIds(workbook));

  for (const cell of workbook.cells) {
    if (cell.depends_on) {
      for (const dep of cell.depends_on) {
        if (!ids.has(dep)) {
          errors.push({
            message: `Cell "${cell.id}" depends on unknown cell "${dep}"`,
            cellId: cell.id,
          });
        }
      }
    }
  }

  return errors;
}
