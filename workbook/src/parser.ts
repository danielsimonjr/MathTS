/**
 * Workbook YAML parser
 */

import type { Workbook, ParseResult, CellType } from './types';

/**
 * Detect cell type from YAML keys
 */
function detectCellType(cell: Record<string, unknown>): CellType {
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
    if (key in cell) {
      return key;
    }
  }

  return 'code'; // Default
}

/**
 * Parse a workbook from YAML content
 */
export function parseWorkbook(content: string): ParseResult {
  try {
    // Dynamic import for yaml to support tree-shaking
    // For now, use a simple placeholder
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content.trim()) {
      return {
        success: false,
        errors: ['Empty workbook content'],
      };
    }

    // TODO: Implement full YAML parsing
    // This is a placeholder structure
    const workbook: Workbook = {
      version: '1.0',
      metadata: {
        title: 'Untitled Workbook',
      },
      runtime: {
        engine: 'mathts',
        execution: 'reactive',
      },
      cells: [],
    };

    // Basic validation
    if (warnings.length > 0 || errors.length > 0) {
      return {
        success: errors.length === 0,
        workbook: errors.length === 0 ? workbook : undefined,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    return {
      success: true,
      workbook,
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Parse error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * Serialize a workbook to YAML
 */
export function serializeWorkbook(_workbook: Workbook): string {
  // TODO: Implement YAML serialization
  throw new Error('serializeWorkbook not yet implemented');
}

/**
 * Strip outputs from workbook (for git)
 */
export function stripOutputs(workbook: Workbook): Workbook {
  return {
    ...workbook,
    cells: workbook.cells.map((cell) => ({
      ...cell,
      output: undefined,
      error: undefined,
    })),
  };
}

export { detectCellType };
