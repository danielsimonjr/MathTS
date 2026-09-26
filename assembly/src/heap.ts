/**
 * Heap reset for the stub runtime.
 *
 * The binary is built with `--runtime stub`: a bump allocator that never frees, so every
 * managed-ABI call (`__new` for the inputs, plus the result array a kernel allocates) grows
 * linear memory for good. The `functions` bridges call `heap_reset` after each managed
 * call has copied its results out, which returns the bump pointer to the heap start and
 * bounds memory by the largest single call.
 *
 * Safe only because nothing persistent lives on the heap: every module-level binding in
 * this source is a scalar constant, and the bridges are synchronous and never hold an AS
 * pointer across calls. A heap-allocated global (`let cache = new Float64Array(n)`) would
 * be overwritten after a reset; keep module state out of the heap, or drop this reset.
 */
export function heap_reset(): void {
  __reset();
}
