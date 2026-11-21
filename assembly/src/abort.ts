/**
 * Abort handler of the binary.
 *
 * The binary has no `env.abort` import: Node reads each import of a WebAssembly module as a
 * package name, so an `abort` import made `import('@danielsimonjr/mathts-wasm/wasm')` fail
 * (#1019). The handler cannot call the host, so it stores the four arguments of the
 * AssemblyScript `abort` in module globals and traps. The host catches the
 * `WebAssembly.RuntimeError`, reads the record through the accessors below and builds the
 * `Error` text `<message> in <file>:<line>:<column>`. The glue (`scripts/patch-glue.mjs`) and
 * the loaders of `core` and `matrix` (`translateWasmAbort`) do this.
 *
 * The globals are scalars, so they are wasm globals and not heap data: the rule of `heap.ts`
 * (no module state on the heap) stays true. `message` and `fileName` are pointers to
 * AssemblyScript strings. For every `assert` and `throw` with a string literal they point into
 * static data, so they stay valid after `heap_reset`.
 */
let abortMessage: usize = 0;
let abortFile: usize = 0;
let abortLine: u32 = 0;
let abortColumn: u32 = 0;
let abortPending: bool = false;

/** The `abort` of the binary (`asconfig.json` `use`): record the arguments, then trap. */
export function trapAbort(message: usize, fileName: usize, line: u32, column: u32): void {
  abortMessage = message;
  abortFile = fileName;
  abortLine = line;
  abortColumn = column;
  abortPending = true;
  unreachable();
}

/**
 * Whether an abort is pending, and clear the flag. A trap that is not an abort (a division by
 * zero, a memory access out of bounds) leaves the flag clear, so a host does not read the
 * record of an older abort for it. Call this first, then read the record.
 */
export function abort_take(): bool {
  const pending = abortPending;
  abortPending = false;
  return pending;
}

/** Pointer to the message string of the last abort, or 0. */
export function abort_message(): usize {
  return abortMessage;
}

/** Pointer to the file name string of the last abort, or 0. */
export function abort_file(): usize {
  return abortFile;
}

/** Line of the last abort. */
export function abort_line(): u32 {
  return abortLine;
}

/** Column of the last abort. */
export function abort_column(): u32 {
  return abortColumn;
}
