#!/usr/bin/env node
/**
 * tsdown/rolldown omits a .js.map when a bundle is only an external re-export
 * or a one-line facade chunk. Every shipped dist .js still needs a map so
 * Node --enable-source-maps and bundlers can resolve it (#740).
 *
 * Run from a package directory after tsdown:
 *   node ../tools/ensure-js-sourcemaps.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

const pkgRoot = process.cwd();
const distDir = existsSync(join(pkgRoot, 'dist'))
  ? join(pkgRoot, 'dist')
  : existsSync(join(pkgRoot, 'build'))
    ? join(pkgRoot, 'build')
    : '';

/**
 * VLQ for a single segment field.
 * @param {number} value
 */
function encodeVlq(value) {
  let vlq = value < 0 ? (-value << 1) | 1 : value << 1;
  let encoded = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  do {
    let digit = vlq & 31;
    vlq >>= 5;
    if (vlq > 0) digit |= 32;
    encoded += chars[digit];
  } while (vlq > 0);
  return encoded;
}

/**
 * One mapping per generated line, onto the same line of the chosen source.
 * @param {number} lineCount
 */
export function identityMappings(lineCount) {
  const lines = [];
  for (let i = 0; i < lineCount; i++) {
    const sourceLineDelta = i === 0 ? 0 : 1;
    lines.push(encodeVlq(0) + encodeVlq(0) + encodeVlq(sourceLineDelta) + encodeVlq(0));
  }
  return lines.join(';');
}

/**
 * @param {string} dir
 * @param {string[]} out
 */
function walkJs(dir, out) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkJs(path, out);
    else if (name.endsWith('.js')) out.push(path);
  }
  return out;
}

if (!distDir) process.exit(0);

let wrote = 0;
for (const jsPath of walkJs(distDir, [])) {
  const mapPath = `${jsPath}.map`;
  if (existsSync(mapPath)) continue;
  const js = readFileSync(jsPath, 'utf8');
  const fileName = basename(jsPath);
  const stem = fileName.slice(0, -'.js'.length);
  const candidate = join(pkgRoot, 'src', `${stem}.ts`);
  const sourcePath = existsSync(candidate) ? candidate : jsPath;
  const sourceRel = relative(dirname(jsPath), sourcePath).replaceAll('\\', '/');
  const lineCount = Math.max(1, js.split('\n').length - (js.endsWith('\n') ? 1 : 0));
  const map = {
    version: 3,
    file: fileName,
    sources: [sourceRel.startsWith('.') ? sourceRel : `./${sourceRel}`],
    sourcesContent: [readFileSync(sourcePath, 'utf8')],
    names: [],
    mappings: identityMappings(lineCount),
  };
  writeFileSync(mapPath, JSON.stringify(map));
  const url = `//# sourceMappingURL=${fileName}.map\n`;
  if (!js.includes('sourceMappingURL=')) {
    writeFileSync(jsPath, js.endsWith('\n') ? js + url : `${js}\n${url}`);
  }
  wrote += 1;
}

if (wrote > 0) {
  console.log(
    `ensure-js-sourcemaps: wrote ${wrote} map(s) in ${relative(process.cwd(), distDir) || 'dist'}`
  );
}
