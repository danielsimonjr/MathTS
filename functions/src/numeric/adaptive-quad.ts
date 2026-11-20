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
  /**
   * Absolute floor on a panel's `|K - G|` below which it is accepted whatever
   * `tol · |K|` is (default 1e-14). An integrand whose integral is itself below
   * the floor (an SI-scaled quantity) needs a smaller floor, or 0.
   */
  atol?: f64;
  /** Maximum bisection recursion depth per panel (default 50). */
  maxDepth?: i32;
  /**
   * Number of Gauss-Kronrod panels after which no panel is bisected (default 100000).
   * A panel evaluated after that point counts as unresolved when its error is above the
   * limit. The panels that wait on the recursion stack are still evaluated once each, so
   * the integrand is called at most 15 times `maxPanels + maxDepth` times in total.
   * A value that is not a positive integer or `Infinity` throws a RangeError.
   * Without this limit, an oscillating integrand such as `sin(1/x)` on `[0, 1]` bisects
   * every panel near 0 down to `maxDepth`.
   */
  maxPanels?: i32;
}

/** Result of {@link quad}. */
export interface QuadResult {
  /** The estimated integral. */
  value: f64;
  /** Sum of the absolute per-panel `|K - G|` error estimates. */
  error: f64;
  /**
   * `true` when the value and error are finite and the error of panels that
   * stopped only at `maxDepth` is negligible (below `1e-6` of the summed
   * `|K|`, or the absolute floor). `false` for a divergent or non-finite
   * integral. {@link quad} never throws for convergence; it reports it here.
   * `tanhSinh` uses its own rule: the change between two levels is within `tol`.
   */
  converged: boolean;
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
/** Default for {@link QuadOptions.maxPanels}. */
const DEFAULT_MAX_PANELS = 100000;
/** Unresolved error allowed, relative to the sum of the panels' `|K|`. Not scaled by the caller's `tol`. */
const CONVERGENCE_RTOL = 1e-6;

/**
 * Throw a RangeError when a bound is NaN or infinite. The quadrature rules here
 * sample finite panels only, so a caller must map an infinite range first.
 * @internal
 */
export function checkFiniteLimits(a: number, b: number, name: string): void {
  if (a !== a || b !== b) throw new RangeError(`${name}: a limit is NaN`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new RangeError(`${name}: infinite limits are not supported`);
  }
}

/**
 * Adaptive Gauss-Kronrod (G7-K15) numerical integration of `f` over `[a, b]`.
 *
 * Each subinterval is evaluated with the 15-point Kronrod rule and its
 * embedded 7-point Gauss rule; `|K - G|` is the panel's error estimate. A
 * panel whose error exceeds `tol * |K|` (or the absolute floor, for panels
 * near zero) is bisected and each half refined recursively, up to
 * `maxDepth`, and until `maxPanels` panels are evaluated in total. This adapts
 * naturally to endpoint singularities and sharply peaked integrands.
 *
 * @param f - Function to integrate
 * @param a - Lower bound
 * @param b - Upper bound
 * @param opts - Options (tol, atol, maxDepth, maxPanels)
 * @returns `{ value, error, converged }` — the estimated integral, summed panel error and convergence flag
 *
 * @example
 * ```typescript
 * quad((x) => 4 / (1 + x * x), 0, 1).value; // ~pi
 * quad((x) => 1 / Math.sqrt(x), 0, 1).value; // ~2, despite the endpoint singularity
 * ```
 */
export function quad(f: (x: f64) => f64, a: f64, b: f64, opts?: QuadOptions): QuadResult {
  const { value, error, converged } = quadDetail('quad', f, a, b, opts);
  return { value, error, converged };
}

interface QuadDetail extends QuadResult {
  unresolved: f64;
  limit: f64;
}

function quadDetail(
  name: string,
  f: (x: f64) => f64,
  a: f64,
  b: f64,
  opts?: QuadOptions
): QuadDetail {
  checkFiniteLimits(a, b, name);
  const tol = opts?.tol ?? 1e-10;
  const atol = opts?.atol ?? ABS_FLOOR;
  const maxDepth = opts?.maxDepth ?? 50;
  const maxPanels = opts?.maxPanels ?? DEFAULT_MAX_PANELS;
  if (!(maxPanels === Infinity || (Number.isInteger(maxPanels) && maxPanels >= 1))) {
    throw new RangeError(
      `${name}: maxPanels must be a positive integer or Infinity, got ${maxPanels}`
    );
  }

  let absSum = 0;
  let unresolved = 0;
  let panels = 0;

  function panel(a: f64, b: f64, depth: i32): { value: f64; error: f64 } {
    const { k, g } = gaussKronrod15(f, a, b);
    panels++;
    const panelError = Math.abs(k - g);
    // A NaN error never meets the tolerance, so stop here and do not bisect to maxDepth.
    if (panelError !== panelError) return { value: NaN, error: NaN };

    const limit = Math.max(tol * Math.abs(k), atol);
    if (depth >= maxDepth || panels >= maxPanels || panelError <= limit) {
      absSum += Math.abs(k);
      if (panelError > limit) unresolved += panelError;
      return { value: k, error: panelError };
    }

    const mid = (a + b) / 2;
    const left = panel(a, mid, depth + 1);
    const right = panel(mid, b, depth + 1);
    return { value: left.value + right.value, error: left.error + right.error };
  }

  const r = panel(a, b, 0);
  const convergenceLimit = Math.max(CONVERGENCE_RTOL * absSum, atol);
  const converged =
    Number.isFinite(r.value) && Number.isFinite(r.error) && unresolved <= convergenceLimit;
  return { value: r.value, error: r.error, converged, unresolved, limit: convergenceLimit };
}

/**
 * Integrate with {@link quad} and return the value, or throw a RangeError when
 * the result is not finite or the integral did not converge.
 * @internal
 */
export function quadValue(
  name: string,
  f: (x: f64) => f64,
  a: f64,
  b: f64,
  opts?: QuadOptions
): f64 {
  const r = quadDetail(name, f, a, b, opts);
  if (!Number.isFinite(r.value) || !Number.isFinite(r.error)) {
    throw new RangeError(
      `${name}: the result is not finite (value ${r.value}, error estimate ${r.error})`
    );
  }
  if (!r.converged) {
    throw new RangeError(
      `${name}: the integral did not converge: unresolved error ${r.unresolved} is above the limit ${r.limit} (value ${r.value}, error estimate ${r.error}); raise maxDepth or maxPanels if the integral is convergent, or call quad for the unconverged estimate`
    );
  }
  return r.value;
}
