/**
 * Abort translation of the loaders (#1019). The binary of `@danielsimonjr/mathts-wasm` has no
 * `env.abort` import: an AssemblyScript abort stores its message, file, line and column in
 * globals and traps as a `WebAssembly.RuntimeError`. `translateWasmAbort` and `guardWasmAborts`
 * turn that trap into an `Error`: the detail `<message> in <file>:<line>:<column>` (the text of the
 * AssemblyScript glue), or the fixed text of a loader with the detail as its `cause`. The tests
 * use a fake binary (a memory that holds two AssemblyScript strings and the
 * accessor functions), so they need no build.
 */
import { describe, it, expect } from 'vitest';
import { guardWasmAborts, translateWasmAbort } from '../src/wasm-loader.js';

/** Write an AssemblyScript string (UTF-16, byte length at pointer - 4) into `buffer`. */
function putString(buffer: ArrayBuffer, pointer: number, text: string): void {
  new Uint32Array(buffer)[(pointer - 4) >>> 2] = text.length * 2;
  const units = new Uint16Array(buffer);
  for (let i = 0; i < text.length; i++) units[(pointer >>> 1) + i] = text.charCodeAt(i);
}

function fakeBinary(pending = true) {
  const buffer = new ArrayBuffer(4096);
  putString(buffer, 64, 'Index out of range');
  putString(buffer, 256, '~lib/typedarray.ts');
  const state = { pending, takes: 0 };
  const trap = () => {
    throw new WebAssembly.RuntimeError('unreachable');
  };
  const exports = {
    memory: { buffer },
    __new: (size: number) => size,
    abort_take: () => {
      state.takes++;
      const was = state.pending;
      state.pending = false;
      return was ? 1 : 0;
    },
    abort_message: () => 64,
    abort_file: () => 256,
    abort_line: () => 1457,
    abort_column: () => 64,
    add: (a: number, b: number) => a + b,
    boom: trap,
    divide: () => {
      throw new WebAssembly.RuntimeError('divide by zero');
    },
    typeError: () => {
      throw new TypeError('not a trap');
    },
  };
  return { exports, state };
}

describe('translateWasmAbort', () => {
  it('turns the trap of an abort into an Error with the message, file, line and column', () => {
    const { exports } = fakeBinary();
    const trap = new WebAssembly.RuntimeError('unreachable');
    const out = translateWasmAbort(trap, exports);
    expect(out).toBeInstanceOf(Error);
    expect(out).not.toBeInstanceOf(WebAssembly.RuntimeError);
    expect((out as Error).message).toBe('Index out of range in ~lib/typedarray.ts:1457:64');
    expect((out as Error).cause).toBe(trap);
  });

  it('with a text, gives an Error of that text and keeps the detail as its cause', () => {
    const { exports } = fakeBinary();
    const trap = new WebAssembly.RuntimeError('unreachable');
    const out = translateWasmAbort(trap, exports, 'WASM abort') as Error;
    expect(out.name).toBe('Error');
    expect(out.message).toBe('WASM abort');
    const detail = out.cause as Error;
    expect(detail.message).toBe('Index out of range in ~lib/typedarray.ts:1457:64');
    expect(detail.cause).toBe(trap);
  });

  it('with a text, returns a trap that is not an abort as it is', () => {
    const { exports } = fakeBinary(false);
    const trap = new WebAssembly.RuntimeError('memory access out of bounds');
    expect(translateWasmAbort(trap, exports, 'WASM abort')).toBe(trap);
  });

  it('reads the record once: a later trap that is not an abort stays as it is', () => {
    const { exports } = fakeBinary();
    translateWasmAbort(new WebAssembly.RuntimeError('unreachable'), exports);
    const other = new WebAssembly.RuntimeError('memory access out of bounds');
    expect(translateWasmAbort(other, exports)).toBe(other);
  });

  it('returns a value that is not a RuntimeError as it is, without reading the record', () => {
    const { exports, state } = fakeBinary();
    const error = new TypeError('x');
    expect(translateWasmAbort(error, exports)).toBe(error);
    expect(translateWasmAbort('text', exports)).toBe('text');
    expect(state.takes).toBe(0);
  });

  it('returns the trap when the binary has no abort accessors', () => {
    const trap = new WebAssembly.RuntimeError('unreachable');
    expect(translateWasmAbort(trap, { memory: { buffer: new ArrayBuffer(8) } })).toBe(trap);
  });
});

describe('guardWasmAborts', () => {
  it('translates the abort of any guarded function and passes arguments and results through', () => {
    const { exports } = fakeBinary();
    const guarded = guardWasmAborts(exports);
    expect(guarded.add(2, 3)).toBe(5);
    expect(() => guarded.boom()).toThrow('Index out of range in ~lib/typedarray.ts:1457:64');
  });

  it('leaves a trap that is not an abort, and any other error, as it is', () => {
    const { exports } = fakeBinary(false);
    const guarded = guardWasmAborts(exports);
    expect(() => guarded.divide()).toThrow(WebAssembly.RuntimeError);
    expect(() => guarded.typeError()).toThrow(TypeError);
  });

  it('keeps the memory and the abort accessors as they are', () => {
    const { exports } = fakeBinary();
    const guarded = guardWasmAborts(exports);
    expect(guarded.memory).toBe(exports.memory);
    expect(guarded.abort_take).toBe(exports.abort_take);
    expect(guarded.abort_message).toBe(exports.abort_message);
  });

  it('guards the runtime helpers: an abort of __new does not stay pending for a later trap', () => {
    // `__new` aborts above the size limit of the runtime. Without a guard its abort stayed pending,
    // and the next trap of another kind (here `divide`) got the record of that abort.
    const { exports, state } = fakeBinary(false);
    const helper = {
      ...exports,
      __new: (_size: number): number => {
        state.pending = true;
        throw new WebAssembly.RuntimeError('unreachable');
      },
    };
    const guarded = guardWasmAborts(helper, 'WASM abort');
    expect(() => guarded.__new(8)).toThrow(new Error('WASM abort'));
    expect(state.pending).toBe(false);
    expect(() => guarded.divide()).toThrow(WebAssembly.RuntimeError);
  });

  it('passes the text to every guarded function', () => {
    const { exports } = fakeBinary();
    const guarded = guardWasmAborts(exports, 'AS WASM abort');
    expect(() => guarded.boom()).toThrow(new Error('AS WASM abort'));
  });

  it('returns a binary without the accessors unchanged', () => {
    const bare = { add: (a: number, b: number) => a + b };
    expect(guardWasmAborts(bare)).toBe(bare);
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 9])(
    'passes every argument of an export of %i parameters and keeps its arity up to six',
    (arity) => {
      const { exports } = fakeBinary();
      const sum = new Function(
        ...Array.from({ length: arity }, (_, i) => `p${i}`),
        `return [${Array.from({ length: arity }, (_, i) => `p${i}`).join(', ')}].reduce((s, v) => s + v, 0);`
      ) as (...args: number[]) => number;
      expect(sum.length).toBe(arity);
      const guarded = guardWasmAborts({ ...exports, sum }) as typeof exports & {
        sum: (...args: number[]) => number;
      };
      const args = Array.from({ length: arity }, (_, i) => i + 1);
      expect(guarded.sum(...args)).toBe(args.reduce((s, v) => s + v, 0));
      // A missing argument reads as undefined, as in a direct call.
      if (arity > 0) expect(guarded.sum(...args.slice(0, -1))).toBeNaN();
      if (arity <= 6) expect(guarded.sum.length).toBe(arity);
    }
  );

  it('translates the abort of an export of seven or more parameters', () => {
    const { exports } = fakeBinary();
    const wide = (
      _a: number,
      _b: number,
      _c: number,
      _d: number,
      _e: number,
      _f: number,
      _g: number
    ) => {
      throw new WebAssembly.RuntimeError('unreachable');
    };
    const guarded = guardWasmAborts({ ...exports, wide });
    expect(() => guarded.wide(1, 2, 3, 4, 5, 6, 7)).toThrow(
      'Index out of range in ~lib/typedarray.ts:1457:64'
    );
  });
});
