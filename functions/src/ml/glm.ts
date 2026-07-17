/**
 * Generalized linear models via IRLS/Fisher scoring (Stats-breadth chunk).
 *
 * `logisticRegression` (`./logistic-regression.ts`) fits the Bernoulli/logit
 * special case by a Newton step equivalent to Fisher scoring (the logit link
 * is canonical for the Bernoulli family, so the two coincide). `glm`
 * generalizes to the Poisson (log link) and Gamma (log or inverse link)
 * families via the standard IRLS recursion, which is Fisher scoring for any
 * link, canonical or not:
 *
 *   w_i = (dμ/dη)² / V(μ),   z_i = η_i + (y_i − μ_i)·(dη/dμ)
 *   β ← solve(XᵀWX, XᵀWz)
 *
 * repeated until the linear predictor stabilizes. Mirrors R's `glm.fit` /
 * statsmodels' `GLM.fit` initialization (`mustart = y + 0.1` for Poisson,
 * `mustart = y` for Gamma) and unit-deviance formulas.
 */
import { linsolve } from '../typed/numeric.js';

/** Supported exponential-family distributions. */
export type GlmFamily = 'poisson' | 'gamma';

/** Supported link functions. */
export type GlmLink = 'log' | 'inverse';

export interface GlmOptions {
  /** Exponential family: `'poisson'` (counts) or `'gamma'` (positive continuous). */
  family: GlmFamily;
  /** Link function. Default `'log'` for both families (`'inverse'` — the Gamma
   * canonical link — is also supported for `family: 'gamma'`). */
  link?: GlmLink;
  /** Prepend a column of ones (default true), matching `ols`'s convention. */
  intercept?: boolean;
  /** Convergence tolerance on the max-norm change in the linear predictor (default 1e-10). */
  tol?: number;
  /** Maximum IRLS iterations (default 100). */
  maxIter?: number;
}

export interface GlmResult {
  /** Fitted coefficients (intercept first, if included). */
  coefficients: number[];
  /** Fitted mean response `μ = linkInverse(Xβ)` for the training rows. */
  fittedValues: number[];
  /** Residual deviance `Σ d(yᵢ, μᵢ)` (family-specific unit deviance). */
  deviance: number;
  /** Number of IRLS iterations performed. */
  iterations: number;
  /** Predict the mean response for new rows. */
  predict: (x: number[][]) => number[];
}

interface LinkFns {
  linkInv: (eta: number) => number;
  dMuDEta: (mu: number) => number;
  linkFn: (mu: number) => number;
}

function getLink(link: GlmLink): LinkFns {
  if (link === 'log') {
    return {
      linkInv: (eta) => Math.exp(eta),
      dMuDEta: (mu) => mu,
      linkFn: (mu) => Math.log(mu),
    };
  }
  return {
    linkInv: (eta) => 1 / eta,
    dMuDEta: (mu) => -mu * mu,
    linkFn: (mu) => 1 / mu,
  };
}

interface FamilyFns {
  variance: (mu: number) => number;
  /** Unit deviance contribution `d(y, μ)`. */
  deviance: (y: number, mu: number) => number;
  defaultLink: GlmLink;
  validLinks: readonly GlmLink[];
  mustart: (y: readonly number[]) => number[];
  validateY: (y: readonly number[]) => void;
}

function getFamily(family: GlmFamily): FamilyFns {
  if (family === 'poisson') {
    return {
      variance: (mu) => mu,
      deviance: (y, mu) => {
        const term = y > 0 ? y * Math.log(y / mu) : 0;
        return 2 * (term - (y - mu));
      },
      defaultLink: 'log',
      validLinks: ['log'],
      mustart: (y) => y.map((yi) => yi + 0.1),
      validateY: (y) => {
        if (y.some((yi) => yi < 0 || !Number.isFinite(yi))) {
          throw new Error('glm: poisson family requires non-negative, finite y');
        }
      },
    };
  }
  return {
    variance: (mu) => mu * mu,
    deviance: (y, mu) => 2 * (-Math.log(y / mu) + (y - mu) / mu),
    defaultLink: 'log',
    validLinks: ['log', 'inverse'],
    mustart: (y) => y.slice(),
    validateY: (y) => {
      if (y.some((yi) => yi <= 0 || !Number.isFinite(yi))) {
        throw new Error('glm: gamma family requires strictly positive, finite y');
      }
    },
  };
}

/**
 * Fit a generalized linear model `μ = linkInverse(Xβ)` by IRLS (Fisher
 * scoring). Supports `family: 'poisson'` (log link only) and `family:
 * 'gamma'` (log or inverse link).
 *
 * @param X - Design matrix (rows = observations, cols = predictors)
 * @param y - Response vector (non-negative for Poisson, strictly positive for Gamma)
 * @param opts - `family` (required), `link` (default `'log'`), `intercept`
 *   (default true), `tol` (default 1e-10), `maxIter` (default 100)
 *
 * @example
 * glm([[1], [2], [3], [4], [5]], [1, 2, 3, 5, 8], { family: 'poisson' })
 * // => coefficients ~= [-0.374104, 0.492678] (matches statsmodels sm.GLM(..., family=Poisson()))
 */
export function glm(X: number[][], y: number[], opts: GlmOptions): GlmResult {
  const n = X.length;
  if (n === 0) throw new Error('glm: empty design matrix');
  if (y.length !== n) throw new Error(`glm: length mismatch (X has ${n} rows, y has ${y.length})`);

  const family = getFamily(opts.family);
  family.validateY(y);

  const link = opts.link ?? family.defaultLink;
  if (!family.validLinks.includes(link)) {
    throw new Error(`glm: ${opts.family} family does not support the ${link} link`);
  }
  const linkFns = getLink(link);

  const useIntercept = opts.intercept !== false;
  const design: number[][] = useIntercept ? X.map((row) => [1, ...row]) : X.map((row) => [...row]);
  const p = design[0].length;
  if (n <= p) throw new Error(`glm: need more observations (${n}) than parameters (${p})`);

  const tol = opts.tol ?? 1e-10;
  const maxIter = opts.maxIter ?? 100;

  let eta = family.mustart(y).map((mu) => linkFns.linkFn(mu));
  let beta = new Array(p).fill(0);
  let iterations = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    const mu = eta.map((e) => linkFns.linkInv(e));

    const w = new Array<number>(n);
    const z = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const dMuDEta = linkFns.dMuDEta(mu[i]);
      const v = family.variance(mu[i]);
      w[i] = Math.max((dMuDEta * dMuDEta) / v, 1e-12);
      z[i] = eta[i] + (y[i] - mu[i]) / dMuDEta;
    }

    const XtWX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
    const XtWz: number[] = new Array(p).fill(0);
    for (let i = 0; i < n; i++) {
      const wi = w[i];
      const row = design[i];
      for (let a = 0; a < p; a++) {
        const wa = wi * row[a];
        for (let b = 0; b < p; b++) {
          XtWX[a][b] += wa * row[b];
        }
        XtWz[a] += wa * z[i];
      }
    }

    // Tiny ridge term keeps XtWX solvable under near-collinear designs
    // (mirrors the same guard in logisticRegression's IRLS).
    const ridgeEps = 1e-10;
    const regularized = XtWX.map((row, a) => row.map((v, b) => (a === b ? v + ridgeEps : v)));

    let newBeta: number[];
    try {
      newBeta = linsolve(regularized, XtWz);
    } catch {
      break;
    }

    const newEta = design.map((row) => row.reduce((s, v, j) => s + v * newBeta[j], 0));
    let maxDiff = 0;
    for (let i = 0; i < n; i++) maxDiff = Math.max(maxDiff, Math.abs(newEta[i] - eta[i]));

    beta = newBeta;
    eta = newEta;
    if (maxDiff < tol) break;
  }

  const mu = eta.map((e) => linkFns.linkInv(e));
  const deviance = y.reduce((sum, yi, i) => sum + family.deviance(yi, mu[i]), 0);

  const predict = (x: number[][]): number[] => {
    const Dx = useIntercept ? x.map((row) => [1, ...row]) : x.map((row) => [...row]);
    return Dx.map((row) => linkFns.linkInv(row.reduce((s, v, j) => s + v * beta[j], 0)));
  };

  return { coefficients: beta, fittedValues: mu, deviance, iterations, predict };
}
