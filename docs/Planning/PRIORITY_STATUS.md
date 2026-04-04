# MathTS Priority Status

**Updated**: 2026-04-04
**Build**: 10/10 | **Typecheck**: 14/14 | **Tests**: 69 files, 1,953 pass
**Factories**: 242/273 active (89%) — remaining 31 are infrastructure types in @mathts/core
**Sprint Completion**: 165/166 (99.4%) — only v1.0.0 release remains

---

## Sprint Completion

| Phase | Sprints | Done | Status |
|-------|---------|------|--------|
| 1: Core Foundation | 1-4 | 28/28 | **COMPLETE** |
| 2: WASM Acceleration | 5-8 | 26/26 | **COMPLETE** |
| 3: Parallel Execution | 9-12 | 26/26 | **COMPLETE** |
| 4: WebGPU Acceleration | 13-16 | 25/25 | **COMPLETE** |
| 5: Function Library | 17-24 | 43/43 | **COMPLETE** |
| 6: Integration & Polish | 25-28 | 17/18 | v1.0.0 release remains |
| **Total** | 1-28 | **165/166** | **99.4%** |

## Remaining

### Only task left: v1.0.0 Release (Sprint 6.28)
- [ ] Run `npm run release` (changeset version + build)
- [ ] Run `changeset publish` (requires 2FA — user must do manually)
- [ ] Tag and push release

All prerequisites are done:
- npm publishing setup: COMPLETE
- Bundle optimization: COMPLETE (57% reduction, 662 KB total)
- Performance regression tests: COMPLETE (23 benchmarks)
- All packages build, typecheck, and test

---

## Feature Plans (Future)

| Plan | Status | Depends On |
|------|--------|-----------|
| Workbook ↔ expression integration | Deferred | Independent |
| Rust WASM migration | 75 .rs files exist | Independent |
| Scientific calculator (Electron) | Not started | Factory activation (done) |
| ISE Workbench (3-zone layout) | Not started (0/16) | Expression evaluator (done) |
| Deno notebook | Not started | Workbook + Expression |
| typed-function improvements | Partial | Independent |
| workerpool improvements | Partial | Independent |
