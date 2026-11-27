/**
 * Vitest twin of tests/unary-fast-path.test.ts — vi.mock must live at module top level.
 * Bun's runner does not load `*.vitest-spec.ts` (only `*.test.ts`).
 */
import { vi } from 'vitest';
import {
  buildMockedFunctionsModule,
  type UnaryFastPathGlobal,
} from './helpers/unary-fast-path-mock.js';

vi.mock('@danielsimonjr/mathts-functions', async (importOriginal) => {
  const g = globalThis as UnaryFastPathGlobal;
  const orig = { ...((await importOriginal!()) as object) } as Record<string, unknown>;
  return buildMockedFunctionsModule(orig, g);
});

const { create, all } = await import('../src/index.js');
const { registerUnaryFastPathSuite } = await import('./helpers/unary-fast-path-suite.js');
await registerUnaryFastPathSuite(create, all);
