# Reports

Archived independent reviews and gap analyses of MathTS. These documents
record a review as it stood on the date in the filename. They are not live
roadmaps; later fixes may have closed some of the gaps they list. Implementation
plans that already live elsewhere in `docs/` are linked, not copied.

Each report starts with a short archive header: the date it was produced, the
MathTS commit it was run against, and the related issue or tracker links.
Findings inside a report are unchanged from the original, except that local
working-copy paths have been rewritten to repo-relative links and a
[Sources of truth](#sources-of-truth) note has been added where it applies.

## Sources of truth

MathTS cannot run Mathematica, Mathcad, or MATLAB to check results. For
correctness of numeric and symbolic output, the sources of truth are
**NumPy**, **SciPy**, **SymPy**, and **PySR**.

Mathematica, Mathcad, and MATLAB are **feature references only**. They
inform API shape and feature-coverage decisions. They are never used to
verify numeric or symbolic output.

Where a report treats a closed system's documented or observed behavior as
expected output — including GNU Octave stand-in values used in place of
MATLAB — that expectation is **unverified** until it is confirmed against
NumPy, SciPy, SymPy, or PySR.

mathjs is a separate case: `mathts-compat` matches mathjs 15.3.0, including
quirks, and the mathjs parity report uses mathjs 15.3.0 as its reference. That
does not change the sources of truth for native MathTS correctness.

## Index

| Date       | Title                                                                               | Scope                                                                                                                                                                                                                                              | Related issues                                                                                                                                                                                                                                                                                                                  | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-25 | [mathjs 15.3.0 parity gap analysis](2026-11-25-mathjs-parity-gap-analysis.md)       | Name-level and runtime comparison of MathTS with mathjs 15.3.0, at MathTS `76f7a5b7`.                                                                                                                                                              | Issues [#1549](https://github.com/danielsimonjr/MathTS/issues/1549)–[#1589](https://github.com/danielsimonjr/MathTS/issues/1589); tracker [#1590](https://github.com/danielsimonjr/MathTS/issues/1590). Plan: [docs/superpowers/plans/2026-11-25-mathjs-parity-plan.md](../superpowers/plans/2026-11-25-mathjs-parity-plan.md). | [appendix](2026-11-25-mathjs-parity/appendix.md), [parity.csv](2026-11-25-mathjs-parity/data/parity.csv), [totals.txt](2026-11-25-mathjs-parity/data/totals.txt), [filed.json](2026-11-25-mathjs-parity/data/filed.json)                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-11-25 | [Six-system parity review (pass 1)](2026-11-25-six-system-parity-review.md)         | Feature-coverage review of MathTS against NumPy 2.5.5, SciPy 1.18.1, PySR 2.7.3, Mathematica (Wolfram Language guides), Mathcad Prime 11, and MATLAB (MathWorks reference lists), at MathTS `76f7a5b7`.                                            | Issues [#1592](https://github.com/danielsimonjr/MathTS/issues/1592)–[#1713](https://github.com/danielsimonjr/MathTS/issues/1713); tracker [#1714](https://github.com/danielsimonjr/MathTS/issues/1714).                                                                                                                         | [pass1-gaps.csv](2026-11-25-six-system-parity/data/pass1-gaps.csv), [pass1-coverage.csv](2026-11-25-six-system-parity/data/pass1-coverage.csv), [ref_name_match.csv](2026-11-25-six-system-parity/data/ref_name_match.csv)                                                                                                                                                                                                                                                                                                                                                                |
| 2026-11-25 | [Six-system deep reviews and merged report](2026-11-25-six-system-parity/merged.md) | Deep per-reference inventories and mappings, plus the merged gap list and the 122 filed issues, at MathTS `e09eb301`. Closed-source systems (Mathematica, Mathcad, MATLAB) are feature references only; see [Sources of truth](#sources-of-truth). | Same tracker [#1714](https://github.com/danielsimonjr/MathTS/issues/1714).                                                                                                                                                                                                                                                      | [numpy](2026-11-25-six-system-parity/numpy.md), [scipy](2026-11-25-six-system-parity/scipy.md), [pysr](2026-11-25-six-system-parity/pysr.md), [mathematica](2026-11-25-six-system-parity/mathematica.md), [mathcad](2026-11-25-six-system-parity/mathcad.md), [matlab](2026-11-25-six-system-parity/matlab.md), [merged-gaps.csv](2026-11-25-six-system-parity/data/merged-gaps.csv), [bugs.csv](2026-11-25-six-system-parity/data/bugs.csv), [filed.json](2026-11-25-six-system-parity/data/filed.json), plus `data/<ref>-inventory.csv` and `data/<ref>-mapping.csv` for each reference |

## Layout

```text
docs/reports/
  README.md
  2026-11-25-mathjs-parity-gap-analysis.md
  2026-11-25-mathjs-parity/
    appendix.md
    data/parity.csv
    data/totals.txt
    data/filed.json
  2026-11-25-six-system-parity-review.md
  2026-11-25-six-system-parity/
    merged.md
    numpy.md
    scipy.md
    pysr.md
    mathematica.md
    mathcad.md
    matlab.md
    data/
      pass1-gaps.csv
      pass1-coverage.csv
      ref_name_match.csv
      merged-gaps.csv
      bugs.csv
      filed.json
      <ref>-inventory.csv
      <ref>-mapping.csv
```

## What this archive does not include

Working-copy scripts, scratch inventories, fetched reference HTML, pip and
build logs, runtime harnesses, vendored MathTS clones, virtualenvs, and issue
body drafts were left out. Those supported the reviews; they are not the
deliverables.

Other box files that were considered and not imported:

- A UPT/PhysJS dogfood group report, which is not a MathTS report.
- Dogfood persona prompts and scripts. The finished persona-session write-ups
  already live in [`docs/persona-sessions/`](../persona-sessions/).
- Ad-hoc reproduction scripts and a temporary MathTS checkout used for
  classification work.
