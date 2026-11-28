/**
 * mathjs 15.3.0 unit surface for compat: `Unit.UNITS` keys and
 * `Unit.isValuelessUnit` match the oracle, not native core's wider table (#1577).
 *
 * **Owner:** G14 PR #1730 (`wrapCompatUnitClass` / `wrapCompatUnitSources`).
 * G01 PR #1731 also needed `isValuelessUnit('d') === false` (#1557). That name is
 * not a mathjs `Unit.UNITS` key, so {@link isMathjsValuelessUnitName} is false.
 * Extra core names stay on the closed-over table (so `createUnit` override and
 * `_findUnit` still see them) but are hidden from `Object.keys` and from
 * `isValuelessUnit`. Do not wrap `isValuelessUnit` again in `instance-api.ts`.
 * Never assign onto `factory_mathjsCompat.constructors.Unit`.
 */

import { Complex } from '@danielsimonjr/mathts-core';
import {
  MATHJS_PREFIX_GROUPS,
  MATHJS_UNIT_NAMES,
  MATHJS_UNIT_PREFIX_GROUP,
} from './mathjs-unit-names.generated.js';
import { patchCompatUnitTypeConverters } from './patch-unit-converters.js';
import { patchCompatUnitParity, type CompatUnitParityClass } from './patch-unit-parity.js';

const MATHJS_UNIT_NAME_SET = new Set(MATHJS_UNIT_NAMES);
const MATHJS_PREFIX_GROUP_SETS = new Map(
  Object.entries(MATHJS_PREFIX_GROUPS).map(([group, prefixes]) => [group, new Set(prefixes)])
);
const MATHJS_UNITS_LONGEST_FIRST = [...MATHJS_UNIT_NAMES].sort((a, b) => b.length - a.length);

/** True when `name` is a mathjs 15.3.0 valueless unit (base or allowed `prefix+base`). */
export function isMathjsValuelessUnitName(name: string): boolean {
  if (MATHJS_UNIT_NAME_SET.has(name)) return true;
  for (const unit of MATHJS_UNITS_LONGEST_FIRST) {
    if (name.length <= unit.length || !name.endsWith(unit)) continue;
    const group = MATHJS_UNIT_PREFIX_GROUP[unit];
    const prefixes = group === undefined ? undefined : MATHJS_PREFIX_GROUP_SETS.get(group);
    if (prefixes?.has(name.slice(0, name.length - unit.length))) return true;
  }
  return false;
}

/** Per-instance unit constructor: `isValuelessUnit` plus the `UNITS` table. */
export type CompatUnitConstructorLike = {
  isValuelessUnit(name: string): boolean;
  UNITS: Record<string, unknown>;
};

/**
 * mathjs 15.3.0 units that native `core` lacks but that have a real definition in
 * mathjs: the stub copies the named core unit and may override its scale.
 * `Ah` is an electric charge of 3600 C (`new Unit(1.4, 'Ah').value === 5040`).
 */
const MATHJS_UNIT_CLONES: Readonly<Record<string, { from: string; value?: number }>> = {
  Ah: { from: 'C', value: 3600 },
  ton: { from: 'shortton' },
  tons: { from: 'shortton' },
};

function mathjsMissingStubs(units: Record<string, unknown>): void {
  for (const name of MATHJS_UNIT_NAMES) {
    if (Object.hasOwn(units, name)) continue;
    const clone = Object.hasOwn(MATHJS_UNIT_CLONES, name) ? MATHJS_UNIT_CLONES[name] : undefined;
    const source = clone === undefined ? undefined : units[clone.from];
    if (clone !== undefined && typeof source === 'object' && source !== null) {
      const copy: Record<string, unknown> = { ...(source as Record<string, unknown>), name };
      if (clone.value !== undefined) {
        copy.value = clone.value;
        delete copy.exact;
        delete copy.exactOffset;
      }
      units[name] = Object.freeze(copy);
      continue;
    }
    units[name] = Object.freeze({
      name,
      value: 1,
      dimensions: [],
      prefixes: Object.freeze({ '': Object.freeze({ name: '', value: 1, scientific: true }) }),
      offset: 0,
    });
  }
}

/**
 * `VAR` is `i` volt-amperes. The function layer builds the class without a `Complex.I`,
 * which leaves `UNITS.VAR.value` undefined and breaks `evaluate('4000 VAR')` (#1784).
 */
function restoreReactivePowerScale(units: Record<string, unknown>): void {
  const reactive = units.VAR as { value?: unknown } | undefined;
  if (reactive !== undefined && reactive.value === undefined) {
    reactive.value = new Complex(0, 1);
  }
}

/**
 * Pin `UNITS` enumeration and `isValuelessUnit` on a per-instance unit class to
 * mathjs 15.3.0. The proxy target is the table the class closed over, so
 * `createUnit` / `_findUnit` keep working. `Base` is from `createCompatUnitSources`
 * for this instance; `create(all)` must not rewrite `core` `Unit.UNITS`.
 */
export function wrapCompatUnitClass<T extends CompatUnitConstructorLike>(
  Base: T,
  registeredNames: Set<string>
): T {
  const units = Base.UNITS;
  const originalKeys = new Set(Object.keys(units));
  mathjsMissingStubs(units);
  restoreReactivePowerScale(units);

  const isVisibleKey = (prop: string): boolean =>
    MATHJS_UNIT_NAME_SET.has(prop) || !originalKeys.has(prop) || registeredNames.has(prop);

  Base.isValuelessUnit = (name: string): boolean => {
    if (isMathjsValuelessUnitName(name) || registeredNames.has(name)) return true;
    if (!Object.hasOwn(units, name)) return false;
    if (typeof units[name] === 'string') return true;
    if (!originalKeys.has(name)) return true;
    const entry = units[name];
    return typeof entry === 'object' && entry !== null && registeredNames.has(name);
  };

  Base.UNITS = new Proxy(units, {
    get(target, prop, receiver) {
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      return Reflect.set(target, prop, value, receiver);
    },
    has(target, prop) {
      return Reflect.has(target, prop);
    },
    ownKeys(target) {
      return Reflect.ownKeys(target).filter((key) => typeof key !== 'string' || isVisibleKey(key));
    },
    getOwnPropertyDescriptor(target, prop) {
      const desc = Reflect.getOwnPropertyDescriptor(target, prop);
      if (desc === undefined || typeof prop !== 'string') return desc;
      return { ...desc, enumerable: isVisibleKey(prop) };
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

/** Parse failures that native `core` raises as its own classes; mathjs 15.3.0 throws `SyntaxError`. */
const NATIVE_PARSE_ERROR_NAMES = new Set(['UnitParseError', 'AmbiguousUnitError']);

function toMathjsSyntaxError(error: unknown): unknown {
  if (error instanceof Error && NATIVE_PARSE_ERROR_NAMES.has(error.name)) {
    return new SyntaxError(error.message);
  }
  return error;
}

/** The part of an instance unit class that builds a unit with a non-finite magnitude. */
type NonFiniteUnitClass = new (
  value: null,
  valuelessUnit?: unknown
) => {
  value: unknown;
  _normalize(value: unknown): unknown;
};

function isValuelessUnitLike(candidate: unknown): boolean {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    (candidate as { isUnit?: boolean }).isUnit === true &&
    (candidate as { value?: unknown }).value === null
  );
}

/**
 * Build a unit whose magnitude is NaN or +/-Infinity. Native `core` refuses these in its
 * constructor; mathjs 15.3.0 stores them (`isNaN`, `isFinite` and `isBounded` read them).
 */
function constructNonFiniteUnit<U extends { value: unknown; _normalize(value: unknown): unknown }>(
  Ctor: new (value: null, valuelessUnit?: unknown) => U,
  value: number,
  valuelessUnit: unknown,
  newTarget: abstract new (...args: never[]) => unknown = Ctor
): U {
  const built = Reflect.construct(Ctor, [null, valuelessUnit], newTarget) as U;
  built.value = built._normalize(value);
  return built;
}

/** Coerce matrix literal aliases from `evaluate` into plain arrays for mathjs parity. */
function normalizeCreateUnitDefinitionArg(def: unknown): unknown {
  if (!def || typeof def !== 'object' || Array.isArray(def)) return def;
  const aliases = (def as { aliases?: unknown }).aliases;
  if (aliases !== null && typeof aliases === 'object' && !Array.isArray(aliases)) {
    const matrix = aliases as { data?: unknown; _data?: unknown };
    const data = Array.isArray(matrix.data)
      ? matrix.data
      : Array.isArray(matrix._data)
        ? matrix._data
        : undefined;
    if (data !== undefined) {
      return { ...(def as Record<string, unknown>), aliases: data.slice() };
    }
  }
  return def;
}

/** Aliases from a definition object (plain arrays or matrix literals from `evaluate`). */
function readCreateUnitAliasList(def: unknown): string[] {
  if (!def || typeof def !== 'object' || Array.isArray(def)) return [];
  const aliases = (def as { aliases?: unknown }).aliases;
  if (Array.isArray(aliases)) {
    return aliases.filter((entry): entry is string => typeof entry === 'string');
  }
  if (aliases !== null && typeof aliases === 'object') {
    const matrix = aliases as { data?: unknown; _data?: unknown };
    const data = Array.isArray(matrix.data)
      ? matrix.data
      : Array.isArray(matrix._data)
        ? matrix._data
        : undefined;
    if (data !== undefined) {
      return data.filter((entry): entry is string => typeof entry === 'string');
    }
    if (typeof (aliases as { forEach?: unknown }).forEach === 'function') {
      return Array.from(aliases as Iterable<unknown>).filter(
        (entry): entry is string => typeof entry === 'string'
      );
    }
  }
  return [];
}

/** Record names `createUnit` just registered so `isValuelessUnit` can see overrides. */
function rememberCreateUnitNames(args: unknown[], registeredNames: Set<string>): void {
  const head = args[0];
  if (typeof head === 'string') {
    registeredNames.add(head);
    for (const alias of readCreateUnitAliasList(args[1])) registeredNames.add(alias);
    return;
  }
  if (head && typeof head === 'object')
    for (const key of Object.keys(head as object)) registeredNames.add(key);
}

/**
 * Wrap one compatibility instance's unit constructor, `unit()`, and `createUnit()`.
 * Pins `UNITS` keys and `isValuelessUnit` to mathjs 15.3.0 without changing native core.
 */
export function wrapCompatUnitSources<T extends LocalUnitSources>(
  sources: T,
  numberMode: () => string | undefined = () => undefined
): T {
  const registeredNames = new Set<string>();
  const builtinUnitKeys = new Set(Object.keys(sources.Unit.UNITS));
  const Unit = wrapCompatUnitClass(sources.Unit, registeredNames);
  // `createUnit` keeps protecting every native name (#739); only a direct
  // `Unit.createUnitSingle` may redefine a name that mathjs 15.3.0 does not have.
  let insideCreateUnit = false;
  patchCompatUnitParity(Unit as unknown as CompatUnitParityClass, {
    numberMode,
    isCoreOnlyUnit: (name) =>
      !insideCreateUnit &&
      builtinUnitKeys.has(name) &&
      !MATHJS_UNIT_NAME_SET.has(name) &&
      !registeredNames.has(name),
    onUnitsCreated: (names) => {
      for (const name of names) registeredNames.add(name);
    },
  });
  patchCompatUnitTypeConverters(
    Unit as unknown as {
      typeConverters: Record<string, (x: unknown) => unknown>;
    }
  );
  const { unit, createUnit, update } = sources;
  const wrappedUnit = (...args: unknown[]) => {
    try {
      if (args.length >= 2 && typeof args[1] === 'string') {
        rejectMathjsIncompatibleUnitToken(args[1]);
        args = [args[0], rewriteMathjsUnitString(args[1]), ...args.slice(2)];
      }
      const value = args[0];
      const unitArg = args[1];
      if (
        args.length <= 2 &&
        typeof value === 'number' &&
        !Number.isFinite(value) &&
        (args.length === 1 || typeof unitArg === 'string' || isValuelessUnitLike(unitArg))
      ) {
        return constructNonFiniteUnit(Unit as unknown as NonFiniteUnitClass, value, unitArg);
      }
      const valueIsNaN =
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { isNaN?: () => boolean }).isNaN === 'function' &&
        (value as { isNaN(): boolean }).isNaN();
      if (args.length >= 2 && typeof unitArg === 'string' && valueIsNaN) {
        return constructNonFiniteUnit(Unit as unknown as NonFiniteUnitClass, NaN, unitArg);
      }
      return unit(...args);
    } catch (error) {
      throw toMathjsSyntaxError(error);
    }
  };
  const isProtectedUnitName = (name: string): boolean =>
    MATHJS_UNIT_NAME_SET.has(name) || builtinUnitKeys.has(name);

  /** Core ships these; mathjs 15.3.0 embedded `createUnit` examples define them (#1776). */
  const coreUnitsDefinedByMathjsDocs = new Set(['knot', 'mph']);

  const wrappedCreateUnit = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args.length >= 2) {
      args[1] = normalizeCreateUnitDefinitionArg(args[1]);
    }
    const head = args[0];
    const optionsArg =
      head && typeof head === 'object' && !Array.isArray(head)
        ? args[1]
        : args.length >= 3
          ? args[2]
          : args[1];
    const overrideRequested =
      typeof optionsArg === 'object' &&
      optionsArg !== null &&
      (optionsArg as { override?: boolean }).override === true;
    if (
      !overrideRequested &&
      typeof head === 'string' &&
      coreUnitsDefinedByMathjsDocs.has(head) &&
      (builtinUnitKeys.has(head) || Object.hasOwn(Unit.UNITS, head))
    ) {
      rememberCreateUnitNames(args, registeredNames);
      const units = Unit.UNITS as Record<string, unknown>;
      for (const alias of readCreateUnitAliasList(args[1])) units[alias] = head;
      return undefined;
    }
    if (!overrideRequested && typeof head === 'string' && registeredNames.has(head)) {
      return undefined;
    }
    if (!overrideRequested && head && typeof head === 'object' && !Array.isArray(head)) {
      const names = Object.keys(head as Record<string, unknown>);
      if (names.length > 0 && names.every((name) => registeredNames.has(name))) {
        return undefined;
      }
    }
    try {
      insideCreateUnit = true;
      const result = createUnit(...args);
      rememberCreateUnitNames(args, registeredNames);
      return result;
    } catch (error) {
      if (!overrideRequested && error instanceof Error && /already exists/.test(error.message)) {
        if (typeof head === 'string' && isProtectedUnitName(head)) {
          throw error;
        }
        rememberCreateUnitNames(args, registeredNames);
        return undefined;
      }
      throw error;
    } finally {
      insideCreateUnit = false;
    }
  };

  return {
    Unit,
    unit: wrappedUnit,
    createUnit: wrappedCreateUnit as T['createUnit'],
    update,
  } as T;
}

/**
 * Per-instance constructor that does not rewrite `Base.isValuelessUnit` (#1557).
 * G14 pins the mathjs catalog on the instance Unit via {@link wrapCompatUnitClass};
 * this wrapper still exists so `create(all)` and isolation tests do not mutate
 * the native `Unit` class. `'d'` stays false even if a caller passes core `Unit`.
 */
type CompatUnitConstructable = (new (...args: never[]) => unknown) & {
  isValuelessUnit: (name: string) => boolean;
};

/** Return a real constructor that delegates to `Base` without rewriting `Base`. */
export function wrapCompatUnitConstructor<T extends CompatUnitConstructable>(Base: T): T {
  const baseIsValuelessUnit = Base.isValuelessUnit.bind(Base);

  function CompatUnit(this: unknown, ...args: unknown[]): unknown {
    const newTarget = new.target ?? CompatUnit;
    const value = args[0];
    if (args.length <= 2 && typeof value === 'number' && !Number.isFinite(value)) {
      return constructNonFiniteUnit(
        Base as unknown as NonFiniteUnitClass,
        value,
        args[1],
        newTarget as unknown as abstract new (...a: never[]) => unknown
      );
    }
    return Reflect.construct(Base, args, newTarget);
  }

  Object.setPrototypeOf(CompatUnit, Base);
  CompatUnit.prototype = Base.prototype;
  Object.defineProperty(CompatUnit, 'name', { value: Base.name });
  CompatUnit.isValuelessUnit = (name: string): boolean => {
    if (name === 'd') return false;
    return baseIsValuelessUnit(name);
  };
  return CompatUnit as unknown as T;
}
