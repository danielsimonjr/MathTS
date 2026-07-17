import { registerNativeTypes } from '@danielsimonjr/mathts-core';

let initialized = false;

/**
 * Initialize the type bridge for mathjs factory compatibility.
 * Call once before using any activated mathjs-derived factories.
 */
export function initTypeBridge(): void {
  if (initialized) return;
  initialized = true;
  registerNativeTypes();
}
