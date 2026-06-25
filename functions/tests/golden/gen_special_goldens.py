#!/usr/bin/env python3
"""High-precision (mpmath, 30-digit) goldens for the @danielsimonjr/mathts-functions
special-function surface (functions/src/typed/special.ts).

Each record: {"name": <public export>, "args": [...], "expected": <float>}.
The JS differential test (diff-special.test.mjs) calls functions[name](...args)
and compares. Run:  python -X utf8 gen_special_goldens.py
"""
import json, os
import mpmath as mp

mp.mp.dps = 30
HERE = os.path.dirname(os.path.abspath(__file__))
F = lambda v: float(v)

records = []
def add(name, mpfn, points):
    for pt in points:
        records.append({"name": name, "args": [float(a) for a in pt],
                        "expected": F(mpfn(*[mp.mpf(a) for a in pt]))})

# ---- 1-arg ----
add("erfc", lambda x: mp.erfc(x), [[-1], [-0.3], [0], [0.5], [1], [2], [3]])
add("erfi", lambda x: mp.erfi(x), [[-1], [0], [0.5], [1], [2]])
add("lgamma", lambda x: mp.log(abs(mp.gamma(x))), [[0.25], [0.5], [1], [1.5], [2], [3.5], [5], [10]])
add("digamma", lambda x: mp.digamma(x), [[0.5], [1], [2], [3.5], [5], [10]])
add("ellipticK", lambda m: mp.ellipk(m), [[0], [0.1], [0.5], [0.9], [0.99]])
add("lambertW", lambda x: mp.lambertw(x), [[-0.3], [0], [0.5], [1], [2], [mp.e]])
add("sinIntegral", lambda x: mp.si(x), [[0.5], [1], [2], [5], [10]])
add("cosIntegral", lambda x: mp.ci(x), [[0.5], [1], [2], [5], [10]])
add("logIntegral", lambda x: mp.li(x), [[2], [5], [10], [100]])
add("expIntegralEi", lambda x: mp.ei(x), [[0.5], [1], [2], [5]])
add("fresnelC", lambda x: mp.fresnelc(x), [[0.5], [1], [2], [3]])
add("fresnelS", lambda x: mp.fresnels(x), [[0.5], [1], [2], [3]])
add("airyAi", lambda x: mp.airyai(x), [[-12], [-8], [-5], [-2], [0], [1], [2], [5], [8], [12]])
add("airyBi", lambda x: mp.airybi(x), [[-12], [-8], [-5], [-2], [0], [1], [2], [5], [8], [12]])
add("besselJ0", lambda x: mp.besselj(0, x), [[0], [0.5], [1], [2], [5], [8], [10], [15], [20]])
add("besselJ1", lambda x: mp.besselj(1, x), [[0], [0.5], [1], [2], [5], [8], [10], [15], [20]])
add("besselY0", lambda x: mp.bessely(0, x), [[0.5], [1], [2], [5], [8], [10], [15], [20]])
add("besselY1", lambda x: mp.bessely(1, x), [[0.5], [1], [2], [5], [8], [10], [15], [20]])

# ---- 2-arg ----
add("beta", lambda a, b: mp.beta(a, b), [[2, 3], [0.5, 0.5], [1, 5], [2.5, 1.5]])
add("gammainc", lambda a, x: mp.gammainc(a, 0, x, regularized=True), [[2, 1], [3, 5], [0.5, 1], [5, 3]])
add("gammaincp", lambda a, x: mp.gammainc(a, x, mp.inf, regularized=True), [[2, 1], [3, 5], [0.5, 1]])
add("besselJ", lambda n, x: mp.besselj(n, x), [[2, 1], [2, 5], [3, 1], [3, 10], [5, 1], [5, 5], [5, 15]])
add("besselY", lambda n, x: mp.bessely(n, x), [[2, 1], [2, 5], [3, 1], [3, 10], [5, 5]])
add("besselI", lambda n, x: mp.besseli(n, x), [[0, 1], [1, 2], [2, 3], [3, 1]])
add("besselK", lambda n, x: mp.besselk(n, x), [[0, 1], [1, 2], [2, 3], [3, 1]])
add("chebyshevT", lambda n, x: mp.chebyt(n, x), [[2, 0.5], [3, 0.3], [5, 0.7], [8, -0.4]])
add("hermiteH", lambda n, x: mp.hermite(n, x), [[2, 0.5], [3, 1], [5, 0.7]])
add("laguerreL", lambda n, x: mp.laguerre(n, 0, x), [[2, 1], [3, 0.5], [5, 2]])
add("legendreP", lambda n, x: mp.legendre(n, x), [[2, 0.5], [3, 0.3], [5, 0.7]])
add("carlsonRC", lambda x, y: mp.elliprc(x, y), [[1, 2], [0.5, 1], [2, 3]])
add("ellipticF", lambda phi, m: mp.ellipf(phi, m), [[0.3, 0.2], [0.7, 0.5], [1.2, 0.8]])
add("ellipticEIncomplete", lambda phi, m: mp.ellipe(phi, m), [[0.3, 0.2], [0.7, 0.5], [1.2, 0.8]])
add("ellipticE", lambda m: mp.ellipe(m), [[0], [0.1], [0.5], [0.9]])  # complete (1-arg)

# ---- 3-arg ----
add("betainc", lambda a, b, x: mp.betainc(a, b, 0, x, regularized=True), [[2, 3, 0.5], [0.5, 0.5, 0.3], [5, 2, 0.7]])
add("carlsonRF", lambda x, y, z: mp.elliprf(x, y, z), [[1, 2, 3], [0.5, 1, 2], [2, 3, 4]])
add("carlsonRD", lambda x, y, z: mp.elliprd(x, y, z), [[1, 2, 3], [0.5, 1, 2], [2, 3, 4]])
add("ellipticPi", lambda n, phi, m: mp.ellippi(n, phi, m), [[0.1, 0.5, 0.3], [0.3, 1.0, 0.6]])

# ---- 4-arg ----
add("carlsonRJ", lambda x, y, z, p: mp.elliprj(x, y, z, p), [[1, 2, 3, 4], [0.5, 1, 2, 3]])

out = {"target_rel": 1e-9, "hard_fail_rel": 1e-6, "records": records}
with open(os.path.join(HERE, "special.golden.json"), "w", encoding="utf-8") as fp:
    json.dump(out, fp, indent=2)
print(f"special.golden.json: {len(records)} cases across "
      f"{len(set(r['name'] for r in records))} functions")
