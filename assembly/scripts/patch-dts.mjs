/**
 * Make the AssemblyScript-generated declaration file load in a project that has neither the
 * DOM lib nor `@types/node`.
 *
 * `asc` writes `export declare const memory: WebAssembly.Memory;`. The `WebAssembly` namespace
 * comes from those libs, so a consumer with `lib: ["ES2022"]` and `skipLibCheck: false` fails
 * with TS2503. This script swaps the name for a local alias that is the real
 * `WebAssembly.Memory` when the project has one, and a minimal `{ buffer }` object otherwise.
 * Run as the last step of `asbuild`, after `asc` has written `build/mathts.d.ts`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const buildDir = join(dirname(dirname(fileURLToPath(import.meta.url))), 'build');
const ALIAS = `/** \`WebAssembly.Memory\` when the project has that type, else an object with its \`buffer\`. */
export type WasmMemory = typeof globalThis extends { WebAssembly: { Memory: { prototype: infer Instance } } }
  ? Instance
  : { readonly buffer: ArrayBufferLike };
`;

for (const name of ['mathts.d.ts', 'mathts-debug.d.ts']) {
  const file = join(buildDir, name);
  if (!existsSync(file)) continue;
  let text = readFileSync(file, 'utf8');
  if (text.includes('export type WasmMemory')) continue;
  text = text.replace(/WebAssembly\.Memory/g, 'WasmMemory');
  if (/WebAssembly\./.test(text)) {
    throw new Error(`patch-dts: ${name} still names the WebAssembly namespace`);
  }
  writeFileSync(file, `${ALIAS}${text}`);
  console.log(`[patch-dts] patched ${name}`);
}
