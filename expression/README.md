# @danielsimonjr/mathts-expression

Expression parser & evaluator for [MathTS](https://github.com/danielsimonjr/mathts).

The expression engine for MathTS: a parser (string → AST), an AST node set, a compiler, and an evaluator. Includes a sandbox (`getSafeProperty` / `getSafeMethod`) for safe property access.

## Install

```sh
npm install @danielsimonjr/mathts-expression
```

## What it provides

- `createParse` / `createParserClass` / `createParser` — parse to an AST.
- 16 AST node constructors (`createConstantNode`, `createOperatorNode`, …).
- `compile` / `createEvaluate` / `compileExpression` — evaluate expressions.
- AST serializers on every node: `toString()`, `toTex()` (LaTeX), `toHTML()`, and `toMathML()` (MathML).
- Focused re-exports are also published: `@danielsimonjr/mathts-{parser,ast,evaluator}`.

## Serializing an AST

Every node serializes to several formats. `toMathML()` returns a MathML
**fragment** (like `toTex()` returns a LaTeX fragment, without delimiters);
wrap it in a `<math>` element with `mathMLDocument(node)` to render. MathML is
typeset natively by modern browsers — no external dependencies.

```ts
import { mathMLDocument, mathMLError } from '@danielsimonjr/mathts-expression';

const node = parse('c = 1 / sqrt(eps0 * mu0)'); // parse from the functions package
node.toString();       // 'c = 1 / sqrt(eps0 * mu0)'
node.toTex();          // 'c=\\frac{1}{\\sqrt{ eps0\\cdot mu0}}'
node.toMathML();       // '<mrow><mi>c</mi><mo>=</mo><mfrac>…</mfrac></mrow>'
mathMLDocument(node);  // '<math xmlns="…" display="block">…</math>'  (renderable)
```

`mathMLError(src)` produces a `<math><merror>` element for a parse failure.

## License

MIT (c) Daniel Simon Jr.
