# Feature Lifecycle Workflow

How a feature travels from idea to shipped code in MathTS. This is the process
contract; the artifacts it produces are `ROADMAP.md` (future/why), `TODO.md`
(active queue + completed log), the per-package `CHANGELOG.md` files (released
changes), and the auto-memory (cross-session context).

## Pipeline

```
IDEA  ──►  brainstorm (lightweight)  ──►  DGT placement/gap probe  ──►  ROADMAP entry
                                                                            │  promote (Definition of Ready)
                                                                            ▼
ROADMAP item  ──►  brainstorm → SPEC  ──►  writing-plans → PLAN  ──►  TODO (active)
                                                                            │
                                                                            ▼
                                              dev-workflow / subagent-driven (DGT = merge gate)
                                                                            │
                              ┌─────────────────────────────────────────────┤
                              ▼ done                                         ▼ gap / defer found
                  check off TODO + ROADMAP "Recently Shipped"       new ROADMAP candidate
```

## Stages

1. **Idea → ROADMAP (lightweight).** A raw idea gets a _short_ brainstorm — just
   enough to state what it is and why. Run the **DGT placement/gap probe** (below)
   to fix a rough home and confirm it doesn't create a cycle. Land it as a
   one-line ROADMAP entry (candidate or near-term). **Do not spec it yet** — most
   ROADMAP ideas won't be built next, and a stale spec is worse than none (YAGNI).

2. **ROADMAP → TODO (promotion).** When an item is actually next, it must pass the
   **Definition of Ready** (below). Only then does the full
   `superpowers:brainstorming → SPEC` and `superpowers:writing-plans → PLAN`
   happen, and the item enters `TODO.md` as active work.

3. **TODO → shipped (execution).** Run the plan through `dev-workflow` /
   `superpowers:subagent-driven-development`. DGT is the **merge gate** on every
   task (0 cycles / 0 new dormant).

4. **Close the loop (bidirectional).** Execution feeds back:
   - **Done** → check the item off in `TODO.md` _and_ roll it into ROADMAP
     "Recently Shipped"; add per-package `CHANGELOG` entries; publish.
   - **Deferred / abandoned** → move to ROADMAP "Explicitly out of scope
     (non-decisions)" with the rationale.
   - **New gap found mid-work** → add a ROADMAP candidate; don't lose it.

## The two roles of DGT

`npm run docs:deps` serves two distinct purposes — keep them straight:

- **Placement / gap probe** (brainstorm time): which package should this live in?
  Does the intended edge create a cycle? Is there dormant or existing code that
  already does this? This is what surfaced, e.g., that `workbook → plot` already
  exists (so `latexToPdf` belongs in plot, reused by workbook, zero new edges).
- **Merge gate** (per task in dev-workflow): the change keeps **0 cycles and 0 new
  dormant** files.

**Discipline:** regenerate the committed graph **canonically** — never with
`--all` (that writes the dormant-included variant and pollutes the committed
artifact). Commit the regenerated `docs/Architecture/*` with the change.

## Definition of Ready (ROADMAP → TODO gate)

An item may be promoted to the active TODO queue only when **all** hold:

- [ ] **Placement is DGT-validated** — a concrete target package, no cycle.
- [ ] **Rough size** is known (S / M / L) and it fits one spec/plan cycle
      (an epic is split into features first — see below).
- [ ] **No blocking dependency** — prerequisites are shipped or scheduled first.
- [ ] **It is actually next** — priority is deliberate, not incidental.

If it can't pass, it stays a ROADMAP entry. This gate is what keeps half-baked
work out of the dev pipeline.

## Single source of truth (per fact, per stage)

Status drift is the failure mode this workflow exists to prevent. Each fact lives
in exactly one primary place at each stage:

| Concern                           | Home                       |
| --------------------------------- | -------------------------- |
| Future plan / why                 | `ROADMAP.md`               |
| Active queue + completed-work log | `TODO.md`                  |
| Released package changes          | per-package `CHANGELOG.md` |
| Cross-session context / decisions | auto-memory (`…/memory/`)  |

## Anti-bloat rules

- `ROADMAP.md` "Recently Shipped" is a **short rolling window** (~last 3), pruned
  periodically; full history lives in CHANGELOGs. (TODO.md bloated to 2,000+ lines
  by doing both jobs — don't repeat that in ROADMAP.)
- `ROADMAP.md` is **forward-only**. Completed detail belongs in TODO/CHANGELOG.

## Epics → features

One ROADMAP item often decomposes into several TODO features, each its own
spec → plan → dev-workflow cycle (e.g. the export-formats epic = expression +
plot + workbook). `superpowers:brainstorming` already flags multi-subsystem specs
for decomposition; honor it — don't let an epic masquerade as a single task.

## Consistency gate — `docs:roadmap-check`

`npm run docs:roadmap-check` is an advisory companion to `docs:deps` that catches
the staleness this workflow is designed to prevent:

- **Shipped-claim check** — every `<pkg>@<version>` under ROADMAP "Recently
  Shipped" is verified against the live npm registry; flags a claim whose
  published version is behind (said shipped, isn't).
- **Stale-TODO check** — every backticked file path in an unchecked `- [ ]` TODO
  item that already exists on disk is flagged "verify it isn't already done".

Advisory by default (exit 0); `--strict` exits 1 on any issue (for CI). It decides
nothing — it just turns the manual reconciliation into a repeatable check. Run it
when reconciling ROADMAP/TODO or before a release. Extractor unit tests:
`npm run docs:roadmap-check:test`.
