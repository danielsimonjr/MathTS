---
'@danielsimonjr/mathts-core': patch
---

`Complex.parse` and `complex(string)` read the grammar of the complex.js string parser that mathjs uses. A number takes an exponent: `complex('1e3+2i')` is 1000 + 2i and was 1000i. A text that is not a complex number throws `SyntaxError('Invalid Param')`: `complex('abc')`, `complex('2abc')` and `complex('1+')` gave `NaN` or a part that the text did not hold. Three forms that mathjs rejects stay valid, so no working input breaks: white space except between two number characters (`'3 + 4 i'`), an `E` exponent (`'1E3'`) and the word `Infinity`. The text `'NaN'` throws. (Refs #1283)
