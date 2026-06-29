"""External-oracle math-correctness audit for MathTS.

Two implementation lineages kept strictly separate:
  - oracle: mpmath (dps=50) / scipy / numpy, computed here in Python
  - subject: MathTS, computed in eval.mjs (Node), never touches an oracle

Flow:
  python audit.py gen      -> inputs.json (args for Node)  +  oracle.json (id -> oracle value)
  node eval.mjs            -> outputs.json (MathTS results)
  python audit.py report   -> report.md (mean/max relative error per function)

Conventions pinned empirically against MathTS before trusting comparisons:
  - std / variance: POPULATION (ddof=0)
  - gammainc(a,x)   = lower regularized P(a,x)
  - gammaincp(a,x)  = upper regularized Q(a,x)
  - besselJ(n,x)    = order-first
  - ellipticK/E(m)  = m-parameter convention (scipy.special.ellipk(m))
  - mad             = unscaled median abs deviation
  - quantileSeq     = numpy linear interpolation
"""

import json
import math
import sys
import os

import numpy as np
import mpmath as mp
from scipy import special as sp
from scipy import stats as st

mp.mp.dps = 50
HERE = os.path.dirname(os.path.abspath(__file__))

# ----------------------------------------------------------------------------
# Serialization helpers (shared shape with Node side)
# ----------------------------------------------------------------------------

def ser(v):
    """Serialize an oracle value to the same JSON shape Node produces."""
    if isinstance(v, complex):
        return {"re": v.real, "im": v.imag}
    if isinstance(v, (list, tuple, np.ndarray)):
        return [ser(x) for x in v]
    if isinstance(v, (mp.mpf,)):
        return float(v)
    if isinstance(v, (mp.mpc,)):
        return {"re": float(v.real), "im": float(v.imag)}
    return float(v)


def f(x):
    """mpmath/np scalar -> python float."""
    return float(x)

# ----------------------------------------------------------------------------
# Registry. Each entry: name, pkg, kind, sample(rng)->list[args], oracle(args)->value
#   kind: 'real' | 'complex' | 'real_array' | 'complex_array' | 'sorted_real'
# ----------------------------------------------------------------------------

REG = []

def reg(name, pkg, kind, sample, oracle, note=""):
    REG.append(dict(name=name, pkg=pkg, kind=kind, sample=sample, oracle=oracle, note=note))

U = lambda rng, a, b, n: [float(x) for x in rng.uniform(a, b, n)]

# ---- Special functions (mpmath dps=50 oracle) ----
reg("gamma", "functions", "real",
    lambda r: [[x] for x in U(r, 0.1, 8.0, 40)],
    lambda a: f(mp.gamma(a[0])))
reg("lgamma", "functions", "real",
    lambda r: [[x] for x in U(r, 0.1, 20.0, 40)],
    lambda a: f(mp.re(mp.loggamma(a[0]))))
reg("digamma", "functions", "real",
    lambda r: [[x] for x in U(r, 0.1, 15.0, 40)],
    lambda a: f(mp.digamma(a[0])))
reg("erf", "functions", "real",
    lambda r: [[x] for x in U(r, -3.0, 3.0, 40)],
    lambda a: f(mp.erf(a[0])))
reg("erfc", "functions", "real",
    lambda r: [[x] for x in U(r, -3.0, 3.0, 40)],
    lambda a: f(mp.erfc(a[0])))
reg("erfi", "functions", "real",
    lambda r: [[x] for x in U(r, -2.0, 2.0, 40)],
    lambda a: f(mp.erfi(a[0])))
reg("beta", "functions", "real",
    lambda r: [[x, y] for x, y in zip(U(r, 0.5, 6.0, 40), U(r, 0.5, 6.0, 40))],
    lambda a: f(mp.beta(a[0], a[1])))
reg("besselJ", "functions", "real",
    lambda r: [[int(n), x] for n, x in zip(r.integers(0, 4, 40), U(r, 0.5, 12.0, 40))],
    lambda a: f(mp.besselj(a[0], a[1])))
reg("besselY", "functions", "real",
    lambda r: [[int(n), x] for n, x in zip(r.integers(0, 4, 40), U(r, 0.5, 12.0, 40))],
    lambda a: f(mp.bessely(a[0], a[1])))
reg("besselI", "functions", "real",
    lambda r: [[int(n), x] for n, x in zip(r.integers(0, 4, 40), U(r, 0.5, 8.0, 40))],
    lambda a: f(mp.besseli(a[0], a[1])))
reg("besselK", "functions", "real",
    lambda r: [[int(n), x] for n, x in zip(r.integers(0, 4, 40), U(r, 0.5, 8.0, 40))],
    lambda a: f(mp.besselk(a[0], a[1])))
reg("airyAi", "functions", "real",
    lambda r: [[x] for x in U(r, -4.0, 3.0, 40)],
    lambda a: f(mp.airyai(a[0])))
reg("airyBi", "functions", "real",
    lambda r: [[x] for x in U(r, -4.0, 3.0, 40)],
    lambda a: f(mp.airybi(a[0])))
reg("zeta", "functions", "real",
    lambda r: [[x] for x in U(r, 1.5, 12.0, 40)],
    lambda a: f(mp.zeta(a[0])))
reg("ellipticK", "functions", "real",
    lambda r: [[x] for x in U(r, 0.0, 0.95, 40)],
    lambda a: f(mp.ellipk(a[0])))
reg("ellipticE", "functions", "real",
    lambda r: [[x] for x in U(r, 0.0, 0.95, 40)],
    lambda a: f(mp.ellipe(a[0])))
reg("expIntegralEi", "functions", "real",
    lambda r: [[x] for x in U(r, 0.2, 4.0, 40)],
    lambda a: f(mp.ei(a[0])))
reg("gammainc", "functions", "real",  # lower regularized P(a,x)
    lambda r: [[s, x] for s, x in zip(U(r, 0.5, 6.0, 40), U(r, 0.1, 10.0, 40))],
    lambda a: f(mp.gammainc(a[0], 0, a[1], regularized=True)))
reg("gammaincp", "functions", "real",  # upper regularized Q(a,x)
    lambda r: [[s, x] for s, x in zip(U(r, 0.5, 6.0, 40), U(r, 0.1, 10.0, 40))],
    lambda a: f(mp.gammainc(a[0], a[1], mp.inf, regularized=True)))

# ---- Elementary, precision-sensitive ----
def tiny_and_normal(r, n):
    half = n // 2
    tiny = [float(x) for x in r.uniform(-1e-6, 1e-6, half)]
    normal = U(r, -0.5, 0.5, n - half)
    return tiny + normal

reg("expm1", "functions", "real",
    lambda r: [[x] for x in tiny_and_normal(r, 40)],
    lambda a: f(mp.expm1(a[0])))
reg("log1p", "functions", "real",
    lambda r: [[x] for x in tiny_and_normal(r, 40)],
    lambda a: f(mp.log1p(a[0])))
reg("cbrt", "functions", "real",  # REAL branch (np.cbrt); mpmath.cbrt is principal complex root
    lambda r: [[x] for x in U(r, -100.0, 100.0, 40)],
    lambda a: f(np.cbrt(a[0])))
reg("hypot", "functions", "real",
    lambda r: [[x, y] for x, y in zip(U(r, -50.0, 50.0, 40), U(r, -50.0, 50.0, 40))],
    lambda a: f(mp.hypot(a[0], a[1])))
reg("atan2", "functions", "real",
    lambda r: [[y, x] for y, x in zip(U(r, -10.0, 10.0, 40), U(r, -10.0, 10.0, 40))],
    lambda a: f(mp.atan2(a[0], a[1])))

# ---- Combinatorics (exact integer oracles) ----
reg("factorial", "functions", "real",
    lambda r: [[int(n)] for n in r.integers(0, 20, 30)],
    lambda a: f(mp.factorial(a[0])))
reg("combinations", "functions", "real",
    lambda r: [[int(n), int(r.integers(0, n + 1))] for n in r.integers(1, 26, 30)],
    lambda a: f(math.comb(int(a[0]), int(a[1]))))
reg("permutations", "functions", "real",
    lambda r: [[int(n), int(r.integers(0, n + 1))] for n in r.integers(1, 20, 30)],
    lambda a: f(math.perm(int(a[0]), int(a[1]))))
reg("gcd", "functions", "real",
    lambda r: [[int(a), int(b)] for a, b in zip(r.integers(1, 100000, 30), r.integers(1, 100000, 30))],
    lambda a: f(math.gcd(int(a[0]), int(a[1]))))
reg("lcm", "functions", "real",
    lambda r: [[int(a), int(b)] for a, b in zip(r.integers(1, 10000, 30), r.integers(1, 10000, 30))],
    lambda a: f(math.lcm(int(a[0]), int(a[1]))))

# ---- Statistics (array input; population convention) ----
def rand_arr(r, lo=15, hi=50, scale=10.0):
    n = int(r.integers(lo, hi))
    return [float(x) for x in r.normal(0, scale, n)]

reg("mean", "functions", "real",
    lambda r: [[rand_arr(r)] for _ in range(30)],
    lambda a: f(np.mean(a[0])))
reg("std", "functions", "real",  # population ddof=0
    lambda r: [[rand_arr(r)] for _ in range(30)],
    lambda a: f(np.std(a[0], ddof=0)))
reg("variance", "functions", "real",  # population ddof=0
    lambda r: [[rand_arr(r)] for _ in range(30)],
    lambda a: f(np.var(a[0], ddof=0)))
reg("median", "functions", "real",
    lambda r: [[rand_arr(r)] for _ in range(30)],
    lambda a: f(np.median(a[0])))
reg("quantileSeq", "functions", "real",
    lambda r: [[rand_arr(r), float(round(r.uniform(0.05, 0.95), 3))] for _ in range(30)],
    lambda a: f(np.quantile(a[0], a[1], method="linear")))
reg("mad", "functions", "real",
    lambda r: [[rand_arr(r)] for _ in range(30)],
    lambda a: f(st.median_abs_deviation(a[0], scale=1.0)))

def corr_pair(r):
    n = int(r.integers(20, 50))
    x = r.normal(0, 5, n)
    y = 0.7 * x + r.normal(0, 3, n)
    return [[float(v) for v in x], [float(v) for v in y]]

reg("corr", "functions", "real",
    lambda r: [corr_pair(r) for _ in range(30)],
    lambda a: f(np.corrcoef(a[0], a[1])[0, 1]))

# ---- Signal: FFT (complex array) ----
def fft_input(r):
    n = int(r.choice([8, 16, 32]))
    return [[float(x) for x in r.normal(0, 5, n)]]

reg("fft", "functions", "complex_array",
    lambda r: [fft_input(r) for _ in range(20)],
    lambda a: [complex(z) for z in np.fft.fft(np.array(a[0]))])

# ---- Linear algebra (matrix package) ----
def rand_matrix(r, n):
    return [[float(x) for x in row] for row in r.uniform(-5, 5, (n, n))]

def rand_spd(r, n):
    A = r.uniform(-3, 3, (n, n))
    M = A @ A.T + n * np.eye(n)
    return [[float(x) for x in row] for row in M]

def rand_vec(r):
    n = int(r.integers(3, 8))
    return [float(x) for x in r.uniform(-10, 10, n)]

reg("det", "functions", "real",
    lambda r: [[rand_matrix(r, int(r.integers(2, 6)))] for _ in range(20)],
    lambda a: f(np.linalg.det(np.array(a[0]))))
reg("norm", "functions", "real",  # vector 2-norm
    lambda r: [[rand_vec(r), 2] for _ in range(20)],
    lambda a: f(np.linalg.norm(np.array(a[0]), 2)))
reg("singularValues", "matrix", "sorted_real",
    lambda r: [[rand_matrix(r, int(r.integers(2, 6)))] for _ in range(20)],
    lambda a: sorted([float(x) for x in np.linalg.svd(np.array(a[0]), compute_uv=False)], reverse=True))
reg("eigvals", "matrix", "sorted_real",  # symmetric -> real eigenvalues
    lambda r: [[rand_spd(r, int(r.integers(2, 6)))] for _ in range(20)],
    lambda a: sorted([float(x) for x in np.linalg.eigvalsh(np.array(a[0]))], reverse=True))

# ----------------------------------------------------------------------------
# Modes
# ----------------------------------------------------------------------------

def cmd_gen():
    rng = np.random.default_rng(20260629)
    cases = []
    oracle = {}
    cid = 0
    for spec in REG:
        for args in spec["sample"](rng):
            cases.append(dict(id=cid, fn=spec["name"], pkg=spec["pkg"], kind=spec["kind"], args=args))
            try:
                ov = spec["oracle"](args)
                oracle[str(cid)] = ser(ov)
            except Exception as e:  # oracle failure is itself notable
                oracle[str(cid)] = {"oracle_error": str(e)}
            cid += 1
    with open(os.path.join(HERE, "inputs.json"), "w") as fh:
        json.dump({"cases": cases}, fh)
    with open(os.path.join(HERE, "oracle.json"), "w") as fh:
        json.dump(oracle, fh)
    print(f"gen: {len(cases)} cases across {len(REG)} functions")


def as_complex(v):
    if isinstance(v, dict) and "re" in v:
        return complex(v["re"], v["im"])
    return complex(float(v), 0.0)


def relerr_scalar(got, exp):
    g, e = as_complex(got), as_complex(exp)
    d = abs(g - e)
    denom = abs(e)
    return d / denom if denom > 1e-300 else d  # absolute fallback near zero


def relerr_array(got, exp):
    if not isinstance(got, list) or len(got) != len(exp):
        return float("inf")
    return max((relerr_scalar(g, e) for g, e in zip(got, exp)), default=0.0)


def cmd_report():
    with open(os.path.join(HERE, "oracle.json")) as fh:
        oracle = json.load(fh)
    with open(os.path.join(HERE, "outputs.json")) as fh:
        outputs = json.load(fh)["results"]
    with open(os.path.join(HERE, "inputs.json")) as fh:
        cases = {str(c["id"]): c for c in json.load(fh)["cases"]}

    by_fn = {}
    for res in outputs:
        cid = str(res["id"])
        c = cases[cid]
        fn = c["fn"]
        rec = by_fn.setdefault(fn, dict(kind=c["kind"], errs=[], fails=[]))
        ov = oracle.get(cid)
        if isinstance(ov, dict) and "oracle_error" in ov:
            rec["fails"].append((cid, "oracle_error: " + ov["oracle_error"], c["args"]))
            continue
        if res.get("error"):
            rec["fails"].append((cid, "mathts_error: " + res["error"], c["args"]))
            continue
        got = res["value"]
        if c["kind"] in ("real", "complex"):
            e = relerr_scalar(got, ov)
        elif c["kind"] == "sorted_real":
            # order-insensitive: spectrum/SV sets are unordered; sort both descending
            got_sorted = sorted((as_complex(x).real for x in got), reverse=True) if isinstance(got, list) else got
            e = relerr_array(got_sorted, ov)
        else:
            e = relerr_array(got, ov)
        rec["errs"].append((e, cid, c["args"], got, ov))

    THRESH = 1e-6
    lines = []
    lines.append("| function | n | mean rel.err | max rel.err | worst input | status |")
    lines.append("|---|---|---|---|---|---|")
    flagged = []
    for spec in REG:
        fn = spec["name"]
        rec = by_fn.get(fn)
        if not rec:
            continue
        errs = [x[0] for x in rec["errs"]]
        nfail = len(rec["fails"])
        if errs:
            mean_e = sum(errs) / len(errs)
            worst = max(rec["errs"], key=lambda x: x[0])
            max_e = worst[0]
            worst_input = json.dumps(worst[2])[:48]
        else:
            mean_e = max_e = float("nan")
            worst_input = "-"
        status = "OK"
        if nfail:
            status = f"{nfail} ERR"
        if errs and max_e > THRESH:
            status = "**FLAG**"
            flagged.append((fn, worst))
        lines.append(f"| {fn} | {len(errs)} | {mean_e:.2e} | {max_e:.2e} | `{worst_input}` | {status} |")

    out = ["# MathTS external-oracle audit\n",
           f"Oracle: mpmath dps=50 / scipy {sp.__name__} / numpy. Threshold for FLAG: rel.err > {THRESH:g}.\n",
           "\n".join(lines), ""]
    if flagged:
        out.append("\n## Flagged details\n")
        for fn, worst in flagged:
            e, cid, args, got, ov = worst
            out.append(f"### {fn}  (rel.err {e:.3e})")
            out.append(f"- input: `{json.dumps(args)}`")
            out.append(f"- MathTS: `{json.dumps(got)[:200]}`")
            out.append(f"- oracle: `{json.dumps(ov)[:200]}`\n")
    else:
        out.append("\n**All functions within threshold. No discrepancies.**\n")

    # error cases (non-numeric failures)
    errcases = [(fn, rec["fails"]) for fn, rec in by_fn.items() if rec["fails"]]
    if errcases:
        out.append("\n## Error cases\n")
        for fn, fails in errcases:
            for cid, msg, args in fails[:3]:
                out.append(f"- `{fn}` id={cid} {msg} args=`{json.dumps(args)[:60]}`")

    report = "\n".join(out)
    with open(os.path.join(HERE, "report.md"), "w") as fh:
        fh.write(report)
    print(report)


if __name__ == "__main__":
    {"gen": cmd_gen, "report": cmd_report}[sys.argv[1]]()
