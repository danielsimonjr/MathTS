/**
 * Adaptive Gauss-Kronrod (G7-K15) quadrature.
 *
 * QUADPACK-style adaptive numerical integration: on each subinterval, a
 * 15-point Kronrod estimate `K` is compared against the embedded 7-point
 * Gauss estimate `G` (both reuse the same 15 evaluation points, so `G` is
 * "free" once `K` is computed). `|K - G|` is the panel's error estimate; if
 * it exceeds tolerance the interval is bisected and each half is refined
 * recursively. This adapts naturally to endpoint singularities and peaked
 * integrands, unlike a fixed-order Gauss-Legendre rule (see `gaussLegendre5`
 * in `../typed/numeric.ts`, whose Richardson-extrapolation adaptivity still
 * converges slowly on e.g. `x^-1/2` near 0).
 *
 * @packageDocumentation
 */

type f64 = number;
type i32 = number;

/** Options for {@link quad}. */
export interface QuadOptions {
  /** Relative tolerance on each panel's `|K - G|` vs `|K|` (default 1e-10). */
  tol?: f64;
  /** Maximum bisection recursion depth per panel (default 50). */
  maxDepth?: i32;
}

/** Result of {@link quad}. */
export interface QuadResult {
  /** The estimated integral. */
  value: f64;
  /** Sum of the absolute per-panel `|K - G|` error estimates. */
  error: f64;
}

// Standard QUADPACK 15-point Gauss-Kronrod abscissae (positive half only —
// the rule is symmetric about 0 on [-1, 1]) and their Kronrod weights, plus
// the weights of the embedded 7-point Gauss rule at the (shared) points
// where it is defined. Source: QUADPACK `dqk15.f` (Piessens et al. 1983),
// the reference implementation of this exact rule.
const XGK: readonly f64[] = [
  0.991455371120813, 0.949107912342759, 0.864864423359769, 0.741531185599394, 0.586087235467691,
  0.405845151377397, 0.207784955007898, 0.0,
];
const WGK: readonly f64[] = [
  0.022935322010529, 0.063092092629979, 0.10479001032225, 0.140653259715525, 0.169004726639267,
  0.190350578064785, 0.204432940075298, 0.209482141084728,
];
// 7-point Gauss weights, indexed by |XGK| position for the odd-indexed
// (Gauss) nodes XGK[1], XGK[3], XGK[5], and the center XGK[7] = 0.
const WG: readonly f64[] = [0.12948496616887, 0.27970539148928, 0.38183005050512, 0.41795918367347];

// Expand to the full symmetric 15-node/15-weight arrays once, at module
// load, rather than per call.
const KRONROD_NODES: f64[] = [];
const KRONROD_WEIGHTS: f64[] = [];
const GAUSS_WEIGHTS: f64[] = [];

for (let i = 0; i < 7; i++) {
  KRONROD_NODES.push(-XGK[i]);
  KRONROD_WEIGHTS.push(WGK[i]);
  GAUSS_WEIGHTS.push(0);
}
KRONROD_NODES.push(0);
KRONROD_WEIGHTS.push(WGK[7]);
GAUSS_WEIGHTS.push(0);
for (let i = 6; i >= 0; i--) {
  KRONROD_NODES.push(XGK[i]);
  KRONROD_WEIGHTS.push(WGK[i]);
  GAUSS_WEIGHTS.push(0);
}
// Gauss-rule nodes sit at Kronrod indices 1, 3, 5, 7(center), 9, 11, 13
// (0-indexed into the 15-element array), with weights WG[0..3] mirrored.
GAUSS_WEIGHTS[1] = WG[0];
GAUSS_WEIGHTS[3] = WG[1];
GAUSS_WEIGHTS[5] = WG[2];
GAUSS_WEIGHTS[7] = WG[3];
GAUSS_WEIGHTS[9] = WG[2];
GAUSS_WEIGHTS[11] = WG[1];
GAUSS_WEIGHTS[13] = WG[0];

/** A single panel's Kronrod value, embedded Gauss value, and |K - G|. */
function gaussKronrod15(f: (x: f64) => f64, a: f64, b: f64): { k: f64; g: f64 } {
  const halfWidth = (b - a) / 2;
  const mid = (a + b) / 2;
  let k = 0;
  let g = 0;
  for (let i = 0; i < 15; i++) {
    const fx = f(halfWidth * KRONROD_NODES[i] + mid);
    k += KRONROD_WEIGHTS[i] * fx;
    g += GAUSS_WEIGHTS[i] * fx;
  }
  return { k: halfWidth * k, g: halfWidth * g };
}

const ABS_FLOOR = 1e-14;

/**
 * Adaptive Gauss-Kronrod (G7-K15) numerical integration of `f` over `[a, b]`.
 *
 * Each subinterval is evaluated with the 15-point Kronrod rule and its
 * embedded 7-point Gauss rule; `|K - G|` is the panel's error estimate. A
 * panel whose error exceeds `tol * |K|` (or the absolute floor, for panels
 * near zero) is bisected and each half refined recursively, up to
 * `maxDepth`. This adapts naturally to endpoint singularities and sharply
 * peaked integrands.
 *
 * @param f - Function to integrate
 * @param a - Lower bound
 * @param b - Upper bound
 * @param opts - Options (tol, maxDepth)
 * @returns `{ value, error }` — the estimated integral and summed panel error
 *
 * @example
 * ```typescript
 * quad((x) => 4 / (1 + x * x), 0, 1).value; // ~pi
 * quad((x) => 1 / Math.sqrt(x), 0, 1).value; // ~2, despite the endpoint singularity
 * ```
 */
export function quad(f: (x: f64) => f64, a: f64, b: f64, opts?: QuadOptions): QuadResult {
  const tol = opts?.tol ?? 1e-10;
  const maxDepth = opts?.maxDepth ?? 50;

  function panel(a: f64, b: f64, depth: i32): QuadResult {
    const { k, g } = gaussKronrod15(f, a, b);
    const panelError = Math.abs(k - g);

    if (depth >= maxDepth || panelError <= Math.max(tol * Math.abs(k), ABS_FLOOR)) {
      return { value: k, error: panelError };
    }

    const mid = (a + b) / 2;
    const left = panel(a, mid, depth + 1);
    const right = panel(mid, b, depth + 1);
    return { value: left.value + right.value, error: left.error + right.error };
  }

  return panel(a, b, 0);
}
