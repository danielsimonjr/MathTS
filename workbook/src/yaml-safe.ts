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

/**
 * Parse YAML with the hardened schema options (core schema, no merge keys).
 * Does **not** walk the result for pollution keys — callers that want
 * structured errors (the document parser) use {@link findPollutionKeys};
 * callers that should fail closed use {@link parseYamlSafe}.
 */
export function parseYamlHardened(content: string): unknown {
  return parseYaml(content, { schema: 'core', merge: false, logLevel: 'silent' });
}

/**
 * Parse YAML with hardened options and reject prototype-pollution keys.
 * Use this at CLI / executor entry points that should throw rather than
 * collect structured errors.
 */
export function parseYamlSafe(content: string): unknown {
  const value = parseYamlHardened(content);
  assertNoPollution(value);
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Collect every prototype-pollution key found anywhere in a parsed value.
 * Only traverses plain objects and arrays (never class instances / built-in
 * prototypes); a `seen` set guards against alias cycles.
 *
 * Also flags an object whose [[Prototype]] is neither `Object.prototype`
 * nor `null` — that is the shape of `obj['__proto__'] = payload`, which
 * does not create an own `__proto__` property for `getOwnPropertyNames`
 * to find.
 */
export function findPollutionKeys(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
  found: string[] = []
): string[] {
  if (!isPlainObject(value) && !Array.isArray(value)) return found;
  if (seen.has(value)) return found;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) findPollutionKeys(item, seen, found);
    return found;
  }

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    found.push('__proto__');
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
