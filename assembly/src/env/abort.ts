/**
 * Custom abort handler for AssemblyScript
 *
 * This provides a minimal abort implementation that doesn't require
 * string operations (which are expensive in WASM).
 */

/**
 * Abort function - called when assertions fail or errors occur
 */
export function abort(
  message: string | null,
  fileName: string | null,
  lineNumber: u32,
  columnNumber: u32
): void {
  // In release builds, this is typically optimized away with --noAssert
  // For debug builds, it signals to the host environment
  unreachable();
}
