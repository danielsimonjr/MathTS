import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// Path to the browser shim for the Node-oriented `workerpool` package.
const workerpoolBrowserShim = fileURLToPath(
  new URL('./packages/workerpool/src/workerpool-browser-shim.ts', import.meta.url)
);

export default defineConfig({
  // The browser bundle transitively pulls in `@danielsimonjr/mathts-workerpool`
  // (via matrix → parallel-matrix → parallel/ComputePool), which imports the
  // Node `workerpool` package. `workerpool`'s `import` export condition resolves
  // to `./src/index.js`, whose `WorkerHandler.js` `require`s the build-only
  // `./generated/embeddedWorker` artifact (absent from the published `src/`
  // tree), so a browser bundler fails with UNRESOLVED_IMPORT. Browsers should
  // use native Worker / WebGPU, not the Node pool — alias `workerpool` (and its
  // `/wasm` feature-detection subpath) to a browser shim so the WebGPU smoke
  // test builds and runs. See packages/workerpool/src/workerpool-browser-shim.ts.
  resolve: {
    alias: [
      { find: /^workerpool\/wasm$/, replacement: workerpoolBrowserShim },
      { find: /^workerpool$/, replacement: workerpoolBrowserShim },
    ],
  },
  test: {
    include: ['**/*.browser.test.ts'],
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: {
          args: [
            '--enable-unsafe-webgpu',
            '--enable-features=Vulkan',
            '--use-angle=vulkan',
            '--ignore-gpu-blocklist',
          ],
        },
      }),
      instances: [{ browser: 'chromium' }],
      headless: true,
    },
  },
});
