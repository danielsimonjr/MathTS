/**
 * A `Map`-facade over a bare object (`ObjectWrappingMap`), a two-partition
 * `Map` (`PartitionedMap`), and small `Map`/object interop helpers
 * (`createMap`/`createEmptyMap`/`toObject`/`assign`).
 *
 * Bucket B slice 2 canonical — consolidated from `expression/src/utils/map.ts`
 * (270 lines) and `functions/src/utils/map.ts` (274 lines). Two real divergences
 * found and reconciled (see `functions/tests/dedup-bucketB-equivalence.test.ts`
 * for the equivalence + regression proof):
 *
 * 1. `[Symbol.iterator]` — expression's copy assigned it dynamically in the
 *    constructor via a type-erasing cast (`(this as unknown as {...})[Symbol.iterator]
 *    = this.entries`), which is runtime-equivalent but INVISIBLE to the type
 *    system: `implements Map<K, V>` was a type-checker lie that surfaced downstream
 *    as TS2420 ("incorrectly implements interface 'Map'... '[Symbol.iterator]' is
 *    missing") under `skipLibCheck: false`. functions's copy had already fixed this
 *    by declaring `[Symbol.iterator]` as a real class method returning a
 *    `MapEntryIterator<K, V>` type derived from the installed TS lib. functions's
 *    fix is the one consolidated here — it is a genuine type-soundness bug fix,
 *    not a style preference, and improves (never regresses) expression's typecheck.
 * 2. `createEmptyMap`/`createMap` generic defaults — expression used
 *    `<K = string, V = unknown>`, functions used `<K = unknown, V = unknown>`. Purely
 *    a compile-time inference default (erased at runtime; no behavioral difference).
 *    Reconciled to `K = string` here, matching `ObjectWrappingMap`/`PartitionedMap`'s
 *    own `K = string` default (already identical in both packages) and the
 *    semantically sensible default for a "scope" map keyed by variable names.
 *
 * `toObject` existed ONLY in expression's copy (consumed by `expression/src/Parser.ts`);
 * functions never had it and doesn't need it, so it is re-exported from expression's
 * shim only — the shims preserve each package's ORIGINAL export list, not an
 * invented new one.
 */
import { getSafeProperty, isSafeProperty, setSafeProperty } from './customs.js';
import { isMap, isObject } from './is.js';

/**
 * A map facade on a bare object.
 *
 * The small number of methods needed to implement a scope,
 * forwarding on to the SafeProperty functions. Over time, the codebase
 * will stop using this method, as all objects will be Maps, rather than
 * more security prone objects.
 */
/**
 * The iterator type `Map` itself declares, derived from the installed TS lib
 * rather than hard-coded: older libs say `IterableIterator<[K, V]>`, TS >= 5.6
 * says `MapIterator<[K, V]>` (which additionally requires `[Symbol.dispose]`).
 * Deriving it keeps `implements Map<K, V>` honest on every TS version.
 */
type MapEntryIterator<K, V> = ReturnType<Map<K, V>[typeof Symbol.iterator]>;

export class ObjectWrappingMap<K = string, V = unknown> implements Map<K, V> {
  wrappedObject: Record<string, V>;
  readonly [Symbol.toStringTag]: string = 'ObjectWrappingMap';

  constructor(object: Record<string, V>) {
    this.wrappedObject = object;
  }

  /**
   * Declared as a real method rather than assigned in the constructor through a
   * cast. The old form satisfied the runtime but never appeared in the emitted
   * type, so `implements Map<K, V>` was a lie that only surfaced downstream:
   * consumers compiling with `skipLibCheck: false` got TS2420 ("incorrectly
   * implements interface 'Map'... '[Symbol.iterator]' is missing").
   */
  [Symbol.iterator](): MapEntryIterator<K, V> {
    return this.entries() as MapEntryIterator<K, V>;
  }

  // @ts-expect-error: Implementation is compatible but TS can't infer it
  keys(): IterableIterator<K> {
    return Object.keys(this.wrappedObject)
      .filter((key) => this.has(key as K))
      .values() as IterableIterator<K>;
  }

  get(key: K): V | undefined {
    return getSafeProperty(this.wrappedObject, key as string) as V | undefined;
  }

  set(key: K, value: V): this {
    setSafeProperty(this.wrappedObject, key as string, value);
    return this;
  }

  has(key: K): boolean {
    return (
      isSafeProperty(this.wrappedObject, key as string) && (key as string) in this.wrappedObject
    );
  }

  // @ts-expect-error: Implementation is compatible but TS can't infer it
  entries(): IterableIterator<[K, V]> {
    return mapIterator(this.keys(), (key) => [key, this.get(key)!]) as IterableIterator<[K, V]>;
  }

  // @ts-expect-error: Implementation is compatible but TS can't infer it
  *values(): IterableIterator<V> {
    for (const key of this.keys()) {
      yield this.get(key)!;
    }
  }

  forEach(callback: (value: V, key: K, map: Map<K, V>) => void): void {
    for (const key of this.keys()) {
      callback(this.get(key)!, key, this as unknown as Map<K, V>);
    }
  }

  delete(key: K): boolean {
    if (isSafeProperty(this.wrappedObject, key as string)) {
      delete this.wrappedObject[key as string];
      return true;
    }
    return false;
  }

  clear(): void {
    for (const key of this.keys()) {
      this.delete(key);
    }
  }

  get size(): number {
    return Object.keys(this.wrappedObject).length;
  }
}

/**
 * Create a map with two partitions: a and b.
 * The set with bKeys determines which keys/values are read/written to map b,
 * all other values are read/written to map a
 *
 * For example:
 *
 *   const a = new Map()
 *   const b = new Map()
 *   const p = new PartitionedMap(a, b, new Set(['x', 'y']))
 *
 * In this case, values `x` and `y` are read/written to map `b`,
 * all other values are read/written to map `a`.
 */
export class PartitionedMap<K = unknown, V = unknown> implements Map<K, V> {
  a: Map<K, V>;
  b: Map<K, V>;
  bKeys: Set<K>;
  readonly [Symbol.toStringTag]: string = 'PartitionedMap';

  /**
   * @param a - Primary map
   * @param b - Secondary map
   * @param bKeys - Set of keys that should be read/written to map b
   */
  constructor(a: Map<K, V>, b: Map<K, V>, bKeys: Set<K>) {
    this.a = a;
    this.b = b;
    this.bKeys = bKeys;
  }

  /** See the note on `ObjectWrappingMap[Symbol.iterator]` — same fix. */
  [Symbol.iterator](): MapEntryIterator<K, V> {
    return this.entries() as MapEntryIterator<K, V>;
  }

  get(key: K): V | undefined {
    return this.bKeys.has(key) ? this.b.get(key) : this.a.get(key);
  }

  set(key: K, value: V): this {
    if (this.bKeys.has(key)) {
      this.b.set(key, value);
    } else {
      this.a.set(key, value);
    }
    return this;
  }

  has(key: K): boolean {
    return this.b.has(key) || this.a.has(key);
  }

  // @ts-expect-error: Implementation is compatible but TS can't infer it
  keys(): IterableIterator<K> {
    return new Set([...this.a.keys(), ...this.b.keys()])[Symbol.iterator]();
  }

  // @ts-expect-error: Implementation is compatible but TS can't infer it
  *values(): IterableIterator<V> {
    for (const key of this.keys()) {
      yield this.get(key)!;
    }
  }

  // @ts-expect-error: Implementation is compatible but TS can't infer it
  entries(): IterableIterator<[K, V]> {
    return mapIterator(this.keys(), (key) => [key, this.get(key)!]) as IterableIterator<[K, V]>;
  }

  forEach(callback: (value: V, key: K, map: Map<K, V>) => void): void {
    for (const key of this.keys()) {
      callback(this.get(key)!, key, this as unknown as Map<K, V>);
    }
  }

  delete(key: K): boolean {
    return this.bKeys.has(key) ? this.b.delete(key) : this.a.delete(key);
  }

  clear(): void {
    this.a.clear();
    this.b.clear();
  }

  get size(): number {
    return [...this.keys()].length;
  }
}

/**
 * Create a new iterator that maps over the provided iterator, applying a mapping function to each item
 */
function mapIterator<T, U>(it: Iterator<T>, callback: (value: T) => U): Iterator<U> {
  return {
    next: (): IteratorResult<U> => {
      const n = it.next();
      return n.done
        ? (n as IteratorResult<U>)
        : {
            value: callback(n.value),
            done: false,
          };
    },
  };
}

/**
 * Creates an empty map, or whatever your platform's polyfill is.
 *
 * @returns an empty Map or Map like object.
 */
export function createEmptyMap<K = string, V = unknown>(): Map<K, V> {
  return new Map<K, V>();
}

/**
 * Creates a Map from the given object.
 *
 * @param mapOrObject - Map or object to convert
 * @returns Map instance
 */
export function createMap<K = string, V = unknown>(
  mapOrObject?: Map<K, V> | Record<string, V> | null
): Map<K, V> {
  if (!mapOrObject) {
    return createEmptyMap<K, V>();
  }
  if (isMap(mapOrObject)) {
    return mapOrObject as Map<K, V>;
  }
  if (isObject(mapOrObject)) {
    return new ObjectWrappingMap(mapOrObject as Record<string, V>) as unknown as Map<K, V>;
  }

  throw new Error('createMap can create maps from objects or Maps');
}

/**
 * Unwraps a map into an object.
 *
 * @param map - Map to convert to object
 * @returns Plain object
 */
export function toObject<V = unknown>(map: Map<unknown, V>): Record<string, V> {
  if (map instanceof ObjectWrappingMap) {
    return map.wrappedObject;
  }
  const object: Record<string, V> = {};
  for (const key of map.keys()) {
    const value = map.get(key)!;
    setSafeProperty(object, key as string, value);
  }
  return object;
}

/**
 * Copies the contents of key-value pairs from each `objects` in to `map`.
 *
 * Object is `objects` can be a `Map` or object.
 *
 * This is the `Map` analog to `Object.assign`.
 */
export function assign<K = unknown, V = unknown>(
  map: Map<K, V>,
  ...objects: (Map<K, V> | Record<string, V> | null | undefined)[]
): Map<K, V> {
  for (const args of objects) {
    if (!args) {
      continue;
    }
    if (isMap(args)) {
      for (const key of (args as Map<K, V>).keys()) {
        map.set(key, (args as Map<K, V>).get(key)!);
      }
    } else if (isObject(args)) {
      for (const key of Object.keys(args)) {
        map.set(key as K, (args as Record<string, V>)[key]);
      }
    }
  }
  return map;
}

/**
 * Returns `true` if `object` is an {@link ObjectWrappingMap}.
 *
 * Defined here, next to the class it guards, so `is.ts` need not import
 * `map.ts` — that import was the sole edge closing the `is`/`map` cycle.
 */
export function isObjectWrappingMap(object: unknown): object is ObjectWrappingMap {
  if (!isMap(object)) return false;
  const wrapper = object as { wrappedObject?: unknown };
  return isObject(wrapper.wrappedObject);
}
