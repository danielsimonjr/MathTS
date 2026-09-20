---
'@danielsimonjr/mathts-arithmetic': patch
'@danielsimonjr/mathts-ast': patch
'@danielsimonjr/mathts-autograd': patch
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-evaluator': patch
'@danielsimonjr/mathts-expression': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-gpu': patch
'@danielsimonjr/mathts-linalg': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-numbers': patch
'@danielsimonjr/mathts-parallel': patch
'@danielsimonjr/mathts-parser': patch
'@danielsimonjr/mathts-plot': patch
'@danielsimonjr/mathts-signal': patch
'@danielsimonjr/mathts-statistics': patch
'@danielsimonjr/mathts-tensor': patch
'@danielsimonjr/mathts-trigonometry': patch
'@danielsimonjr/mathts-typed-function': patch
'@danielsimonjr/mathts-units': patch
'@danielsimonjr/mathts-workbook': patch
'@danielsimonjr/mathts-workerpool': patch
---

The published `.d.ts` files now carry explicit `.js` extensions on relative imports, so a consumer on `moduleResolution` `node16` or `nodenext` can use them.

Declaration emit runs under `module`/`moduleResolution` `nodenext` (`tsconfig.dts.base.json`). `tsc` copies a relative specifier into the `.d.ts` verbatim and synthesises one for an inferred type, so the emit mode is what decides whether the extension is there. An extensionless relative import in `src` is now a build error instead of a silent consumer break. A NodeNext consumer type check of the packed tarballs reported 60 errors before this change (53 TS2834, 7 TS2709) and reports 0 after it.

`@danielsimonjr/mathts-functions` also imports `Decimal` and `Complex` as named exports of `decimal.js` and `complex.js`. NodeNext resolves those two packages as CommonJS, where the default export is a namespace and not usable as a type (TS2709).
