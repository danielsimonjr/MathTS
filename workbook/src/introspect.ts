/**
 * Engine introspection shared by the CLI (`capabilities`, `functions`) and the
 * serve JSON-RPC router. Imports only constants + the math package, so both the
 * CLI and the RPC layer can use it without an import cycle.
 */

import * as mathFunctions from '@danielsimonjr/mathts-functions';
import { VERSION, SCHEMA_VERSION, COMMAND_NAMES } from './contract';
import { SUPPORTED_CELL_TYPES } from './parser';

let functionsCache: { functions: string[]; constants: string[] } | undefined;

/**
 * Names a code cell can call/use, from the exported surface of
 * `@danielsimonjr/mathts-functions`. Names only (no signatures); computed once.
 * Best-effort — the exported surface, not the engine's full internal symbol table.
 */
export function listFunctions(): { functions: string[]; constants: string[] } {
  if (functionsCache) return functionsCache;
  const functions: string[] = [];
  const constants: string[] = [];
  for (const [name, value] of Object.entries(mathFunctions)) {
    if (typeof value === 'function') functions.push(name);
    else if (value !== null && typeof value !== 'object') constants.push(name);
  }
  functionsCache = { functions: functions.sort(), constants: constants.sort() };
  return functionsCache;
}

/** Capabilities payload — version, cell types, command list, feature flags. */
export function capabilitiesInfo(): {
  name: string;
  version: string;
  schemaVersion: typeof SCHEMA_VERSION;
  cellTypes: { supported: string[]; deferred: string[] };
  commands: string[];
  features: Record<string, boolean>;
} {
  return {
    name: 'mtsw',
    version: VERSION,
    schemaVersion: SCHEMA_VERSION,
    cellTypes: {
      supported: [...SUPPORTED_CELL_TYPES],
      deferred: ['tensor', 'equation', 'visualization', 'export'],
    },
    commands: [...COMMAND_NAMES],
    features: {
      json: true,
      write: true,
      runCell: true,
      editCell: true,
      serve: true,
      incremental: true,
      functions: true,
    },
  };
}
