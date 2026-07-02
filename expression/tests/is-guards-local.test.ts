import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Architectural guardrail (PERF). The type guards in `src/utils/is.ts` must stay DEFINED
 * LOCALLY — they must NOT be consolidated into a re-export shim of
 * `@danielsimonjr/mathts-core`. They are called in hot loops (parser/compiler AST walks),
 * where V8 inlines local guards but will NOT inline them across a module boundary; a
 * cross-module re-export measured ~40% slower on the functions studentized-range path.
 * See the PERF banner in `is.ts`.
 *
 * STRUCTURAL check, not a timing benchmark — deterministic. Fails the moment someone turns
 * `is.ts` into `export * from '@danielsimonjr/mathts-core/...'`.
 */
const isSrc = readFileSync(fileURLToPath(new URL('../src/utils/is.ts', import.meta.url)), 'utf8');

describe('is.ts guards stay local (hot-path inlining guardrail)', () => {
  it('defines the core guards locally', () => {
    expect(isSrc).toMatch(/export function isNumber\b/);
    expect(isSrc).toMatch(/export function isComplex\b/);
    expect(isSrc).toMatch(/export function isMatrix\b/);
  });

  it('does NOT re-export the guards from core (would defeat inlining)', () => {
    expect(isSrc).not.toMatch(/export \* from ['"]@danielsimonjr\/mathts-core/);
    expect(isSrc).not.toMatch(/\bis[A-Z]\w*[^;\n]*\bfrom ['"]@danielsimonjr\/mathts-core/);
  });
});
