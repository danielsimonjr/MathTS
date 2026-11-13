/**
 * A math scope holds its config as an object, or as an accessor function that
 * returns the current config (compat `math.config`). Every reader of a config
 * dependency goes through `currentConfig`, so both forms give the same result.
 *
 * @packageDocumentation
 */

/** The config value: the result of the accessor when `config` is a function, else `config`. */
export function currentConfig<T>(config: T | (() => T)): T {
  return typeof config === 'function' ? (config as () => T)() : config;
}
