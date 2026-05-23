/**
 * Default backend registrations.
 *
 * This module is imported for side effects from both `./index.ts` and
 * `./BackendManager.ts`. Putting the registrations here ensures they run
 * regardless of which module the consumer imports first, and avoids a
 * back-edge from BackendManager → index → BackendManager.
 *
 * Backends declared here are *registered* but not *initialized*: the WASM
 * artifacts only load when `BackendManager.initialize()` (or a direct
 * `.initialize()` call on the backend) runs. Importing this module is
 * therefore cheap and safe in environments without WebAssembly (the
 * `isAvailable()` check on each backend is the gate).
 *
 * @packageDocumentation
 */

import { backendRegistry } from './Backend.js';
import { jsBackend } from './JSBackend.js';
import { rustWasmBackend } from './RustWASMBackend.js';
import { wasmBackend } from './WASMBackend.js';

backendRegistry.register(jsBackend);
// Order: register Rust before AS so when `BackendManager.selectBackend`
// reaches its "elementCount >= rustWasmThresh" branch it finds the Rust
// backend. AS remains available as a fallback at the lower wasm threshold.
backendRegistry.register(rustWasmBackend);
backendRegistry.register(wasmBackend);
