// `bun test` has no `vi.stubGlobal` / `vi.unstubAllGlobals` (Bun 1.4.2). These
// helpers reproduce vitest's semantics: the first stub of a name saves the
// original property descriptor, the stub is a writable, configurable,
// enumerable data property, and `unstubAllGlobals` restores every saved
// descriptor (or deletes the property when there was none).
const originals = new Map<PropertyKey, PropertyDescriptor | undefined>();

export function stubGlobal(name: PropertyKey, value: unknown): void {
  if (!originals.has(name)) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

export function unstubAllGlobals(): void {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
  originals.clear();
}
