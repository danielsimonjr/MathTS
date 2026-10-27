// CI helper: run `bun audit --audit-level=high` with retries on registry outages only.
// Usage: node tools/test/bun-audit-retry.mjs
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

/** Args passed to `bun` (never a bare `bun audit`). */
export const BUN_AUDIT_ARGS = ['audit', '--audit-level=high'];

const ATTEMPT_TIMEOUT_MS = 60_000;

/** stderr patterns that mean a registry/network outage, not a real advisory. */
export const OUTAGE_STDERR_RE =
  /503|502|504|ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed|socket hang up/i;

/**
 * @typedef {{ exitCode: number | null, stderr: string, spawnError?: Error, timedOut?: boolean }} AuditAttemptResult
 */

/**
 * @param {AuditAttemptResult} result
 * @returns {'ok' | 'outage' | 'advisory'}
 */
export function classifyAttempt(result) {
  if (result.exitCode === 0) return 'ok';
  if (result.spawnError || result.timedOut) return 'outage';
  if (OUTAGE_STDERR_RE.test(result.stderr)) return 'outage';
  return 'advisory';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {number} attemptIndex
 * @returns {Promise<AuditAttemptResult>}
 */
export async function defaultRunOnce(_attemptIndex) {
  try {
    const { stderr } = await execFileAsync('bun', BUN_AUDIT_ARGS, {
      timeout: ATTEMPT_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8',
    });
    return { exitCode: 0, stderr: stderr ?? '' };
  } catch (err) {
    if (err.killed && (err.signal === 'SIGTERM' || err.signal === 'SIGKILL')) {
      return { exitCode: null, stderr: err.stderr ?? '', timedOut: true };
    }
    if (typeof err.code === 'string') {
      return { exitCode: null, stderr: err.message ?? String(err), spawnError: err };
    }
    const exitCode = typeof err.code === 'number' ? err.code : 1;
    const stderr = err.stderr ?? err.message ?? '';
    return { exitCode, stderr };
  }
}

/**
 * @param {{ runOnce?: (attemptIndex: number) => Promise<AuditAttemptResult>, backoffMs?: number[], maxAttempts?: number }} [options]
 * @returns {Promise<number>} process exit code
 */
export async function runAuditWithRetry(options = {}) {
  const { runOnce = defaultRunOnce, backoffMs = [2000, 4000], maxAttempts = 3 } = options;

  let lastStderr = '';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await runOnce(attempt);
    lastStderr = result.stderr;
    const kind = classifyAttempt(result);
    if (kind === 'ok') {
      console.log('bun audit: no high+ vulnerabilities found.');
      return 0;
    }
    if (kind === 'advisory') {
      if (lastStderr) console.error(lastStderr);
      else console.error('bun audit reported a high+ advisory.');
      return 1;
    }
    if (attempt < maxAttempts - 1) {
      const delay = backoffMs[attempt] ?? backoffMs[backoffMs.length - 1] ?? 0;
      if (delay > 0) await sleep(delay);
    }
  }
  console.error(lastStderr || 'bun audit failed after retries (registry outage).');
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const code = await runAuditWithRetry();
  process.exit(code);
}
