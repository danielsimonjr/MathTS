#!/usr/bin/env python3
"""Generate high-precision golden values for the mathts-wasm P0 audit.

- special.golden.json:  mpmath (30-digit) reference values for the 18
  hand-rolled special functions (Bessel, Airy, elliptic, Carlson, lgamma).
- decomposition.golden.json:  numpy reference det/inverse + the input
  matrices for the 5 dense decompositions. (LU/QR/Cholesky are verified by
  reconstruction in the JS runner since those factorizations are not unique.)

Run:  python -X utf8 generate_goldens.py
Regenerates both JSON fixtures in this directory. Deterministic — no RNG.

Conventions verified against assembly/src/special.ts:
  elliptic uses PARAMETER m = k**2 (matches mpmath ellipk(m)/ellipe(m));
  incomplete F/E take (phi, m); Pi takes (n, phi, m); Carlson are the
  standard DLMF symmetric forms RC/RF/RD/RJ.
"""
import json, os
import mpmath as mp
import numpy as np

mp.mp.dps = 30
HERE = os.path.dirname(os.path.abspath(__file__))


def f(x):
    """mpmath value -> plain float64."""
    return float(x)


# ---------------------------------------------------------------------------
# Special functions. Each entry: function -> {kind, cases}.
# kind tells the JS runner how to marshal the call:
#   vec1      fn([x]) -> [out]            case = [x, expected]
#   int_vec1  fn(n, [x]) -> [out]         case = [n, x, expected]
#   vec2      fn([a],[b]) -> [out]        case = [a, b, expected]
#   vec3      fn([a],[b],[c]) -> [out]    case = [a, b, c, expected]
#   vec4      fn([a],[b],[c],[d]) -> [out]case = [a, b, c, d, expected]
# ---------------------------------------------------------------------------
def special_goldens():
    out = {}

    xs_pos = [0.5, 1.0, 2.0, 3.0, 5.0, 10.0, 20.0]
    out["bessel_j0_f64"] = {"kind": "vec1",
        "cases": [[x, f(mp.besselj(0, x))] for x in [0.0] + xs_pos]}
    out["bessel_j1_f64"] = {"kind": "vec1",
        "cases": [[x, f(mp.besselj(1, x))] for x in [0.0] + xs_pos]}
    out["bessel_y0_f64"] = {"kind": "vec1",
        "cases": [[x, f(mp.bessely(0, x))] for x in xs_pos]}
    out["bessel_y1_f64"] = {"kind": "vec1",
        "cases": [[x, f(mp.bessely(1, x))] for x in xs_pos]}
    out["bessel_jn_f64"] = {"kind": "int_vec1",
        "cases": [[n, x, f(mp.besselj(n, x))]
                  for n in [2, 3, 5] for x in [1.0, 5.0, 10.0]]}
    out["bessel_yn_f64"] = {"kind": "int_vec1",
        "cases": [[n, x, f(mp.bessely(n, x))]
                  for n in [2, 3, 5] for x in [1.0, 5.0, 10.0]]}

    airy_xs = [-5.0, -2.0, -1.0, 0.0, 1.0, 2.0, 5.0]
    out["airy_ai_f64"] = {"kind": "vec1",
        "cases": [[x, f(mp.airyai(x))] for x in airy_xs]}
    out["airy_bi_f64"] = {"kind": "vec1",
        "cases": [[x, f(mp.airybi(x))] for x in airy_xs]}

    ms = [0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99]
    out["elliptic_k_f64"] = {"kind": "vec1",
        "cases": [[m, f(mp.ellipk(m))] for m in ms]}
    out["elliptic_e_f64"] = {"kind": "vec1",
        "cases": [[m, f(mp.ellipe(m))] for m in ms]}

    lg_xs = [0.25, 0.5, 1.0, 1.5, 2.0, 3.5, 5.0, 10.0]
    out["lgamma_f64"] = {"kind": "vec1",
        "cases": [[x, f(mp.log(abs(mp.gamma(x))))] for x in lg_xs]}

    out["carlson_rc_f64"] = {"kind": "vec2",
        "cases": [[x, y, f(mp.elliprc(x, y))]
                  for (x, y) in [(1, 2), (0.5, 1.0), (2.0, 3.0), (1.0, 0.5)]]}
    out["carlson_rf_f64"] = {"kind": "vec3",
        "cases": [[x, y, z, f(mp.elliprf(x, y, z))]
                  for (x, y, z) in [(1, 2, 3), (0.5, 1, 2), (1, 1, 1), (2, 3, 4)]]}
    out["carlson_rd_f64"] = {"kind": "vec3",
        "cases": [[x, y, z, f(mp.elliprd(x, y, z))]
                  for (x, y, z) in [(1, 2, 3), (0.5, 1, 2), (1, 1, 1), (2, 3, 4)]]}
    out["carlson_rj_f64"] = {"kind": "vec4",
        "cases": [[x, y, z, p, f(mp.elliprj(x, y, z, p))]
                  for (x, y, z, p) in [(1, 2, 3, 4), (0.5, 1, 2, 3), (1, 1, 1, 1)]]}

    fe = [(0.3, 0.2), (0.7, 0.5), (1.2, 0.8), (1.5, 0.3)]
    out["elliptic_f_incomplete_f64"] = {"kind": "vec2",
        "cases": [[phi, m, f(mp.ellipf(phi, m))] for (phi, m) in fe]}
    out["elliptic_e_incomplete_f64"] = {"kind": "vec2",
        "cases": [[phi, m, f(mp.ellipe(phi, m))] for (phi, m) in fe]}
    # Pi(n; phi | m) with q = 1 - n sin^2(phi) > 0 enforced by small n.
    pin = [(0.1, 0.5, 0.3), (0.3, 1.0, 0.6), (0.2, 0.7, 0.4)]
    out["elliptic_pi_incomplete_f64"] = {"kind": "vec3",
        "cases": [[n, phi, m, f(mp.ellippi(n, phi, m))] for (n, phi, m) in pin]}

    return out


# ---------------------------------------------------------------------------
# Decomposition oracle: numpy det + inverse, plus the matrices themselves.
# checks: which verifications apply to each matrix.
# ---------------------------------------------------------------------------
def decomposition_goldens():
    mats = []

    def add(name, A, checks):
        A = np.array(A, dtype=float)
        n, m = A.shape
        entry = {"name": name, "rows": n, "cols": m,
                 "A": A.flatten().tolist(), "checks": checks}
        if "det" in checks:
            entry["det"] = float(np.linalg.det(A))
        if "inverse" in checks:
            entry["inverse"] = np.linalg.inv(A).flatten().tolist()
        mats.append(entry)

    # General square (det, inverse, LU, QR). Diagonally dominant -> LU needs
    # no pivot, so reconstruction P*A == L*U with P = identity is exercised,
    # plus a non-dominant one that forces a pivot.
    add("square2", [[4, 1], [1, 3]], ["det", "inverse", "lu", "qr"])
    add("square3", [[6, 2, 1], [2, 5, 2], [1, 2, 4]], ["det", "inverse", "lu", "qr"])
    add("pivot3",  [[0, 2, 1], [2, 1, 1], [1, 1, 3]], ["det", "inverse", "lu"])
    add("square4", [[10, 2, 1, 0], [2, 9, 1, 1], [1, 1, 8, 2], [0, 1, 2, 7]],
        ["det", "inverse", "lu"])

    # SPD (Cholesky). Also square -> det/inverse/lu valid.
    add("spd2", [[4, 2], [2, 3]], ["chol", "det", "inverse"])
    add("spd3", [[25, 15, -5], [15, 18, 0], [-5, 0, 11]], ["chol", "det", "inverse"])

    # Tall (QR only; m > n).
    add("tall32", [[1, 2], [3, 4], [5, 6]], ["qr"])

    return {"matrices": mats}


def main():
    special = {"target_rel": 1e-9, "hard_fail_rel": 1e-6, "functions": special_goldens()}
    decomp = {"target_abs": 1e-9, "hard_fail_abs": 1e-6, **decomposition_goldens()}

    with open(os.path.join(HERE, "special.golden.json"), "w", encoding="utf-8") as fp:
        json.dump(special, fp, indent=2)
    with open(os.path.join(HERE, "decomposition.golden.json"), "w", encoding="utf-8") as fp:
        json.dump(decomp, fp, indent=2)

    ncases = sum(len(v["cases"]) for v in special["functions"].values())
    print(f"special.golden.json: {len(special['functions'])} functions, {ncases} cases")
    print(f"decomposition.golden.json: {len(decomp['matrices'])} matrices")


if __name__ == "__main__":
    main()
