/**
 * Compat `zpk2tf` delegates to the mathjs 15.3.0 oracle (quirks included, #1589).
 */
import { create, all, type MathJsInstance } from 'mathjs';
import * as mathFunctions from '@danielsimonjr/mathts-functions';

export type CompatRuntimeConfig = Record<string, unknown>;

export function mathjsOracleZpk2tf(
  config: CompatRuntimeConfig,
  ...args: unknown[]
): unknown {
  const oracle = create(all, config) as MathJsInstance;
  return (oracle.zpk2tf as (...a: unknown[]) => unknown)(...args);
}

export function bindOracleZpk2tf(
  readConfig: () => CompatRuntimeConfig
): typeof mathFunctions.zpk2tf {
  const fn = (...args: unknown[]): unknown => mathjsOracleZpk2tf(readConfig(), ...args);
  for (const key of Reflect.ownKeys(mathFunctions.zpk2tf)) {
    if (key === 'prototype') continue;
    const desc = Object.getOwnPropertyDescriptor(mathFunctions.zpk2tf, key);
    if (desc) Object.defineProperty(fn, key, desc);
  }
  return fn as typeof mathFunctions.zpk2tf;
}