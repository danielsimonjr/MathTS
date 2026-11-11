# @danielsimonjr/mathts-compat

Mathjs compatibility shim for [MathTS](https://github.com/danielsimonjr/mathts).

A drop-in [mathjs](https://mathjs.org)-compatible API over MathTS — the quickest migration path for existing mathjs users.

## Install

```sh
npm install @danielsimonjr/mathts-compat
```

## What it provides

- `create(all)` exposes `math.evaluate`, `math.chain`, `math.config`, and functions
  names such as `math.createUnit` (spread from `@danielsimonjr/mathts-functions`).
  Each instance's `config` is isolated: `create(all, { number: 'BigNumber' })` does not
  change bare `evaluate` from `@danielsimonjr/mathts-functions`.
- Direct named imports (`add`, `matrix`, …) come from `compat/src/shims.ts`. There is
  no `math.import` and no named `import` / `createUnit` / `config` export from this
  package.
- Delegates to `@danielsimonjr/mathts-core` types + `@danielsimonjr/mathts-functions`
  operations. See `docs/api/compat.md` for the full export index.
- With default `predictable: false` (mathjs parity), real-scalar `asin`/`acos`/`log`/`pow`
  and related helpers promote out-of-domain values to `Complex` instead of `NaN`.
  `create(all, { predictable: true })` keeps real-only `Math.*` behaviour.

## License

MIT (c) Daniel Simon Jr.
