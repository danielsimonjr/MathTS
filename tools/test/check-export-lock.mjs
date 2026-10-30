#!/usr/bin/env node
/**
 * Public export-name lock for published workspace packages.
 *
 * Compares built `.d.ts` export surfaces to `export-lock.json`.
 * Run with `node` (never `bun run`): `node tools/test/check-export-lock.mjs`.
 * Refresh after a deliberate export change: `node tools/test/check-export-lock.mjs --write`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

const LOCK_PATH = join(repoRoot, 'tools/test/export-lock.json');
const writeMode = process.argv.includes('--write');

/** Entry points that cannot be imported in the main process (worker scripts). */
const SKIP_RUNTIME_IMPORT = new Set([
  '@danielsimonjr/mathts-workerpool/worker',
]);

/** @typedef {{ kind: string }} ExportEntry */

/**
 * Parse export names from a declaration file's text.
 * @param {string} text
 * @returns {Map<string, 'type' | 'value'>}
 */
export function parseExportNames(text) {
  /** @type {Map<string, 'type' | 'value'>} */
  const names = new Map();

  const add = (name, kind) => {
    if (!name || name === 'from') return;
    const prev = names.get(name);
    if (prev === 'value' || kind === 'value') {
      names.set(name, 'value');
    } else if (!prev) {
      names.set(name, kind);
    }
  };

  const exportTypeBlock = /export\s+type\s*\{([^}]+)\}/g;
  let m;
  while ((m = exportTypeBlock.exec(text)) !== null) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) add(name, 'type');
    }
  }

  const exportBlock = /export\s*(?!type\s*\{)\{([^}]+)\}/g;
  while ((m = exportBlock.exec(text)) !== null) {
    for (const part of m[1].split(',')) {
      const chunk = part.trim();
      if (!chunk) continue;
      const isType = /^type\s+/.test(chunk);
      const cleaned = chunk.replace(/^type\s+/, '').trim();
      const name = cleaned.split(/\s+as\s+/).pop().trim();
      add(name, isType ? 'type' : 'value');
    }
  }

  const patterns = [
    [/export\s+declare?\s+interface\s+(\w+)/g, 'type'],
    [/export\s+declare?\s+type\s+(\w+)/g, 'type'],
    [/export\s+interface\s+(\w+)/g, 'type'],
    [/export\s+type\s+(\w+)/g, 'type'],
    [/export\s+declare?\s+class\s+(\w+)/g, 'value'],
    [/export\s+class\s+(\w+)/g, 'value'],
    [/export\s+declare?\s+function\s+(\w+)/g, 'value'],
    [/export\s+declare?\s+const\s+(\w+)/g, 'value'],
    [/export\s+declare?\s+enum\s+(\w+)/g, 'value'],
    [/export\s+declare?\s+namespace\s+(\w+)/g, 'value'],
  ];
  for (const [re, kind] of patterns) {
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      add(m[1], kind);
    }
  }

  if (/export\s+default/.test(text)) {
    add('default', 'value');
  }

  return names;
}

/**
 * Resolve the on-disk types file for an exports entry.
 * @param {string} dir workspace dir
 * @param {string} subpath exports key
 * @param {object} target exports target
 */
function typesPath(dir, subpath, target) {
  if (typeof target === 'string') {
    return join(repoRoot, dir, target);
  }
  const types = target.types ?? target.default?.types;
  if (!types) return null;
  return join(repoRoot, dir, types);
}

/**
 * Resolve the runtime import path for an exports entry.
 * @param {string} dir
 * @param {object} target
 */
function importPath(dir, target) {
  if (typeof target === 'string') {
    return pathToFileURL(join(repoRoot, dir, target)).href;
  }
  const imp = target.import ?? target.default?.import;
  if (!imp) return null;
  return pathToFileURL(join(repoRoot, dir, imp)).href;
}

/**
 * @returns {Record<string, Record<string, Record<string, ExportEntry>>>}
 */
export function collectLockTree() {
  /** @type {Record<string, Record<string, Record<string, ExportEntry>>>} */
  const tree = {};

  for (const dir of workspaceDirs()) {
    const pkgPath = join(repoRoot, dir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg.private) continue;

    const exp = pkg.exports ?? { '.': { types: pkg.types, import: pkg.main ?? pkg.module } };
    tree[pkg.name] = {};

    for (const [sub, target] of Object.entries(exp)) {
      if (typeof target !== 'object' || target === null || !target.types) continue;
      const dtsPath = typesPath(dir, sub, target);
      if (!dtsPath) continue;
      const text = readFileSync(dtsPath, 'utf8');
      const parsed = parseExportNames(text);
      const href = importPath(dir, target);
      const specifier =
        sub === '.' ? pkg.name : `${pkg.name}/${sub.startsWith('./') ? sub.slice(2) : sub}`;
      /** @type {Record<string, string>} */
      let runtimeKinds = {};
      if (href && !SKIP_RUNTIME_IMPORT.has(specifier)) {
        const script = [
          `const m = await import(${JSON.stringify(href)});`,
          'const out = {};',
          'for (const k of Object.keys(m)) {',
          '  const v = m[k];',
          '  out[k] = v === null ? "object" : typeof v;',
          '}',
          'console.log(JSON.stringify(out));',
        ].join('\n');
        try {
          runtimeKinds = JSON.parse(
            execFileSync(process.execPath, ['--input-type=module', '-e', script], {
              encoding: 'utf8',
            }).trim()
          );
        } catch (error) {
          throw new Error(`${specifier}: failed to import runtime entry: ${error.message}`);
        }
      } else if (SKIP_RUNTIME_IMPORT.has(specifier)) {
        for (const [name, kind] of parsed) {
          if (kind === 'value') runtimeKinds[name] = 'function';
        }
      }

      /** @type {Record<string, ExportEntry>} */
      const entries = {};
      for (const [name, kind] of [...parsed.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        if (kind === 'type') {
          entries[name] = { kind: 'type' };
        } else if (name === 'default') {
          entries[name] = { kind: runtimeKinds.default ?? 'object' };
        } else {
          entries[name] = { kind: runtimeKinds[name] ?? 'object' };
        }
      }
      tree[pkg.name][sub] = entries;
    }
  }
  return tree;
}

function stableStringify(obj) {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

const live = collectLockTree();

if (writeMode) {
  writeFileSync(LOCK_PATH, stableStringify(live));
  console.log(`Wrote ${LOCK_PATH}`);
  process.exit(0);
}

let expected;
try {
  expected = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
} catch {
  console.error(`Missing ${LOCK_PATH}. Run with --write after bun run build.`);
  process.exit(1);
}

const liveJson = JSON.stringify(live);
const expectedJson = JSON.stringify(expected);
if (liveJson !== expectedJson) {
  console.error('FAIL: export lock differs from tools/test/export-lock.json');
  console.error('Update deliberately with: node tools/test/check-export-lock.mjs --write');
  process.exit(1);
}
console.log('OK: export lock matches built public entries.');
