/**
 * Matrix Backend Exports
 * @packageDocumentation
 */

export {
  BackendRegistry,
  backendRegistry,
  DEFAULT_BACKEND_HINTS,
} from './Backend.js';

export type {
  MatrixBackend,
  BackendType,
  BackendHints,
} from './Backend.js';

export { JSBackend, jsBackend } from './JSBackend.js';

export {
  ParallelBackend,
  parallelBackend,
  createParallelBackend,
  type ParallelBackendConfig,
} from './ParallelBackend.js';

// Register JS backend by default
import { backendRegistry } from './Backend.js';
import { jsBackend } from './JSBackend.js';

backendRegistry.register(jsBackend);
