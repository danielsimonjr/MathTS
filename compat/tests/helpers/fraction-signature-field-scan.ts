/**
 * Flags fraction.js field reads (`.s`, `.n`, `.d`, `['s']`, …) on Fraction-typed
 * parameters inside typed-function signature blocks. Multiline-aware (#1551 F4).
 */

const FRACTION_SIG = /Fraction\s*:/;
const FIELD_READ = /\b(x|[\w]+)\s*\.\s*(s|n|d)\b|\b(x|[\w]+)\s*\[\s*['"](s|n|d)['"]\s*\]/g;

const LOOKAHEAD_LINES = 12;

export function scanFractionFieldReads(source: string): string[] {
  const hits: string[] = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!FRACTION_SIG.test(lines[i]!)) continue;
    const window = lines.slice(i, Math.min(i + LOOKAHEAD_LINES, lines.length)).join('\n');
    FIELD_READ.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = FIELD_READ.exec(window))) {
      hits.push(`${i + 1}: ${m[0]}`);
    }
  }
  return hits;
}
