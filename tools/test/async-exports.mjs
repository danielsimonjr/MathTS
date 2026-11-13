/**
 * Which exports return a Promise, and which fenced samples call one without awaiting it.
 *
 * `deriveAsyncExports` reads the built packages, so the list cannot go stale: a name is async when
 * the package exports it at run time and every declaration of it in the emitted `.d.ts` files
 * returns `Promise<...>`. A name with one synchronous declaration is left out (the call site
 * decides, as for `fft`, which is synchronous for `number[]` and a Promise for `Float64Array`).
 * Run time alone is not enough: `casSimplify` returns a Promise without being an `async` function.
 *
 * `unawaitedCalls` scans the code fences of a Markdown document. A call is awaited when `await`
 * precedes it, when it is returned, when it sits inside `Promise.all/allSettled/race/any(...)`,
 * when `.then/.catch/.finally` follows it, or when it is assigned to a name that is awaited or
 * chained later in the same fence. Any other call to an async export is reported.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractFences } from './readme-fences.mjs';
import { MATHTS_WORKSPACE_PREFIX, workspaceDirs } from './workspaces.mjs';

/** Fence languages that hold code. */
const CODE_LANGS = new Set(['ts', 'typescript', 'js', 'javascript', 'mjs', 'tsx']);

// ---------------------------------------------------------------------------
// Deriving the async exports from the built packages
// ---------------------------------------------------------------------------

/** Remove `/* ... *\/` comments (JSDoc holds example code that must not read as a declaration). */
function stripBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Index of the bracket that closes the one opened at `open`. `=>` is skipped, so the `>` of an
 * arrow does not close a `<` generic list.
 * @param {string} text
 * @param {number} open
 * @returns {number} the index, or -1
 */
function matching(text, open) {
  const pairs = { '(': ')', '<': '>', '[': ']', '{': '}' };
  const stack = [text[open]];
  for (let i = open + 1; i < text.length; i++) {
    const c = text[i];
    if (c === '=' && text[i + 1] === '>') {
      i++;
      continue;
    }
    if (c in pairs) stack.push(c);
    else if (c === pairs[stack[stack.length - 1]]) {
      stack.pop();
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

/**
 * The text of a type that starts at `from`, up to the `;` that ends the declaration.
 * @param {string} text
 * @param {number} from
 */
function typeText(text, from) {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (c === '=' && text[i + 1] === '>') {
      i++;
      continue;
    }
    if ('(<[{'.includes(c)) depth++;
    else if (')>]}'.includes(c)) depth--;
    else if (c === ';' && depth <= 0) return text.slice(from, i);
  }
  return text.slice(from);
}

/** True when a return-type text is a Promise. */
const isPromise = (t) => /^\s*Promise\s*</.test(t);

/**
 * Whether each declaration of each function in a `.d.ts` returns a Promise.
 * Handles `export declare function f(...): R;` and `export declare const f: (...) => R;`.
 * @param {string} dts
 * @returns {Map<string, boolean[]>} name -> one flag per declaration (true = Promise)
 */
export function declaredReturns(dts) {
  const text = stripBlockComments(dts);
  /** @type {Map<string, boolean[]>} */
  const found = new Map();
  const add = (name, promise) => found.set(name, [...(found.get(name) ?? []), promise]);

  const fnRe = /export declare function ([A-Za-z_$][\w$]*)\s*/g;
  for (let m; (m = fnRe.exec(text));) {
    let i = m.index + m[0].length;
    if (text[i] === '<') {
      const close = matching(text, i);
      if (close < 0) continue;
      i = close + 1;
    }
    while (/\s/.test(text[i] ?? '')) i++;
    if (text[i] !== '(') continue;
    const close = matching(text, i);
    if (close < 0) continue;
    const rest = text.slice(close + 1).replace(/^\s*/, '');
    if (rest[0] !== ':') continue;
    add(m[1], isPromise(typeText(rest, 1)));
  }

  const constRe = /export declare const ([A-Za-z_$][\w$]*)\s*:\s*/g;
  for (let m; (m = constRe.exec(text));) {
    let i = m.index + m[0].length;
    if (text[i] === '<') {
      const close = matching(text, i);
      if (close < 0) continue;
      i = close + 1;
    }
    if (text[i] !== '(') continue; // a typed function, an object type or an alias: not a plain function
    const close = matching(text, i);
    if (close < 0) continue;
    const after = text.slice(close + 1).replace(/^\s*/, '');
    if (!after.startsWith('=>')) continue;
    add(m[1], isPromise(typeText(after, 2)));
  }
  return found;
}

/** All `.d.ts` files under `dir`. */
function dtsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...dtsFiles(path));
    else if (entry.endsWith('.d.ts')) out.push(path);
  }
  return out;
}

/**
 * The built main entry (`.`) of each workspace package whose JavaScript and declarations exist.
 * Subpath entries are not read: some are worker or tool scripts that run code when imported
 * (`workerpool/worker`), and a sample imports its calls from the main entry.
 * @returns {{ dir: string, js: string }[]}
 */
function builtEntries(root) {
  const dirs = workspaceDirs(root).map((d) => join(root, d));
  const entries = [];
  for (const dir of dirs) {
    const manifest = join(dir, 'package.json');
    if (!existsSync(manifest)) continue;
    const { exports = {} } = JSON.parse(readFileSync(manifest, 'utf8'));
    const main = exports['.'];
    if (typeof main !== 'object' || main === null) continue;
    const js = main.import ?? main.default;
    const types = main.types;
    if (typeof js !== 'string' || typeof types !== 'string') continue;
    if (existsSync(join(dir, js)) && existsSync(join(dir, types)))
      entries.push({ dir, js: join(dir, js) });
  }
  return entries;
}

/**
 * Names that a built package exports as a function and that always return a Promise.
 * Throws when no package is built, so a missing build cannot pass as "no async exports".
 * @param {string} root repository root
 * @returns {Promise<Set<string>>}
 */
export async function deriveAsyncExports(root) {
  const entries = builtEntries(root);
  if (entries.length === 0) {
    throw new Error('no built package found (dist entries of the workspaces): run `bun run build`');
  }
  /** @type {Map<string, boolean[]>} */
  const declared = new Map();
  /** @type {Set<string>} */
  const exported = new Set();
  for (const dir of new Set(entries.map((e) => e.dir))) {
    if (!existsSync(join(dir, 'dist'))) continue;
    for (const file of dtsFiles(join(dir, 'dist'))) {
      for (const [name, flags] of declaredReturns(readFileSync(file, 'utf8'))) {
        declared.set(name, [...(declared.get(name) ?? []), ...flags]);
      }
    }
  }
  for (const { js } of entries) {
    const ns = await import(pathToFileURL(js).href);
    for (const [name, value] of Object.entries(ns))
      if (typeof value === 'function') exported.add(name);
  }
  const names = new Set();
  for (const name of exported) {
    const flags = declared.get(name);
    if (flags && flags.length > 0 && flags.every(Boolean)) names.add(name);
  }
  return names;
}

// ---------------------------------------------------------------------------
// Scanning a sample
// ---------------------------------------------------------------------------

/**
 * Replace comments and the inside of string and template literals with spaces (newlines stay), so
 * a name in a comment or a string is not read as a call.
 * @param {string} code
 */
function blank(code) {
  /** A space for each character, but a newline stays a newline. */
  const blankOf = (text) => text.replace(/[^\n]/g, ' ');
  let out = '';
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    const next = code[i + 1];
    if (c === '/' && next === '/') {
      const end = code.indexOf('\n', i);
      const stop = end < 0 ? code.length : end;
      out += blankOf(code.slice(i, stop));
      i = stop;
    } else if (c === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2);
      const stop = end < 0 ? code.length : end + 2;
      out += blankOf(code.slice(i, stop));
      i = stop;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== c) j += code[j] === '\\' ? 2 : 1;
      const stop = Math.min(j, code.length);
      out += c + blankOf(code.slice(i + 1, stop));
      if (stop < code.length) out += c;
      i = stop + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/**
 * Names the fence defines for itself: a call to one is not a call to the export of that name.
 * Also maps an import alias to the exported name.
 * @param {string} code blanked code
 * @param {string} original code with strings (the module specifier of an import is a string)
 * @returns {{ local: Set<string>, alias: Map<string, string> }}
 */
function bindings(code, original) {
  const local = new Set();
  const alias = new Map();
  for (const m of code.matchAll(/\b(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g))
    local.add(m[1]);
  for (const m of code.matchAll(/\b(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) local.add(m[1]);
  for (const m of original.matchAll(/\bimport\s*\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2/g)) {
    const own = m[3].startsWith(MATHTS_WORKSPACE_PREFIX);
    for (const part of m[1].split(',')) {
      const [imported, as] = part.trim().split(/\s+as\s+/);
      if (!imported) continue;
      const name = as ?? imported;
      if (!own)
        local.add(name); // imported from a package that is not ours
      else if (as) alias.set(as, imported);
    }
  }
  return { local, alias };
}

/** The openers that are still open at the end of `text`, with the text before each. */
function openStack(text) {
  const stack = [];
  const closer = { ')': '(', ']': '[', '}': '{' };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if ('([{'.includes(c)) stack.push({ c, before: text.slice(0, i) });
    else if (c in closer && stack.length > 0 && stack[stack.length - 1].c === closer[c])
      stack.pop();
  }
  return stack;
}

/** True when the call that starts at `start` and opens at `open` is awaited, returned or chained. */
function handled(code, start, open) {
  const before = code.slice(0, start);
  const head = before.replace(/[\s(]*$/, '');
  if (/\bawait$/.test(head) || /\breturn$/.test(head) || /=>$/.test(head)) return true;
  // Inside Promise.all([...]) and its relatives.
  for (const o of openStack(before)) {
    if (/Promise\s*\.\s*(all|allSettled|race|any)\s*$/.test(o.before)) return true;
  }
  // `.then(...)`, `.catch(...)` or `.finally(...)` follows the call.
  const close = matching(code, open);
  if (close >= 0 && /^\s*\.\s*(then|catch|finally)\b/.test(code.slice(close + 1))) return true;
  // `const p = call(...)`, and `p` is awaited or chained later in the fence.
  const assign = /(?:^|[\s;{}])(?:const|let|var)?\s*([A-Za-z_$][\w$]*)\s*=\s*$/.exec(head);
  if (assign && !/=\s*=$/.test(head)) {
    const name = assign[1].replace(/\$/g, '\\$');
    const later = code.slice(close >= 0 ? close : open);
    const use = new RegExp(
      `\\bawait\\s*\\(*\\s*${name}\\b|\\b${name}\\s*\\.\\s*(then|catch|finally)\\b|Promise\\s*\\.\\s*(all|allSettled|race|any)\\s*\\([^;]*\\b${name}\\b`
    );
    return use.test(later);
  }
  return false;
}

/**
 * Lines of the fenced samples of a Markdown document that call an async export without `await`.
 * A call is `name(...)` or `receiver.name(...)` (a namespace import such as `stats.pageRank(g)`).
 * @param {string} markdown
 * @param {ReadonlySet<string>} asyncNames
 * @returns {string[]} `name: <line>` for each call
 */
export function unawaitedCalls(markdown, asyncNames) {
  const found = [];
  for (const fence of extractFences(markdown)) {
    if (!CODE_LANGS.has(fence.lang)) continue;
    const code = blank(fence.code);
    const { local, alias } = bindings(code, fence.code);
    const callRe = /(?<![\w$.])((?:[A-Za-z_$][\w$]*\s*\.\s*)*)([A-Za-z_$][\w$]*)\s*\(/g;
    for (let m; (m = callRe.exec(code));) {
      const receivers = m[1].replace(/\s+/g, '');
      const written = m[2];
      if (/^this\b/.test(receivers) || receivers.startsWith('Promise.')) continue;
      const name = receivers === '' ? (alias.get(written) ?? written) : written;
      if (!asyncNames.has(name)) continue;
      if (receivers === '' && local.has(written) && !alias.has(written)) continue;
      const open = m.index + m[0].length - 1;
      if (handled(code, m.index, open)) continue;
      const line = fence.code.slice(0, m.index).split('\n').length - 1;
      found.push(`${name}: ${fence.code.split('\n')[line].trim()}`);
    }
  }
  return found;
}

/** Markdown files under `root`, without build output, dependencies and agent scratch. */
export function markdownFiles(
  root,
  skip = new Set(['node_modules', 'dist', '.git', '.claude', '.turbo', 'coverage', 'site'])
) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (skip.has(entry)) continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith('.md')) out.push(path);
    }
  };
  walk(root);
  return out;
}
