import Emitter from 'tiny-emitter';

export interface EmitterMixin {
  on: (event: string, callback: (...args: unknown[]) => void, context?: unknown) => void;
  off: (event: string, callback?: (...args: unknown[]) => void) => void;
  once: (event: string, callback: (...args: unknown[]) => void, context?: unknown) => void;
  emit: (event: string, ...args: unknown[]) => void;
}

interface TinyEmitterInstance {
  on(event: string, callback: (...args: unknown[]) => void, ctx?: unknown): TinyEmitterInstance;
  off(event: string, callback?: (...args: unknown[]) => void): TinyEmitterInstance;
  once(event: string, callback: (...args: unknown[]) => void, ctx?: unknown): TinyEmitterInstance;
  emit(event: string, ...args: unknown[]): TinyEmitterInstance;
}

/**
 * Extend given object with emitter functions `on`, `off`, `once`, `emit`
 * @param obj - Object to extend with emitter functions
 * @return The object with emitter methods
 */
export function mixin<T extends object>(obj: T): T & EmitterMixin {
  // create event emitter
  const emitter = new (Emitter as unknown as new () => TinyEmitterInstance)();

  // bind methods to obj (we don't want to expose the emitter.e Array...)
  const extendedObj = obj as T & EmitterMixin;
  extendedObj.on = emitter.on.bind(emitter);
  extendedObj.off = emitter.off.bind(emitter);
  extendedObj.once = emitter.once.bind(emitter);
  extendedObj.emit = emitter.emit.bind(emitter);

  return extendedObj;
}
