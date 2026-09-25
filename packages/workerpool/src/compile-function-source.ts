/**
 * Rebuild a function from its source text.
 *
 * A function cannot be structured-cloned to another thread, so the pool ships
 * it as source text and each receiver compiles it back into a callable. This is
 * the ONLY place in the package that compiles code from a string; every
 * function-shipping path (the worker kernels and the main-thread fallbacks
 * taken below the parallel threshold) routes through it.
 *
 * Trust model: the source comes from the pool's own caller and runs with that
 * caller's privileges, exactly as if the caller had invoked the function
 * directly. Never pass text from an untrusted party (user input, network) here.
 * Untrusted math belongs in the sandboxed evaluator of
 * `@danielsimonjr/mathts-expression`.
 *
 * Indirect eval, `(0, eval)(…)`, evaluates in the global scope. A direct
 * `eval(…)` evaluates inside the calling function instead: the shipped code
 * could then read and reassign that function's locals, the engine
 * de-optimises the whole caller, and a bundler cannot rename anything in
 * scope (esbuild's `direct-eval` warning).
 *
 * @param source Source text of a function expression, e.g. `(x) => x * 2`.
 * @returns The compiled function.
 */
export function compileFunctionSource<F extends (...args: never[]) => unknown>(source: string): F {
  // eslint-disable-next-line no-eval -- the single documented code-from-string entry point; see the trust model above.
  return (0, eval)(`(${source})`) as F;
}
