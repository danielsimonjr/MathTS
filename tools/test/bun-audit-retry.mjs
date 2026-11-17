// CI helper: run `bun audit --audit-level=high` with retries on registry outages only.
// It runs two audits. The full tree skips the advisories in the ignore file. The
// production tree (`--prod`) skips no advisory.
// Usage: node tools/test/bun-audit-retry.mjs
// The ignore file is tools/test/audit-ignore.json. Set MATHTS_AUDIT_IGNORE_FILE to use another file.
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

/** Args passed to `bun` (never a bare `bun audit`). */
export const BUN_AUDIT_ARGS = ['audit', '--audit-level=high'];

const ATTEMPT_TIMEOUT_MS = 60_000;

/** The default ignore file, next to this script. */
export const DEFAULT_IGNORE_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  'audit-ignore.json'
);

const ADVISORY_ID_RE = /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/;
const REQUIRED_FIELDS = ['id', 'package', 'reason', 'remove', 'issue'];

/**
 * Reads and checks the ignore file. Throws when the file is missing, is not JSON,
 * or has an entry without an advisory id, package, reason, removal condition or issue.
 * @param {string} file
 * @returns {{ id: string, package: string, reason: string, remove: string, issue: number }[]}
 */
export function loadIgnores(file) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`bun audit: cannot read the ignore file ${file}: ${err.message}`);
  }
  if (!parsed || !Array.isArray(parsed.ignores)) {
    throw new Error(`bun audit: ${file} has no "ignores" array`);
  }
  for (const entry of parsed.ignores) {
    for (const field of REQUIRED_FIELDS) {
      if (entry?.[field] === undefined || entry[field] === '') {
        throw new Error(`bun audit: an entry in ${file} has no "${field}"`);
      }
    }
    if (!ADVISORY_ID_RE.test(entry.id)) {
      throw new Error(`bun audit: "${entry.id}" in ${file} is not a GHSA id`);
    }
  }
  return parsed.ignores;
}

/**
 * Builds the bun arguments for one audit.
 * The production audit never takes an ignore, so a runtime dependency cannot hide behind the list.
 * @param {{ id: string }[]} ignores
 * @param {{ production?: boolean }} [options]
 * @returns {string[]}
 */
export function buildAuditArgs(ignores, { production = false } = {}) {
  if (production) return [...BUN_AUDIT_ARGS, '--prod'];
  return [...BUN_AUDIT_ARGS, ...ignores.map((entry) => `--ignore=${entry.id}`)];
}

/**
 * stderr patterns that mean a registry/network outage, not a real advisory.
 * HTTP 5xx plus Node-style codes, and bun 1.4.2's own names observed on
 * `bun audit --audit-level=high` (` - 503`, `ConnectionRefused`,
 * `DNSResolveFailed`). Outage matching is stderr-only so an advisory table
 * on stdout that happens to contain "503" (e.g. a CVE id) is never retried.
 */
export const OUTAGE_STDERR_RE =
  /503|502|504|ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed|socket hang up|ConnectionRefused|ConnectionReset|DNSResolveFailed|ConnectionTimedOut/i;

/**
 * @typedef {{ exitCode: number | null, stdout?: string, stderr: string, spawnError?: Error, timedOut?: boolean }} AuditAttemptResult
 */

/**
 * Classifies one audit attempt as a pass, an outage or an advisory failure.
 * @param {AuditAttemptResult} result
 * @returns {'ok' | 'outage' | 'advisory'}
 */
export function classifyAttempt(result) {
  // Timeout/spawn must not pass even if the child somehow reports exit 0.
  if (result.spawnError || result.timedOut) return 'outage';
  if (result.exitCode === 0) return 'ok';
  if (OUTAGE_STDERR_RE.test(result.stderr ?? '')) return 'outage';
  return 'advisory';
}

function sleep(ms) {
  return new Promise((ok) => setTimeout(ok, ms));
}

function streamText(stream, text) {
  if (!text) return;
  stream.write(text.endsWith('\n') ? text : `${text}\n`);
}

/**
 * Forward bun's own stdout/stderr so CI shows the audit table (or the last
 * outage line). Generic fallbacks only when bun printed nothing.
 * @param {AuditAttemptResult} result
 * @param {'ok' | 'advisory' | 'outage'} kind
 */
function emitAttempt(result, kind) {
  streamText(process.stdout, result.stdout);
  streamText(process.stderr, result.stderr);
  if (kind === 'ok' && !result.stdout) {
    console.log('bun audit: no high+ vulnerabilities found.');
  } else if (kind === 'advisory' && !result.stdout && !result.stderr) {
    console.error('bun audit reported a high+ advisory.');
  } else if (kind === 'outage' && !result.stdout && !result.stderr) {
    console.error('bun audit failed after retries (registry outage).');
  }
}

/**
 * Runs bun audit one time and returns its exit code and output.
 * @param {string[]} args The bun arguments
 * @returns {Promise<AuditAttemptResult>}
 */
export async function defaultRunOnce(args) {
  try {
    const { stdout, stderr } = await execFileAsync('bun', args, {
      timeout: ATTEMPT_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8',
    });
    return { exitCode: 0, stdout: stdout ?? '', stderr: stderr ?? '' };
  } catch (err) {
    const stdout = err.stdout ?? '';
    const stderr = err.stderr ?? '';
    if (err.killed && (err.signal === 'SIGTERM' || err.signal === 'SIGKILL')) {
      return { exitCode: null, stdout, stderr, timedOut: true };
    }
    if (typeof err.code === 'string') {
      return {
        exitCode: null,
        stdout,
        stderr: stderr || (err.message ?? String(err)),
        spawnError: err,
      };
    }
    const exitCode = typeof err.code === 'number' ? err.code : 1;
    return { exitCode, stdout, stderr: stderr || (err.message ?? '') };
  }
}

/**
 * Runs the audit, retries after an outage, and returns the exit code.
 * @param {{ runOnce?: (attemptIndex: number) => Promise<AuditAttemptResult>, backoffMs?: number[], maxAttempts?: number, args?: string[] }} [options]
 * @returns {Promise<number>} process exit code
 */
export async function runAuditWithRetry(options = {}) {
  const {
    args = BUN_AUDIT_ARGS,
    runOnce = () => defaultRunOnce(args),
    backoffMs = [2000, 4000],
    maxAttempts = 3,
  } = options;

  let lastResult = /** @type {AuditAttemptResult} */ ({ exitCode: 1, stdout: '', stderr: '' });
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await runOnce(attempt);
    lastResult = result;
    const kind = classifyAttempt(result);
    if (kind === 'ok') {
      emitAttempt(result, 'ok');
      return 0;
    }
    if (kind === 'advisory') {
      emitAttempt(result, 'advisory');
      return 1;
    }
    if (attempt < maxAttempts - 1) {
      const delay = backoffMs[attempt] ?? backoffMs[backoffMs.length - 1] ?? 0;
      if (delay > 0) await sleep(delay);
    }
  }
  emitAttempt(lastResult, 'outage');
  return 1;
}

/**
 * Runs the full-tree audit with the ignore file, then the production audit with no ignore.
 * @param {{ ignoreFile?: string, run?: (args: string[]) => Promise<number> }} [options]
 * @returns {Promise<number>} 0 only when both audits pass
 */
export async function runAudits(options = {}) {
  const {
    ignoreFile = process.env.MATHTS_AUDIT_IGNORE_FILE || DEFAULT_IGNORE_FILE,
    run = (args) => runAuditWithRetry({ args }),
  } = options;
  const ignores = loadIgnores(ignoreFile);
  for (const entry of ignores) {
    console.log(
      `bun audit: ignoring ${entry.id} (${entry.package}, issue #${entry.issue}) in the full tree only.`
    );
  }
  const full = await run(buildAuditArgs(ignores));
  const production = await run(buildAuditArgs(ignores, { production: true }));
  return full === 0 && production === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    process.exit(await runAudits());
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
