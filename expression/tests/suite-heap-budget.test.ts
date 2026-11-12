/**
 * Regression guard for #878.
 *
 * CI run 43182254185 (Test 22.x) killed `@danielsimonjr/mathts-expression#test`
 * with exit 137. The bun crash record is a SIGSEGV in
 * `JSWebAssemblyInstance::finalizeCreation` (null module, address 0x8) while
 * the test runner loaded the next isolated file. The same record prints
 * `Peak: 0.37 GB` on a 16.76 GB machine, so this was not the OOM killer.
 *
 * Cause: `functions/src/factories/matrix-bridge.ts` used to call
 * `backendManager.initialize()` at import, which compiles and instantiates
 * `mathts-as.wasm` in every isolate that loads the factory graph. That
 * instantiate races Bun 1.4.2's test runner. The call is gone; multiply and
 * transpose stay on the JS backend until a caller initializes explicitly.
 *
 * Bootstrap also imports `expression-eval-barrel` rather than `typed/index`,
 * so `enableGpu` / `gpuMatmul` are not copied onto the math namespace.
 *
 * Measured on Node 22 / Bun 1.4.2 (this VM, after the side effect was removed
 * the heap test below re-checks the budget):
 * - importing `typed/index` vs the eval barrel differed by ~5 MiB RSS
 * - expression `bun test --isolate` peak RSS of the suite was ~362 MiB
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

/**
 * Heap growth after bootstrap + 64 parses.
 * Bun isolate measured ~63 MiB. Node vitest (CI Test 20/22) measured ~148 MiB
 * because the worker is already warm. 256 MiB fails a doubling of that Node figure.
 */
const BOOTSTRAP_HEAP_BUDGET_BYTES = 256 * 1024 * 1024;

describe('expression suite heap budget (#878)', () => {
  it('bootstrap graph stays under the documented heap budget', async () => {
    const gc = (globalThis as { gc?: () => void }).gc;
    if (gc) gc();
    const before = process.memoryUsage().heapUsed;
    const { parse, evaluate, math } = await import('./helpers/bootstrap.js');
    expect(math.enableGpu).toBeUndefined();
    expect(math.gpuMatmul).toBeUndefined();
    for (let i = 0; i < 64; i++) {
      evaluate(`${i} + ${i + 1}`);
      parse(`sin(${i})`);
    }
    if (gc) gc();
    const delta = process.memoryUsage().heapUsed - before;
    expect(delta).toBeLessThan(BOOTSTRAP_HEAP_BUDGET_BYTES);
  });

  it('importing the functions bundle does not instantiate WASM', () => {
    const entry = new URL('../../functions/dist/index.js', import.meta.url);
    const script = `
      let hits = 0;
      const compile = WebAssembly.compile.bind(WebAssembly);
      const instantiate = WebAssembly.instantiate.bind(WebAssembly);
      WebAssembly.compile = async (...args) => { hits++; return compile(...args); };
      WebAssembly.instantiate = async (...args) => { hits++; return instantiate(...args); };
      await import(${JSON.stringify(entry.href)});
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (hits !== 0) {
        console.error('wasm instantiations: ' + hits);
        process.exit(1);
      }
    `;
    execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  });
});
