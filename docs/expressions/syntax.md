# Expression syntax

This page describes the syntax of the MathTS expression parser. The parser targets a
mathematical audience and is close to standard calculator notation.

## Differences from JavaScript

- No namespace prefix: write `sin(pi / 4)` not `Math.sin(Math.PI / 4)`.
- Matrix indexes are **one-based** (not zero-based). Upper bound is **inclusive**.
- Range operator: `1:4` produces `[1, 2, 3, 4]`.
- `^` is exponentiation, not bitwise XOR.
- Implicit multiplication: `2 pi` is valid and equals `2 * pi`.
- Chained relational operators: `5 < x < 10` means `5 < x and x < 10`.
- Function definition syntax: `f(x) = x^2`.
- Multi-statement blocks with `;` or newlines produce an array of visible results.

## Operators

| Operator | Name | Example | Result |
|---|---|---|---|
| `()` | Grouping | `(2 + 3) * 4` | `20` |
| `[]` | Matrix / index | `[1, 2, 3]` | `[1, 2, 3]` |
| `{}` | Object | `{a: 1, b: 2}` | `{a: 1, b: 2}` |
| `+` | Add / unary plus | `4 + 5` | `9` |
| `-` | Subtract / negate | `7 - 3` | `4` |
| `*` | Multiply | `2 * 3` | `6` |
| `.*` | Element-wise multiply | `[1,2,3] .* [1,2,3]` | `[1,4,9]` |
| `/` | Divide | `6 / 2` | `3` |
| `./` | Element-wise divide | `[9,6] ./ [3,2]` | `[3,3]` |
| `%` | Modulus | `8 % 3` | `2` |
| `^` | Power | `2 ^ 3` | `8` |
| `.^` | Element-wise power | `[2,3] .^ [3,3]` | `[8,27]` |
| `'` | Transpose | `[[1,2],[3,4]]'` | `[[1,3],[2,4]]` |
| `!` | Factorial | `5!` | `120` |
| `&` | Bitwise AND | `5 & 3` | `1` |
| `~` | Bitwise NOT | `~2` | `-3` |
| `\|` | Bitwise OR | `5 \| 3` | `7` |
| `^\|` | Bitwise XOR | `5 ^\| 2` | `7` |
| `<<` | Left shift | `4 << 1` | `8` |
| `>>` | Right shift | `8 >> 1` | `4` |
| `and` | Logical AND | `true and false` | `false` |
| `or` | Logical OR | `true or false` | `true` |
| `not` | Logical NOT | `not true` | `false` |
| `xor` | Logical XOR | `true xor true` | `false` |
| `=` | Assignment | `a = 5` | `5` |
| `? :` | Conditional | `x > 0 ? x : -x` | |
| `??` | Nullish coalesce | `null ?? 2` | `2` |
| `?.` | Optional chain | `obj?.prop` | |
| `:` | Range | `1:4` | `[1,2,3,4]` |
| `<`, `>`, `<=`, `>=`, `==`, `!=` | Comparison | `5 < x < 10` | chained |

## Operator precedence

Follows standard mathematical convention. Use parentheses to override. Unary minus
has higher precedence than exponentiation: `-2^2` evaluates as `(-2)^2 = 4`.

## Numbers



## Strings



## Booleans and null



## Complex numbers

Complex values are expressed through functions:



## Matrices

Matrices use square brackets. Rows are separated by semicolons, columns by commas:



One-based indexing with inclusive upper bound:



## Ranges



## Objects



## Variables

Variables are assigned with `=`. They persist in the scope across multi-statement blocks:



## Functions

Functions are called with parentheses. All functions from the math scope are available
without a namespace prefix:



### Function definitions

User-defined functions use `f(x) = expr` syntax:



## Constants

The following constants are available by name:

| Name | Value |
|---|---|
| `pi` | 3.14159... |
| `e` | 2.71828... |
| `tau` | 6.28318... (2pi) |
| `Infinity` | Infinity |
| `NaN` | NaN |
| `null` | null |
| `true` | true |
| `false` | false |
| `i` | imaginary unit (via `complex(0, 1)`) |

## Conditionals



## Multi-statement blocks

Semicolons and newlines separate statements. Statements ending with `;` are evaluated
for side effect only and their result is suppressed:



## Implicit multiplication

Adjacent identifiers or numbers multiply:



Special rules apply: `2x` is `2 * x`, but `sin2x` is parsed as `sin(2 * x)`.
