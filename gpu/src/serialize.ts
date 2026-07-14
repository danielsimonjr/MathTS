/**
 * One serialization queue for every GPU dispatch in the process.
 *
 * `pushErrorScope`/`popErrorScope` is a **per-device LIFO stack**. Two dispatches in flight
 * interleave destructively: A pushes, B pushes, A submits and pops — and A pops B's scope.
 * Errors are then attributed to the wrong call, and the call that actually failed sees a
 * clean scope and returns its zero-initialised staging buffer as a success. For a reduction
 * that is a plausible-looking number; for an FFT it is a spectrum of zeros.
 *
 * `await Promise.all([fuseUnaryChainAsync(a), fftGpuDispatch(b)])` is an ordinary thing to
 * write, so this is not a theoretical hazard.
 *
 * It lives HERE, in the shared foundation, rather than in any one domain module: the hazard
 * is a property of the *device*, so a per-module queue would not prevent an element-wise
 * dispatch from racing an FFT dispatch. Every GPU entry point in the monorepo must funnel
 * through this one queue.
 *
 * Cost is ~nothing: the work serialises on a single hardware queue anyway. It also stops the
 * `BufferPool` from allocating a duplicate buffer set per concurrent caller.
 */

let gpuQueue: Promise<unknown> = Promise.resolve();

/** Run `task` after every previously-queued GPU dispatch has settled. */
export function serializeGpu<T>(task: () => Promise<T>): Promise<T> {
  // `.then(task, task)` — a previous dispatch's failure must not skip this one.
  const next = gpuQueue.then(task, task);
  // Never let one rejection poison the chain for everything behind it.
  gpuQueue = next.catch(() => undefined);
  return next;
}
