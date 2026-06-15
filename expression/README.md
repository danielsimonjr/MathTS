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
- Focused re-exports are also published: `@danielsimonjr/mathts-{parser,ast,evaluator}`.

## License

MIT (c) Daniel Simon Jr.
