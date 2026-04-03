# MathTS Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the native MathTS architecture (37K lines) with the synced mathjs factory code (156K lines) by resolving the 5 architectural barriers identified in the inventory, progressively activating dormant factories.

**Architecture:** Bottom-up activation in 5 phases. Each phase produces working, tested code that builds on the previous. Phase 1 fixes immediate type mismatches. Phase 2 extends core types. Phase 3 bridges the factory systems. Phase 4 activates function categories. Phase 5 wires expression + workbook.

**Tech Stack:** TypeScript 5.3+, Vitest, decimal.js (BigNumber math), complex.js, fraction.js

---

## Phase 1: Fix Active Code Type Mismatches

### Task 1: Fix method name mismatches in typed functions

**Files:**
- Modify: `functions/src/typed/arithmetic.ts`
- Modify: `functions/src/typed/trigonometry.ts`
- Test: `functions/tests/typed-arithmetic.test.ts`

The typed functions call methods by wrong names. Fix these exact mismatches:

| Called | Should Be | Type | File:Line Pattern |
|--------|-----------|------|-------------------|
| `.neg()` | `.negate()` | Complex, Fraction, BigNumber | arithmetic.ts |
| `.reciprocal()` | `.inverse()` | Complex | trigonometry.ts |
| `.div()` | `.divide()` | BigNumber | trigonometry.ts |

- [ ] **Step 1: Fix arithmetic.ts**

Search for `.neg(` and replace with `.negate(`. There are 3 occurrences (one per type):

```typescript
// Line ~214: (val as Complex).neg() → (val as Complex).negate()
// Line ~215: (val as Fraction).neg() → (val as Fraction).negate()
// Line ~216: (val as BigNumber).neg() → (val as BigNumber).negate()
```

- [ ] **Step 2: Fix trigonometry.ts**

Search for `.reciprocal(` and replace with `.inverse(`. Search for `.div(` on BigNumber and replace with `.divide(`.

```typescript
// Lines ~84,93,102,160,168,176: .reciprocal() → .inverse()
// Lines ~85,94,103: .div( → .divide(
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run functions/tests/typed-arithmetic.test.ts
```

Expected: 40 tests pass (they use the number overloads which don't hit these methods, but verify no regressions).

- [ ] **Step 4: Commit**

```bash
git add functions/src/typed/arithmetic.ts functions/src/typed/trigonometry.ts
git commit -m "fix(functions): correct method names in typed functions (neg→negate, reciprocal→inverse, div→divide)"
```

---

### Task 2: Fix factoriesAny.ts and factoriesNumber.ts import paths

**Files:**
- Modify: `functions/src/factoriesAny.ts`
- Modify: `functions/src/factoriesNumber.ts`

These files were synced from mathjs but their import paths still use the mathjs layout (`./function/utils/...` instead of `./utils/...`). The sync script's `function/` segment stripping only applies to imports with 2+ `../` prefixes, but these files use `./function/` (relative, no `../`).

- [ ] **Step 1: Update sync script to handle `./function/` in standalone files**

In `~/.claude/scripts/sync_mathjs_to_mathts.py`, the `function/` segment stripping regex is:
```python
r"((?:from|import)\s+['\"](?:\.\./){2,})function/"
```

This misses `./function/` (only 1 level). For standalone files at src/ root, `./function/<cat>/` should become `./<cat>/`. Add a second regex for standalone files (or make the transform handle this case).

Actually, the simpler fix: these standalone files should be treated as support-level (`is_support_dir=True`) which skips the depth reduction but still applies the `function/` strip. But the `function/` strip currently only fires for 2+ `../`. The root-level files use `./function/`.

Add to `transform_imports()`, after the existing `function/` strip block:

```python
# Also strip ./function/ for files at the src/ root level
content = re.sub(
    r"((?:from|import)\s+['\"])\./function/",
    r"\1./",
    content,
)
```

- [ ] **Step 2: Re-run sync**

```bash
python -X utf8 ~/.claude/scripts/sync_mathjs_to_mathts.py
```

Verify factoriesAny.ts and factoriesNumber.ts are updated.

- [ ] **Step 3: Verify imports resolve**

```bash
grep "from '\./function/" functions/src/factoriesAny.ts | head -5
# Expected: no matches (all stripped)
grep "from '\./" functions/src/factoriesAny.ts | head -5
# Expected: ./core/function/typed.js, ./type/bignumber/BigNumber.js, etc.
```

- [ ] **Step 4: Commit**

```bash
git add functions/src/factoriesAny.ts functions/src/factoriesNumber.ts
git commit -m "fix(functions): fix factory registry import paths (strip ./function/ prefix)"
```

---

## Phase 2: Extend Core Types

### Task 3: Add BigNumber trig and transcendental methods

**Files:**
- Modify: `core/src/types/bignumber.ts`
- Create: `core/tests/types/bignumber-math.test.ts`

BigNumber wraps a `Decimal` instance from `decimal.js`. The `Decimal` class already has `sin()`, `cos()`, `tan()`, `asin()`, `acos()`, `atan()`, `exp()`, `ln()`, `log()` (base-10), `sqrt()`, `cbrt()`, etc. We need to expose these through BigNumber's public API.

Methods to add (22 total):

**Trig (6):** `sin`, `cos`, `tan`, `asin`, `acos`, `atan`
**Hyperbolic (6):** `sinh`, `cosh`, `tanh`, `asinh`, `acosh`, `atanh`
**Transcendental (6):** `exp`, `ln`, `log10`, `log2`, `cbrt`, `expm1`
**Other (4):** `mod`, `log1p`, `atan2`, `hypot`

- [ ] **Step 1: Write failing tests**

Create `core/tests/types/bignumber-math.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { BigNumber } from '../../src/types/bignumber.js';

describe('BigNumber math methods', () => {
  const pi = new BigNumber('3.14159265358979323846');
  const one = new BigNumber(1);
  const zero = new BigNumber(0);
  const half = new BigNumber('0.5');

  describe('trigonometry', () => {
    it('sin(0) = 0', () => {
      expect(zero.sin().toNumber()).toBeCloseTo(0, 10);
    });
    it('cos(0) = 1', () => {
      expect(zero.cos().toNumber()).toBeCloseTo(1, 10);
    });
    it('tan(0) = 0', () => {
      expect(zero.tan().toNumber()).toBeCloseTo(0, 10);
    });
    it('asin(0) = 0', () => {
      expect(zero.asin().toNumber()).toBeCloseTo(0, 10);
    });
    it('acos(1) = 0', () => {
      expect(one.acos().toNumber()).toBeCloseTo(0, 10);
    });
    it('atan(0) = 0', () => {
      expect(zero.atan().toNumber()).toBeCloseTo(0, 10);
    });
  });

  describe('hyperbolic', () => {
    it('sinh(0) = 0', () => {
      expect(zero.sinh().toNumber()).toBeCloseTo(0, 10);
    });
    it('cosh(0) = 1', () => {
      expect(zero.cosh().toNumber()).toBeCloseTo(1, 10);
    });
    it('tanh(0) = 0', () => {
      expect(zero.tanh().toNumber()).toBeCloseTo(0, 10);
    });
  });

  describe('transcendental', () => {
    it('exp(0) = 1', () => {
      expect(zero.exp().toNumber()).toBeCloseTo(1, 10);
    });
    it('ln(1) = 0', () => {
      expect(one.ln().toNumber()).toBeCloseTo(0, 10);
    });
    it('log10(10) = 1', () => {
      const ten = new BigNumber(10);
      expect(ten.log10().toNumber()).toBeCloseTo(1, 10);
    });
    it('cbrt(8) = 2', () => {
      const eight = new BigNumber(8);
      expect(eight.cbrt().toNumber()).toBeCloseTo(2, 10);
    });
    it('sqrt(4) = 2', () => {
      // sqrt already exists, just verify
      const four = new BigNumber(4);
      expect(four.sqrt().toNumber()).toBeCloseTo(2, 10);
    });
  });

  describe('other', () => {
    it('mod(7, 3) = 1', () => {
      const seven = new BigNumber(7);
      const three = new BigNumber(3);
      expect(seven.mod(three).toNumber()).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run core/tests/types/bignumber-math.test.ts
```

Expected: FAIL — methods don't exist yet.

- [ ] **Step 3: Implement methods on BigNumber**

In `core/src/types/bignumber.ts`, add these methods. The BigNumber class has a `value` property that is the underlying `Decimal` instance. Each method delegates to `Decimal`'s built-in method and wraps the result in a new `BigNumber`.

Pattern for each method:

```typescript
sin(): BigNumber {
  return new BigNumber(this.value.sin());
}
```

For `log2`: `decimal.js` doesn't have a direct `log2`, so compute as `ln(x) / ln(2)`:
```typescript
log2(): BigNumber {
  return new BigNumber(this.value.ln().div(new Decimal(2).ln()));
}
```

For `expm1`: `exp(x) - 1`:
```typescript
expm1(): BigNumber {
  return new BigNumber(this.value.exp().minus(1));
}
```

For `log1p`: `ln(1 + x)`:
```typescript
log1p(): BigNumber {
  return new BigNumber(new Decimal(1).plus(this.value).ln());
}
```

For hyperbolic functions, `decimal.js` has `sinh`, `cosh`, `tanh` built-in.
For inverse hyperbolics, use formulas:
```typescript
asinh(): BigNumber {
  // asinh(x) = ln(x + sqrt(x² + 1))
  const x = this.value;
  return new BigNumber(x.plus(x.times(x).plus(1).sqrt()).ln());
}
acosh(): BigNumber {
  // acosh(x) = ln(x + sqrt(x² - 1))
  const x = this.value;
  return new BigNumber(x.plus(x.times(x).minus(1).sqrt()).ln());
}
atanh(): BigNumber {
  // atanh(x) = 0.5 * ln((1+x)/(1-x))
  const x = this.value;
  const one = new Decimal(1);
  return new BigNumber(one.plus(x).div(one.minus(x)).ln().times(0.5));
}
```

For `mod`:
```typescript
mod(other: BigNumber): BigNumber {
  return new BigNumber(this.value.mod(other.value));
}
```

For `atan2`:
```typescript
atan2(x: BigNumber): BigNumber {
  return new BigNumber(Decimal.atan2(this.value, x.value));
}
```

For `hypot`:
```typescript
hypot(other: BigNumber): BigNumber {
  return new BigNumber(this.value.times(this.value).plus(other.value.times(other.value)).sqrt());
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run core/tests/types/bignumber-math.test.ts
```

Expected: All pass.

- [ ] **Step 5: Run full core test suite**

```bash
npx vitest run core/tests/
```

Expected: All existing tests still pass + new tests pass.

- [ ] **Step 6: Commit**

```bash
git add core/src/types/bignumber.ts core/tests/types/bignumber-math.test.ts
git commit -m "feat(core): add trig, hyperbolic, and transcendental methods to BigNumber"
```

---

## Phase 3: Bridge the Factory Systems

### Task 4: Create type compatibility bridge

**Files:**
- Create: `core/src/typed/type-bridge.ts`
- Create: `core/tests/typed/type-bridge.test.ts`

The synced mathjs factories use duck-typing checks (`isComplex(x)` checks for `x.type === 'Complex'` or `x.isComplex === true`). The native MathTS types use `instanceof`. We need a bridge that registers native types with the mathjs type checks.

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { Complex } from '../../src/types/complex.js';
import { Fraction } from '../../src/types/fraction.js';
import { BigNumber } from '../../src/types/bignumber.js';
import { registerNativeTypes } from '../../src/typed/type-bridge.js';

describe('Type Bridge', () => {
  it('should make native Complex pass mathjs duck-type checks', () => {
    registerNativeTypes();
    const z = new Complex(3, 4);
    expect((z as any).isComplex).toBe(true);
    expect((z as any).type).toBe('Complex');
  });

  it('should make native Fraction pass mathjs duck-type checks', () => {
    registerNativeTypes();
    const f = new Fraction(1, 3);
    expect((f as any).isFraction).toBe(true);
    expect((f as any).type).toBe('Fraction');
  });

  it('should make native BigNumber pass mathjs duck-type checks', () => {
    registerNativeTypes();
    const b = new BigNumber(42);
    expect((b as any).isBigNumber).toBe(true);
    expect((b as any).type).toBe('BigNumber');
  });
});
```

- [ ] **Step 2: Implement type-bridge.ts**

Add `isComplex`, `type`, `isFraction`, `isBigNumber` properties to the prototype of each native type so they pass mathjs duck-type checks:

```typescript
import { Complex } from '../types/complex.js';
import { Fraction } from '../types/fraction.js';
import { BigNumber } from '../types/bignumber.js';

export function registerNativeTypes(): void {
  // Complex bridge
  if (!('isComplex' in Complex.prototype)) {
    Object.defineProperty(Complex.prototype, 'isComplex', { value: true, writable: false });
    Object.defineProperty(Complex.prototype, 'type', { value: 'Complex', writable: false });
  }

  // Fraction bridge
  if (!('isFraction' in Fraction.prototype)) {
    Object.defineProperty(Fraction.prototype, 'isFraction', { value: true, writable: false });
    Object.defineProperty(Fraction.prototype, 'type', { value: 'Fraction', writable: false });
  }

  // BigNumber bridge
  if (!('isBigNumber' in BigNumber.prototype)) {
    Object.defineProperty(BigNumber.prototype, 'isBigNumber', { value: true, writable: false });
    Object.defineProperty(BigNumber.prototype, 'type', { value: 'BigNumber', writable: false });
  }
}
```

- [ ] **Step 3: Run tests and commit**

```bash
npx vitest run core/tests/typed/type-bridge.test.ts
git add core/src/typed/type-bridge.ts core/tests/typed/type-bridge.test.ts
git commit -m "feat(core): add type compatibility bridge for mathjs duck-typing"
```

---

### Task 5: Bridge the typed-function instances

**Files:**
- Create: `functions/src/typed/typed-bridge.ts`
- Create: `functions/tests/typed-bridge.test.ts`

The native `mathTyped` (from `@mathts/core`) and the synced `createTyped` factory (in `functions/src/core/function/typed.ts`) are separate typed-function instances with different type registrations. We need to register native MathTS types in the synced typed-function so factories can dispatch on them.

- [ ] **Step 1: Analyze what the synced typed.ts does**

Read `functions/src/core/function/typed.ts` to understand how it registers types. It calls `typed.addType({name, test})` for each mathjs type.

- [ ] **Step 2: Write typed-bridge.ts**

This module imports both typed-function instances, registers native types in the synced one, and exports a unified dispatch function:

```typescript
import { mathTyped } from '@mathts/core';
import { Complex } from '@mathts/core';
import { Fraction } from '@mathts/core';
import { BigNumber } from '@mathts/core';
import { registerNativeTypes } from '@mathts/core';

/**
 * Bridge native MathTS types into the synced mathjs typed-function instance.
 * Call this once at initialization to enable synced factories to work
 * with native types.
 */
export function initTypeBridge(): void {
  // Step 1: Add duck-typing markers to native types
  registerNativeTypes();

  // Step 2: The synced typed-function checks isComplex/isFraction/isBigNumber
  // which are now set on native type prototypes.
  // No additional registration needed — the duck-type checks will pass.
}
```

- [ ] **Step 3: Write test**

```typescript
import { describe, it, expect } from 'vitest';
import { Complex, Fraction, BigNumber } from '@mathts/core';
import { initTypeBridge } from '../src/typed/typed-bridge.js';

describe('Typed Bridge', () => {
  initTypeBridge();

  it('native Complex passes synced isComplex check', () => {
    const z = new Complex(1, 2);
    // mathjs checks: typeof x === 'object' && x.isComplex === true
    expect(typeof z === 'object' && (z as any).isComplex === true).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests and commit**

```bash
npx vitest run functions/tests/typed-bridge.test.ts
git add functions/src/typed/typed-bridge.ts functions/tests/typed-bridge.test.ts
git commit -m "feat(functions): add typed-function bridge for native type dispatch"
```

---

## Phase 4: Activate Factory Categories

### Task 6: Activate leaf factories (typed-only dependencies)

**Files:**
- Modify: `functions/src/index.ts`
- Create: `functions/tests/factories-leaf.test.ts`

56 factories depend only on the `typed` dispatch system (no Matrix, Unit, or Index dependencies). These can be activated immediately after the type bridge is in place.

Categories with leaf factories: `relational`, `logical`, `bitwise`, `string`, `special`, `combinatorics` (partial), `arithmetic` (partial).

- [ ] **Step 1: Identify exact leaf factories**

Run this to find factories with only `typed` as dependency:

```bash
cd functions/src && grep -rl "factory(" relational/ logical/ bitwise/ string/ special/ | head -20
```

For each, check the dependency array in the `factory()` call. If it only contains `'typed'` (and possibly basic types like `'number'`, `'BigNumber'`, `'Complex'`), it's a leaf.

- [ ] **Step 2: Create a barrel export for leaf factories**

Create `functions/src/factories/index.ts` that re-exports the leaf factories:

```typescript
// Leaf factories — depend only on typed-function dispatch
export { createEqual } from '../relational/equal.js';
export { createUnequal } from '../relational/unequal.js';
// ... etc for each leaf factory
```

- [ ] **Step 3: Export from functions/src/index.ts**

```typescript
export * from './typed/index.js';
export * from './factories/index.js';
```

- [ ] **Step 4: Write tests for activated factories**

```typescript
import { describe, it, expect } from 'vitest';
import { initTypeBridge } from '../src/typed/typed-bridge.js';
// Import specific factories and test them

describe('Leaf factories', () => {
  // Tests for each activated factory
});
```

- [ ] **Step 5: Build and test**

```bash
npx turbo build --filter=@mathts/functions
npx vitest run functions/tests/
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(functions): activate leaf factories (relational, logical, bitwise, string)"
```

---

### Task 7: Activate arithmetic factories

**Files:**
- Modify: `functions/src/factories/index.ts`
- Create: `functions/tests/factories-arithmetic.test.ts`

Arithmetic factories depend on `typed`, `Complex`, `BigNumber`, `Fraction`, and `DenseMatrix`. After the type bridge (Task 4-5) and BigNumber methods (Task 3), most arithmetic factories should work.

- [ ] **Step 1: List arithmetic factories and their deps**

```bash
grep -A3 "factory(" functions/src/arithmetic/*.ts | grep -E "factory\(|deps"
```

- [ ] **Step 2: Add arithmetic factories to the barrel export**

- [ ] **Step 3: Write tests**

Test each arithmetic factory with number, Complex, Fraction, and BigNumber inputs.

- [ ] **Step 4: Build, test, commit**

---

### Task 8: Activate trigonometry factories

Similar pattern to Task 7 but for `functions/src/trigonometry/`.

---

### Task 9: Activate statistics factories

Similar pattern. These depend on Matrix — will need DenseMatrix integration.

---

## Phase 5: Wire Expression + Workbook

### Task 10: Connect expression parser to function registry

**Files:**
- Modify: `expression/src/compiler/` (create compiler)
- Modify: `expression/src/evaluator/` (create evaluator)
- Create: `expression/tests/parse-eval.test.ts`

The expression parser produces an AST. The compiler needs to resolve function names to registered functions. The evaluator executes the compiled AST.

- [ ] **Step 1: Implement a minimal compiler**

The compiler takes a Node (AST) and a scope (function registry + variables), and returns a compiled function that evaluates the expression.

- [ ] **Step 2: Implement a minimal evaluator**

The evaluator wraps the compiler with a default scope containing all registered functions.

- [ ] **Step 3: Write tests**

```typescript
// parse('2 + 3').evaluate() === 5
// parse('sin(pi/2)').evaluate() === 1
// parse('x^2').evaluate({x: 3}) === 9
```

- [ ] **Step 4: Build, test, commit**

---

### Task 11: Connect workbook executeCode to expression evaluator

**Files:**
- Modify: `workbook/src/executor.ts`
- Modify: `workbook/tests/executor.test.ts`

Replace the `'Code execution not yet implemented'` throw with a call to the expression evaluator.

- [ ] **Step 1: Import expression evaluator**

- [ ] **Step 2: Implement executeCode()**

- [ ] **Step 3: Update tests**

- [ ] **Step 4: Build, test, commit**

---

## Verification

### Task 12: Full integration verification

- [ ] **Step 1: Full build**

```bash
npx turbo build
```

Expected: All 10 packages build.

- [ ] **Step 2: Full typecheck**

```bash
npx turbo typecheck
```

Expected: All packages pass.

- [ ] **Step 3: Full test suite**

```bash
npx vitest run
```

Expected: All tests pass, including new factory tests.

- [ ] **Step 4: Update CLAUDE.md**

Document the integration status, which factories are active, and the new architecture.
