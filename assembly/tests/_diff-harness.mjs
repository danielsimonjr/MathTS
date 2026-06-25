/**
 * Shared helpers for the differential numerical-correctness harness.
 *
 * Three-tier classification (see COVERAGE_AUDIT.md):
 *   PASS  score <= target       within reference accuracy
 *   WEAK  target < score <= fail works, but below target accuracy (a finding)
 *   FAIL  score > fail          genuine correctness bug (fails the build)
 *
 * `score` is a combined relative/absolute error: |a-e| / max(|e|, 1) so that
 * values near zero are judged on absolute error and large values on relative.
 */
export function score(actual, expected) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
    return actual === expected ? 0 : Infinity;
  }
  const denom = Math.abs(expected) > 1e-12 ? Math.abs(expected) : 1;
  return Math.abs(actual - expected) / denom;
}

export function createReport(title, target, fail) {
  const rows = []; // {label, score, tier}
  return {
    add(label, actual, expected) {
      const s = score(actual, expected);
      const tier = s <= target ? 'PASS' : s <= fail ? 'WEAK' : 'FAIL';
      rows.push({ label, score: s, tier, actual, expected });
      return tier;
    },
    addScore(label, s) {
      const tier = s <= target ? 'PASS' : s <= fail ? 'WEAK' : 'FAIL';
      rows.push({ label, score: s, tier });
      return tier;
    },
    finish() {
      const pass = rows.filter((r) => r.tier === 'PASS').length;
      const weak = rows.filter((r) => r.tier === 'WEAK');
      const fails = rows.filter((r) => r.tier === 'FAIL');
      console.log(`\n${title}`);
      console.log('='.repeat(title.length));
      console.log(`target rel/abs <= ${target}, hard-fail > ${fail}`);
      console.log(`${rows.length} checks: ${pass} PASS, ${weak.length} WEAK, ${fails.length} FAIL`);
      if (weak.length) {
        console.log('\nWEAK (accuracy below target — finding, not failure):');
        for (const r of weak) console.log(`  ~ ${r.label}  score=${r.score.toExponential(2)}`);
      }
      if (fails.length) {
        console.log('\nFAIL (genuine error):');
        for (const r of fails) {
          const detail = r.actual !== undefined
            ? `  got ${r.actual} want ${r.expected}` : '';
          console.log(`  X ${r.label}  score=${r.score.toExponential(2)}${detail}`);
        }
      }
      // Worst-case per-tier summary line for quick scanning.
      const worst = rows.reduce((m, r) => (r.score > m ? r.score : m), 0);
      console.log(`\nworst score: ${worst.toExponential(2)}`);
      return fails.length === 0;
    },
  };
}
