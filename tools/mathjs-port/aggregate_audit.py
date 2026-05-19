"""
aggregate_audit.py — combine per-category audit JSON files into a single report,
strip JSON fences if present, and compute summary statistics.
"""
import json
import re
from pathlib import Path

AUDITS = Path(__file__).parent / "audits"
OUT = Path(__file__).parent / "audit_summary.md"


def strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```\s*$", "", text)
    return text.strip()


def load_audit(path: Path) -> list[dict]:
    raw = path.read_text(encoding="utf-8")
    cleaned = strip_fences(raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        print(f"[aggregate] WARNING: {path.name} failed JSON parse: {e}")
        # Try array-only extraction
        m = re.search(r"\[\s*\{.*\}\s*\]", cleaned, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return []
        return []


def main():
    rows: list[dict] = []
    by_cat: dict[str, list[dict]] = {}
    for f in sorted(AUDITS.glob("*.json")):
        cat = f.stem
        items = load_audit(f)
        for it in items:
            it["category"] = cat
            rows.append(it)
        by_cat[cat] = items

    total = len(rows)
    found = sum(1 for r in rows if r.get("found_in_mathts"))
    sig_match = sum(1 for r in rows if r.get("signature_match") == "match")
    alg_match = sum(1 for r in rows if r.get("algorithm_match") == "match")
    sig_div = [r for r in rows if r.get("signature_match") == "diverged"]
    alg_div = [r for r in rows if r.get("algorithm_match") == "diverged"]
    unknown = [r for r in rows if "unknown" in (r.get("signature_match"), r.get("algorithm_match"))]
    not_found = [r for r in rows if not r.get("found_in_mathts")]

    lines = [
        "# MathTS ↔ mathjs parity audit",
        "",
        f"**Functions audited:** {total}",
        f"**Found in MathTS active layer:** {found} / {total} ({100*found/max(total,1):.0f}%)",
        f"**Signature match:** {sig_match} / {total}",
        f"**Algorithm match:** {alg_match} / {total}",
        f"**Signature diverged:** {len(sig_div)}",
        f"**Algorithm diverged:** {len(alg_div)}",
        f"**Unknown (couldn't determine):** {len(unknown)}",
        f"**Not found in MathTS:** {len(not_found)}",
        "",
        "## By category",
        "",
        "| Category | n | found | sig-match | alg-match | sig-div | alg-div | unknown | not-found |",
        "|----------|---|-------|-----------|-----------|---------|---------|---------|-----------|",
    ]
    for cat, items in by_cat.items():
        n = len(items)
        f = sum(1 for r in items if r.get("found_in_mathts"))
        sm = sum(1 for r in items if r.get("signature_match") == "match")
        am = sum(1 for r in items if r.get("algorithm_match") == "match")
        sd = sum(1 for r in items if r.get("signature_match") == "diverged")
        ad = sum(1 for r in items if r.get("algorithm_match") == "diverged")
        u = sum(1 for r in items if "unknown" in (r.get("signature_match"), r.get("algorithm_match")))
        nf = sum(1 for r in items if not r.get("found_in_mathts"))
        lines.append(f"| {cat} | {n} | {f} | {sm} | {am} | {sd} | {ad} | {u} | {nf} |")

    if sig_div or alg_div:
        lines += ["", "## Divergences (signature or algorithm)", ""]
        for r in sig_div + alg_div:
            if r in sig_div and r in alg_div:
                tag = "SIG+ALG"
            elif r in sig_div:
                tag = "SIG"
            else:
                tag = "ALG"
            lines.append(f"- **{r['category']}/{r.get('name','?')}** [{tag}]: {r.get('notes','(no note)')}")

    if not_found:
        lines += ["", "## Not found in MathTS active layer", ""]
        for r in not_found:
            lines.append(f"- **{r['category']}/{r.get('name','?')}**: {r.get('notes','(no note)')}")

    if unknown:
        lines += ["", "## Unknown / couldn't determine", ""]
        for r in unknown:
            lines.append(f"- **{r['category']}/{r.get('name','?')}**: {r.get('notes','(no note)')}")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"[aggregate] Wrote {OUT}")
    print(f"[aggregate] Total: {total} | found {found} | sig-div {len(sig_div)} | alg-div {len(alg_div)} | unknown {len(unknown)} | not-found {len(not_found)}")


if __name__ == "__main__":
    main()
