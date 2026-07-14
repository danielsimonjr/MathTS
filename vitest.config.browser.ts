import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// Path to the browser shim for the Node-oriented `workerpool` package.
const workerpoolBrowserShim = fileURLToPath(
  new URL('./packages/workerpool/src/workerpool-browser-shim.ts', import.meta.url)
);

// Local and CI need genuinely different browsers, and conflating them broke CI.
//
//  LOCAL: the SYSTEM Chrome, headed. Playwright's bundled `chrome-headless-shell`
//    ships with no GPU adapter, so `requestAdapter()` resolves to null and no WGSL
//    kernel can execute — which silently made this whole suite a no-op. System
//    Chrome exposes the real adapter (verified: NVIDIA Pascal), and that is what
//    the perf tests need.
//
//  CI: a headless Linux runner has no X server, so a headed browser CANNOT launch
//    ("Looks like you launched a headed browser without having a XServer running")
//    and no `channel: 'chrome'` is installed there. Use Playwright's full Chromium
//    in new-headless mode — unlike chrome-headless-shell it retains GPU support —
//    against the Mesa lavapipe software adapter that ci.yml installs.
//
// Perf assertions are gated on a REAL adapter (functions/tests/helpers/gpu-hardware.ts),
// so on CI's software rasterizer they skip while every correctness test still runs.
const isCI = !!process.env.CI;

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
          // See the note above the config: system Chrome locally (real adapter),
          // Playwright's full Chromium on CI (installed there; keeps GPU support
          // in new-headless mode, unlike chrome-headless-shell).
          channel: isCI ? 'chromium' : 'chrome',
          args: isCI
            ? [
                '--enable-unsafe-webgpu',
                // Route WebGPU at the lavapipe software Vulkan ICD that ci.yml
                // installs; without these the runner has no adapter at all.
                '--enable-features=Vulkan',
                '--use-angle=vulkan',
                '--use-gl=angle',
                // GitHub runners: no sandbox, and /dev/shm is too small for Chrome.
                '--no-sandbox',
                '--disable-dev-shm-usage',
              ]
            : ['--enable-unsafe-webgpu'],
        },
      }),
      instances: [{ browser: 'chromium' }],
      headless: isCI,
    },
  },
});
