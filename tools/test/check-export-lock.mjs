#!/usr/bin/env node
/**
 * Public export-name lock for published workspace packages.
 *
 * For every non-private workspace package and every `exports` key that names a `types` file, this
 * records each exported name and its kind: `typeof` of the runtime export from the built `.js`, or
 * `type` for a name that only the `.d.ts` declares. A name the `.d.ts` declares as a value but the
 * built `.js` does not export is recorded as `missing`, so a broken build is locked as broken
 * instead of being passed off as an `object`.
 *
 * The `.d.ts` names come from following `export * from './x.js'` through the declaration tree, as
 * the published `index.d.ts` files are thin re-export barrels. A barrel read without following
 * them records nothing (it once recorded 0 names for `matrix`).
 *
 * Compares the tree to `export-lock.json`. Run with `node` (never `bun run`):
 *   node tools/test/check-export-lock.mjs            compare, exit 1 on a difference
 *   node tools/test/check-export-lock.mjs --write    refresh after a deliberate export change
 * `--root <dir>` and `--lock <file>` point both at a fixture (the unit tests do).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { repoRoot, workspaceDirs } from './workspaces.mjs';

/** Entry points that cannot be imported in the main process (worker scripts). */
const SKIP_RUNTIME_IMPORT = new Set(['@danielsimonjr/mathts-workerpool/worker']);

/** @typedef {{ kind: string }} ExportEntry */
/** @typedef {Record<string, Record<string, Record<string, ExportEntry>>>} LockTree */

/** @param {string} text */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Resolve a relative module specifier from a declaration file to its `.d.ts` file.
 * @param {string} fromFile
 * @param {string} spec
 */
function resolveDeclaration(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  const candidates = [base.replace(/\.js$/, '.d.ts'), `${base}.d.ts`, join(base, 'index.d.ts')];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`${fromFile}: cannot resolve '${spec}' to a declaration file`);
  }
  return found;
}

/**
 * Map each workspace package name to its `exports` so a re-export package that says
 * `export type * from '@scope/other'` can be followed into the other package's declarations.
 * @param {string} root
 * @returns {(spec: string) => string | null} declaration file for a workspace specifier
 */
function workspaceResolver(root) {
  /** @type {Map<string, { dir: string, exports: Record<string, any> }>} */
  const byName = new Map();
  for (const dir of workspaceDirs(root)) {
    const pkg = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'));
    byName.set(pkg.name, { dir, exports: pkg.exports ?? { '.': { types: pkg.types } } });
  }
  return (spec) => {
    const parts = spec.split('/');
    const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    const rest = spec.slice(name.length);
    const pkg = byName.get(name);
    const target = pkg?.exports[rest === '' ? '.' : `.${rest}`];
    const types = typeof target === 'object' ? (target?.types ?? target?.import?.types) : null;
    return pkg && types ? join(root, pkg.dir, types) : null;
  };
}

/**
 * Collect the names a declaration file exports at its top level, following `export *`.
 * @param {string} file absolute path of a `.d.ts`
 * @param {(spec: string) => string | null} resolveWorkspace declaration file of a workspace package specifier
 * @param {Set<string>} [visiting] files on the current path, to stop cycles
 * @returns {Map<string, 'type' | 'value'>}
 */
export function parseDeclarationFile(file, resolveWorkspace, visiting = new Set()) {
  /** @type {Map<string, 'type' | 'value'>} */
  const names = new Map();
  if (visiting.has(file)) return names;
  visiting.add(file);

  const add = (name, kind) => {
    if (!name || name === 'from') return;
    if (names.get(name) === 'value') return;
    names.set(name, kind);
  };
  const addAll = (more, forceType) => {
    for (const [name, kind] of more) add(name, forceType ? 'type' : kind);
  };

  const text = stripComments(readFileSync(file, 'utf8'));
  let m;

  const reexportAll = /^export\s+(type\s+)?\*\s*(?:as\s+(\w+)\s*)?from\s*['"]([^'"]+)['"]/gm;
  while ((m = reexportAll.exec(text)) !== null) {
    const [, typeOnly, namespace, spec] = m;
    if (namespace) {
      add(namespace, typeOnly ? 'type' : 'value');
      continue;
    }
    const target = spec.startsWith('.') ? resolveDeclaration(file, spec) : resolveWorkspace(spec);
    if (!target) {
      throw new Error(`${file}: cannot follow 'export * from "${spec}"' to a declaration file`);
    }
    addAll(parseDeclarationFile(target, resolveWorkspace, visiting), Boolean(typeOnly));
  }

  const exportBlock = /^export\s+(type\s+)?\{([^}]*)\}/gm;
  while ((m = exportBlock.exec(text)) !== null) {
    const blockIsType = Boolean(m[1]);
    for (const part of m[2].split(',')) {
      const chunk = part.trim();
      if (!chunk) continue;
      const isType = blockIsType || /^type\s+/.test(chunk);
      const name = chunk
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()
        .trim();
      add(name, isType ? 'type' : 'value');
    }
  }

  const declarations = [
    [/^export\s+(?:declare\s+)?interface\s+(\w+)/gm, 'type'],
    [/^export\s+(?:declare\s+)?type\s+(\w+)/gm, 'type'],
    [/^export\s+(?:declare\s+)?(?:abstract\s+)?class\s+(\w+)/gm, 'value'],
    [/^export\s+(?:declare\s+)?(?:async\s+)?function\s*\*?\s*(\w+)/gm, 'value'],
    [/^export\s+(?:declare\s+)?(?:const\s+)?enum\s+(\w+)/gm, 'value'],
    [/^export\s+(?:declare\s+)?(?:const|let|var)\s+(\w+)/gm, 'value'],
    [/^export\s+(?:declare\s+)?namespace\s+(\w+)/gm, 'value'],
  ];
  for (const [re, kind] of declarations) {
    while ((m = re.exec(text)) !== null) add(m[1], kind);
  }
  if (/^export\s+default\b/m.test(text)) add('default', 'value');

  visiting.delete(file);
  return names;
}

/**
 * Declaration and runtime files of one `exports` entry, or null when it has no `types`.
 * @param {string} root
 * @param {string} dir
 * @param {any} target
 */
function entryFiles(root, dir, target) {
  if (typeof target !== 'object' || target === null) return null;
  const types = target.types ?? target.import?.types ?? target.default?.types;
  const imp =
    typeof target.import === 'string'
      ? target.import
      : (target.import?.default ?? target.default?.import);
  if (!types) return null;
  return { types: join(root, dir, types), runtime: imp ? join(root, dir, imp) : null };
}

/** @param {string} runtimeFile @returns {Record<string, string>} */
function runtimeKinds(runtimeFile) {
  const script = [
    `const m = await import(${JSON.stringify(pathToFileURL(runtimeFile).href)});`,
    'const out = {};',
    'for (const k of Object.keys(m)) {',
    '  const v = m[k];',
    '  out[k] = v === null ? "object" : typeof v;',
    '}',
    'console.log(JSON.stringify(out));',
  ].join('\n');
  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }).trim()
  );
}

/**
 * Build the lock tree for every non-private workspace package under `root`.
 * @param {string} [root]
 * @returns {LockTree}
 */
export function collectLockTree(root = repoRoot) {
  /** @type {LockTree} */
  const tree = {};
  const resolveWorkspace = workspaceResolver(root);

  for (const dir of workspaceDirs(root)) {
    const pkg = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'));
    if (pkg.private) continue;

    const exp = pkg.exports ?? { '.': { types: pkg.types, import: pkg.main ?? pkg.module } };
    tree[pkg.name] = {};

    for (const [sub, target] of Object.entries(exp)) {
      const files = entryFiles(root, dir, target);
      if (!files) continue;
      const specifier =
        sub === '.' ? pkg.name : `${pkg.name}/${sub.startsWith('./') ? sub.slice(2) : sub}`;

      const declared = parseDeclarationFile(files.types, resolveWorkspace);
      /** @type {Record<string, string>} */
      let live = {};
      if (files.runtime && !SKIP_RUNTIME_IMPORT.has(specifier)) {
        try {
          live = runtimeKinds(files.runtime);
        } catch (error) {
          throw new Error(`${specifier}: failed to import runtime entry: ${error.message}`);
        }
      } else {
        for (const [name, kind] of declared) {
          if (kind === 'value') live[name] = 'unimported';
        }
      }

      /** @type {Record<string, ExportEntry>} */
      const entries = {};
      const all = new Set([...declared.keys(), ...Object.keys(live)]);
      for (const name of [...all].sort()) {
        if (name in live) {
          entries[name] = { kind: live[name] };
        } else if (declared.get(name) === 'type') {
          entries[name] = { kind: 'type' };
        } else {
          entries[name] = { kind: 'missing' };
        }
      }
      tree[pkg.name][sub] = entries;
    }
  }
  return tree;
}

/**
 * Describe how `live` differs from `expected`; an empty list means they match.
 * @param {LockTree} live
 * @param {LockTree} expected
 * @returns {string[]}
 */
export function diffTrees(live, expected) {
  /** @type {string[]} */
  const lines = [];
  for (const pkg of new Set([...Object.keys(live), ...Object.keys(expected)])) {
    for (const sub of new Set([
      ...Object.keys(live[pkg] ?? {}),
      ...Object.keys(expected[pkg] ?? {}),
    ])) {
      const now = live[pkg]?.[sub];
      const was = expected[pkg]?.[sub];
      const where = sub === '.' ? pkg : `${pkg} ${sub}`;
      if (!now) {
        lines.push(`${where}: entry point removed`);
        continue;
      }
      if (!was) {
        lines.push(`${where}: entry point added (${Object.keys(now).length} names)`);
        continue;
      }
      for (const name of Object.keys(now)) {
        if (!(name in was)) lines.push(`${where}: added ${name} (${now[name].kind})`);
        else if (now[name].kind !== was[name].kind) {
          lines.push(`${where}: ${name} changed ${was[name].kind} -> ${now[name].kind}`);
        }
      }
      for (const name of Object.keys(was)) {
        if (!(name in now)) lines.push(`${where}: removed ${name}`);
      }
    }
  }
  return lines;
}

/** @param {string[]} args @param {string} flag */
function flagValue(args, flag) {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
}

/** @param {string[]} args */
export function main(args) {
  const root = resolve(flagValue(args, '--root') ?? repoRoot);
  const lockPath = resolve(flagValue(args, '--lock') ?? join(root, 'tools/test/export-lock.json'));
  const live = collectLockTree(root);

  if (args.includes('--write')) {
    writeFileSync(lockPath, `${JSON.stringify(live, null, 2)}\n`);
    console.log(`Wrote ${lockPath}`);
    return 0;
  }

  if (!existsSync(lockPath)) {
    console.error(`Missing ${lockPath}. Run with --write after bun run build.`);
    return 1;
  }
  const differences = diffTrees(live, JSON.parse(readFileSync(lockPath, 'utf8')));
  if (differences.length > 0) {
    console.error('FAIL: public export names differ from the lock:');
    for (const line of differences) console.error(`  ${line}`);
    console.error('If deliberate, refresh with: node tools/test/check-export-lock.mjs --write');
    return 1;
  }
  const names = Object.values(live).reduce(
    (n, subs) => n + Object.values(subs).reduce((m, entries) => m + Object.keys(entries).length, 0),
    0
  );
  console.log(`OK: ${names} public export names match the lock.`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit(main(process.argv.slice(2)));
}
