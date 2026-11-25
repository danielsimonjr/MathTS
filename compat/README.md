# @danielsimonjr/mathts-compat

Mathjs compatibility shim for [MathTS](https://github.com/danielsimonjr/mathts).

A drop-in [mathjs](https://mathjs.org)-compatible API over MathTS — the quickest migration path for existing mathjs users.

## Install

MathTS packages are **ESM only** (`"type": "module"`). There is no `require` condition
in `package.json` `exports` and no CommonJS build. From a legacy CommonJS Node app, use
dynamic `import()` (for example `const { create, all } = await import('@danielsimonjr/mathts-compat');`)
or migrate the entry file to ESM.

```sh
npm install @danielsimonjr/mathts-compat
```

## Example

```ts node
import { create, all } from '@danielsimonjr/mathts-compat';

const math = create(all);
math.add(1, 2); // 3
math.evaluate('sin(pi/2)'); // 1
math.complex(2, 3); // 2 + 3i
```

## What it provides

- `create(all)` exposes `math.evaluate`, `math.chain`, `math.config`, and functions
  names such as `math.createUnit` (spread from `@danielsimonjr/mathts-functions`).
  It also exposes mathjs-compatible constructors, type predicates, constants, fraction
  numerator and denominator helpers, and import event subscriptions. `math.version`
  identifies the installed MathTS compatibility package.
  Each instance's `config` is isolated: `create(all, { number: 'BigNumber' })` does not
  change bare `evaluate` from `@danielsimonjr/mathts-functions`.
- `math.import`, `math.typed`, and `math.compile` (alias of `compileExpr`) match
  mathjs semantics on each `create(all)` instance, including `{ override, silent, wrap }`
  on `import`. Safe `evaluate` keeps G22 denylisted symbols out of expressions even when
  `import` overrides them on the instance.
- `math.matrix([[1, 2]])` returns a dense mathjs-style Matrix with `.size()` and `.toArray()`.
  Passing an existing native MathTS matrix through `math.matrix` preserves its class when
  no storage conversion is requested.
- `math.add`, `math.subtract`, and `math.multiply` preserve boxed Matrix results.
  Matrix literals and numeric-dimension `math.zeros` follow the instance's `matrix`
  setting. `math.size` returns a plain array of dimensions, as in mathjs 15.
- Compatibility BigNumbers use exponential notation at decimal exponents of −7 and below or 21 and above. For example, `String(bignumber('1e21'))` returns `'1e+21'`. Use `toFixed()` for the full decimal expansion.
- Unit readings use mathjs’s floating-point conversion order. For example, both
  `unit(0.75, 'inch')` and `evaluate('0.75 inch')` print `0.7499999999999999 inch`.
- Named imports such as `unit` and `createUnit` share the default unit registry. Each
  `create(all)` instance keeps its own registry. Use `math.config` to configure that instance.
- Delegates to `@danielsimonjr/mathts-core` types + `@danielsimonjr/mathts-functions`
  operations. See the
  [compat API index](https://github.com/danielsimonjr/MathTS/blob/main/docs/api/compat.md)
  for the full export list.
- With default `predictable: false` (mathjs parity), real-scalar `asin`/`acos`/`log`/`pow`
  and related helpers promote out-of-domain values to `Complex` instead of `NaN`.
  `create(all, { predictable: true })` keeps real-only `Math.*` behaviour.

## License

MIT (c) Daniel Simon Jr.
