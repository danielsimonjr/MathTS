/**
 * Property layout of a compat instance (#1200).
 *
 * V8 keeps an object in fast mode only up to 1020 own properties. Above that,
 * every property read is a dictionary lookup. So the instance holds as own keys
 * only the names of the mathjs instance (`MATHJS_PARITY_NAMES`). Every other
 * name goes on a chain of prototype levels below the instance. No level holds
 * more than {@link PROTOTYPE_LEVEL_CAP} names.
 *
 * @packageDocumentation
 */

/** The maximum number of names on one prototype level. V8's limit is 1020. */
export const PROTOTYPE_LEVEL_CAP = 900;

/**
 * Makes the prototype levels for `count` names, linked in order: level 0
 * inherits from level 1, and the last level inherits from `Object.prototype`.
 *
 * @param count - The number of names that go on the levels.
 * @returns The levels and the number of names that go on each level.
 */
export function createPrototypeLevels(count: number): {
  levels: Record<string, unknown>[];
  perLevel: number;
} {
  const levelCount = Math.ceil(count / PROTOTYPE_LEVEL_CAP);
  const levels: Record<string, unknown>[] = [];
  let parent: object = Object.prototype;
  for (let i = 0; i < levelCount; i += 1) {
    const level = Object.create(parent) as Record<string, unknown>;
    levels.unshift(level);
    parent = level;
  }
  return { levels, perLevel: levelCount === 0 ? 0 : Math.ceil(count / levelCount) };
}

/**
 * Defines a permanent accessor for `key` on a prototype level. The getter builds
 * the value on the first read and caches it. The setter stores a new value in the
 * accessor's closure, so an assignment adds no own key to the instance. The
 * accessor stays an accessor: redefining a prototype property as a data property
 * puts the prototype in dictionary mode.
 *
 * Integrity levels behave as for an own data property of `owner` (#1223): an
 * assignment through a sealed or non-extensible `owner` works, and an assignment
 * through a frozen `owner` throws a `TypeError`. An assignment through another
 * receiver (an object that inherits from `owner`) defines an own data property on
 * that receiver, as an inherited writable data property does.
 *
 * @param level - The prototype level.
 * @param key - The name.
 * @param build - Makes the value on the first read.
 * @param owner - The instance that the level belongs to.
 */
export function definePrototypeAccessor(
  level: Record<string, unknown>,
  key: string,
  build: () => unknown,
  owner: object
): void {
  let built = false;
  let stored: unknown;
  Object.defineProperty(level, key, {
    enumerable: true,
    configurable: true,
    get() {
      if (!built) {
        stored = build();
        built = true;
      }
      return stored;
    },
    set(this: object, value: unknown) {
      if (this !== owner) {
        // Throws a TypeError when the receiver is not extensible.
        Object.defineProperty(this, key, {
          value,
          writable: true,
          enumerable: true,
          configurable: true,
        });
        return;
      }
      if (Object.isFrozen(owner)) {
        throw new TypeError(`Cannot assign to read only property '${key}' of object`);
      }
      stored = value;
      built = true;
    },
  });
}
