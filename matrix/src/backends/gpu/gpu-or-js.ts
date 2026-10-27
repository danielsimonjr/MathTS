/**
 * Route a matrix op to GPU when over the element threshold, else JS (with optional fallback).
 */

export async function gpuOrJs<T>(
  useGpu: boolean,
  js: () => T,
  gpu: () => Promise<T>,
  executeWithFallback: (gpuOp: () => Promise<T>, fallback: () => T) => Promise<T>
): Promise<T> {
  if (!useGpu) {
    return js();
  }
  return executeWithFallback(gpu, js);
}
