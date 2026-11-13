/**
 * The built bundles load in a browser.
 *
 * When a bundler meets `require('os')` in an ESM file, it can emit a module-level
 * `createRequire(import.meta.url)` imported from `node:module`. A browser bundler
 * externalizes `node:module`, so that line throws when the package is imported,
 * before any runtime guard such as `typeof navigator` runs. The WebGPU browser job
 * of the repository imports this package in a browser. The test reads the built
 * files, so it needs `bun run build` first (turbo orders `build` before `test`).
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const bundles = readdirSync(distDir).filter((name) => name.endsWith('.js'));

describe('@danielsimonjr/mathts-workerpool bundles are browser-safe', () => {
  it('has the package entry and the worker entry', () => {
    expect(bundles).toContain('index.js');
    expect(bundles).toContain('worker.js');
    expect(bundles).toContain('browser.js');
    expect(bundles).toContain('worker.browser.js');
  });

  it('worker.browser.js is a classic script: the pool starts it with `new Worker(url)`', () => {
    // A worker started without `{ type: 'module' }` fails on an `import` or `export` statement
    // ("Cannot use import statement outside a module"), and a shared chunk next to it would
    // not travel with a bundler that copies the worker file as an asset (Vite `?url`).
    // `tests/browser/compute-pool-worker.browser.test.ts` runs the file in Chromium.
    const code = readFileSync(join(distDir, 'worker.browser.js'), 'utf8');
    expect(code).not.toMatch(/^\s*import\s[^\n]*\sfrom\s/m);
    expect(code).not.toMatch(/^\s*import\s*["']/m);
    expect(code).not.toMatch(/^\s*export\s/m);
  });

  it.each(bundles)('%s has no module-level node:module import', (name) => {
    const code = readFileSync(join(distDir, name), 'utf8');
    expect(code).not.toMatch(/from\s*["']node:module["']/);
    expect(code).not.toMatch(/\bcreateRequire\s*\(/);
  });
});
