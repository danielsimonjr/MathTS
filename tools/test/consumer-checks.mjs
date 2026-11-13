/**
 * Checks that run INSIDE a temporary consumer project that holds the packed tarballs.
 * Each check returns a list of problem strings (empty when it passes).
 *
 *   loadProblems         ESM `import()` and CommonJS `require()` of every entry point
 *   browserBundleProblems  `esbuild --platform=browser` of every browser-facing entry point,
 *                          then a scan of the bundle for Node builtins
 *
 * esbuild and TypeScript are installed in the consumer folder by the caller; they are never
 * repository dependencies.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join } from 'node:path';
import { staticImports } from './dist-node-imports.mjs';

/** Every Node builtin name, with and without the `node:` prefix. */
const BUILTINS = new Set(builtinModules.flatMap((m) => [m, m.replace(/^node:/, ''), `node:${m}`]));

/**
 * Tell whether a specifier names a Node builtin.
 * @param {string} specifier
 * @returns {boolean}
 */
export function isBuiltin(specifier) {
  return BUILTINS.has(specifier) || BUILTINS.has(specifier.replace(/^node:/, ''));
}

/**
 * ESM `import()` and CJS `require()` of each entry point, in a fresh Node process per mode.
 * An entry in `requireExempt` must fail `require()` with ERR_REQUIRE_ASYNC_MODULE and no other
 * code; an entry in `workerScripts` is skipped (loading it registers a pool worker).
 * @param {string} consumer consumer project folder
 * @param {string[]} specifiers JavaScript entry points
 * @param {{ requireExempt: Record<string,string>, workerScripts: Record<string,string> }} policy
 * @returns {string[]} problems
 */
export function loadProblems(consumer, specifiers, policy) {
  const specs = specifiers.filter((s) => !(s in policy.workerScripts));
  const script = [
    'import { createRequire } from "node:module";',
    'const require = createRequire(process.cwd() + "/x.cjs");',
    'const out = [];',
    'for (const s of JSON.parse(process.argv[1])) {',
    '  for (const mode of ["import", "require"]) {',
    '    try { if (mode === "import") await import(s); else require(s); out.push([s, mode, null]); }',
    '    catch (e) { out.push([s, mode, e.code ?? "ERROR", String(e.message).split("\\n")[0].slice(0, 160)]); }',
    '  }',
    '}',
    'console.log(JSON.stringify(out));',
    'process.exit(0);',
  ].join('\n');
  const stdout = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', script, JSON.stringify(specs)],
    { cwd: consumer, encoding: 'utf8' }
  );
  const rows = JSON.parse(stdout.trim().split(/\r?\n/).pop());
  const problems = [];
  for (const [spec, mode, code, message] of rows) {
    if (mode === 'require' && spec in policy.requireExempt) {
      if (code !== 'ERR_REQUIRE_ASYNC_MODULE') {
        problems.push(`require('${spec}') is exempt only for ERR_REQUIRE_ASYNC_MODULE, got ${code ?? 'success'}`);
      }
      continue;
    }
    if (code !== null) problems.push(`${mode === 'import' ? 'import()' : 'require()'} of '${spec}' failed: ${code} ${message}`);
  }
  return problems;
}

/**
 * Bundle each entry with esbuild for the browser and report Node builtins.
 *
 * The build is the one a user runs: `esbuild --bundle --platform=browser`, with no `external`
 * list, so esbuild applies the `browser` field of each dependency (seedrandom maps `crypto` to
 * false) and fails with "Could not resolve" on a builtin that nothing maps. A successful
 * bundle is then scanned for static imports of a builtin (`import ... from "node:x"`), which
 * would break the page at load. A builtin name inside a string, such as the source of an
 * embedded worker, is not a finding.
 * @param {string} consumer consumer project folder with esbuild installed
 * @param {string[]} specifiers entry points to bundle
 * @param {string} [outRoot] folder for the bundles (default: `<consumer>/.bundles`)
 * @returns {{ problems: string[], sizes: Record<string, number> }}
 */
export function browserBundleProblems(consumer, specifiers, outRoot = join(consumer, '.bundles')) {
  mkdirSync(outRoot, { recursive: true });
  const driver = join(outRoot, 'bundle.mjs');
  writeFileSync(
    driver,
    [
      'import { buildSync } from "esbuild";',
      'import { statSync } from "node:fs";',
      'const [spec, outfile] = process.argv.slice(2);',
      'const contents = "import * as m from " + JSON.stringify(spec) + "; globalThis.__keep = m;";',
      'try {',
      '  buildSync({ stdin: { contents, resolveDir: process.cwd(), loader: "js" }, bundle: true, format: "esm", platform: "browser", outfile, logLevel: "silent" });',
      '  console.log(JSON.stringify({ ok: true, size: statSync(outfile).size }));',
      '} catch (e) {',
      '  console.log(JSON.stringify({ ok: false, errors: (e.errors ?? [{ text: String(e.message) }]).map((x) => x.text) }));',
      '}',
    ].join('\n')
  );
  const problems = [];
  const sizes = {};
  for (const spec of specifiers) {
    const outfile = join(outRoot, `${spec.replace(/[^\w]/g, '_')}.js`);
    const stdout = execFileSync(process.execPath, [driver, spec, outfile], {
      cwd: consumer,
      encoding: 'utf8',
    });
    const result = JSON.parse(stdout.trim().split(/\r?\n/).pop());
    if (!result.ok) {
      problems.push(
        `browser bundle of '${spec}' failed: ${[...new Set(result.errors)].join('; ').slice(0, 300)}`
      );
      continue;
    }
    sizes[spec] = result.size;
    for (const found of staticImports(readFileSync(outfile, 'utf8'))) {
      if (isBuiltin(found)) {
        problems.push(`browser bundle of '${spec}' imports the Node builtin '${found}' statically`);
      }
    }
  }
  return { problems, sizes };
}

/**
 * Size in bytes of a minified esbuild bundle of one import statement, built from the consumer.
 * @param {string} consumer consumer project folder with esbuild installed
 * @param {string} importLine for example `import { evaluate } from '@danielsimonjr/mathts-functions/evaluate';`
 * @param {{ platform?: 'node' | 'browser', outDir?: string }} [opts]
 * @returns {number}
 */
export function minifiedBundleSize(consumer, importLine, { platform = 'node', outDir } = {}) {
  const dir = outDir ?? join(consumer, '.bundles');
  mkdirSync(dir, { recursive: true });
  const entry = join(dir, `size-${Math.abs(hash(importLine))}.mjs`);
  const outfile = entry.replace(/\.mjs$/, '.out.js');
  writeFileSync(entry, `${importLine}\nglobalThis.__keep = [${bindingsOf(importLine).join(', ')}];\n`);
  const driver = join(dir, 'size.mjs');
  writeFileSync(
    driver,
    [
      'import { buildSync } from "esbuild";',
      'const [entry, outfile, platform] = process.argv.slice(2);',
      'buildSync({ entryPoints: [entry], bundle: true, minify: true, format: "esm", platform, outfile, logLevel: "silent" });',
    ].join('\n')
  );
  execFileSync(process.execPath, [driver, entry, outfile, platform], { cwd: consumer, stdio: 'pipe' });
  return statSync(outfile).size;
}

/** Cheap string hash for temp file names. */
function hash(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

/**
 * Local binding names of an import line.
 * @param {string} importLine
 * @returns {string[]}
 */
function bindingsOf(importLine) {
  const named = importLine.match(/import\s*\{([^}]+)\}\s*from/);
  if (named) return named[1].split(',').map((p) => p.trim().split(/\s+as\s+/i).pop());
  const ns = importLine.match(/import\s+\*\s+as\s+(\w+)/);
  return ns ? [ns[1]] : [];
}

/**
 * Read a JSON file.
 * @param {string} file
 * @returns {any}
 */
export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}
