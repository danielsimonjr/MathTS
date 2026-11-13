import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig } from 'tsdown';

/**
 * Browser build of the package: `dist/browser.js` and `dist/worker.browser.js`.
 *
 * The `workerpool` package lists its `import` export condition before `browser`, so a bundler
 * that targets the browser (`esbuild --platform=browser`, Vite) follows `import` to
 * `src/js/index.js`, which requires `worker_threads`, `os` and `child_process`. The bundle
 * fails to resolve them, or it succeeds only with stubs that throw on first use. This build
 * aliases `workerpool` to its prebuilt browser file (`dist/workerpool.js`) and inlines it, so
 * the browser entries of the package import no Node builtin. `worker.browser.js` is a classic
 * (IIFE) script with no imports, because the pool starts it with `new Worker(url)`. `platform: 'browser'` makes the
 * bundler replace the Node builtins that file still requires (behind `platform === 'node'`
 * checks) with empty modules, instead of a `node:module` `createRequire` import. `package.json` `exports` names
 * these files under the `browser` condition.
 *
 * The three options below are mandatory in every package of this repository (see the
 * Package Build Details section of CLAUDE.md).
 */
// `workerpool` exports `./src/js/index.js` as `.`; its package folder is two levels up.
const workerpoolDir = dirname(
  dirname(dirname(createRequire(import.meta.url).resolve('workerpool')))
);

/**
 * Rolldown plugin for this build only:
 * `transform` points the package's own worker URL at the browser worker file. Vite copies
 *    the file that `new URL('./worker.js', import.meta.url)` names as it is, so the URL must
 *    name `worker.browser.js` (which has no bare `workerpool` import).
 */
const browserBuildPlugin = {
  name: 'mathts-workerpool-browser',
  transform(code: string, id: string) {
    if (!/[\\/]src[\\/]index\.ts$/.test(id)) return null;
    const patched = code
      .replaceAll(
        "new URL('./worker.js', import.meta.url)",
        "new URL('./worker.browser.js', import.meta.url)"
      )
      .replaceAll(
        "new URL('../dist/worker.js', import.meta.url)",
        "new URL('../dist/worker.browser.js', import.meta.url)"
      )
      .replaceAll('mathts-workerpool/dist/worker.js', 'mathts-workerpool/dist/worker.browser.js');
    return { code: patched, map: null };
  },
};

/** Options of both browser builds. */
const common = {
  platform: 'browser',
  clean: false,
  dts: false,
  fixedExtension: false,
  sourcemap: true,
  alias: { workerpool: join(workerpoolDir, 'dist', 'workerpool.js') },
  plugins: [browserBuildPlugin],
  noExternal: ['workerpool'],
  outputOptions: { comments: { legal: true, annotation: true, jsdoc: false } },
} as const;

export default defineConfig([
  // The pool: an ES module that a bundler (or a `<script type="module">`) imports.
  { ...common, entry: { browser: 'src/index.ts' }, format: 'esm' },
  // The worker: ONE self-contained classic script (no `import`, no shared chunk). The pool
  // starts it with `new Worker(url)`, which is a classic worker, so an ES module file with
  // `import` statements fails there with "Cannot use import statement outside a module". A
  // bundler that copies the file as an asset (Vite `?url`) also copies nothing else with it.
  {
    ...common,
    entry: { 'worker.browser': 'src/worker.ts' },
    format: 'iife',
    // tsdown names an IIFE entry `<name>.iife.js`; `exports` names `worker.browser.js`.
    outputOptions: { ...common.outputOptions, entryFileNames: '[name].js' },
  },
]);
