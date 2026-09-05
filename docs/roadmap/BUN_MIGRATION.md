# Bun Migration Roadmap

> Status: **Phase 1 landed** (2026-09-05). The monorepo package manager and
> TypeScript script runner are Bun. Published packages still target Node ≥20
> (and browsers); Bun is a _dev/CI_ cutover, not a consumer-runtime requirement.

## Why Bun

- Native TypeScript execution (`bun tools/….ts`) replaces `npx tsx`.
- Fast workspace installs (`bun install` ~100ms warm / sub-second cold here).
- One toolchain for install + script running; Turbo/tsup/vitest keep working.
- Dependabot supports the text `bun.lock` (`package-ecosystem: bun`).

## Non-goals (this phase)

- Replacing **vitest** with `bun test` (26 configs + Playwright browser suite).
- Replacing **tsup** with Bun's bundler (`.d.ts` emission + multi-entry workers).
- Requiring Bun at **consume** time — npm packages stay Node/browser compatible.
- Forcing `[run].bun = true` (that aliases `node` → `bun` and breaks shebangs we still need).

## Phase checklist

### Phase 1 — Package manager + TS runner (DONE)

- [x] `packageManager: "bun@1.4.2"` + committed text `bun.lock`
- [x] `bunfig.toml` (hoisted linker; Node shebangs preserved)
- [x] Root scripts: `npx tsx` → `bun`; `npm run -w` → `bun run --filter`
- [x] `js-yaml` at root so `tools/create-dependency-graph` resolves under Bun
- [x] CI / Release / Dependabot on Bun
- [x] `package-lock.json` retired (gitignored)
- [x] Verified locally: `bun run build` (24/24), `typecheck` (32/32), `test` (48/48), `build:wasm`

### Phase 2 — Tooling depth (next)

- [ ] Migrate remaining nested `npm run` / `node` script strings in package
      `package.json` files where Bun is a drop-in (leave `asc` / Playwright alone)
- [ ] Add a Bun-runtime smoke job (`bun --bun` on a small unit subset) without
      flipping `[run].bun`
- [ ] Document contributor install as Bun-first in onboarding templates
- [ ] Evaluate moving `tools/*` into workspaces so tool deps are not root-only

### Phase 3 — Test runner (later, measured)

- [ ] Pilot `bun test` on one leaf package (e.g. `units` / `numbers`)
- [ ] Keep vitest for browser / GPU / coverage until parity is proven
- [ ] Only then consider dropping `@vitest/*` from packages that fully migrated

### Phase 4 — Bundler (optional, high risk)

- [ ] Prototype Bun build for a thin re-export package (no `.d.ts` complexity)
- [ ] Compare emitted ESM + declaration story vs tsup; do not cut over matrix /
      functions / workbook until dts + worker-entry parity is green

## Developer commands

```bash
# Install Bun (once): https://bun.sh
curl -fsSL https://bun.sh/install | bash

bun install                 # frozen by bun.lock
bun run build
bun run test
bun run typecheck
bun run build:wasm
bun run docs:deps           # runs the CDG TypeScript entry via Bun
```

Node ≥20 is still required on PATH for vitest, AssemblyScript (`asc`), and a
handful of `node …` scripts. Consumers of published `@danielsimonjr/mathts-*`
packages do **not** need Bun.

## Known Bun-specific notes

1. **Git dependency integrity.** npm's `package-lock.json` stores integrity
   hashes for a different git-tarball shape than Bun/GitHub serve, so a naive
   lockfile migration yields `IntegrityCheckFailed` on cold CI installs (seen
   on `@danielsimonjr/workerpool`). The committed `bun.lock` pins the hash of
   the GitHub `legacy.tar.gz` for that commit — use
   `bun install --frozen-lockfile`, never re-migrate from npm's lockfile.
2. **`bun test` ≠ `bun run test`.** The former is Bun's built-in runner; the
   latter runs the Turbo/vitest graph. CI must call `bun run test`.
3. **Publish path unchanged.** `npx changeset publish` / `npm publish` from the
   release machine still ships to the npm registry.
