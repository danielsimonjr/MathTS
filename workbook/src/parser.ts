/**
 * Workbook YAML parser
 */

import { stringify as stringifyYaml } from 'yaml';
import { parseYamlHardened, findPollutionKeys } from './yaml-safe';
import type { Workbook, ParseResult, CellType, Cell, RuntimeConfig } from './types';

/**
 * Canonical cell-type keys, in detection-precedence order. Shared between the
 * `detectCellType` helper and the parser's exactly-one-type-key rule.
 */
const CELL_TYPE_KEYS: CellType[] = [
  'markdown',
  'code',
  'tensor',
  'equation',
  'visualization',
  'data',
  'test',
  'export',
];

/** Non-type cell keys that are handled explicitly and excluded from metadata. */
const RESERVED_CELL_KEYS = ['id', 'depends_on', 'language', 'format', 'output', 'error'];

/** Valid MathTS identifier — required for cell ids so by-id dependency refs work. */
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const EXECUTION_MODES = ['reactive', 'sequential', 'manual'];

/**
 * Detect cell type from YAML keys (first match by precedence).
 */
function detectCellType(cell: Record<string, unknown>): CellType {
  for (const key of CELL_TYPE_KEYS) {
    if (key in cell) {
      return key;
    }
  }

  return 'code'; // Default
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Coerce a cell's type-key value to string content (block scalars stay verbatim). */
function toContent(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') return raw;
  return stringifyYaml(raw).trim();
}

function normalizeRuntime(raw: unknown): RuntimeConfig {
  const rt = isPlainObject(raw) ? raw : {};
  const runtime: RuntimeConfig = {
    engine: rt.engine === 'custom' ? 'custom' : 'mathts',
    execution:
      typeof rt.execution === 'string' && EXECUTION_MODES.includes(rt.execution)
        ? (rt.execution as RuntimeConfig['execution'])
        : 'reactive',
  };
  if (typeof rt.timeout === 'number') runtime.timeout = rt.timeout;
  return runtime;
}

/**
 * Map and validate a single raw cell. Pushes any problems into `errors` and
 * returns a best-effort `Cell` (so downstream dependency checks still have ids).
 */
function mapCell(raw: unknown, index: number, errors: string[]): Cell {
  if (!isPlainObject(raw)) {
    errors.push(`Cell at index ${index}: must be a mapping`);
    return { id: `#${index}`, type: 'code', content: '' };
  }

  const rawId = raw.id;
  let id: string;
  if (rawId === undefined || rawId === null) {
    errors.push(`Cell at index ${index}: missing "id"`);
    id = `#${index}`;
  } else if (typeof rawId !== 'string' || !IDENTIFIER_RE.test(rawId)) {
    errors.push(
      `Cell "${String(rawId)}": id must be a valid identifier ([A-Za-z_][A-Za-z0-9_]*)`
    );
    id = String(rawId);
  } else {
    id = rawId;
  }

  const presentTypeKeys = CELL_TYPE_KEYS.filter((k) =>
    Object.prototype.hasOwnProperty.call(raw, k)
  );
  if (presentTypeKeys.length === 0) {
    errors.push(
      `Cell "${id}": no recognized type key (expected one of ${CELL_TYPE_KEYS.join(', ')})`
    );
  } else if (presentTypeKeys.length > 1) {
    errors.push(`Cell "${id}": multiple type keys (${presentTypeKeys.join(', ')})`);
  }
  const type: CellType = presentTypeKeys[0] ?? 'code';
  const content = presentTypeKeys[0] ? toContent(raw[presentTypeKeys[0]]) : '';

  let dependsOn: string[] | undefined;
  if (raw.depends_on !== undefined) {
    if (!Array.isArray(raw.depends_on)) {
      errors.push(`Cell "${id}": depends_on must be a list`);
    } else {
      dependsOn = raw.depends_on.map((d) => String(d));
    }
  }

  const metadata: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (RESERVED_CELL_KEYS.includes(key) || (CELL_TYPE_KEYS as string[]).includes(key)) continue;
    metadata[key] = raw[key];
  }

  const cell: Cell = { id, type, content };
  if (dependsOn) cell.dependsOn = dependsOn;
  if (Object.keys(metadata).length > 0) cell.metadata = metadata;
  if (raw.output !== undefined) cell.output = raw.output;
  if (raw.error !== undefined) cell.error = String(raw.error);
  return cell;
}

/**
 * Parse a workbook from YAML content.
 */
export function parseWorkbook(content: string): ParseResult {
  try {
    if (!content.trim()) {
      return { success: false, errors: ['Empty workbook content'] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    const doc = parseYamlHardened(content);

    if (!isPlainObject(doc)) {
      return { success: false, errors: ['Workbook must be a YAML mapping'] };
    }

    for (const key of findPollutionKeys(doc)) {
      errors.push(`Disallowed key "${key}" (prototype pollution)`);
    }

    const metadata = isPlainObject(doc.metadata) ? (doc.metadata as Workbook['metadata']) : {};
    const workbook: Workbook = {
      version: doc.version != null ? String(doc.version) : '1.0',
      metadata,
      runtime: normalizeRuntime(doc.runtime),
      cells: [],
    };

    if (doc.cells === undefined) {
      warnings.push('Workbook has no cells');
    } else if (!Array.isArray(doc.cells)) {
      errors.push('Workbook "cells" must be a list');
    } else {
      const idSet = new Set<string>();
      const cells = doc.cells.map((raw, i) => {
        const cell = mapCell(raw, i, errors);
        if (IDENTIFIER_RE.test(cell.id)) {
          if (idSet.has(cell.id)) {
            errors.push(`Duplicate cell id: "${cell.id}"`);
          } else {
            idSet.add(cell.id);
          }
        }
        return cell;
      });

      for (const cell of cells) {
        for (const dep of cell.dependsOn ?? []) {
          if (!idSet.has(dep)) {
            errors.push(`Cell "${cell.id}": depends_on references unknown cell "${dep}"`);
          }
        }
      }

      workbook.cells = cells;
    }

    const success = errors.length === 0;
    return {
      success,
      workbook: success ? workbook : undefined,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Parse error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/** Serialize one cell to its YAML mapping shape (round-trips through mapCell). */
function serializeCell(cell: Cell): Record<string, unknown> {
  // Structural keys come from the cell fields, never from metadata.
  const out: Record<string, unknown> = { [cell.type]: cell.content, id: cell.id };
  if (cell.dependsOn && cell.dependsOn.length > 0) out.depends_on = cell.dependsOn;

  if (cell.metadata) {
    for (const [key, value] of Object.entries(cell.metadata)) {
      // Never let metadata clobber a structural/type key (would brick re-parse).
      if ((CELL_TYPE_KEYS as string[]).includes(key) || RESERVED_CELL_KEYS.includes(key)) continue;
      out[key] = value;
    }
  }

  if (cell.output !== undefined) out.output = cell.output;
  if (cell.error !== undefined) out.error = String(cell.error);
  return out;
}

/**
 * Serialize a workbook to YAML that round-trips through {@link parseWorkbook}.
 *
 * Structural fidelity (version/metadata/runtime/cells: id/type/content/dependsOn/
 * metadata) is exact. Persisted `output` values are best-effort: plain
 * primitives/arrays/objects round-trip exactly (the YAML serializer quotes
 * scalars that would otherwise re-type); exotic class instances serialize to
 * their plain shape. Throws only on a structurally invalid workbook.
 */
export function serializeWorkbook(workbook: Workbook): string {
  if (!workbook || !Array.isArray(workbook.cells)) {
    throw new Error('serializeWorkbook: invalid workbook (missing "cells" array)');
  }

  const runtime: RuntimeConfig = {
    engine: workbook.runtime?.engine ?? 'mathts',
    execution: workbook.runtime?.execution ?? 'reactive',
  };
  if (workbook.runtime?.timeout !== undefined) runtime.timeout = workbook.runtime.timeout;

  const doc = {
    version: String(workbook.version ?? '1.0'),
    metadata: workbook.metadata ?? {},
    runtime,
    cells: workbook.cells.map(serializeCell),
  };

  return stringifyYaml(doc, { lineWidth: 0 });
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

export { detectCellType, CELL_TYPE_KEYS };
