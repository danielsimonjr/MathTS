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

import {
  MATHJS_PREFIX_GROUPS,
  MATHJS_UNIT_NAMES,
  MATHJS_UNIT_PREFIX_GROUP,
} from './mathjs-unit-names.generated.js';
import { patchCompatUnitTypeConverters } from './patch-unit-converters.js';

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

function mathjsMissingStubs(units: Record<string, unknown>): void {
  for (const name of MATHJS_UNIT_NAMES) {
    if (Object.hasOwn(units, name)) continue;
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

  const isVisibleKey = (prop: string): boolean =>
    MATHJS_UNIT_NAME_SET.has(prop) || !originalKeys.has(prop) || registeredNames.has(prop);

  Base.isValuelessUnit = (name: string): boolean =>
    isMathjsValuelessUnitName(name) ||
    registeredNames.has(name) ||
    (Object.hasOwn(units, name) && !originalKeys.has(name));

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

/** Record names `createUnit` just registered so `isValuelessUnit` can see overrides. */
function rememberCreateUnitNames(args: unknown[], registeredNames: Set<string>): void {
  const head = args[0];
  if (typeof head === 'string') registeredNames.add(head);
  else if (head && typeof head === 'object')
    for (const key of Object.keys(head as object)) registeredNames.add(key);
}

/**
 * Wrap one compatibility instance's unit constructor, `unit()`, and `createUnit()`.
 * Pins `UNITS` keys and `isValuelessUnit` to mathjs 15.3.0 without changing native core.
 */
export function wrapCompatUnitSources<T extends LocalUnitSources>(sources: T): T {
  const registeredNames = new Set<string>();
  const builtinUnitKeys = new Set(Object.keys(sources.Unit.UNITS));
  const Unit = wrapCompatUnitClass(sources.Unit, registeredNames);
  patchCompatUnitTypeConverters(
    Unit as unknown as {
      typeConverters: Record<string, (x: unknown) => unknown>;
    }
  );
  const { unit, createUnit, update } = sources;
  const wrappedUnit = (...args: unknown[]) => {
    if (args.length >= 2 && typeof args[1] === 'string') {
      rejectMathjsIncompatibleUnitToken(args[1]);
      args = [args[0], rewriteMathjsUnitString(args[1]), ...args.slice(2)];
    }
    const value = args[0];
    const unitName = args[1];
    const valueIsNaN =
      typeof value === 'number'
        ? Number.isNaN(value)
        : typeof value === 'object' &&
          value !== null &&
          typeof (value as { isNaN?: () => boolean }).isNaN === 'function' &&
          (value as { isNaN(): boolean }).isNaN();
    if (args.length >= 2 && typeof unitName === 'string' && valueIsNaN) {
      const template = unit(0, unitName) as { clone(): { value: unknown } };
      const copy = template.clone();
      copy.value = typeof value === 'number' ? value : NaN;
      return copy;
    }
    return unit(...args);
  };
  const isProtectedUnitName = (name: string): boolean =>
    MATHJS_UNIT_NAME_SET.has(name) || builtinUnitKeys.has(name);

  /** Core ships these; mathjs 15.3.0 embedded `createUnit` examples define them (#1776). */
  const coreUnitsDefinedByMathjsDocs = new Set(['knot', 'mph']);

  const wrappedCreateUnit = (...args: unknown[]) => {
    const head = args[0];
    const overrideRequested =
      args.length >= 3 &&
      typeof args[2] === 'object' &&
      args[2] !== null &&
      (args[2] as { override?: boolean }).override === true;
    if (
      !overrideRequested &&
      typeof head === 'string' &&
      coreUnitsDefinedByMathjsDocs.has(head) &&
      builtinUnitKeys.has(head)
    ) {
      rememberCreateUnitNames(args, registeredNames);
      return undefined;
    }
    if (typeof head === 'string' && registeredNames.has(head)) {
      return undefined;
    }
    if (head && typeof head === 'object' && !Array.isArray(head)) {
      const names = Object.keys(head as Record<string, unknown>);
      if (names.length > 0 && names.every((name) => registeredNames.has(name))) {
        return undefined;
      }
    }
    try {
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
    return Reflect.construct(Base, args, new.target ?? CompatUnit);
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
