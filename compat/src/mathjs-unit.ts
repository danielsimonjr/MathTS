/**
 * mathjs 15.3.0 unit surface for compat: `Unit.UNITS` keys and
 * `Unit.isValuelessUnit` match the oracle, not native core's wider table (#1577).
 */

import { MATHJS_IS_VALUELESS_UNIT, MATHJS_UNIT_NAMES } from './mathjs-unit-names.generated.js';

/** Per-instance unit constructor: `isValuelessUnit` plus the `UNITS` table. */
export type CompatUnitConstructorLike = {
  isValuelessUnit(name: string): boolean;
  UNITS: Record<string, unknown>;
};

function mathjsCatalogOverrides(nativeUnits: Record<string, unknown>): Record<string, unknown> {
  const catalog: Record<string, unknown> = {};
  for (const name of MATHJS_UNIT_NAMES) {
    if (Object.hasOwn(nativeUnits, name)) catalog[name] = nativeUnits[name];
    else catalog[name] = Object.freeze({ baseName: name });
  }
  return catalog;
}

/**
 * Pin `UNITS` keys and `isValuelessUnit` on a per-instance unit class to mathjs 15.3.0.
 * `Base` is the class `createCompatUnitSources` just built for this instance, not the
 * shared native constructor; `create(all)` must not rewrite `core` `Unit.UNITS`.
 */
export function wrapCompatUnitClass<T extends CompatUnitConstructorLike>(
  Base: T,
  customValuelessUnits: Set<string>
): T {
  const nativeUnits = Base.UNITS;
  const compatCatalog = mathjsCatalogOverrides(nativeUnits);
  const customRegistry = new Map<string, unknown>();

  Base.isValuelessUnit = (name: string): boolean =>
    MATHJS_IS_VALUELESS_UNIT[name] === true || customValuelessUnits.has(name);

  const resolve = (prop: string): unknown => {
    if (customRegistry.has(prop)) return customRegistry.get(prop);
    if (Object.hasOwn(compatCatalog, prop)) return compatCatalog[prop];
    if (Object.hasOwn(nativeUnits, prop)) return nativeUnits[prop];
    return undefined;
  };

  Base.UNITS = new Proxy(compatCatalog, {
    get(_target, prop, receiver) {
      if (typeof prop !== 'string') return Reflect.get(_target, prop, receiver);
      return resolve(prop);
    },
    set(_target, prop, value, receiver) {
      if (typeof prop !== 'string') return Reflect.set(_target, prop, value, receiver);
      nativeUnits[prop] = value;
      if (MATHJS_UNIT_NAMES.includes(prop)) compatCatalog[prop] = value;
      else customRegistry.set(prop, value);
      return true;
    },
    has(_target, prop) {
      return typeof prop === 'string' && resolve(prop) !== undefined;
    },
    ownKeys() {
      return [...MATHJS_UNIT_NAMES, ...customRegistry.keys()];
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      if (!MATHJS_UNIT_NAMES.includes(prop) && !customRegistry.has(prop)) return undefined;
      return { configurable: true, enumerable: true, writable: true, value: resolve(prop) };
    },
  }) as Record<string, unknown>;

  return Base;
}

/** mathjs 15.3.0 parses these; native `core` throws or reads a different table. */
const MATHJS_UNIT_PARSE_ALIASES: Readonly<Record<string, string>> = {
  ton: 'shortton',
  tons: 'shortton',
};

function rewriteMathjsUnitString(uStr: string): string {
  const trimmed = uStr.trim();
  return MATHJS_UNIT_PARSE_ALIASES[trimmed] ?? trimmed;
}

/** Single-token unit strings native `core` exposes but mathjs 15.3.0 rejects in `unit()`. */
const MATHJS_REJECTED_UNIT_TOKENS = new Set(['c']);

function rejectMathjsIncompatibleUnitToken(uStr: string): void {
  const trimmed = uStr.trim();
  if (!trimmed.includes(' ') && MATHJS_REJECTED_UNIT_TOKENS.has(trimmed)) {
    throw new SyntaxError(`Unit "${trimmed}" not found.`);
  }
}

type LocalUnitSources = {
  Unit: CompatUnitConstructorLike;
  unit: (...args: unknown[]) => unknown;
  createUnit: (...args: unknown[]) => unknown;
  update: (current: unknown, previous: unknown) => void;
};

function rememberCreateUnitNames(args: unknown[], customValuelessUnits: Set<string>): void {
  const head = args[0];
  if (typeof head === 'string') customValuelessUnits.add(head);
  else if (head && typeof head === 'object')
    for (const key of Object.keys(head as object)) customValuelessUnits.add(key);
}

/**
 * Wrap one compatibility instance's unit constructor, `unit()`, and `createUnit()`.
 * Pins `UNITS` keys and `isValuelessUnit` to mathjs 15.3.0 without changing native core.
 */
export function wrapCompatUnitSources<T extends LocalUnitSources>(sources: T): T {
  const customValuelessUnits = new Set<string>();
  const Unit = wrapCompatUnitClass(sources.Unit, customValuelessUnits);
  const { unit, createUnit, update } = sources;
  const wrappedUnit = (...args: unknown[]) => {
    if (args.length >= 2 && typeof args[1] === 'string') {
      rejectMathjsIncompatibleUnitToken(args[1]);
      args = [args[0], rewriteMathjsUnitString(args[1]), ...args.slice(2)];
    }
    return unit(...args);
  };
  const wrappedCreateUnit = (...args: unknown[]) => {
    const result = createUnit(...args);
    rememberCreateUnitNames(args, customValuelessUnits);
    return result;
  };

  return {
    Unit,
    unit: wrappedUnit,
    createUnit: wrappedCreateUnit as T['createUnit'],
    update,
  } as T;
}
