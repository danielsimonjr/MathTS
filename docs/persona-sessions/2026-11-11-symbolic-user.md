# Symbolic user — npm dogfood, 2026-11-11

Label: `persona:symbolic-user`. I am coming from SymPy, Mathematica, and mathjs. I want to parse a real grammar, round-trip to string/TeX, run CAS (`simplify` / `expand` / `factor` / `diff` / `integrate` / `solve` / `subs`), compile with a scope, and keep BigNumber/Fraction exact. I did **not** build the clone. Scratch dirs `/tmp/mathts-symbolic` (plain ESM) and `/tmp/mathts-symbolic/ts` (strict NodeNext).

## Environment

- Clone SHA (docs / “reproduces on master” checks): `fef4010b8a468215a26bcdb9642db0556055b9bb`
- npm `@latest`: parser **0.1.34**, ast **0.1.33**, expression **0.12.7**, evaluator **0.1.33**, functions **0.84.0**, numbers **0.1.28**, core **0.26.0**; mathjs **15.2.0**
- Node **v22.23.4**, ESM; TypeScript 5.x; Linux x86_64, Intel Xeon 4-core
- Oracle: **SymPy 1.14.0** (`python3`)
- Bench JSON: [`bench/2026-11-11-symbolic-user.json`](./bench/2026-11-11-symbolic-user.json)

## Goal, in order

Install the published expression stack. Parse a grammar corpus. Round-trip. CAS vs SymPy. Compile/evaluate + sandbox. Precision. Speed vs mathjs. Check README vs exports vs `.d.ts`.

## What I tried

### 1. The focused packages vs functions

`npm i @danielsimonjr/mathts-{parser,ast,expression,evaluator,functions,numbers,core}`. Parser README:

```ts
import { createParse, createParserClass } from '@danielsimonjr/mathts-parser';
```

`createParse()` throws `Cannot read properties of undefined (reading 'typed')`. `createEvaluate()` throws `Invalid value used as weak map key`. `compile` exists but needs a wired node. The only copy-pasteable `parse('2+3*4')` is `@danielsimonjr/mathts-functions`. That is [#715](https://github.com/danielsimonjr/MathTS/issues/715). `docs/api/expression.md` does describe factories; the npm READMEs do not.

### 2. Grammar corpus (functions `parse` / `evaluate`)

| input                    | parse                           | toString / toTex                        | evaluate                                                                                                                                         |
| ------------------------ | ------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `2+3*4`                  | OperatorNode                    | `2 + 3 * 4` / `2+3\cdot4`               | **14**                                                                                                                                           |
| `2^3^2`                  | ok                              | TeX `{2}^{{3}^{2}}`                     | **512** (right assoc, good)                                                                                                                      |
| `-2^2`                   | ok                              | `-2 ^ 2`                                | **-4** (unary minus vs power, matches mathjs)                                                                                                    |
| `2*-3`                   | ok                              |                                         | **-6**                                                                                                                                           |
| `2(3+4)`, `2x`, `x y`    | implicit multiply               | `2 (3 + 4)`                             | 14; `2x` needs scope                                                                                                                             |
| `5!`                     | ok                              | `5!`                                    | **120**                                                                                                                                          |
| `[[1,2],[3,4]]`          | ArrayNode                       | bmatrix TeX                             | nested array                                                                                                                                     |
| `f(x) = x^2`             | FunctionAssignmentNode          | TeX `\mathrm{f}\left(x\right)={ x}^{2}` | **Security: function definitions disabled** unless `{ unsafe: true }` → then `f(3)=9` [#725](https://github.com/danielsimonjr/MathTS/issues/725) |
| `x=3`                    | AssignmentNode                  |                                         | same security gate                                                                                                                               |
| `2 inch`, `2 * inch`     | ok                              |                                         | Unit 2 inch; `2 inch to cm` → **5.08 cm**                                                                                                        |
| `π`, `sin(π/2)`          | SymbolNode `π`                  | TeX uses `π`                            | **Undefined symbol "π"**; `pi` works [#720](https://github.com/danielsimonjr/MathTS/issues/720)                                                  |
| `√2`                     | **Syntax error (char 1)**       | —                                       | — (mathjs same)                                                                                                                                  |
| `1 + * 2`, `(1+2`, `x[1` | SyntaxError with **char index** | —                                       | good                                                                                                                                             |
| `1e`                     | `1 e`                           |                                         | **2.718…** [#723](https://github.com/danielsimonjr/MathTS/issues/723)                                                                            |
| `2**3`                   | Value expected (char 3)         |                                         | mathjs same                                                                                                                                      |
| `x==y==z`                | RelationalNode                  | TeX `x= y= z` (equals, not ==)          | unbound                                                                                                                                          |
| `a ? b : c`              | ConditionalNode                 | cases TeX                               | unbound                                                                                                                                          |
| `1; 2`                   | BlockNode                       |                                         | **2**                                                                                                                                            |
| `sum(i, 1, 3, i)`        | FunctionNode                    |                                         | **4+2i** [#721](https://github.com/danielsimonjr/MathTS/issues/721)                                                                              |

`evaluate('2x', { x: 5 })` is 10. Parenthesis nesting: **124** evaluates to 1; **125** `expression exceeds nesting limit (char 125)` while README says 125 [#722](https://github.com/danielsimonjr/MathTS/issues/722). `toHTML()` on `2x+3!` looks fine.

### 3. CAS vs SymPy 1.14

| op                             | MathTS                      | SymPy                         |
| ------------------------------ | --------------------------- | ----------------------------- |
| `simplify('x^2+2*x+1')`        | unchanged                   | `(x + 1)**2`                  |
| `fullSimplify` / `casSimplify` | unchanged                   | same                          |
| `expand('(x+1)^2')`            | `1 + 2*x + 1*x^2`           | `x**2 + 2*x + 1`              |
| `factor('x^2+2*x+1')`          | `(x + 1)*(x + 1)`           | `(x + 1)**2`                  |
| `derivative('sin(x)*x','x')`   | `cos(x) * x + sin(x)`       | `x*cos(x) + sin(x)` **match** |
| `casDerivative(...)`           | **`d/dx(sin(x)*x)`**        | —                             |
| `integrate('x^2','x')`         | `x^3/3`                     | match                         |
| `integrate('sin(x)')`          | `-cos(x)`                   | match                         |
| `integrate('1/x')`             | **`log(x)`**                | `log(x)`                      |
| `symbolicIntegral('1/x')`      | **`1 * log(abs(x))`**       | —                             |
| `integrate('exp(-x^2)')`       | unevaluated `integral(...)` | erf form                      |
| `solve('x^2-2')`               | **±1.4142135623730951**     | `±sqrt(2)`                    |
| `solve('x^2+1')`               | `i, -i` exact               | match-ish                     |
| `solve('sin(x)=0')`            | **63 floats** ~[-31π,31π]   | `k π`                         |
| `substitute('x^2+y',{x:2})`    | **`2^2+y`**                 | `4+y`                         |
| `rationalize('1/x+1/y')`       | `(y + x) / (x * y)`         | match                         |

Issues: [#716](https://github.com/danielsimonjr/MathTS/issues/716) simplify, [#717](https://github.com/danielsimonjr/MathTS/issues/717) two integrals, [#718](https://github.com/danielsimonjr/MathTS/issues/718) casDerivative, [#719](https://github.com/danielsimonjr/MathTS/issues/719) solve, [#724](https://github.com/danielsimonjr/MathTS/issues/724) substitute. `derivative('abs(x)','x')` is `abs(x)/x`; at `x=0` that evaluates to **NaN** (not a filed crash; expected distributionally messy).

I did not re-file [#690](https://github.com/danielsimonjr/MathTS/issues/690) (`solve` on a matrix → `[]`).

### 4. Compile, sandbox, overflow

`compileExpr('2*x+y').evaluate({x:3,y:4})` is 10. `parser().set('x',2).evaluate('x^2')` is 4.

Sandbox (default evaluate): `constructor.prototype.polluted`, `__proto__`, `Object.assign`, `globalThis.process`, `process.env` → **Undefined symbol**. `constructor.constructor("return process")()` → **Value expected** (parse). I could not smash the prototype. Assignment/function-def recursion is blocked until `{ unsafe: true }` [#725](https://github.com/danielsimonjr/MathTS/issues/725). `2^10000` and `compileExpr('2^1000000')` are **Infinity**, no overflow error.

### 5. BigNumber / Fraction / numbers package

`evaluate('0.1+0.2')` is `0.30000000000000004`. `evaluate('bignumber(0.1)+bignumber(0.2)')` is `0.3`. `fraction(1,3)+fraction(1,6)` is `1/2`. `bignumber(1)/3` prints a long 0.333… string. Good.

`@danielsimonjr/mathts-numbers` README says export `BigNumber`. `new BigNumber(1)` **runs**, leaves `_coefficient` undefined, then **`toString` TypeError**. `.d.ts` ctor is private; there is no `bignumber` export on that package. `BigNumber.fromNumber(1)` works. [#714](https://github.com/danielsimonjr/MathTS/issues/714). Reproduces on master (`core/src/types/bignumber.ts`).

### 6. Types

Strict NodeNext + `skipLibCheck: false` on `evaluate` from functions: workerpool Node types (already [#697](https://github.com/danielsimonjr/MathTS/issues/697)), **GPUBuffer** from `mathts-gpu` (new [#726](https://github.com/danielsimonjr/MathTS/issues/726)), and `evaluate` typed **`unknown`**. I did not duplicate #697.

### 7. Speed vs mathjs (Node 22, public symbols)

See the JSON. Headline: **scoped `evaluate` median 0.0036 ms vs mathjs 0.012 ms (~0.30×)**. Compiled evaluate is a near tie (0.89×). Parse of a 40-char polynomial is a **tie**; a 200-term sum is **1.14× slower** than mathjs. An earlier 11-sample parse looked 3× faster — I am not claiming that.

## Findings

| #   | sev | issue                                                                                                      |
| --- | --- | ---------------------------------------------------------------------------------------------------------- |
| 1   | P0  | [#714](https://github.com/danielsimonjr/MathTS/issues/714) `new BigNumber(1)` crash                        |
| 2   | P1  | [#715](https://github.com/danielsimonjr/MathTS/issues/715) parser/evaluator factories unusable from README |
| 3   | P1  | [#716](https://github.com/danielsimonjr/MathTS/issues/716) simplify no-op; factor not a square             |
| 4   | P1  | [#717](https://github.com/danielsimonjr/MathTS/issues/717) `integrate` vs `symbolicIntegral` on 1/x        |
| 5   | P1  | [#718](https://github.com/danielsimonjr/MathTS/issues/718) `casDerivative` unevaluated                     |
| 6   | P1  | [#719](https://github.com/danielsimonjr/MathTS/issues/719) `solve` numeric, not ±√2 / kπ                   |
| 7   | P1  | [#720](https://github.com/danielsimonjr/MathTS/issues/720) Unicode `π` parse/eval split                    |
| 8   | P1  | [#721](https://github.com/danielsimonjr/MathTS/issues/721) `sum(i,1,3,i)` → 4+2i                           |
| 9   | P2  | [#722](https://github.com/danielsimonjr/MathTS/issues/722) nesting 125 vs 124                              |
| 10  | P2  | [#723](https://github.com/danielsimonjr/MathTS/issues/723) `1e` → e                                        |
| 11  | P2  | [#724](https://github.com/danielsimonjr/MathTS/issues/724) substitute no fold                              |
| 12  | P2  | [#725](https://github.com/danielsimonjr/MathTS/issues/725) assignment sandbox vs README                    |
| 13  | P2  | [#726](https://github.com/danielsimonjr/MathTS/issues/726) GPU types + `evaluate: unknown`                 |

Intended labels on every body: `dogfood` + `bug|api|perf|docs|packaging` + `P0|P1|P2` + `persona:symbolic-user` (token cannot apply labels).

## Verdict

The **wired** functions `parse` / `evaluate` / `compileExpr` path is real: mathjs-class grammar, implicit multiply, factorial, matrices, units, TeX, char-indexed syntax errors, a working sandbox, Fraction/BigNumber **when** I use the functions factories, and evaluate that is **faster** than mathjs on a scoped scalar. I would not ship a symbolic notebook on this stack yet: `simplify` does not simplify, `solve` is numeric, two integral APIs disagree, Unicode `π` parses then dies, the parser npm package is not a parser, and `new BigNumber(1)` explodes. I did not fix any of that this round.
