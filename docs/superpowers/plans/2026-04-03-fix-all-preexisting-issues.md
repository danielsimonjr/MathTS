# Fix All Pre-Existing Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every known build, typecheck, test-config, and dependency issue across the MathTS monorepo so that `npx turbo build`, `npx turbo typecheck`, and `npx turbo test` all pass cleanly for every package.

**Architecture:** Seven independent fix tasks organized by package. Each task is self-contained — fixes one package's issues, verifies with build/typecheck/test, commits. Tasks 1-3 are quick infrastructure fixes; Tasks 4-7 are deeper code fixes.

**Tech Stack:** TypeScript 5.3+, Vitest, tsup, Turborepo, AssemblyScript 0.27

---

### Task 1: Fix root tsconfig.json and add @types/node everywhere

**Files:**
- Modify: `tsconfig.json`
- Modify: `core/package.json`
- Modify: `matrix/package.json`
- Modify: `functions/package.json`
- Modify: `parallel/package.json`
- Modify: `compat/package.json`
- Modify: `workbook/package.json`
- Modify: `expression/package.json`

- [ ] **Step 1: Fix root tsconfig.json include**

The root `tsconfig.json` has `"include": []` which makes `npx turbo typecheck` a no-op at the root level. Add proper workspace references:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@danielsimonjr/mathts-core": ["core/src"],
      "@danielsimonjr/mathts-matrix": ["matrix/src"],
      "@danielsimonjr/mathts-parallel": ["parallel/src"],
      "@danielsimonjr/mathts-workbook": ["workbook/src"],
      "@danielsimonjr/mathts-compat": ["compat/src"],
      "@danielsimonjr/mathts-expression": ["expression/src"],
      "@danielsimonjr/mathts-functions": ["functions/src"]
    }
  },
  "references": [],
  "include": [],
  "exclude": ["node_modules", "dist", "**/dist"]
}
```

Actually — the root tsconfig should stay `"include": []` because each package has its own tsconfig for typechecking. The real issue is that packages without tsconfig.json silently pass. This is addressed in Tasks 5-7 by adding tsconfigs to packages that lack them. Remove the root tsconfig from the known issues — it is intentionally empty since turbo delegates to per-package typechecks.

**Skip this step — root tsconfig is correct by design.**

- [ ] **Step 2: Add @types/node to all 7 packages**

Run from repo root:

```bash
npm install -D @types/node -w @danielsimonjr/mathts-core -w @danielsimonjr/mathts-matrix -w @danielsimonjr/mathts-functions -w @danielsimonjr/mathts-parallel -w @danielsimonjr/mathts-compat -w @danielsimonjr/mathts-workbook -w @danielsimonjr/mathts-expression
```

- [ ] **Step 3: Verify no regressions**

```bash
npx turbo build --filter='!@danielsimonjr/mathts-wasm' && npx vitest run
```

Expected: 9 packages build, 1342 tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "fix: add @types/node to all workspace packages"
```

---

### Task 2: Add missing vitest.config.ts to 5 packages

**Files:**
- Create: `functions/vitest.config.ts`
- Create: `parallel/vitest.config.ts`
- Create: `workbook/vitest.config.ts`
- Create: `packages/typed-function/vitest.config.ts`
- Create: `packages/workerpool/vitest.config.ts`

- [ ] **Step 1: Create functions/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: false,
    environment: 'node',
  },
});
```

- [ ] **Step 2: Create parallel/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: false,
    environment: 'node',
  },
});
```

- [ ] **Step 3: Create workbook/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: false,
    environment: 'node',
  },
});
```

- [ ] **Step 4: Create packages/typed-function/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'test/**/*.test.ts'],
    globals: false,
    environment: 'node',
  },
});
```

- [ ] **Step 5: Create packages/workerpool/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'test/**/*.test.ts'],
    globals: false,
    environment: 'node',
  },
});
```

- [ ] **Step 6: Verify per-package test discovery works**

```bash
cd functions && npx vitest run --reporter=verbose 2>&1 | tail -5
cd ../parallel && npx vitest run --reporter=verbose 2>&1 | tail -5
cd ../workbook && npx vitest run --reporter=verbose 2>&1 | tail -5
```

Expected: Each package finds and runs its own test files.

- [ ] **Step 7: Verify turbo test passes for all**

```bash
npx turbo test --filter='!@danielsimonjr/mathts-wasm'
```

- [ ] **Step 8: Commit**

```bash
git add functions/vitest.config.ts parallel/vitest.config.ts workbook/vitest.config.ts packages/typed-function/vitest.config.ts packages/workerpool/vitest.config.ts
git commit -m "fix: add missing vitest.config.ts to 5 packages"
```

---

### Task 3: Fix parallel/ typecheck failure

**Files:**
- Modify: `parallel/tsconfig.json`

The errors come from `../node_modules/workerpool/src/workers/worker.ts` and `../node_modules/workerpool/src/core/Pool.ts` — TypeScript `.ts` source files in node_modules that `skipLibCheck` doesn't cover (it only skips `.d.ts`). The fix is to exclude the node_modules workerpool source from compilation.

- [ ] **Step 1: Update parallel/tsconfig.json to exclude workerpool source**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "skipLibCheck": true,
    "paths": {
      "@danielsimonjr/mathts-workerpool": ["../packages/workerpool/dist/index.d.ts"],
      "workerpool": ["../node_modules/workerpool/dist/index.d.ts"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests", "../node_modules/**/*.ts"]
}
```

Key change: `"../node_modules/**/*.ts"` in exclude to prevent tsc from following imports into the workerpool TypeScript source.

- [ ] **Step 2: Verify typecheck passes**

```bash
cd parallel && npx tsc --noEmit
```

Expected: Exit 0, no errors.

- [ ] **Step 3: Verify turbo typecheck passes**

```bash
npx turbo typecheck --filter='!@danielsimonjr/mathts-wasm'
```

Expected: All packages pass.

- [ ] **Step 4: Commit**

```bash
git add parallel/tsconfig.json
git commit -m "fix(parallel): exclude workerpool .ts sources from typecheck"
```

---

### Task 4: Fix assembly/ WASM build (64 errors)

**Files:**
- Modify: `assembly/asconfig.json` (abort path)
- Modify: `assembly/src/types/complex.ts` (add 6 missing methods + prefix bare math calls)
- Modify: `assembly/src/ops/scalar.ts` (prefix bare math calls)
- Modify: `assembly/src/ops/array.ts` (prefix bare math calls)
- Modify: `assembly/src/ops/complex-array.ts` (prefix bare math calls)
- Modify: `assembly/src/ops/complex-ops.ts` (prefix bare math calls)
- Modify: `assembly/src/bindings/wasm-loader.ts` (prefix bare math calls)

There are three root causes:
1. `asconfig.json` uses `"abort=src/env/abort"` but asc resolves relative to entry root `src/`, so it should be `"abort=env/abort"`
2. AssemblyScript uses `Math.cos()` / `Mathf.cos()`, not bare `cos()` — 114 bare calls across 6 files
3. `Complex` class is missing 6 inverse trig methods: `asin`, `acos`, `atan`, `asinh`, `acosh`, `atanh`

- [ ] **Step 1: Fix abort path in asconfig.json**

Change `"use": "abort=src/env/abort"` to `"use": "abort=env/abort"`.

- [ ] **Step 2: Add Math. prefix to all bare math calls**

Run a script to do this across all 6 files. In AssemblyScript, `Math.cos` operates on `f64` which is what all these files use.

For each of these files, replace every bare `cos(`, `sin(`, `tan(`, `pow(`, `exp(`, `log(`, `log2(`, `log10(`, `log1p(`, `expm1(`, `acos(`, `asin(`, `atan(`, `atan2(` with `Math.cos(`, `Math.sin(`, etc. — but only when NOT already preceded by `Math.` or a word character.

```python
import re
from pathlib import Path

files = [
    'src/types/complex.ts',
    'src/ops/scalar.ts',
    'src/ops/array.ts',
    'src/ops/complex-array.ts',
    'src/ops/complex-ops.ts',
    'src/bindings/wasm-loader.ts',
]

fns = ['cos','sin','tan','pow','exp','log','log2','log10','log1p','expm1','acos','asin','atan','atan2']
pattern = r'(?<!Math\.)(?<!\w)(' + '|'.join(fns) + r')\s*\('

for fpath in files:
    p = Path(fpath)
    content = p.read_text(encoding='utf-8')
    new_content = re.sub(pattern, lambda m: f'Math.{m.group(1)}(', content)
    if new_content != content:
        p.write_text(new_content, encoding='utf-8')
        count = len(re.findall(pattern, content))
        print(f'{fpath}: fixed {count} bare math calls')
```

- [ ] **Step 3: Add 6 missing inverse trig methods to Complex class**

In `assembly/src/types/complex.ts`, add these methods to the `Complex` class. The formulas use the standard complex analysis definitions:

```typescript
  // z.asin() = -i * log(i*z + sqrt(1 - z*z))
  asin(): Complex {
    const iz = new Complex(-this.im, this.re); // i * z
    const z2 = this.mul(this);                  // z * z
    const one_minus_z2 = new Complex(1.0 - z2.re, -z2.im);
    const sqrt_val = one_minus_z2.sqrt();
    const sum = iz.add(sqrt_val);
    const log_val = sum.log();
    return new Complex(log_val.im, -log_val.re); // -i * log(...)
  }

  // z.acos() = -i * log(z + sqrt(z*z - 1))
  acos(): Complex {
    const z2 = this.mul(this);
    const z2_minus_1 = new Complex(z2.re - 1.0, z2.im);
    const sqrt_val = z2_minus_1.sqrt();
    const sum = this.add(sqrt_val);
    const log_val = sum.log();
    return new Complex(log_val.im, -log_val.re); // -i * log(...)
  }

  // z.atan() = (i/2) * log((i+z)/(i-z))
  atan(): Complex {
    const i_plus_z = new Complex(this.re, this.im + 1.0);  // (z + i)
    const i_minus_z = new Complex(-this.re, 1.0 - this.im); // (i - z)
    const ratio = i_plus_z.div(i_minus_z);
    const log_val = ratio.log();
    return new Complex(-log_val.im * 0.5, log_val.re * 0.5); // (i/2) * log(...)
  }

  // z.asinh() = log(z + sqrt(z*z + 1))
  asinh(): Complex {
    const z2 = this.mul(this);
    const z2_plus_1 = new Complex(z2.re + 1.0, z2.im);
    const sqrt_val = z2_plus_1.sqrt();
    const sum = this.add(sqrt_val);
    return sum.log();
  }

  // z.acosh() = log(z + sqrt(z*z - 1))
  acosh(): Complex {
    const z2 = this.mul(this);
    const z2_minus_1 = new Complex(z2.re - 1.0, z2.im);
    const sqrt_val = z2_minus_1.sqrt();
    const sum = this.add(sqrt_val);
    return sum.log();
  }

  // z.atanh() = 0.5 * log((1+z)/(1-z))
  atanh(): Complex {
    const one_plus_z = new Complex(1.0 + this.re, this.im);
    const one_minus_z = new Complex(1.0 - this.re, -this.im);
    const ratio = one_plus_z.div(one_minus_z);
    const log_val = ratio.log();
    return new Complex(log_val.re * 0.5, log_val.im * 0.5);
  }
```

- [ ] **Step 4: Also fix the TS2322 error in complex-ops.ts**

The error is `Type 'f64' is not assignable to type 'Complex'`. Check the function returning `f64` instead of `Complex` and wrap it.

- [ ] **Step 5: Verify WASM build passes**

```bash
cd assembly && npx asc src/index.ts --target debug 2>&1 | grep ERROR
```

Expected: No ERROR lines.

- [ ] **Step 6: Run full build**

```bash
cd assembly && npm run build
```

Expected: Both `asbuild` and `build:bindings` succeed. Files created in `build/`.

- [ ] **Step 7: Commit**

```bash
git add assembly/
git commit -m "fix(assembly): fix WASM build - Math. prefix, abort path, Complex inverse trig"
```

---

### Task 5: Fix expression/ package — make it build

**Files:**
- Modify: `expression/src/types.ts` (fix import)
- Create: `expression/tsconfig.json`
- Modify: `expression/package.json` (fix build script, add deps)

- [ ] **Step 1: Fix expression/src/types.ts import**

The file imports `TypedFunction` from `../core/function/typed.js` — a path that resolves into the synced mathjs code in `functions/src/core/`. Since `TypedFunctionConstructor` is already defined inline, and the `TypedFunction` type is a simple callable, define it locally instead of importing:

Replace:
```typescript
export type {
  TypedFunction
} from '../core/function/typed.js'
```

With:
```typescript
// Typed function type - a callable with metadata
export type TypedFunction = ((...args: any[]) => any) & {
  signatures: Record<string, (...args: any[]) => any>;
};
```

- [ ] **Step 2: Add expression/tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "strict": false,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

Using `strict: false` because the expression code was ported from mathjs JavaScript and has many implicit-any patterns.

- [ ] **Step 3: Check if tsc passes**

```bash
cd expression && npx tsc --noEmit 2>&1 | head -20
```

If there are errors, fix them. Expected issues: missing typed-function types, implicit any. The tsconfig's `strict: false` should handle most.

- [ ] **Step 4: Fix build script in package.json**

Change `"build": "echo 'Skipping build - expression package is incomplete'"` to:
```json
"build": "tsup src/index.ts --format esm --dts --clean"
```

Add `@danielsimonjr/mathts-core` dependency and `tsup` devDependency if missing.

- [ ] **Step 5: Verify build succeeds**

```bash
cd expression && npm run build
```

Expected: `dist/index.js` and `dist/index.d.ts` created.

- [ ] **Step 6: Verify turbo build passes**

```bash
npx turbo build --filter='!@danielsimonjr/mathts-wasm'
```

Expected: All packages build including expression.

- [ ] **Step 7: Commit**

```bash
git add expression/
git commit -m "fix(expression): enable build - fix types import, add tsconfig, restore build script"
```

---

### Task 6: Update CLAUDE.md known issues

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Remove fixed known issues**

Remove these from the Known Issues section:
- `expression/` build is skipped (now builds)
- `assembly/` WASM build fails (now builds)
- Some packages may need `npm i -D @types/node` (now all have it)

- [ ] **Step 2: Update expression/ section**

Change the Package Build Details to note expression now builds with `tsup src/index.ts --format esm --dts --clean` like other packages.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md - remove fixed known issues"
```

---

### Task 7: Final verification — full build + typecheck + test

- [ ] **Step 1: Full build (all packages)**

```bash
npx turbo build
```

Expected: ALL packages build (including wasm and expression). 0 failures.

- [ ] **Step 2: Full typecheck**

```bash
npx turbo typecheck
```

Expected: All packages with typecheck scripts pass. 0 failures.

- [ ] **Step 3: Full test suite**

```bash
npx vitest run
```

Expected: 51+ test files, 1342+ tests pass.

- [ ] **Step 4: Per-package test verification**

```bash
npx turbo test
```

Expected: All packages with tests pass (functions, parallel, workbook now find tests via local vitest config).
