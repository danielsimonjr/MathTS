# @danielsimonjr/mathts-compat

Mathjs compatibility shim for [MathTS](https://github.com/danielsimonjr/mathts).

A drop-in [mathjs](https://mathjs.org)-compatible API over MathTS — the quickest migration path for existing mathjs users.

## Install

```sh
npm install @danielsimonjr/mathts-compat
```

## Example

```ts
import { create, all } from '@danielsimonjr/mathts-compat';

const math = create(all);
math.add(1, 2); // 3
math.evaluate('sin(pi/2)'); // 1
math.complex(2, 3); // 2 + 3i
```

## What it provides

- `create(all)` exposes `math.evaluate`, `math.chain`, `math.config`, and functions
  names such as `math.createUnit` (spread from `@danielsimonjr/mathts-functions`).
  Each instance's `config` is isolated: `create(all, { number: 'BigNumber' })` does not
  change bare `evaluate` from `@danielsimonjr/mathts-functions`.
- `math.import`, `math.typed`, and `math.compile` (alias of `compileExpr`) match
  mathjs semantics on each `create(all)` instance, including `{ override, silent, wrap }`
  on `import`. Safe `evaluate` keeps G22 denylisted symbols out of expressions even when
  `import` overrides them on the instance.
- Direct named imports (`add`, `matrix`, …) come from `compat/src/shims.ts`. There is
  no package-level named `import` / `createUnit` / `config` export (use the instance).
- Delegates to `@danielsimonjr/mathts-core` types + `@danielsimonjr/mathts-functions`
  operations. See `docs/api/compat.md` for the full export index.
- With default `predictable: false` (mathjs parity), real-scalar `asin`/`acos`/`log`/`pow`
  and related helpers promote out-of-domain values to `Complex` instead of `NaN`.
  `create(all, { predictable: true })` keeps real-only `Math.*` behaviour.

## License

MIT (c) Daniel Simon Jr.
