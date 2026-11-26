/**
 * Loader for the split known-gap records.
 *
 * The gap list used to be one `known-gaps.json` keyed by issue number. Every
 * parity PR appended labels to its issue's array in that one file, so parallel
 * PRs conflicted on the shared lines. Now each issue group is its own JSON file
 * next to this loader (`<issue>.json`, `unassigned.json` for labels whose
 * function no issue claims), and the merged `Record<string, string[]>` is
 * identical to what the single file held: the full-surface harness pins the
 * same unrecorded/stale/grouping checks over the merge.
 *
 * Add a gap by appending the label to the issue's file (create the file when
 * the issue has no gaps yet). Do not edit another issue's file.
 */
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('.', import.meta.url);

/** Every issue group, merged from the per-issue files in filename order. */
export const GAPS: Record<string, string[]> = Object.fromEntries(
  readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => [
      name.replace(/\.json$/, ''),
      JSON.parse(readFileSync(new URL(name, dir), 'utf8')) as string[],
    ])
);

export const ALL_GAPS: ReadonlySet<string> = new Set(Object.values(GAPS).flat());
