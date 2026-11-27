/**
 * #889 speed property, tested without a clock: a lone number never enters the config
 * wrapper (runWithConfig) or the typed function. The functions package is wrapped with
 * counters; the compat instance is built on the wrapped package.
 *
 * CI runs this file in a dedicated `bun test` process (`scripts/bun-test.mjs`) so
 * `mock.module` installs before shims import `@danielsimonjr/mathts-functions`. Vitest uses
 * tests/unary-fast-path.vitest-spec.ts with a hoisted vi.mock instead.
 */
import { mock } from 'bun:test';
import {
  buildMockedFunctionsModule,
  type UnaryFastPathGlobal,
} from './helpers/unary-fast-path-mock.js';
import { registerUnaryFastPathSuite } from './helpers/unary-fast-path-suite.js';

const g = globalThis as UnaryFastPathGlobal;
const orig = { ...(await import('@danielsimonjr/mathts-functions')) } as Record<string, unknown>;
g.__fpOrig = orig;
mock.module('@danielsimonjr/mathts-functions', () => buildMockedFunctionsModule(orig, g));

const { create, all } = await import('../src/index.js');
await registerUnaryFastPathSuite(create, all);
