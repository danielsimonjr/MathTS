/**
 * Register workerpool worker methods so that workerpool uses its Node branch
 * under Bun.
 *
 * Bun exposes the Web Worker globals (`self`, `postMessage`,
 * `addEventListener`) inside a `node:worker_threads` worker. workerpool's
 * worker runtime tests for those globals first, so under Bun it takes its
 * BROWSER branch. Two defects follow:
 *
 * 1. Bun delivers a parent's `worker.postMessage(...)` only to `parentPort`,
 *    never to the global `message` listener. The worker sends `ready`, then
 *    never receives a task, and every dispatch times out.
 * 2. The browser branch defines no `worker.exit`. A graceful
 *    `pool.terminate()` therefore waits the full `workerTerminateTimeout`
 *    (the pool's `idleTimeout`, 60 s by default) before a forced kill.
 *
 * Node is unaffected: it has no worker globals. A browser has no
 * `parentPort`, so nothing changes there either.
 *
 * workerpool loads its worker runtime lazily, inside the `worker(methods)`
 * call, and picks the branch at that moment. This wrapper hides
 * `addEventListener` for the duration of that call only, then restores it.
 * workerpool then uses `parentPort` for messages and `process.exit` for
 * termination, which is its genuine `worker_threads` path.
 *
 * @packageDocumentation
 */

function isBunWorkerThread(): boolean {
  if (typeof (globalThis as { Bun?: unknown }).Bun === 'undefined') return false;
  const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process;
  if (typeof proc?.getBuiltinModule !== 'function') return false;
  const wt = proc.getBuiltinModule('node:worker_threads') as { parentPort: unknown } | undefined;
  return wt?.parentPort != null;
}

/**
 * Call workerpool's `worker(methods)` so that it selects its Node branch in a
 * Bun `worker_threads` worker. Elsewhere it calls `register(methods)` unchanged.
 *
 * @param register - workerpool's `worker` export.
 * @param methods - The worker methods to register.
 */
export function registerWorkerMethods<M>(register: (methods: M) => unknown, methods: M): void {
  if (!isBunWorkerThread()) {
    register(methods);
    return;
  }
  const g = globalThis as { addEventListener?: unknown };
  const saved = g.addEventListener;
  g.addEventListener = undefined;
  try {
    register(methods);
  } finally {
    g.addEventListener = saved;
  }
}
