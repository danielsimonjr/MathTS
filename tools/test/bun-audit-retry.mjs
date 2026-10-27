// CI helper: run `bun audit --audit-level=high` with retries on registry outages only.
// Usage: node tools/test/bun-audit-retry.mjs
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

/** Args passed to `bun` (never a bare `bun audit`). */
export const BUN_AUDIT_ARGS = ['audit', '--audit-level=high'];

const ATTEMPT_TIMEOUT_MS = 60_000;

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
 * @param {number} attemptIndex
 * @returns {Promise<AuditAttemptResult>}
 */
export async function defaultRunOnce(_attemptIndex) {
  try {
    const { stdout, stderr } = await execFileAsync('bun', BUN_AUDIT_ARGS, {
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
 * @param {{ runOnce?: (attemptIndex: number) => Promise<AuditAttemptResult>, backoffMs?: number[], maxAttempts?: number }} [options]
 * @returns {Promise<number>} process exit code
 */
export async function runAuditWithRetry(options = {}) {
  const { runOnce = defaultRunOnce, backoffMs = [2000, 4000], maxAttempts = 3 } = options;

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

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const code = await runAuditWithRetry();
  process.exit(code);
}
