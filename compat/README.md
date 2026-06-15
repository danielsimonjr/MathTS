# @danielsimonjr/mathts-compat

Mathjs compatibility shim for [MathTS](https://github.com/danielsimonjr/mathts).

A drop-in [mathjs](https://mathjs.org)-compatible API over MathTS — the quickest migration path for existing mathjs users.

## Install

```sh
npm install @danielsimonjr/mathts-compat
```

## What it provides

- `create(all)` builds a math instance with the familiar mathjs surface.
- Delegates to `@danielsimonjr/mathts-core` types + `@danielsimonjr/mathts-functions` operations.
- Useful as a single dependency that pulls a working MathTS stack together.

## License

MIT (c) Daniel Simon Jr.
