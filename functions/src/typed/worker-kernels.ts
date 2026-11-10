/**
 * Worker kernel sources for the element-wise special functions and distributions.
 *
 * The typed `Float64Array` signatures of these functions are synchronous. The functions run
 * on the calling thread. To run one of these functions on worker threads, give the source
 * that `workerKernel` returns to `computePool.applyKernel`:
 *
 * ```ts
 * import { computePool } from '@danielsimonjr/mathts-parallel';
 * import { workerKernel } from '@danielsimonjr/mathts-functions';
 *
 * await computePool.initialize();
 * const { result } = await computePool.applyKernel(x, workerKernel('besselK', 1));
 * ```
 *
 * The source holds the same scalar code as the synchronous function. The worker result is
 * equal to the synchronous result bit for bit.
 *
 * `special.ts` and `distributions.ts` add their builders when the files load. Only
 * `workerKernel` is public.
 */

/**
 * A builder: the least and the most number of parameters it takes, and the function that
 * makes the source. Only normalPDF and normalCDF have optional parameters (mu = 0, sigma = 1).
 */
type KernelBuilder = readonly [
  required: number,
  max: number,
  build: (...params: number[]) => string,
];

const BUILDERS = new Map<string, KernelBuilder>();

/** Write a number as a source literal. `String(-0)` is `'0'`, so -0 needs its own case. */
export function numberLiteral(v: number): string {
  return Object.is(v, -0) ? '-0' : String(v);
}

/** Add the kernel builders of one module. A name that is already present is an error. */
export function registerWorkerKernels(builders: Record<string, KernelBuilder>): void {
  for (const [name, builder] of Object.entries(builders)) {
    if (BUILDERS.has(name)) throw new Error(`workerKernel: duplicate kernel "${name}"`);
    BUILDERS.set(name, builder);
  }
}

/**
 * Get the worker kernel source of an element-wise special function or distribution.
 *
 * @param name - The function name, for example `'erfc'`, `'besselK'` or `'normalCDF'`.
 * @param params - The scalar parameters of the function, in the order of its typed
 *   signature, without the array. For example `workerKernel('besselK', n)` and
 *   `workerKernel('normalCDF', mu, sigma)`. Each parameter must be a number.
 * @returns The source of a self-contained `(x) => number` function, for
 *   `computePool.applyKernel`.
 * @throws Error when the name is unknown or the parameter count is wrong. TypeError when a
 *   parameter is not a number.
 */
export function workerKernel(name: string, ...params: number[]): string {
  const builder = BUILDERS.get(name);
  if (!builder) {
    throw new Error(
      `workerKernel: unknown kernel "${name}". Known: ${[...BUILDERS.keys()].sort().join(', ')}`
    );
  }
  const [required, max, build] = builder;
  if (params.length < required || params.length > max) {
    const want = required === max ? `${max}` : `${required} to ${max}`;
    throw new Error(`workerKernel: "${name}" takes ${want} parameters, got ${params.length}`);
  }
  // The parameters go into source that a worker evaluates, so workerKernel accepts only numbers.
  for (const p of params) {
    if (typeof p !== 'number') {
      throw new TypeError(`workerKernel: "${name}" parameters must be numbers`);
    }
  }
  return build(...params);
}
