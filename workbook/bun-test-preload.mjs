// Mirror the build-time `define` from tsup.config.ts for `bun test`, which does
// not read vitest.config.ts. src/contract.ts reads the injected __PKG_VERSION__
// global for `export const VERSION`.
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

globalThis.__PKG_VERSION__ = version;
