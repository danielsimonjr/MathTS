# @danielsimonjr/mathts-compat - Dependency Graph

**Version**: 0.1.2 | **Last Updated**: 2026-04-10

This document provides a comprehensive dependency graph of all files, components, imports, functions, and variables in the codebase.

---

## Table of Contents

1. [Overview](#overview)
2. [Package Dependencies](#package-dependencies)
3. [Root Dependencies](#root-dependencies)
4. [Entry Dependencies](#entry-dependencies)
5. [Dependency Matrix](#dependency-matrix)
6. [Circular Dependency Analysis](#circular-dependency-analysis)
7. [Visual Dependency Graph](#visual-dependency-graph)
8. [Summary Statistics](#summary-statistics)

---

<a id="overview"></a>
## Overview

The codebase is organized into the following modules:

- **root**: 2 files
- **entry**: 1 file

---

<a id="root-dependencies"></a>

## Root Dependencies

### `src/functions.d.ts` - Type declarations for @danielsimonjr/mathts-functions

**External Dependencies:**
| Package | Import |
|---------|--------|
| `@danielsimonjr/mathts-core` | `Complex, Fraction, BigNumber` |

**Exports:**
- Functions: `add`, `add`, `add`, `add`, `add`, `subtract`, `subtract`, `subtract`, `subtract`, `subtract`, `multiply`, `multiply`, `multiply`, `multiply`, `multiply`, `divide`, `divide`, `divide`, `divide`, `divide`, `pow`, `pow`, `pow`, `pow`, `sqrt`, `sqrt`, `sqrt`, `abs`, `abs`, `abs`, `exp`, `exp`, `exp`, `log`, `log`, `log`, `sin`, `sin`, `sin`, `cos`, `cos`, `cos`, `tan`, `tan`, `tan`, `sum`, `mean`, `min`, `max`, `gcd`, `lcm`, `round`, `floor`, `ceil`

---

### `src/shims.ts` - mathjs Compatibility Shims

**External Dependencies:**
| Package | Import |
|---------|--------|
| `@danielsimonjr/mathts-core` | `Complex, Fraction, BigNumber, I, COMPLEX_ZERO, isComplex, isFraction, isBigNumber, isNumber` |
| `@danielsimonjr/mathts-functions` | `add, subtract, multiply, divide, pow, sqrt, abs, exp, log, sin, cos, tan, sum, mean, min, max, gcd, lcm, round, floor, ceil` |
| `@danielsimonjr/mathts-matrix` | `DenseMatrix, SparseMatrix` |

**Exports:**
- Functions: `complex`, `fraction`, `bignumber`, `matrix`, `sparse`, `asin`, `acos`, `atan`, `atan2`, `conj`, `re`, `im`, `arg`, `transpose`, `det`, `identity`, `zeros`, `ones`, `size`, `isComplex_`, `isFraction_`, `isBigNumber_`, `isNumber_`, `isMatrix`
- Constants: `add`, `subtract`, `multiply`, `divide`, `pow`, `sqrt`, `abs`, `exp`, `log`, `sin`, `cos`, `tan`, `sum`, `mean`, `min`, `max`, `gcd`, `lcm`, `round`, `floor`, `ceil`, `i`, `pi`, `e`, `phi`, `tau`, `LN2`, `LN10`, `LOG2E`, `LOG10E`, `SQRT2`, `SQRT1_2`, `Infinity_`, `NaN_`, `shims`

---

<a id="entry-dependencies"></a>

## Entry Dependencies

### `src/index.ts` - mathjs Compatibility Layer

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./shims.js` | `shims` | Import |
| `./shims.js` | `*` | Re-export |
| `@danielsimonjr/mathts-core` | `Complex, Fraction, BigNumber, I, COMPLEX_ZERO, COMPLEX_ONE, FRACTION_ZERO, FRACTION_ONE, BIGNUMBER_ZERO, BIGNUMBER_ONE, BIGNUMBER_PI, BIGNUMBER_E` | Re-export |
| `@danielsimonjr/mathts-matrix` | `DenseMatrix, SparseMatrix` | Re-export |
| `@danielsimonjr/mathts-parallel` | `computePool` | Re-export |

**Exports:**
- Interfaces: `MathJSConfig`, `MathInstance`
- Functions: `create`
- Constants: `all`
- Re-exports: `* from ./shims.js`, `Complex`, `Fraction`, `BigNumber`, `I`, `COMPLEX_ZERO`, `COMPLEX_ONE`, `FRACTION_ZERO`, `FRACTION_ONE`, `BIGNUMBER_ZERO`, `BIGNUMBER_ONE`, `BIGNUMBER_PI`, `BIGNUMBER_E`, `DenseMatrix`, `SparseMatrix`, `computePool`

---

<a id="dependency-matrix"></a>
## Dependency Matrix

### File Import/Export Matrix

| File | Imports From | Exports To |
|------|--------------|------------|
| `src/index` | 4 files | 0 files |
| `src/shims` | 0 files | 1 file |
| `src/functions.d` | 0 files | 0 files |

---

<a id="circular-dependency-analysis"></a>
## Circular Dependency Analysis

**No circular dependencies detected.**
---

<a id="visual-dependency-graph"></a>
## Visual Dependency Graph

```mermaid
graph TD
    subgraph Root
        N0[functions.d]
        N1[shims]
    end

    subgraph Entry
        N2[index]
    end

    N2 --> N1
```

---

<a id="summary-statistics"></a>
## Summary Statistics

| Category | Count |
|----------|-------|
| Total TypeScript Files | 3 |
| Total Modules | 2 |
| Total Lines of Code | 883 |
| Total Exports | 97 |
| Total Re-exports | 16 |
| Total Classes | 0 |
| Total Interfaces | 2 |
| Total Functions | 79 |
| Total Type Guards | 5 |
| Total Enums | 0 |
| Type-only Imports | 0 |
| Runtime Circular Deps | 0 |
| Type-only Circular Deps | 0 |

---

*Last Updated*: 2026-04-10
*Version*: 0.1.2
