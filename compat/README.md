# @danielsimonjr/mathts-compat

Mathjs compatibility shim for [MathTS](https://github.com/danielsimonjr/mathts).

A drop-in [mathjs](https://mathjs.org)-compatible API over MathTS — the quickest migration path for existing mathjs users.

## Install

```sh
npm install @danielsimonjr/mathts-compat
```

## What it provides

- `create(all)` builds a math instance with the familiar mathjs surface (`math.evaluate`,
  `math.chain`, matrices, units, …).
- `config` / `import` / `createUnit` shims and direct named imports (`add`, `matrix`, …)
  mirror mathjs entry points over `@danielsimonjr/mathts-functions`.
- Delegates to `@danielsimonjr/mathts-core` types + `@danielsimonjr/mathts-functions`
  operations. See `docs/api/compat.md` for the full export index.

## License

MIT (c) Daniel Simon Jr.
