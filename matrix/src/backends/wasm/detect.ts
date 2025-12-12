/**
 * WASM Feature Detection
 *
 * Detects available WebAssembly features in the current environment.
 * Used to enable/disable SIMD, threads, and other optimizations.
 *
 * @packageDocumentation
 */

/**
 * Available WASM features
 */
export interface WasmFeatures {
  /** Basic WebAssembly support */
  webAssembly: boolean;
  /** WASM SIMD (v128) support */
  simd: boolean;
  /** SharedArrayBuffer available */
  sharedMemory: boolean;
  /** Atomics API available */
  atomics: boolean;
  /** WASM threads (requires SharedArrayBuffer) */
  threads: boolean;
  /** Bulk memory operations */
  bulkMemory: boolean;
  /** Reference types */
  referenceTypes: boolean;
  /** WASM exception handling */
  exceptions: boolean;
  /** Tail call optimization */
  tailCall: boolean;
}

/**
 * Cached feature detection result
 */
let cachedFeatures: WasmFeatures | null = null;

/**
 * Test if a WASM module with specific features can be compiled
 */
async function testWasmFeature(bytes: Uint8Array): Promise<boolean> {
  try {
    // Use buffer.slice and type assert to ArrayBuffer for WebAssembly.compile
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await WebAssembly.compile(buffer);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect WASM SIMD support
 * Test module uses v128 type
 */
async function detectSIMD(): Promise<boolean> {
  // Minimal WASM module using v128 (SIMD) type
  // (module (func (result v128) (v128.const i32x4 0 0 0 0)))
  const simdBytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, // WASM magic
    0x01, 0x00, 0x00, 0x00, // Version 1
    0x01, 0x05, 0x01, 0x60, // Type section: 1 type, function
    0x00, 0x01, 0x7b,       // () -> v128
    0x03, 0x02, 0x01, 0x00, // Function section: 1 function, type 0
    0x0a, 0x0a, 0x01, 0x08, // Code section
    0x00,                   // 0 locals
    0xfd, 0x0c,             // v128.const
    0x00, 0x00, 0x00, 0x00, // i32x4 0, 0, 0, 0
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x0b                    // end
  ]);

  return testWasmFeature(simdBytes);
}

/**
 * Detect bulk memory operations support
 */
async function detectBulkMemory(): Promise<boolean> {
  // Module using memory.copy (bulk memory)
  const bulkBytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, // WASM magic
    0x01, 0x00, 0x00, 0x00, // Version 1
    0x01, 0x04, 0x01, 0x60, // Type section
    0x00, 0x00,             // () -> ()
    0x03, 0x02, 0x01, 0x00, // Function section
    0x05, 0x03, 0x01, 0x00, // Memory section: 1 page
    0x00,
    0x0a, 0x0e, 0x01, 0x0c, // Code section
    0x00,                   // 0 locals
    0x41, 0x00,             // i32.const 0 (dest)
    0x41, 0x00,             // i32.const 0 (src)
    0x41, 0x00,             // i32.const 0 (len)
    0xfc, 0x0a, 0x00, 0x00, // memory.copy
    0x0b                    // end
  ]);

  return testWasmFeature(bulkBytes);
}

/**
 * Detect reference types support
 */
async function detectReferenceTypes(): Promise<boolean> {
  // Module using externref type
  const refBytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, // WASM magic
    0x01, 0x00, 0x00, 0x00, // Version 1
    0x01, 0x04, 0x01, 0x60, // Type section
    0x00, 0x01, 0x6f,       // () -> externref
    0x03, 0x02, 0x01, 0x00, // Function section
    0x0a, 0x05, 0x01, 0x03, // Code section
    0x00,                   // 0 locals
    0xd0, 0x6f,             // ref.null extern
    0x0b                    // end
  ]);

  return testWasmFeature(refBytes);
}

/**
 * Detect exception handling support
 */
async function detectExceptions(): Promise<boolean> {
  // Module using try/catch
  const excBytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, // WASM magic
    0x01, 0x00, 0x00, 0x00, // Version 1
    0x01, 0x04, 0x01, 0x60, // Type section
    0x00, 0x00,             // () -> ()
    0x03, 0x02, 0x01, 0x00, // Function section
    0x0d, 0x03, 0x01, 0x00, // Tag section: 1 tag
    0x00,
    0x0a, 0x0a, 0x01, 0x08, // Code section
    0x00,                   // 0 locals
    0x06, 0x40,             // try
    0x07, 0x00,             // catch tag 0
    0x0b,                   // end try
    0x0b                    // end func
  ]);

  return testWasmFeature(excBytes);
}

/**
 * Detect tail call optimization support
 */
async function detectTailCall(): Promise<boolean> {
  // Module using return_call
  const tailBytes = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, // WASM magic
    0x01, 0x00, 0x00, 0x00, // Version 1
    0x01, 0x04, 0x01, 0x60, // Type section
    0x00, 0x00,             // () -> ()
    0x03, 0x03, 0x02, 0x00, // Function section: 2 functions
    0x00,
    0x0a, 0x09, 0x02,       // Code section: 2 functions
    0x02, 0x00, 0x0b,       // func 0: empty
    0x04, 0x00,             // func 1: 0 locals
    0x12, 0x00,             // return_call 0
    0x0b                    // end
  ]);

  return testWasmFeature(tailBytes);
}

/**
 * Detect all WASM features
 *
 * @returns Promise resolving to detected features
 */
export async function detectWasmFeatures(): Promise<WasmFeatures> {
  if (cachedFeatures) {
    return cachedFeatures;
  }

  // Check basic WebAssembly support
  const webAssembly = typeof WebAssembly !== 'undefined';

  if (!webAssembly) {
    cachedFeatures = {
      webAssembly: false,
      simd: false,
      sharedMemory: false,
      atomics: false,
      threads: false,
      bulkMemory: false,
      referenceTypes: false,
      exceptions: false,
      tailCall: false,
    };
    return cachedFeatures;
  }

  // Check SharedArrayBuffer and Atomics
  const sharedMemory = typeof SharedArrayBuffer !== 'undefined';
  const atomics = typeof Atomics !== 'undefined';
  const threads = sharedMemory && atomics;

  // Test advanced features in parallel
  const [simd, bulkMemory, referenceTypes, exceptions, tailCall] = await Promise.all([
    detectSIMD(),
    detectBulkMemory(),
    detectReferenceTypes(),
    detectExceptions(),
    detectTailCall(),
  ]);

  cachedFeatures = {
    webAssembly,
    simd,
    sharedMemory,
    atomics,
    threads,
    bulkMemory,
    referenceTypes,
    exceptions,
    tailCall,
  };

  return cachedFeatures;
}

/**
 * Synchronously check if WASM is available (basic check only)
 */
export function isWasmAvailable(): boolean {
  return typeof WebAssembly !== 'undefined';
}

/**
 * Synchronously check if SharedArrayBuffer is available
 */
export function isSharedMemoryAvailable(): boolean {
  return typeof SharedArrayBuffer !== 'undefined';
}

/**
 * Synchronously check if Atomics are available
 */
export function isAtomicsAvailable(): boolean {
  return typeof Atomics !== 'undefined';
}

/**
 * Clear the feature detection cache (useful for testing)
 */
export function clearFeatureCache(): void {
  cachedFeatures = null;
}

/**
 * Get cached features if available
 */
export function getCachedFeatures(): WasmFeatures | null {
  return cachedFeatures;
}
