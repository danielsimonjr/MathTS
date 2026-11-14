# Base-against-head benchmark (A/B)

`run.mjs` times the base tree and the head tree of each case in separate processes. It prints
the ratio head / base for each case and fails when a case is slower than the slow limit (1.02, or the value of `--slow-limit`). A `gain` case
must also reach 0.95, unless `--slow-only` is set. The CI job "Benchmark baseline" runs the
cases of `matmul`, `decomp` and `stats` on each pull request with `--slow-only`.

Commands:

- `node tools/benchmark/ab/make-base.mjs --ref <git-ref>` builds the base tree.
- `node tools/benchmark/ab/run.mjs --slow-only --engine node --only "<name part>" <case files>`
  runs the cases. `--only` may repeat.

## Results that change on purpose

Each run first checks that the base and the head give bit-equal results for a case. A
difference fails the case. A pull request that changes the results of a case on purpose lists
that case in `allowed-output-changes.json`:

```json
[
  {
    "case": "median n = 100,000",
    "pr": "#971",
    "reason": "the mean of the middle pair no longer overflows"
  }
]
```

Rules:

1. `case` is the exact case name. `pr` and `reason` are required.
2. The case still runs the time gate. Only the result comparison is skipped for it.
3. The table shows `no, allowed by <pr>` in the Equal column, so a reviewer sees the entry.
4. An entry for a case whose results are equal fails the run as stale. Remove the entry in the
   next pull request, after the base moves past the change.
5. There is no environment switch and no flag that skips the check.

## Slow limit of the CI gate

The CI step runs `--slow-only --slow-limit 1.25` on five cases: `median n = 100,000`,
`JSBackend multiply 128×128`, `qr 128×128`, `lup 128×128` and the two `lusolve 128×128` cases.

The limit comes from A/A control sessions (`make-base.mjs --control`, then
`run.mjs --control --engine node --runs 5`). In a control session the head tree is a second copy
of the base build, so every ratio above 1 is noise. Three sessions on a busy developer machine
gave these ratios, with the lowest and highest per-run ratio in brackets:

| Case                       | Session 1         | Session 2         | Session 3         |
| -------------------------- | ----------------- | ----------------- | ----------------- |
| median n = 100,000         | 1.040 [0.81-1.24] | 1.038 [0.75-1.58] | 0.936 [0.68-1.73] |
| sort n = 100,000           | 1.000 [0.70-1.54] | 1.239 [0.77-1.85] | 0.991 [0.74-1.22] |
| JSBackend multiply 128×128 | 0.972 [0.89-1.08] | 1.042 [0.85-1.35] | 0.977 [0.79-1.38] |
| qr 128×128                 | 0.927 [0.71-1.47] | 0.967 [0.75-1.08] | 1.036 [0.93-1.29] |
| lup 128×128                | 0.971 [0.82-1.15] | 1.004 [0.80-1.10] | 0.890 [0.74-1.09] |
| lusolve 128×128            | 1.001 [0.77-1.57] | 0.986 [0.55-1.25] | 1.099 [0.88-1.31] |
| lusolve 128×128 after lup  | 1.076 [0.78-1.30] | 0.812 [0.38-1.19] | 0.990 [0.84-1.04] |

- The A/A ratio of the gated cases reaches 1.099 at most. The limit 1.02 would fail equal code.
  A first run of `qr 128×128` read 1.059 on equal code.
- `sort n = 100,000` reached 1.239, within 1% of the limit, so it is not gated. A limit that
  noise can reach is not a gate.
- The limit 1.25 leaves 14% above the highest A/A ratio of a gated case. It catches a slowdown
  of 1.25 or more. A smaller regression passes. With a 2x slowdown injected into `median`, the
  step measured 1.92 and failed.
- The ratio of one run reached 1.7 on this machine. A runner that is quieter lets the limit
  move down: repeat the control sessions on the runner, then lower the value.
