/**
 * Atomic file write shared by the CLI write commands and the serve session.
 */

import { writeFileSync, renameSync, unlinkSync } from 'node:fs';

let counter = 0;

/**
 * Write `content` to `file` atomically: write a uniquely-named sibling temp
 * file (exclusive create, so a pre-planted symlink can't be hijacked), then
 * rename over the target (atomic on the same filesystem; replaces a symlink
 * rather than writing through it). On any failure the temp file is removed.
 */
export function writeFileAtomic(file: string, content: string): void {
  const tmp = `${file}.${process.pid}.${counter++}.tmp`;
  writeFileSync(tmp, content, { encoding: 'utf-8', flag: 'wx' });
  try {
    renameSync(tmp, file);
  } catch (error) {
    try {
      unlinkSync(tmp);
    } catch {
      // best-effort cleanup
    }
    throw error;
  }
}
