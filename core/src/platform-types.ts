/**
 * Types of platform objects that the published declarations mention.
 *
 * A declaration file that names `WebAssembly.Module` or `AbortSignal` fails in a consumer that
 * has neither the DOM lib nor `@types/node` (`skipLibCheck: false`, `lib: ["ES2022"]`). Each
 * type here is the real global type when the compiling project has it, and a minimal
 * structural type when it has not. The repository compiles with both libs, so source code
 * sees the real types.
 *
 * @packageDocumentation
 */

/** The instance type of `WebAssembly.<Key>`, or `Fallback` when the project has no such class. */
type WebAssemblyInstance<Key extends string, Fallback> = typeof globalThis extends {
  WebAssembly: { [K in Key]: { prototype: infer Instance } };
}
  ? Instance
  : Fallback;

/** A `WebAssembly.Memory`, or an object that has its `buffer` when the project has no such type. */
export type WasmMemoryHandle = WebAssemblyInstance<'Memory', { readonly buffer: ArrayBufferLike }>;

/** A compiled `WebAssembly.Module`, or an opaque object when the project has no such type. */
export type CompiledWasmModule = WebAssemblyInstance<'Module', object>;

/**
 * The part of an `AbortSignal` that MathTS reads. A real `AbortSignal` is assignable to it, so
 * callers pass `controller.signal`.
 */
export interface AbortSignalLike {
  readonly aborted: boolean;
}
