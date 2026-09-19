import { describe, expect, it } from 'vitest';

/**
 * Runtime probe: prints which runtime executes this test file. CI greps the
 * `[runtime-probe]` line to prove that the Node matrix legs run the suite on real
 * Node (`typeof Bun` is `undefined`) and not on Bun.
 */
describe('runtime probe', () => {
  it('reports the executing runtime', () => {
    const bun = typeof (globalThis as { Bun?: unknown }).Bun;
    console.log(`[runtime-probe] process.version=${process.version} typeof Bun=${bun}`);
    expect(process.version).toMatch(/^v\d+\./);
  });
});
