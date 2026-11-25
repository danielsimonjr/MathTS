import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

/** GitHub repository that owns the six-system parity issues. */
export const REPO = 'danielsimonjr/MathTS';

/** Minimum pause after a successful GitHub write, in milliseconds. */
export const WRITE_GAP_MS = 1100;

function errorText(err) {
  const stderr = err.stderr != null ? String(err.stderr) : '';
  const stdout = err.stdout != null ? String(err.stdout) : '';
  return `${stderr}\n${stdout}\n${err.message || ''}`;
}

/**
 * Returns whether a `gh` failure is an "already exists" response from GitHub.
 *
 * @param err - Error thrown by `execFileSync` when `gh` exits non-zero
 * @returns `true` when the message reports that the label or resource already exists
 */
export function isAlreadyExists(err) {
  const msg = errorText(err);
  return /already_exists|already exists|Name has already been taken/i.test(msg);
}

/**
 * Returns whether a `gh` failure is a GitHub primary or secondary rate limit.
 *
 * @param err - Error thrown by `execFileSync` when `gh` exits non-zero
 * @returns `true` when the status or message indicates 403/429 rate limiting
 */
export function isRateLimited(err) {
  const msg = errorText(err);
  return (
    err.status === 429 ||
    /secondary rate limit|API rate limit exceeded|429 Too Many Requests|abuse detection|Wait a few minutes before|You have exceeded a secondary rate limit/i.test(
      msg
    ) ||
    (/HTTP 403|status 403/i.test(msg) && /rate/i.test(msg))
  );
}

/**
 * Runs `gh` with the given arguments, retrying 403/429 rate limits with backoff.
 *
 * After a successful write, waits {@link WRITE_GAP_MS} so callers stay under
 * GitHub's secondary rate limit of about one write per second.
 *
 * @param args - Arguments passed to the `gh` executable, not including `gh` itself
 * @param options - Optional stdin `input` and `isWrite` to apply the post-write pause
 * @returns The UTF-8 stdout of the successful `gh` process
 * @throws The last `gh` error when retries are exhausted or the error is not a rate limit
 */
export async function ghRetry(args, options = {}) {
  const { input, isWrite = false } = options;
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const out = execFileSync('gh', args, {
        encoding: 'utf8',
        input,
        maxBuffer: 20 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      if (isWrite) await delay(WRITE_GAP_MS);
      return out;
    } catch (err) {
      if (isRateLimited(err) && attempt < maxAttempts) {
        const wait = Math.min(60_000, 5_000 * 2 ** (attempt - 1));
        console.error(
          `  rate limited (attempt ${attempt}/${maxAttempts}), waiting ${wait / 1000}s...`
        );
        await delay(wait);
        continue;
      }
      err.ghArgs = args;
      throw err;
    }
  }
}

/**
 * Reads classification-script flags from `process.argv`.
 *
 * @param argv - Argument vector, usually `process.argv`
 * @returns Parsed flags; `dryRun` is true when `--dry-run` is present
 */
export function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
  };
}
