import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

export const REPO = 'danielsimonjr/MathTS';
export const WRITE_GAP_MS = 1100;

function errorText(err) {
  const stderr = err.stderr != null ? String(err.stderr) : '';
  const stdout = err.stdout != null ? String(err.stdout) : '';
  return `${stderr}\n${stdout}\n${err.message || ''}`;
}

export function isAlreadyExists(err) {
  const msg = errorText(err);
  return /already_exists|already exists|Name has already been taken/i.test(msg);
}

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

export async function ghRetry(args, { input, isWrite = false } = {}) {
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

export function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
  };
}
