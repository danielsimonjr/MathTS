// MathTS evaluator for the external-oracle audit.
// Reads inputs.json, calls MathTS, writes outputs.json. Never touches an oracle.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = "C:/Users/danie/Github/Mathts";
const url = (p) => pathToFileURL(resolve(REPO, ...p)).href;

const fns = await import(url(["functions", "dist", "index.js"]));
const mat = await import(url(["matrix", "dist", "index.js"]));
const core = await import(url(["core", "dist", "index.js"]));
const libOf = (pkg) => (pkg === "matrix" ? mat : fns);

// Convert audit args to runtime values: a {re,im} object becomes a Complex.
const toArg = (a) =>
  a && typeof a === "object" && !Array.isArray(a) && "re" in a && "im" in a
    ? new core.Complex(a.re, a.im)
    : a;

// Serialize a MathTS result into the JSON shape the oracle uses.
function ser(v, kind) {
  if (v == null) return v;
  if (typeof v === "number") return v;
  if (typeof v === "object" && ("re" in v) && ("im" in v)) return { re: v.re, im: v.im };
  if (typeof v?.toArray === "function") v = v.toArray();
  if (Array.isArray(v)) {
    const out = v.map((x) => ser(x, kind));
    // flatten one level for plain real arrays (e.g. row-major matrices)
    if ((kind === "real_array") && out.every(Array.isArray)) return out.flat();
    return out;
  }
  if (typeof v === "bigint") return Number(v);
  return v;
}

const { cases } = JSON.parse(readFileSync(resolve(HERE, "inputs.json"), "utf8"));
const results = [];
for (const c of cases) {
  const lib = libOf(c.pkg);
  const fnName = c.call ?? c.fn; // `call` lets a complex variant reuse the real export
  const fn = lib[fnName];
  if (typeof fn !== "function") {
    results.push({ id: c.id, value: null, error: `not a function in ${c.pkg}` });
    continue;
  }
  try {
    let out;
    if (c.method) {
      // Distribution object call: dist(ctorArgs).method(methodArgs).
      const arity = c.ctorArity ?? 0;
      const obj = fn(...c.args.slice(0, arity).map(toArg));
      out = obj[c.method](...c.args.slice(arity).map(toArg));
    } else {
      out = fn(...c.args.map(toArg));
    }
    results.push({ id: c.id, value: ser(out, c.kind), error: null });
  } catch (e) {
    results.push({ id: c.id, value: null, error: String(e?.message ?? e) });
  }
}
writeFileSync(resolve(HERE, "outputs.json"), JSON.stringify({ results }));
console.log(`eval: ${results.length} results, ${results.filter((r) => r.error).length} errors`);
