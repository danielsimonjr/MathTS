#!/usr/bin/env node
/**
 * graph-query — agent-facing query surface + derived reports over DGT's output.
 *
 * Reads docs/Architecture/dependency-graph.json (+ package-export-surfaces.json)
 * — it does NOT re-parse the codebase — and answers the structural questions an
 * agent otherwise greps for, plus emits two derived artifacts:
 *   - dependency-reverse.json : reverse edges ("who imports file X")
 *   - node-safety.json        : node:-tainted files + browser-safety leaks
 *
 * Usage:
 *   node graph-query.mjs                      # (or --emit) write derived artifacts
 *   node graph-query.mjs dependents <file>    # intra-package files importing <file>
 *   node graph-query.mjs symbol-users <sym>   # files importing symbol <sym> (any package)
 *   node graph-query.mjs is-public <pkg> <s>  # is <s> in <pkg>'s public export surface?
 *   node graph-query.mjs node-safety [pkg]    # node:-using files reachable from a browser `.` entry
 *   node graph-query.mjs cycles               # circular dependencies
 *   node graph-query.mjs --check-browser-safety   # exit 1 if a browser-safe pkg leaks node: code
 *
 * Packages whose `.` (browser-facing) entry must stay free of node: builtins:
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const BROWSER_SAFE_PACKAGES = ['plot'];

// ── pure helpers (unit-tested) ──────────────────────────────────────────────

/** Resolve a relative import specifier from `importer` to a repo-relative file
 *  in `allFiles`, or null if it's external/unresolvable. */
export function resolveSpec(importer, spec, allFiles) {
  if (!spec.startsWith('.')) return null; // bare/external specifier
  const p = posix.normalize(posix.join(posix.dirname(importer), spec));
  const candidates = [];
  if (p.endsWith('.js')) {
    const b = p.slice(0, -3);
    candidates.push(`${b}.ts`, `${b}.tsx`, `${b}/index.ts`);
  } else if (p.endsWith('.ts')) {
    candidates.push(p);
  } else {
    candidates.push(`${p}.ts`, `${p}.tsx`, `${p}/index.ts`);
  }
  for (const c of candidates) if (allFiles.has(c)) return c;
  return null;
}

/** file → Set(files it imports), from resolved internalDependencies. */
export function buildForward(fileEntries, allFiles) {
  const forward = new Map();
  for (const [file, entry] of fileEntries) {
    const set = new Set();
    for (const dep of entry.internalDependencies || []) {
      const r = resolveSpec(file, dep.file, allFiles);
      if (r) set.add(r);
    }
    forward.set(file, set);
  }
  return forward;
}

/** Invert a forward edge map into file → sorted array of dependents. */
export function invert(forward) {
  const rev = new Map();
  for (const [file, deps] of forward) {
    for (const d of deps) {
      if (!rev.has(d)) rev.set(d, new Set());
      rev.get(d).add(file);
    }
  }
  // Files with no dependents are omitted (absent = "nobody imports this").
  const out = {};
  for (const [file, set] of rev) out[file] = [...set].sort();
  return out;
}

/** Compute node:-taint: a file is tainted if it (or anything it transitively
 *  imports) uses a node: builtin. Returns { taint: Map, direct: Map }. */
export function computeTaint(forward, fileEntries) {
  const direct = new Map();
  for (const [f, e] of fileEntries) direct.set(f, (e.nodeDependencies || []).length > 0);
  const taint = new Map();
  const visiting = new Set();
  function dfs(f) {
    if (taint.has(f)) return taint.get(f);
    if (direct.get(f)) {
      taint.set(f, true);
      return true;
    }
    if (visiting.has(f)) return false; // cycle guard
    visiting.add(f);
    let t = false;
    for (const d of forward.get(f) || []) {
      if (dfs(d)) {
        t = true;
        break;
      }
    }
    visiting.delete(f);
    taint.set(f, t);
    return t;
  }
  for (const f of forward.keys()) dfs(f);
  return { taint, direct };
}

/** BFS the set of files reachable from `entry` over forward edges. */
export function reachableFrom(entry, forward) {
  const seen = new Set();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const d of forward.get(f) || []) stack.push(d);
  }
  return seen;
}

/** Files reachable from `<pkg>/src/index.ts` that directly use a node: builtin. */
export function findLeaks(pkg, forward, direct) {
  const entry = `${pkg}/src/index.ts`;
  if (!forward.has(entry)) return [];
  const reachable = reachableFrom(entry, forward);
  return [...reachable].filter((f) => direct.get(f)).sort();
}

// ── data loading + CLI ──────────────────────────────────────────────────────

function loadData(root) {
  const graph = JSON.parse(readFileSync(join(root, 'docs/Architecture/dependency-graph.json'), 'utf8'));
  const surfPath = join(root, 'docs/Architecture/package-export-surfaces.json');
  const surfaces = existsSync(surfPath) ? JSON.parse(readFileSync(surfPath, 'utf8')).surfaces : {};
  const fileEntries = [];
  for (const mod of Object.values(graph.modules)) {
    for (const [file, entry] of Object.entries(mod)) fileEntries.push([file, entry]);
  }
  const allFiles = new Set(fileEntries.map(([f]) => f));
  const forward = buildForward(fileEntries, allFiles);
  return { graph, surfaces, fileEntries, allFiles, forward };
}

/** Files importing `symbol` via internal or workspace deps → [{file, from}]. */
function symbolUsers(symbol, fileEntries) {
  const out = [];
  for (const [file, entry] of fileEntries) {
    for (const d of entry.internalDependencies || [])
      if ((d.imports || []).includes(symbol)) out.push({ file, from: 'internal' });
    for (const d of entry.workspaceDependencies || [])
      if ((d.imports || []).includes(symbol)) out.push({ file, from: d.package });
  }
  return out;
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const [cmd, ...args] = process.argv.slice(2);
  const { graph, surfaces, fileEntries, allFiles, forward } = loadData(root);

  if (!cmd || cmd === '--emit') {
    const reverse = invert(forward);
    const { direct } = computeTaint(forward, fileEntries);
    const tainted = [...direct.entries()].filter(([, v]) => v).map(([f]) => f).sort();
    const leaks = {};
    for (const pkg of BROWSER_SAFE_PACKAGES) leaks[pkg] = findLeaks(pkg, forward, direct);
    writeFileSync(
      join(root, 'docs/Architecture/dependency-reverse.json'),
      JSON.stringify({ generated: graph.metadata.lastUpdated, dependents: reverse }, null, 2)
    );
    writeFileSync(
      join(root, 'docs/Architecture/node-safety.json'),
      JSON.stringify(
        { generated: graph.metadata.lastUpdated, browserSafePackages: BROWSER_SAFE_PACKAGES, nodeTaintedFiles: tainted, leaks },
        null,
        2
      )
    );
    const nLeaks = Object.values(leaks).reduce((a, l) => a + l.length, 0);
    console.log(`graph-query: wrote dependency-reverse.json (${Object.keys(reverse).length} files) + node-safety.json (${tainted.length} node-tainted, ${nLeaks} leak(s)).`);
    return;
  }

  if (cmd === 'dependents') {
    const file = args[0];
    const rev = invert(forward)[file] || [];
    console.log(rev.length ? rev.join('\n') : `(no intra-package importers of ${file})`);
    return;
  }
  if (cmd === 'symbol-users') {
    const users = symbolUsers(args[0], fileEntries);
    console.log(users.length ? users.map((u) => `${u.file}  [${u.from}]`).join('\n') : `(no importers of symbol ${args[0]})`);
    return;
  }
  if (cmd === 'is-public') {
    const [pkg, sym] = args;
    const list = surfaces[pkg];
    if (!list) return console.log(`(unknown package '${pkg}')`);
    console.log(list.includes(sym) ? `PUBLIC — ${sym} is exported from ${pkg}` : `INTERNAL — ${sym} is not in ${pkg}'s public export surface`);
    return;
  }
  if (cmd === 'node-safety') {
    const { direct } = computeTaint(forward, fileEntries);
    const pkgs = args[0] ? [args[0]] : BROWSER_SAFE_PACKAGES;
    for (const pkg of pkgs) {
      const leaks = findLeaks(pkg, forward, direct);
      console.log(`${pkg}: ${leaks.length ? `⚠ ${leaks.length} node: file(s) reachable from .:\n  ${leaks.join('\n  ')}` : '✓ clean (. entry reaches no node: code)'}`);
    }
    return;
  }
  if (cmd === 'cycles') {
    const cyc = graph.dependencyGraph.circularDependencies || [];
    console.log(cyc.length ? JSON.stringify(cyc, null, 2) : 'none (0 circular dependencies)');
    return;
  }
  if (cmd === '--check-browser-safety') {
    const { direct } = computeTaint(forward, fileEntries);
    let bad = 0;
    for (const pkg of BROWSER_SAFE_PACKAGES) {
      const leaks = findLeaks(pkg, forward, direct);
      if (leaks.length) {
        bad += leaks.length;
        console.log(`✖ ${pkg}: browser-safe . entry reaches node: code: ${leaks.join(', ')}`);
      } else {
        console.log(`✓ ${pkg}: . entry is node-free`);
      }
    }
    process.exit(bad ? 1 : 0);
  }

  console.log(`unknown command '${cmd}'. See --help header in graph-query.mjs.`);
  process.exit(2);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
