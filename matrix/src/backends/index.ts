/**
 * Matrix Backend Exports
 * @packageDocumentation
 */

export {
  MatrixBackend,
  BackendType,
  BackendHints,
  BackendRegistry,
  backendRegistry,
  DEFAULT_BACKEND_HINTS,
} from './Backend.js';

export { JSBackend, jsBackend } from './JSBackend.js';

// Register JS backend by default
import { backendRegistry } from './Backend.js';
import { jsBackend } from './JSBackend.js';

backendRegistry.register(jsBackend);
