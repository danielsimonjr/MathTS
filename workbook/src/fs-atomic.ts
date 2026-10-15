/**
 * Atomic file write shared by the CLI write commands and the serve session.
 */

import { writeFileSync, renameSync, unlinkSync } from 'node:fs';

let counter = 0;

/** Rename attempts before the error is thrown. */
const RENAME_ATTEMPTS = 12;

/**
 * Error codes of a rename that fails because another process holds the target open. On Windows a
 * reader of the target (an antivirus scan, the search indexer) makes the rename fail with
 * `EPERM`, `EBUSY` or `EACCES` until it lets go.
 */
const LOCK_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

/** Options for tests: the rename to use and how to wait between attempts. */
export interface AtomicWriteOptions {
  rename?: typeof renameSync;
  sleepMs?: (ms: number) => void;
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Write `content` to `file` atomically: write a uniquely-named sibling temp
 * file (exclusive create, so a pre-planted symlink can't be hijacked), then
 * rename over the target (atomic on the same filesystem; replaces a symlink
 * rather than writing through it). A rename that fails because another process
 * holds the target open is retried a few times with a growing wait; any other
 * error is thrown at once. On any failure the temp file is removed.
 */
export function writeFileAtomic(
  file: string,
  content: string,
  options: AtomicWriteOptions = {}
): void {
  const rename = options.rename ?? renameSync;
  const sleep = options.sleepMs ?? sleepSync;
  const tmp = `${file}.${process.pid}.${counter++}.tmp`;
  writeFileSync(tmp, content, { encoding: 'utf-8', flag: 'wx' });
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        rename(tmp, file);
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (attempt >= RENAME_ATTEMPTS || code === undefined || !LOCK_CODES.has(code)) throw error;
        sleep(Math.min(10 * attempt, 50));
      }
    }
  } catch (error) {
    try {
      unlinkSync(tmp);
    } catch {
      // best-effort cleanup
    }
    throw error;
  }
}
