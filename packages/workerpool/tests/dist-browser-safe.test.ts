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
  });

  it.each(bundles)('%s has no module-level node:module import', (name) => {
    const code = readFileSync(join(distDir, name), 'utf8');
    expect(code).not.toMatch(/from\s*["']node:module["']/);
    expect(code).not.toMatch(/\bcreateRequire\s*\(/);
  });
});
