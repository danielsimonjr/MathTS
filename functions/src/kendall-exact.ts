/**
 * Exact two-sided Kendall τ p-value (no ties), ported from
 * `scipy.stats._mstats_basic._kendall_p_exact` (Maurice G. Kendall, 1970).
 */

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/**
 * Two-sided exact p-value for Kendall τ with no ties (enumeration, small n).
 * @param n Sample size
 * @param c Concordant pair count (`tot - discordant`), SciPy's `tot-dis`
 */
export function kendallPExact(n: number, c: number): number {
  const tot = (n * (n - 1)) / 2;
  let cAdj = Math.min(c, tot - c);
  cAdj = Math.floor(cAdj);

  if (n <= 0) throw new Error(`kendallPExact: n (${n}) must be positive`);
  if (cAdj < 0 || 4 * cAdj > n * (n - 1)) {
    throw new Error(`kendallPExact: invalid c ${cAdj} for n=${n}`);
  }
  if (n === 1) return 1;
  if (n === 2) return 1;

  let prob: number;
  if (cAdj === 0) {
    prob = 2 / factorial(n);
  } else if (cAdj === 1) {
    prob = 2 / factorial(n - 1);
  } else if (4 * cAdj === n * (n - 1)) {
    prob = 1;
  } else if (n < 171) {
    const newArr = new Float64Array(cAdj + 1);
    newArr[0] = 1;
    if (cAdj >= 1) newArr[1] = 1;
    for (let j = 3; j <= n; j++) {
      let running = 0;
      for (let i = 0; i < newArr.length; i++) {
        running += newArr[i];
        newArr[i] = running;
      }
      if (j <= cAdj) {
        for (let i = j; i <= cAdj; i++) {
          newArr[i] -= newArr[i - j];
        }
      }
    }
    let sum = 0;
    for (let i = 0; i < newArr.length; i++) sum += newArr[i];
    prob = (2 * sum) / factorial(n);
  } else {
    const newArr = new Float64Array(cAdj + 1);
    newArr[0] = 1;
    if (cAdj >= 1) newArr[1] = 1;
    for (let j = 3; j <= n; j++) {
      let running = 0;
      for (let i = 0; i < newArr.length; i++) {
        running += newArr[i];
        newArr[i] = running / j;
      }
      if (j <= cAdj) {
        for (let i = j; i <= cAdj; i++) {
          newArr[i] -= newArr[i - j];
        }
      }
    }
    let sum = 0;
    for (let i = 0; i < newArr.length; i++) sum += newArr[i];
    prob = sum;
  }
  return Math.max(0, Math.min(1, prob));
}

/** SciPy `method='auto'` exact branch for τ_b without ties. */
export function kendallShouldUseExact(n: number, discordant: number): boolean {
  const tot = (n * (n - 1)) / 2;
  const concordant = tot - discordant;
  return n <= 33 || Math.min(discordant, concordant) <= 1;
}
