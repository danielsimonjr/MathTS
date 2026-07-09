#!/usr/bin/env node
/**
 * roadmap-check — advisory consistency gate for the feature-lifecycle workflow.
 *
 * Two deterministic checks (see docs/FEATURE_WORKFLOW.md):
 *   1. SHIPPED-CLAIM check: every `<pkg>@<version>` named under ROADMAP.md's
 *      "Recently shipped" section is verified against the live npm registry.
 *      Flags a claim whose npm version is BEHIND the claimed one (i.e. said
 *      shipped but isn't actually published).
 *   2. STALE-TODO check: every backticked file path in an unchecked TODO.md
 *      item (`- [ ]`) that ALREADY EXISTS on disk is flagged "verify not done".
 *
 * Advisory by default (exit 0). `--strict` exits 1 when any issue is found.
 * No dependencies; npm is queried best-effort (offline → reported, not fatal).
 */
import { readFileSync, existsSync } from 'node:fs';
import { get } from 'node:https';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const SCOPE = '@danielsimonjr/mathts-';

/** Parse "pkg@1.2.3" / "@scope/name@1.2.3" → {pkg (full scoped name), version}. */
function normalizePkg(short) {
  return short.startsWith('@') ? short : SCOPE + short;
}

/** Extract {pkg, version} claims from the "Recently shipped" section of ROADMAP md. */
export function extractShippedClaims(roadmapMd) {
  const lines = roadmapMd.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+recently shipped/i.test(l));
  if (start === -1) return [];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const body = lines.slice(start + 1, end).join('\n');
  const re = /(@danielsimonjr\/mathts-[a-z-]+|(?<![\w/])[a-z][a-z-]*)@(\d+\.\d+\.\d+)/g;
  const seen = new Map();
  let m;
  while ((m = re.exec(body)) !== null) {
    const pkg = normalizePkg(m[1]);
    // keep the highest claimed version per package
    const prev = seen.get(pkg);
    if (!prev || cmpSemver(m[2], prev) > 0) seen.set(pkg, m[2]);
  }
  return [...seen.entries()].map(([pkg, version]) => ({ pkg, version }));
}

/** Extract {line, lineNo, path} for backticked file-path tokens in unchecked TODO items. */
export function extractOpenTodoArtifacts(todoMd) {
  const out = [];
  const lines = todoMd.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (!/^\s*- \[ \]/.test(line)) return;
    const backticked = line.match(/`([^`]+)`/g) || [];
    for (const tok of backticked) {
      const inner = tok.slice(1, -1);
      // path-like: contains a slash AND a file extension, no spaces
      if (/^[\w./-]+\/[\w./-]+\.\w+$/.test(inner)) out.push({ lineNo: i + 1, path: inner });
    }
  });
  return out;
}

/** Compare two "a.b.c" semver-ish strings. Returns -1/0/1. */
export function cmpSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

/** Query the npm registry HTTP API for a package's latest version. No shell,
 *  no child_process — `pkg` (regex-constrained to [a-z@/-]) is URL-encoded.
 *  `agent: false` disables keep-alive so no pooled socket lingers past exit. */
function npmVersion(pkg) {
  return new Promise((resolveVersion) => {
    const url = `https://registry.npmjs.org/${pkg.replace('/', '%2f')}/latest`;
    const req = get(url, { agent: false }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolveVersion(null);
      }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const v = JSON.parse(data).version;
          resolveVersion(typeof v === 'string' ? v : null);
        } catch {
          resolveVersion(null);
        }
      });
    });
    req.on('error', () => resolveVersion(null));
    req.setTimeout(8000, () => {
      req.destroy();
      resolveVersion(null);
    });
  });
}

async function main() {
  const strict = process.argv.includes('--strict');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const roadmap = join(root, 'ROADMAP.md');
  const todo = join(root, 'TODO.md');
  const issues = [];

  if (existsSync(roadmap)) {
    const claims = extractShippedClaims(readFileSync(roadmap, 'utf8'));
    for (const { pkg, version } of claims) {
      const live = await npmVersion(pkg);
      if (live === null) {
        console.log(`  ?  ${pkg}@${version} — could not query npm (offline?)`);
      } else if (cmpSemver(live, version) < 0) {
        issues.push(`ROADMAP claims ${pkg}@${version} shipped, but npm latest is ${live}`);
      } else {
        console.log(`  ✓  ${pkg}@${version} — npm latest ${live}`);
      }
    }
  }

  if (existsSync(todo)) {
    for (const { lineNo, path } of extractOpenTodoArtifacts(readFileSync(todo, 'utf8'))) {
      if (existsSync(join(root, path))) {
        issues.push(`TODO.md:${lineNo} unchecked item references \`${path}\` which EXISTS — verify it isn't already done`);
      }
    }
  }

  console.log('');
  if (issues.length === 0) {
    console.log('roadmap-check: clean — no shipped-claim or stale-TODO issues.');
    process.exit(0);
  }
  console.log(`roadmap-check: ${issues.length} issue(s) to verify:`);
  for (const i of issues) console.log(`  ⚠  ${i}`);
  process.exit(strict ? 1 : 0);
}

// Run only when invoked directly (not when imported by the test).
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
