# @danielsimonjr/mathts

One install for [MathTS](https://github.com/danielsimonjr/mathts), the TypeScript
port of mathjs. This package re-exports the entry points
[Universal-Physics-Tensor](https://github.com/danielsimonjr/Universal-Physics-Tensor)
calls. It does not copy their implementations.

ESM-only (`"type": "module"`). No CommonJS build: the packages it depends on
are ESM-only, so `require()` is not supported. Use `import`.

| Runtime | Supported                                                   |
| ------- | ----------------------------------------------------------- |
| Node.js | `>= 20` (18 is not tested; the toolchain uses Node 20 APIs) |
| Bun     | `>= 1.4.2`                                                  |

## Install

```sh
npm install @danielsimonjr/mathts
```

That also installs `@danielsimonjr/mathts-functions`, `@danielsimonjr/mathts-tensor`,
and `@danielsimonjr/mathts-autograd` (and their dependencies). You do not need Bun.

## Usage

```ts
import { evaluate, parse, simplify } from '@danielsimonjr/mathts';

evaluate('1 + 2 * 3'); // 7
evaluate('a*b^2 + 1', { a: 3, b: 4 }); // 49
parse('sqrt(4)').evaluate({}); // 2

simplify(parse('(g0)*((g1)/(g0))')).toString(); // 'g1'
```

Tree-shakeable subpaths (Node loads only the entry you import):

```ts
import { parse, simplify } from '@danielsimonjr/mathts/functions';
import { Tensor } from '@danielsimonjr/mathts/tensor';
import { forwardGrad, reverseGrad, TapedTensor } from '@danielsimonjr/mathts/autograd';

Tensor.fromNested([1, 2, 3], [3]);
```

`@danielsimonjr/mathts/functions` re-exports the whole
`@danielsimonjr/mathts-functions` module. `/tensor` and `/autograd` do the same
for those packages. The root entry exports only `parse`, `evaluate`, and
`simplify`.

The focused packages remain published on their own
(`@danielsimonjr/mathts-core`, `@danielsimonjr/mathts-functions`, …). Install
those directly when you want a smaller dependency tree.

## Language differences a builtin parser will not match

These are mathjs-compatible on purpose. A smaller parser that leaves `e` free
and rejects factorial, `erf`, `gamma()`, and juxtaposition is a different
language, not a bug in this package.

| Expression | This package                                   |
| ---------- | ---------------------------------------------- |
| `e`        | Euler's number (`Math.E`), not a free variable |
| `5!`       | `120`                                          |
| `erf(0)`   | `0`                                            |
| `gamma(5)` | `24`                                           |
| `2pi`      | `2 * π` (juxtaposition)                        |
| `ln(1)`    | `0`                                            |

## License

MIT (c) Daniel Simon Jr.
