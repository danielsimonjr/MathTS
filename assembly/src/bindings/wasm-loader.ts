/**
 * WASM Module Loader
 *
 * TypeScript bindings for loading and using the MathTS WASM module.
 * This provides a clean interface for JavaScript/TypeScript consumers.
 */

// Type definitions for the WASM module exports
export interface MathTSWasmExports {
  // Memory
  memory: WebAssembly.Memory;

  // Scalar operations
  add_f64(a: number, b: number): number;
  sub_f64(a: number, b: number): number;
  mul_f64(a: number, b: number): number;
  div_f64(a: number, b: number): number;
  sqrt_f64(a: number): number;
  pow_f64(a: number, b: number): number;
  exp_f64(a: number): number;
  log_f64(a: number): number;
  sin_f64(a: number): number;
  cos_f64(a: number): number;
  tan_f64(a: number): number;
  abs_f64(a: number): number;

  // Array operations (pointers)
  array_sum(dataPtr: number): number;
  array_dot(aPtr: number, bPtr: number): number;
  array_norm(dataPtr: number): number;

  // Matrix operations (pointers)
  matrix_multiply(aPtr: number, aRows: number, aCols: number, bPtr: number, bCols: number, resultPtr: number): void;
  matrix_transpose(aPtr: number, rows: number, cols: number, resultPtr: number): void;
  matrix_trace(dataPtr: number, rows: number, cols: number): number;
  matrix_norm_frobenius(dataPtr: number): number;

  // Memory management
  __new(size: number, id: number): number;
  __pin(ptr: number): number;
  __unpin(ptr: number): void;
  __collect(): void;
}

export interface MathTSWasmInstance {
  exports: MathTSWasmExports;
  module: WebAssembly.Module;
}

/**
 * Load the WASM module from a URL or buffer
 */
export async function loadWasm(source: string | BufferSource): Promise<MathTSWasmInstance> {
  let wasmModule: WebAssembly.Module;

  if (typeof source === 'string') {
    // Load from URL
    if (typeof fetch !== 'undefined') {
      const response = await fetch(source);
      const buffer = await response.arrayBuffer();
      wasmModule = await WebAssembly.compile(buffer);
    } else {
      // Node.js environment
      const fs = await import('fs');
      const path = await import('path');
      const buffer = fs.readFileSync(path.resolve(source));
      wasmModule = await WebAssembly.compile(buffer);
    }
  } else {
    // Load from buffer
    wasmModule = await WebAssembly.compile(source);
  }

  const imports = createImports();
  const instance = await WebAssembly.instantiate(wasmModule, imports);

  return {
    exports: instance.exports as unknown as MathTSWasmExports,
    module: wasmModule,
  };
}

/**
 * Synchronously load the WASM module (Node.js only)
 */
export function loadWasmSync(source: BufferSource): MathTSWasmInstance {
  const wasmModule = new WebAssembly.Module(source);
  const imports = createImports();
  const instance = new WebAssembly.Instance(wasmModule, imports);

  return {
    exports: instance.exports as unknown as MathTSWasmExports,
    module: wasmModule,
  };
}

/**
 * Create the import object for WASM instantiation
 */
function createImports(): WebAssembly.Imports {
  return {
    env: {
      // Abort handler
      abort(messagePtr: number, fileNamePtr: number, line: number, column: number): void {
        console.error(`WASM abort at ${line}:${column}`);
        throw new Error('WASM execution aborted');
      },

      // Trace for debugging (optional)
      trace(messagePtr: number, numArgs: number): void {
        // Debug tracing - can be implemented if needed
      },

      // Seed for random numbers
      seed(): number {
        return Date.now() * Math.random();
      },
    },
  };
}

/**
 * High-level WASM wrapper with convenient array operations
 */
export class MathTSWasm {
  private instance: MathTSWasmInstance;
  private memory: WebAssembly.Memory;
  private exports: MathTSWasmExports;

  private constructor(instance: MathTSWasmInstance) {
    this.instance = instance;
    this.exports = instance.exports;
    this.memory = instance.exports.memory;
  }

  /**
   * Create a new MathTSWasm instance
   */
  static async create(source: string | BufferSource): Promise<MathTSWasm> {
    const instance = await loadWasm(source);
    return new MathTSWasm(instance);
  }

  /**
   * Get raw exports for advanced usage
   */
  get raw(): MathTSWasmExports {
    return this.exports;
  }

  // =========================================================================
  // Scalar Operations
  // =========================================================================

  add(a: number, b: number): number {
    return this.exports.add_f64(a, b);
  }

  subtract(a: number, b: number): number {
    return this.exports.sub_f64(a, b);
  }

  multiply(a: number, b: number): number {
    return this.exports.mul_f64(a, b);
  }

  divide(a: number, b: number): number {
    return this.exports.div_f64(a, b);
  }

  sqrt(a: number): number {
    return this.exports.sqrt_f64(a);
  }

  pow(a: number, b: number): number {
    return this.exports.pow_f64(a, b);
  }

  exp(a: number): number {
    return this.exports.exp_f64(a);
  }

  log(a: number): number {
    return this.exports.log_f64(a);
  }

  sin(a: number): number {
    return this.exports.sin_f64(a);
  }

  cos(a: number): number {
    return this.exports.cos_f64(a);
  }

  tan(a: number): number {
    return this.exports.tan_f64(a);
  }

  abs(a: number): number {
    return this.exports.abs_f64(a);
  }

  // =========================================================================
  // Memory Helpers
  // =========================================================================

  /**
   * Allocate a Float64Array in WASM memory
   */
  allocFloat64Array(length: number): { ptr: number; array: Float64Array } {
    const FLOAT64_ARRAY_ID = 3; // AssemblyScript array type ID
    const byteLength = length * 8;
    const ptr = this.exports.__new(byteLength + 16, FLOAT64_ARRAY_ID);
    this.exports.__pin(ptr);

    const view = new DataView(this.memory.buffer);
    view.setInt32(ptr, ptr + 16, true);     // data pointer
    view.setInt32(ptr + 4, length, true);   // length

    const array = new Float64Array(this.memory.buffer, ptr + 16, length);
    return { ptr, array };
  }

  /**
   * Free a previously allocated array
   */
  freeArray(ptr: number): void {
    this.exports.__unpin(ptr);
  }

  /**
   * Copy a JavaScript array to WASM memory
   */
  copyToWasm(data: ArrayLike<number>): { ptr: number; array: Float64Array } {
    const { ptr, array } = this.allocFloat64Array(data.length);
    for (let i = 0; i < data.length; i++) {
      array[i] = data[i];
    }
    return { ptr, array };
  }

  /**
   * Copy from WASM memory to a new JavaScript array
   */
  copyFromWasm(ptr: number, length: number): Float64Array {
    const offset = ptr + 16; // Skip header
    return new Float64Array(this.memory.buffer.slice(offset, offset + length * 8));
  }

  /**
   * Run garbage collection
   */
  gc(): void {
    this.exports.__collect();
  }
}

/**
 * Default export for convenience
 */
export default MathTSWasm;
