# math-correctness-audit

External-oracle differential test for MathTS numerical functions. Closes
`TODO.md` Open Action #5. Full write-up:
[`MATH_CORRECTNESS_AUDIT_2026-06-29.md`](../../MATH_CORRECTNESS_AUDIT_2026-06-29.md).

**Idea:** the internal vitest suite is self-referential — it checks that
"what we computed" matches "what we hand-authored as expected", so a shared
misunderstanding passes green on both sides. This harness compares MathTS
against an **independent** oracle (mpmath dps=50 / scipy.special / numpy)
whose implementation lineage is completely separate. Relative error vs. that
oracle is the signal the internal suite can't see.

The two lineages never meet: `eval.mjs` (Node) never sees an oracle value;
`audit.py` (Python) never sees a MathTS value. They communicate only through
JSON files of inputs and results.

## Layout

- `audit.py` — single source of oracle truth. A registry of `reg(name, pkg,
  kind, sampler, oracle)` entries (one per function). Two modes:
  - `gen` → `inputs.json` (args for Node) + `oracle.json` (id → oracle value)
  - `report` → `report.md` (mean/max rel.err per function; FLAGs > 1e-6)
- `eval.mjs` — reads `inputs.json`, calls MathTS from each package's built
  `dist/`, writes `outputs.json`. Dumb evaluator; no oracle logic.

## Run

```bash
python audit.py gen
node eval.mjs
python audit.py report
```

Prereqs: `pip install mpmath scipy numpy`, and a built repo
(`npm run build` so `functions/dist` and `matrix/dist` exist). The repo path
in `eval.mjs` is hardcoded to `C:/Users/danie/Github/Mathts` — change it if
running elsewhere.

## Extend

Add one `reg(...)` line per new function (sampler + oracle). If the function
is already exported from `functions` or `matrix`, the Node side needs no
change. `kind` is one of `real` | `complex` | `real_array` |
`complex_array` | `sorted_real` (the last compares order-insensitively, for
eigenvalue/singular-value spectra).

> Generated artifacts (`inputs.json`, `oracle.json`, `outputs.json`,
> `report.md`) are reproducible from the seed and are not committed.
