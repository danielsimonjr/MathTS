# @danielsimonjr/mathts-typed-function

Utility helpers around [typed-function](https://github.com/josdejong/typed-function) for MathTS.

## Relationship to the dispatch fork

Runtime polymorphic dispatch in `@danielsimonjr/mathts-core` and `@danielsimonjr/mathts-functions` uses the published npm alias `typed-function` → `npm:@danielsimonjr/typed-function@5.0.0-alpha.4`. No workspace package depends on `@danielsimonjr/mathts-typed-function` by name.

This workspace package re-exports `typed` and `create` from that fork and adds MathTS-specific helpers (signature parsing, safe conversions, robust type tests, and shared guards).

## Install

```sh
npm install @danielsimonjr/mathts-typed-function
```

For application code, prefer `mathTyped` from `@danielsimonjr/mathts-core` unless you need the helpers below directly.

## Exports

| Category            | Names                                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fork re-exports     | `typed`, `create`, type `TypedFunction`                                                                                                                                    |
| Symbol / signatures | `TYPED_FUNCTION_TYPE`, `parseSignature`, `buildSignature`                                                                                                                  |
| Type tests          | `isNumber`, `isInteger`, `isTypedArray`, `isFloat64Array`, `isFloat32Array`, …                                                                                             |
| Def builders        | `createSymbolTypeTest`, `createRobustTypeTest`, `createRobustSubtypeTest`, `createSafeConversion`, `createSafeConversionDef`, `createSymbolTypeDef`, `createRobustTypeDef` |
| Errors              | `NoMatchingSignatureError`, `TypeConversionError`                                                                                                                          |

## License

MIT (c) Daniel Simon Jr.
