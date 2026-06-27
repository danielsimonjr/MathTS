/**
 * Hardened YAML parsing shared by the workbook parser (document load) and the
 * executor (data-cell payloads). Centralizing it keeps the two YAML entry
 * points consistent: core schema only (no YAML 1.1 / custom-tag surprises),
 * merge keys disabled, library warnings silenced, plus a prototype-pollution
 * guard.
 */

import { parse as parseYaml } from 'yaml';

/** Keys that enable prototype pollution; rejected anywhere in parsed data. */
const POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Parse YAML with the hardened options. Throws on malformed input. */
export function parseYamlHardened(content: string): unknown {
  return parseYaml(content, { schema: 'core', merge: false, logLevel: 'silent' });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Collect every prototype-pollution key found anywhere in a parsed value.
 * Only traverses plain objects and arrays (never class instances / built-in
 * prototypes); a `seen` set guards against alias cycles.
 */
export function findPollutionKeys(value: unknown, seen: WeakSet<object> = new WeakSet(), found: string[] = []): string[] {
  if (!isPlainObject(value) && !Array.isArray(value)) return found;
  if (seen.has(value)) return found;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) findPollutionKeys(item, seen, found);
    return found;
  }

  for (const key of Object.getOwnPropertyNames(value)) {
    if (POLLUTION_KEYS.has(key)) {
      found.push(key);
      continue;
    }
    findPollutionKeys(value[key], seen, found);
  }
  return found;
}

/** Throw if a parsed value contains any prototype-pollution key. */
export function assertNoPollution(value: unknown): void {
  const keys = findPollutionKeys(value);
  if (keys.length > 0) {
    throw new Error(`Disallowed key "${keys[0]}" (prototype pollution)`);
  }
}
