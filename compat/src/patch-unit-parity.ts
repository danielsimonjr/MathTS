/**
 * mathjs 15.3.0 unit parity for one compat instance `Unit` class (#1784).
 *
 * Every patch here is applied to the per-instance class that
 * `createCompatUnitSources` builds (and to its prototype), never to
 * `instanceSymbols.Unit` or to the native `core` class:
 *
 * - `Unit.parse` follows the mathjs grammar ({@link createMathjsUnitParse}).
 * - `Unit.isValidAlpha` becomes an accessor, so an override that a caller assigns on
 *   any wrapper of the class reaches the function that `createUnit` and `parse` call.
 * - `Unit.createUnitSingle` lets a caller define a name that only native `core`
 *   ships (`knots`), because mathjs 15.3.0 has no such unit.
 * - `Unit.prototype.toBest` defaults the prefix offset to 1.2, the mathjs value
 *   (native `core` defaults it to 0).
 *
 * @packageDocumentation
 */
import {
  createMathjsUnitParse,
  type MathjsUnitParse,
  type MathjsUnitParseHost,
} from './mathjs-unit-parse.js';

/** The offset that mathjs 15.3.0 `Unit.prototype.toBest` uses when the caller gives none. */
export const MATHJS_TO_BEST_OFFSET = 1.2;

/** Statics and prototype of an instance unit class that the parity patches read or replace. */
export type CompatUnitParityClass = MathjsUnitParseHost & {
  prototype: object;
  parse: MathjsUnitParse;
  UNITS: Record<string, unknown>;
  _findUnit: (name: string, unrestricted?: boolean) => { unit: unknown; prefix: unknown } | null;
  createUnitSingle: (name: unknown, definition?: unknown, options?: unknown) => unknown;
};

/** What the parity patches need to know about the instance. */
export type CompatUnitParityOptions = {
  /** Live read of the instance `config.number`. */
  numberMode: () => string | undefined;
  /** True for a name that only native `core` defines (not a mathjs 15.3.0 unit). */
  isCoreOnlyUnit: (name: string) => boolean;
  /** Called with the names that `createUnitSingle` registered. */
  onUnitsCreated: (names: readonly string[]) => void;
};

type ToBestPrototype = {
  toBest(this: unknown, unitList?: unknown, options?: Record<string, unknown>): unknown;
};

function installIsValidAlpha(Unit: CompatUnitParityClass): void {
  let current = Unit.isValidAlpha;
  Object.defineProperty(Unit, 'isValidAlpha', {
    configurable: true,
    enumerable: true,
    get: () => current,
    set: (value: (c: string) => boolean) => {
      current = value;
    },
  });
}

function aliasNames(definition: unknown): string[] {
  if (typeof definition !== 'object' || definition === null) return [];
  const aliases = (definition as { aliases?: unknown }).aliases;
  return Array.isArray(aliases) ? aliases.filter((a): a is string => typeof a === 'string') : [];
}

function installCreateUnitSingle(
  Unit: CompatUnitParityClass,
  options: CompatUnitParityOptions
): void {
  const native = Unit.createUnitSingle;
  Unit.createUnitSingle = function createUnitSingle(
    this: unknown,
    name: unknown,
    definition?: unknown,
    createOptions?: unknown
  ): unknown {
    const names = typeof name === 'string' ? [name, ...aliasNames(definition)] : [];
    const displaced = new Map<string, unknown>();
    for (const candidate of names) {
      if (Object.hasOwn(Unit.UNITS, candidate) && options.isCoreOnlyUnit(candidate)) {
        displaced.set(candidate, Unit.UNITS[candidate]);
        delete Unit.UNITS[candidate];
      }
    }
    try {
      const created = native.call(this, name, definition, createOptions);
      options.onUnitsCreated(names);
      return created;
    } catch (error) {
      for (const [key, def] of displaced) Unit.UNITS[key] = def;
      throw error;
    }
  };
}

/** `createUnit` may point alias names at a canonical unit with a string UNITS entry. */
function installFindUnitStringAliases(Unit: CompatUnitParityClass): void {
  const native = Unit._findUnit.bind(Unit);
  Unit._findUnit = ((name: string, unrestricted?: boolean) => {
    const units = Unit.UNITS;
    if (Object.hasOwn(units, name)) {
      const entry = units[name];
      if (typeof entry === 'string') {
        const resolved = native(entry, unrestricted);
        if (resolved !== null) {
          const unit =
            typeof resolved.unit === 'object' && resolved.unit !== null
              ? { ...(resolved.unit as Record<string, unknown>), name }
              : resolved.unit;
          return { unit, prefix: resolved.prefix };
        }
      }
    }
    return native(name, unrestricted);
  }) as CompatUnitParityClass['_findUnit'];
}

function installToBest(Unit: CompatUnitParityClass): void {
  const proto = Unit.prototype as ToBestPrototype;
  const native = proto.toBest;
  proto.toBest = function toBest(
    this: unknown,
    unitList?: unknown,
    toBestOptions?: Record<string, unknown>
  ): unknown {
    return native.call(this, unitList, { offset: MATHJS_TO_BEST_OFFSET, ...toBestOptions });
  };
}

/**
 * Apply the mathjs 15.3.0 unit parity patches to one instance `Unit` class.
 *
 * @param Unit - The class from `createCompatUnitSources` for this instance.
 * @param options - Instance hooks (number mode, core-only names, registration callback).
 */
export function patchCompatUnitParity(
  Unit: CompatUnitParityClass,
  options: CompatUnitParityOptions
): void {
  Unit.parse = createMathjsUnitParse(Unit, options.numberMode);
  installIsValidAlpha(Unit);
  installFindUnitStringAliases(Unit);
  installCreateUnitSingle(Unit, options);
  installToBest(Unit);
}
