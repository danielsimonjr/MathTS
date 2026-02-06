# @mathts/functions - Dependency Graph

**Version**: 0.1.0 | **Last Updated**: 2026-02-06

This document provides a comprehensive dependency graph of all files, components, imports, functions, and variables in the codebase.

---

## Table of Contents

1. [Overview](#overview)
2. [Algebra Dependencies](#algebra-dependencies)
3. [Arithmetic Dependencies](#arithmetic-dependencies)
4. [Bitwise Dependencies](#bitwise-dependencies)
5. [Combinatorics Dependencies](#combinatorics-dependencies)
6. [Complex Dependencies](#complex-dependencies)
7. [Core Dependencies](#core-dependencies)
8. [Error Dependencies](#error-dependencies)
9. [Expression Dependencies](#expression-dependencies)
10. [Geometry Dependencies](#geometry-dependencies)
11. [Entry Dependencies](#entry-dependencies)
12. [Logical Dependencies](#logical-dependencies)
13. [Matrix Dependencies](#matrix-dependencies)
14. [Numeric Dependencies](#numeric-dependencies)
15. [Plain Dependencies](#plain-dependencies)
16. [Probability Dependencies](#probability-dependencies)
17. [Relational Dependencies](#relational-dependencies)
18. [Set Dependencies](#set-dependencies)
19. [Signal Dependencies](#signal-dependencies)
20. [Special Dependencies](#special-dependencies)
21. [Statistics Dependencies](#statistics-dependencies)
22. [String Dependencies](#string-dependencies)
23. [Trigonometry Dependencies](#trigonometry-dependencies)
24. [Type Dependencies](#type-dependencies)
25. [Typed Dependencies](#typed-dependencies)
26. [Unit Dependencies](#unit-dependencies)
27. [Utils Dependencies](#utils-dependencies)
28. [Wasm Dependencies](#wasm-dependencies)
29. [Dependency Matrix](#dependency-matrix)
30. [Circular Dependency Analysis](#circular-dependency-analysis)
31. [Visual Dependency Graph](#visual-dependency-graph)
32. [Summary Statistics](#summary-statistics)

---

## Overview

The codebase is organized into the following modules:

- **algebra**: 45 files
- **arithmetic**: 40 files
- **bitwise**: 8 files
- **combinatorics**: 4 files
- **complex**: 4 files
- **core**: 5 files
- **error**: 3 files
- **expression**: 314 files
- **geometry**: 2 files
- **entry**: 1 file
- **logical**: 5 files
- **matrix**: 44 files
- **numeric**: 1 file
- **plain**: 12 files
- **probability**: 14 files
- **relational**: 13 files
- **set**: 10 files
- **signal**: 5 files
- **special**: 2 files
- **statistics**: 14 files
- **string**: 5 files
- **trigonometry**: 26 files
- **type**: 50 files
- **typed**: 5 files
- **unit**: 2 files
- **utils**: 43 files
- **wasm**: 62 files

---

## Algebra Dependencies

### `src/algebra/decomposition/lup.ts` - Check if a 2D array contains only plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/object.js` | `clone` | Import |
| `../../utils/factory.js` | `factory` | Import |
| `../../wasm/WasmLoader.js` | `wasmLoader` | Import |

**Exports:**
- Constants: `createLup`

---

### `src/algebra/decomposition/qr.ts` - Check if a 2D array contains only plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.js` | `factory` | Import |
| `../../wasm/WasmLoader.js` | `wasmLoader` | Import |

**Exports:**
- Constants: `createQr`

---

### `src/algebra/decomposition/schur.ts` - Check if a 2D array contains only plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.js` | `factory` | Import |
| `../../wasm/WasmLoader.js` | `wasmLoader` | Import |

**Exports:**
- Constants: `createSchur`

---

### `src/algebra/decomposition/slu.ts` - Calculate the Sparse Matrix LU decomposition with full pivoting. Sparse Matrix `A` is decomposed in two matrices (`L`, `U`) and two permutation vectors (`pinv`, `q`) where

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/number.js` | `isInteger` | Import |
| `../../utils/factory.js` | `factory` | Import |
| `../sparse/csSqr.js` | `createCsSqr` | Import |
| `../sparse/csLu.js` | `createCsLu` | Import |

**Exports:**
- Constants: `createSlu`

---

### `src/algebra/derivative.ts` - Takes the derivative of an expression expressed in parser Nodes.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isConstantNode, typeOf` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/number.js` | `safeNumberType` | Import |
| `../utils/node.js` | `MathNode, ConstantNode, SymbolNode, ParenthesisNode, FunctionNode, OperatorNode, FunctionAssignmentNode` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createDerivative`

---

### `src/algebra/leafCount.ts` - Gives the number of "leaf nodes" in the parse tree of the given expression

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/node.js` | `MathNode` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createLeafCount`

---

### `src/algebra/lyap.ts` - Solves the Continuous-time Lyapunov equation AP+PA'+Q=0 for P, where

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createLyap`

---

### `src/algebra/polynomialRoot.ts` - Finds the numerical values of the distinct roots of a polynomial with real or complex coefficients.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createPolynomialRoot`

---

### `src/algebra/rationalize.ts` - Transform a rationalizable expression in a rational fraction.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/number.js` | `isInteger` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/node.js` | `MathNode, ConstantNode, SymbolNode, OperatorNode, ParenthesisNode` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createRationalize`

---

### `src/algebra/resolve.ts` - resolve(expr, scope) replaces variable nodes with their scoped values

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/map.js` | `createMap` | Import |
| `../utils/is.js` | `isFunctionNode, isNode, isOperatorNode, isParenthesisNode, isSymbolNode` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/node.js` | `MathNode` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createResolve`

---

### `src/algebra/simplify/util.ts` - Merge the given contexts, with primary overriding secondary

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.js` | `isFunctionNode, isOperatorNode, isParenthesisNode` | Import |
| `../../utils/factory.js` | `factory` | Import |
| `../../utils/object.js` | `hasOwnProperty` | Import |
| `../../utils/node.js` | `MathNode, FunctionNode, OperatorNode` | Import (type-only) |

**Exports:**
- Constants: `createUtil`

---

### `src/algebra/simplify/wildcards.ts` - wildcards module

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.js` | `isConstantNode, isFunctionNode, isOperatorNode, isParenthesisNode` | Import |
| `../../utils/node.js` | `MathNode` | Import (type-only) |
| `../../utils/is.js` | `isConstantNode, isSymbolNode` | Re-export |

**Exports:**
- Functions: `isNumericNode`, `isConstantExpression`
- Re-exports: `isConstantNode`, `isSymbolNode`

---

### `src/algebra/simplify.ts` - Simplify an expression tree.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isParenthesisNode` | Import |
| `./simplify/wildcards.js` | `isConstantNode, isVariableNode, isNumericNode, isConstantExpression` | Import |
| `../utils/factory.js` | `factory` | Import |
| `./simplify/util.js` | `createUtil` | Import |
| `../utils/object.js` | `hasOwnProperty` | Import |
| `../utils/map.js` | `createEmptyMap, createMap` | Import |
| `../utils/node.js` | `MathNode, SymbolNode, ConstantNode, OperatorNode, ParenthesisNode, ArrayNode, AccessorNode, IndexNode, ObjectNode` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createSimplify`

---

### `src/algebra/simplifyConstant.ts` - simplifyConstant() takes a mathjs expression (either a Node representing

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isFraction, isMatrix, isNode, isArrayNode, isConstantNode, isIndexNode, isObjectNode, isOperatorNode` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/number.js` | `safeNumberType` | Import |
| `./simplify/util.js` | `createUtil` | Import |
| `../utils/noop.js` | `noBignumber, noFraction` | Import |
| `../utils/node.js` | `MathNode, ConstantNode, ArrayNode, AccessorNode, IndexNode, ObjectNode, OperatorNode, FunctionNode, ParenthesisNode` | Import (type-only) |

**Exports:**
- Constants: `createSimplifyConstant`

---

### `src/algebra/simplifyCore.ts` - simplifyCore() performs single pass simplification suitable for

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isAccessorNode, isArrayNode, isConstantNode, isFunctionNode, isIndexNode, isObjectNode, isOperatorNode` | Import |
| `../expression/operators.js` | `getOperator` | Import |
| `./simplify/util.js` | `createUtil` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/node.js` | `MathNode` | Import (type-only) |

**Exports:**
- Constants: `createSimplifyCore`

---

### `src/algebra/solver/lsolve.ts` - Check if a 2D array contains only plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.js` | `factory` | Import |
| `./utils/solveValidation.js` | `createSolveValidation` | Import |
| `../../wasm/WasmLoader.js` | `wasmLoader` | Import |

**Exports:**
- Constants: `createLsolve`

---

### `src/algebra/solver/lsolveAll.ts` - Finds all solutions of a linear equation system by forwards substitution. Matrix must be a lower triangular matrix.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.js` | `factory` | Import |
| `./utils/solveValidation.js` | `createSolveValidation` | Import |

**Exports:**
- Constants: `createLsolveAll`

---

### `src/algebra/solver/lusolve.ts` - Check if a 2D array contains only plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.js` | `isArray, isMatrix` | Import |
| `../../utils/factory.js` | `factory` | Import |
| `./utils/solveValidation.js` | `createSolveValidation` | Import |
| `../sparse/csIpvec.js` | `csIpvec` | Import |
| `../../wasm/WasmLoader.js` | `wasmLoader` | Import |

**Exports:**
- Constants: `createLusolve`

---

### `src/algebra/solver/usolve.ts` - Check if a 2D array contains only plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.js` | `factory` | Import |
| `./utils/solveValidation.js` | `createSolveValidation` | Import |
| `../../wasm/WasmLoader.js` | `wasmLoader` | Import |

**Exports:**
- Constants: `createUsolve`

---

### `src/algebra/solver/usolveAll.ts` - Finds all solutions of a linear equation system by backward substitution. Matrix must be an upper triangular matrix.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.js` | `factory` | Import |
| `./utils/solveValidation.js` | `createSolveValidation` | Import |

**Exports:**
- Constants: `createUsolveAll`

---

### `src/algebra/solver/utils/solveValidation.ts` - Validates matrix and column vector b for backward/forward substitution algorithms.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/is.js` | `isArray, isMatrix, isDenseMatrix, isSparseMatrix` | Import |
| `../../../utils/array.js` | `arraySize` | Import |
| `../../../utils/string.js` | `format` | Import |

**Exports:**
- Functions: `createSolveValidation`

---

### `src/algebra/sparse/csAmd.ts` - Approximate minimum degree ordering. The minimum degree algorithm is a widely used

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.js` | `factory` | Import |
| `./csFkeep.js` | `csFkeep` | Import |
| `./csFlip.js` | `csFlip` | Import |
| `./csTdfs.js` | `csTdfs` | Import |
| `../../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCsAmd`

---

### `src/algebra/sparse/csChol.ts` - Computes the Cholesky factorization of matrix A. It computes L and P so

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.js` | `factory` | Import |
| `./csEreach.js` | `csEreach` | Import |
| `./csSymperm.js` | `createCsSymperm` | Import |
| `../../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCsChol`

---

### `src/algebra/sparse/csCounts.ts` - Computes the column counts using the upper triangular part of A.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.js` | `factory` | Import |
| `./csLeaf.js` | `csLeaf` | Import |
| `../../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCsCounts`

---

### `src/algebra/sparse/csCumsum.ts` - It sets the p[i] equal to the sum of c[0] through c[i-1].

**Exports:**
- Functions: `csCumsum`

---

### `src/algebra/sparse/csDfs.ts` - Depth-first search computes the nonzero pattern xi of the directed graph G (Matrix) starting

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./csMarked.js` | `csMarked` | Import |
| `./csMark.js` | `csMark` | Import |
| `./csUnflip.js` | `csUnflip` | Import |

**Exports:**
- Functions: `csDfs`

---

### `src/algebra/sparse/csEreach.ts` - Find nonzero pattern of Cholesky L(k,1:k-1) using etree and triu(A(:,k))

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./csMark.js` | `csMark` | Import |
| `./csMarked.js` | `csMarked` | Import |

**Exports:**
- Functions: `csEreach`

---

### `src/algebra/sparse/csEtree.ts` - Computes the elimination tree of Matrix A (using triu(A)) or the

**Exports:**
- Functions: `csEtree`

---

### `src/algebra/sparse/csFkeep.ts` - Keeps entries in the matrix when the callback function returns true, removes the entry otherwise

**Exports:**
- Functions: `csFkeep`

---

### `src/algebra/sparse/csFlip.ts` - This function "flips" its input about the integer -1.

**Exports:**
- Functions: `csFlip`

---

### `src/algebra/sparse/csIpvec.ts` - Permutes a vector; x = P'b. In MATLAB notation, x(p)=b.

**Exports:**
- Functions: `csIpvec`

---

### `src/algebra/sparse/csLeaf.ts` - This function determines if j is a leaf of the ith row subtree.

**Exports:**
- Functions: `csLeaf`

---

### `src/algebra/sparse/csLu.ts` - Computes the numeric LU factorization of the sparse matrix A. Implements a Left-looking LU factorization

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.js` | `factory` | Import |
| `./csSpsolve.js` | `createCsSpsolve` | Import |
| `../../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCsLu`

---

### `src/algebra/sparse/csMark.ts` - Marks the node at w[j]

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./csFlip.js` | `csFlip` | Import |

**Exports:**
- Functions: `csMark`

---

### `src/algebra/sparse/csMarked.ts` - Checks if the node at w[j] is marked

**Exports:**
- Functions: `csMarked`

---

### `src/algebra/sparse/csPermute.ts` - Permutes a sparse matrix C = P * A * Q

**Exports:**
- Functions: `csPermute`

---

### `src/algebra/sparse/csPost.ts` - Post order a tree of forest

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./csTdfs.js` | `csTdfs` | Import |

**Exports:**
- Functions: `csPost`

---

### `src/algebra/sparse/csReach.ts` - The csReach function computes X = Reach(B), where B is the nonzero pattern of the n-by-1

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./csMarked.js` | `csMarked` | Import |
| `./csMark.js` | `csMark` | Import |
| `./csDfs.js` | `csDfs` | Import |

**Exports:**
- Functions: `csReach`

---

### `src/algebra/sparse/csSpsolve.ts` - The function csSpsolve() computes the solution to G * x = bk, where bk is the

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./csReach.js` | `csReach` | Import |
| `../../utils/factory.js` | `factory` | Import |
| `../../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCsSpsolve`

---

### `src/algebra/sparse/csSqr.ts` - Symbolic ordering and analysis for QR and LU decompositions.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./csPermute.js` | `csPermute` | Import |
| `./csPost.js` | `csPost` | Import |
| `./csEtree.js` | `csEtree` | Import |
| `./csAmd.js` | `createCsAmd` | Import |
| `./csCounts.js` | `createCsCounts` | Import |
| `../../utils/factory.js` | `factory` | Import |
| `../../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCsSqr`

---

### `src/algebra/sparse/csSymperm.ts` - Computes the symmetric permutation of matrix A accessing only

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./csCumsum.js` | `csCumsum` | Import |
| `../../utils/factory.js` | `factory` | Import |
| `../../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCsSymperm`

---

### `src/algebra/sparse/csTdfs.ts` - Depth-first search and postorder of a tree rooted at node j

**Exports:**
- Functions: `csTdfs`

---

### `src/algebra/sparse/csUnflip.ts` - Flips the value if it is negative of returns the same value otherwise.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./csFlip.js` | `csFlip` | Import |

**Exports:**
- Functions: `csUnflip`

---

### `src/algebra/sylvester.ts` - Solves the real-valued Sylvester equation AX+XB=C for X, where A, B and C are

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createSylvester`

---

### `src/algebra/symbolicEqual.ts` - Attempts to determine if two expressions are symbolically equal, i.e.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isConstantNode` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/node.js` | `MathNode` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createSymbolicEqual`

---

## Arithmetic Dependencies

### `src/arithmetic/abs.ts` - Calculate the absolute value of a number. For matrices, the function is

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/collection.js` | `deepMap` | Import |
| `../plain/number/index.js` | `absNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createAbs`

---

### `src/arithmetic/add.ts` - Add two or more values, `x + y`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matAlgo01xDSid.js` | `createMatAlgo01xDSid` | Import |
| `../type/matrix/utils/matAlgo04xSidSid.js` | `createMatAlgo04xSidSid` | Import |
| `../type/matrix/utils/matAlgo10xSids.js` | `createMatAlgo10xSids` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |

**Exports:**
- Constants: `createAdd`

---

### `src/arithmetic/addScalar.ts` - Add two scalar values, `x + y`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../plain/number/index.js` | `addNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createAddScalar`

---

### `src/arithmetic/cbrt.ts` - Calculate the cubic root of a value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/is.js` | `isBigNumber, isComplex, isFraction` | Import |
| `../plain/number/index.js` | `cbrtNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `MathJsConfig` | Import (type-only) |

**Exports:**
- Constants: `createCbrt`

---

### `src/arithmetic/ceil.ts` - Round a value towards plus infinity

**External Dependencies:**
| Package | Import |
|---------|--------|
| `decimal.js` | `Decimal` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/number.js` | `isInteger, nearlyEqual` | Import |
| `../utils/bignumber/nearlyEqual.js` | `nearlyEqual` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matAlgo14xDs.js` | `createMatAlgo14xDs` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createCeilNumber`, `createCeil`

---

### `src/arithmetic/cube.ts` - Compute the cube of a value, `x * x * x`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../plain/number/index.js` | `cubeNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCube`

---

### `src/arithmetic/divide.ts` - Divide two values, `x / y`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/object.js` | `extend` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matAlgo14xDs.js` | `createMatAlgo14xDs` | Import |

**Exports:**
- Constants: `createDivide`

---

### `src/arithmetic/divideScalar.ts` - Divide two scalar values, `x / y`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createDivideScalar`

---

### `src/arithmetic/dotDivide.ts` - Divide two matrices element wise. The function accepts both matrices and

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../type/matrix/utils/matAlgo02xDS0.js` | `createMatAlgo02xDS0` | Import |
| `../type/matrix/utils/matAlgo03xDSf.js` | `createMatAlgo03xDSf` | Import |
| `../type/matrix/utils/matAlgo07xSSf.js` | `createMatAlgo07xSSf` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |

**Exports:**
- Constants: `createDotDivide`

---

### `src/arithmetic/dotMultiply.ts` - Multiply two matrices element wise. The function accepts both matrices and

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../type/matrix/utils/matAlgo02xDS0.js` | `createMatAlgo02xDS0` | Import |
| `../type/matrix/utils/matAlgo09xS0Sf.js` | `createMatAlgo09xS0Sf` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |

**Exports:**
- Constants: `createDotMultiply`

---

### `src/arithmetic/dotPow.ts` - Calculates the power of x to y element wise.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../type/matrix/utils/matAlgo03xDSf.js` | `createMatAlgo03xDSf` | Import |
| `../type/matrix/utils/matAlgo07xSSf.js` | `createMatAlgo07xSSf` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |

**Exports:**
- Constants: `createDotPow`

---

### `src/arithmetic/exp.ts` - Calculate the exponential of a value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../plain/number/index.js` | `expNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createExp`

---

### `src/arithmetic/expm1.ts` - Calculate the value of subtracting 1 from the exponential value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../plain/number/index.js` | `expm1Number` | Import |

**Exports:**
- Constants: `createExpm1`

---

### `src/arithmetic/fix.ts` - Round a value towards zero.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/collection.js` | `deepMap` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matAlgo14xDs.js` | `createMatAlgo14xDs` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createFixNumber`, `createFix`

---

### `src/arithmetic/floor.ts` - Round a value towards minus infinity.

**External Dependencies:**
| Package | Import |
|---------|--------|
| `decimal.js` | `Decimal` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/number.js` | `isInteger, nearlyEqual` | Import |
| `../utils/bignumber/nearlyEqual.js` | `nearlyEqual` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matAlgo14xDs.js` | `createMatAlgo14xDs` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createFloorNumber`, `createFloor`

---

### `src/arithmetic/gcd.ts` - Calculate the greatest common divisor for two or more values or arrays.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/number.js` | `isInteger` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |
| `./mod.js` | `createMod` | Import |
| `../type/matrix/utils/matAlgo01xDSid.js` | `createMatAlgo01xDSid` | Import |
| `../type/matrix/utils/matAlgo04xSidSid.js` | `createMatAlgo04xSidSid` | Import |
| `../type/matrix/utils/matAlgo10xSids.js` | `createMatAlgo10xSids` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `../error/ArgumentsError.js` | `ArgumentsError` | Import |

**Exports:**
- Constants: `createGcd`

---

### `src/arithmetic/hypot.ts` - Calculate the hypotenuse of a list with values. The hypotenuse is defined as:

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../utils/array.js` | `flatten` | Import |
| `../utils/is.js` | `isComplex` | Import |

**Exports:**
- Constants: `createHypot`

---

### `src/arithmetic/invmod.ts` - Calculate the (modular) multiplicative inverse of a modulo b. Solution to the equation `ax ≣ 1 (mod b)`

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createInvmod`

---

### `src/arithmetic/lcm.ts` - Calculate the least common multiple for two or more values or arrays.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../type/matrix/utils/matAlgo02xDS0.js` | `createMatAlgo02xDS0` | Import |
| `../type/matrix/utils/matAlgo06xS0S0.js` | `createMatAlgo06xS0S0` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `../plain/number/index.js` | `lcmNumber` | Import |

**Exports:**
- Constants: `createLcm`

---

### `src/arithmetic/log.ts` - Calculate the logarithm of a value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `MathJsConfig` | Import (type-only) |
| `../utils/bigint.js` | `promoteLogarithm` | Import |
| `../plain/number/index.js` | `logNumber` | Import |

**Exports:**
- Constants: `createLog`

---

### `src/arithmetic/log10.ts` - Calculate the 10-base logarithm of a value. This is the same as calculating `log(x, 10)`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../plain/number/index.js` | `log10Number` | Import |
| `../utils/bigint.js` | `promoteLogarithm` | Import |
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `MathJsConfig` | Import (type-only) |

**Exports:**
- Constants: `createLog10`

---

### `src/arithmetic/log1p.ts` - Calculate the logarithm of a `value+1`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `MathJsConfig` | Import (type-only) |
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/number.js` | `log1p` | Import |

**Exports:**
- Constants: `createLog1p`

---

### `src/arithmetic/log2.ts` - Calculate the 2-base of a value. This is the same as calculating `log(x, 2)`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../plain/number/index.js` | `log2Number` | Import |
| `../utils/bigint.js` | `promoteLogarithm` | Import |
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `MathJsConfig` | Import (type-only) |

**Exports:**
- Constants: `createLog2`

---

### `src/arithmetic/mod.ts` - Calculates the modulus, the remainder of an integer division.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `./floor.js` | `createFloor` | Import |
| `../type/matrix/utils/matAlgo02xDS0.js` | `createMatAlgo02xDS0` | Import |
| `../type/matrix/utils/matAlgo03xDSf.js` | `createMatAlgo03xDSf` | Import |
| `../type/matrix/utils/matAlgo05xSfSf.js` | `createMatAlgo05xSfSf` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createMod`

---

### `src/arithmetic/multiply.ts` - Validates matrix dimensions for multiplication

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/is.js` | `isMatrix` | Import |
| `../utils/array.js` | `arraySize` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matAlgo14xDs.js` | `createMatAlgo14xDs` | Import |

**Exports:**
- Constants: `createMultiply`

---

### `src/arithmetic/multiplyScalar.ts` - Multiply two scalar values, `x * y`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../plain/number/index.js` | `multiplyNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createMultiplyScalar`

---

### `src/arithmetic/norm.ts` - Calculate the norm of a number, vector or matrix.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createNorm`

---

### `src/arithmetic/nthRoot.ts` - Calculate the nth root of a value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../type/matrix/utils/matAlgo01xDSid.js` | `createMatAlgo01xDSid` | Import |
| `../type/matrix/utils/matAlgo02xDS0.js` | `createMatAlgo02xDS0` | Import |
| `../type/matrix/utils/matAlgo06xS0S0.js` | `createMatAlgo06xS0S0` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `../plain/number/index.js` | `nthRootNumber` | Import |

**Exports:**
- Constants: `createNthRoot`, `createNthRootNumber`

---

### `src/arithmetic/nthRoots.ts` - Each function here returns a real multiple of i as a Complex value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `MathJsConfig` | Import (type-only) |

**Exports:**
- Constants: `createNthRoots`

---

### `src/arithmetic/pow.ts` - Calculates the power of x to y, `x ^ y`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/number.js` | `isInteger` | Import |
| `../utils/array.js` | `arraySize` | Import |
| `../plain/number/index.js` | `powNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createPow`

---

### `src/arithmetic/round.ts` - Round a value towards the nearest rounded value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/number.js` | `nearlyEqual, splitNumber` | Import |
| `../utils/bignumber/nearlyEqual.js` | `nearlyEqual` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matAlgo14xDs.js` | `createMatAlgo14xDs` | Import |
| `../plain/number/index.js` | `roundNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createRound`

---

### `src/arithmetic/sign.ts` - Compute the sign of a value. The sign of a value x is:

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/collection.js` | `deepMap` | Import |
| `../plain/number/index.js` | `signNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createSign`

---

### `src/arithmetic/sqrt.ts` - Calculate the square root of a value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createSqrt`

---

### `src/arithmetic/square.ts` - Compute the square of a value, `x * x`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../plain/number/index.js` | `squareNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createSquare`

---

### `src/arithmetic/subtract.ts` - Subtract two values, `x - y`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../type/matrix/utils/matAlgo01xDSid.js` | `createMatAlgo01xDSid` | Import |
| `../type/matrix/utils/matAlgo03xDSf.js` | `createMatAlgo03xDSf` | Import |
| `../type/matrix/utils/matAlgo05xSfSf.js` | `createMatAlgo05xSfSf` | Import |
| `../type/matrix/utils/matAlgo10xSids.js` | `createMatAlgo10xSids` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |

**Exports:**
- Constants: `createSubtract`

---

### `src/arithmetic/subtractScalar.ts` - Subtract two scalar values, `x - y`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../plain/number/index.js` | `subtractNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createSubtractScalar`

---

### `src/arithmetic/unaryMinus.ts` - Inverse the sign of a value, apply a unary minus operation.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/collection.js` | `deepMap` | Import |
| `../plain/number/index.js` | `unaryMinusNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createUnaryMinus`

---

### `src/arithmetic/unaryPlus.ts` - Unary plus operation.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/collection.js` | `deepMap` | Import |
| `../plain/number/index.js` | `unaryPlusNumber` | Import |
| `../utils/number.js` | `safeNumberType` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createUnaryPlus`

---

### `src/arithmetic/utils/nodeOperations.ts` - Node Operations Utility Module

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.js` | `factory` | Import |
| `../../utils/is.js` | `isNode` | Import |

**Exports:**
- Constants: `name`, `dependencies`, `createNodeOperations`

---

### `src/arithmetic/xgcd.ts` - Calculate the extended greatest common divisor for two values.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |
| `../plain/number/index.js` | `xgcdNumber` | Import |

**Exports:**
- Constants: `createXgcd`

---

## Bitwise Dependencies

### `src/bitwise/bitAnd.ts` - Bitwise AND two values, `x & y`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/bignumber/bitwise.js` | `bitAndBigNumber` | Import |
| `../type/matrix/utils/matAlgo02xDS0.js` | `createMatAlgo02xDS0` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matAlgo06xS0S0.js` | `createMatAlgo06xS0S0` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `../plain/number/index.js` | `bitAndNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createBitAnd`

---

### `src/bitwise/bitNot.ts` - Bitwise NOT value, `~x`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/bignumber/bitwise.js` | `bitNotBigNumber` | Import |
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../plain/number/index.js` | `bitNotNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createBitNot`

---

### `src/bitwise/bitOr.ts` - Bitwise OR two values, `x | y`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/bignumber/bitwise.js` | `bitOrBigNumber` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matAlgo10xSids.js` | `createMatAlgo10xSids` | Import |
| `../type/matrix/utils/matAlgo04xSidSid.js` | `createMatAlgo04xSidSid` | Import |
| `../type/matrix/utils/matAlgo01xDSid.js` | `createMatAlgo01xDSid` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `../plain/number/index.js` | `bitOrNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createBitOr`

---

### `src/bitwise/bitXor.ts` - Bitwise XOR two values, `x ^ y`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/bignumber/bitwise.js` | `bitXor` | Import |
| `../type/matrix/utils/matAlgo03xDSf.js` | `createMatAlgo03xDSf` | Import |
| `../type/matrix/utils/matAlgo07xSSf.js` | `createMatAlgo07xSSf` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `../plain/number/index.js` | `bitXorNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createBitXor`

---

### `src/bitwise/leftShift.ts` - Bitwise left logical shift of a value x by y number of bits, `x << y`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../type/matrix/utils/matAlgo02xDS0.js` | `createMatAlgo02xDS0` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matAlgo14xDs.js` | `createMatAlgo14xDs` | Import |
| `../type/matrix/utils/matAlgo01xDSid.js` | `createMatAlgo01xDSid` | Import |
| `../type/matrix/utils/matAlgo10xSids.js` | `createMatAlgo10xSids` | Import |
| `../type/matrix/utils/matAlgo08xS0Sid.js` | `createMatAlgo08xS0Sid` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `./useMatrixForArrayScalar.js` | `createUseMatrixForArrayScalar` | Import |
| `../plain/number/index.js` | `leftShiftNumber` | Import |
| `../utils/bignumber/bitwise.js` | `leftShiftBigNumber` | Import |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createLeftShift`

---

### `src/bitwise/rightArithShift.ts` - Bitwise right arithmetic shift of a value x by y number of bits, `x >> y`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/bignumber/bitwise.js` | `rightArithShiftBigNumber` | Import |
| `../type/matrix/utils/matAlgo02xDS0.js` | `createMatAlgo02xDS0` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matAlgo14xDs.js` | `createMatAlgo14xDs` | Import |
| `../type/matrix/utils/matAlgo01xDSid.js` | `createMatAlgo01xDSid` | Import |
| `../type/matrix/utils/matAlgo10xSids.js` | `createMatAlgo10xSids` | Import |
| `../type/matrix/utils/matAlgo08xS0Sid.js` | `createMatAlgo08xS0Sid` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `./useMatrixForArrayScalar.js` | `createUseMatrixForArrayScalar` | Import |
| `../plain/number/index.js` | `rightArithShiftNumber` | Import |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createRightArithShift`

---

### `src/bitwise/rightLogShift.ts` - Bitwise right logical shift of value x by y number of bits, `x >>> y`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../type/matrix/utils/matAlgo02xDS0.js` | `createMatAlgo02xDS0` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matAlgo14xDs.js` | `createMatAlgo14xDs` | Import |
| `../type/matrix/utils/matAlgo01xDSid.js` | `createMatAlgo01xDSid` | Import |
| `../type/matrix/utils/matAlgo10xSids.js` | `createMatAlgo10xSids` | Import |
| `../type/matrix/utils/matAlgo08xS0Sid.js` | `createMatAlgo08xS0Sid` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `../plain/number/index.js` | `rightLogShiftNumber` | Import |
| `./useMatrixForArrayScalar.js` | `createUseMatrixForArrayScalar` | Import |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createRightLogShift`

---

### `src/bitwise/useMatrixForArrayScalar.ts` - Type definitions for useMatrixForArrayScalar

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createUseMatrixForArrayScalar`

---

## Combinatorics Dependencies

### `src/combinatorics/bellNumbers.ts` - The Bell Numbers count the number of partitions of a set. A partition is a pairwise disjoint subset of S whose union is S.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createBellNumbers`

---

### `src/combinatorics/catalan.ts` - The Catalan Numbers enumerate combinatorial structures of many different types.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCatalan`

---

### `src/combinatorics/composition.ts` - The composition counts of n into k parts.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createComposition`

---

### `src/combinatorics/stirlingS2.ts` - The Stirling numbers of the second kind, counts the number of ways to partition

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/is.js` | `isNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createStirlingS2`

---

## Complex Dependencies

### `src/complex/arg.ts` - Compute the argument of a complex value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/collection.js` | `deepMap` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createArg`

---

### `src/complex/conj.ts` - Compute the complex conjugate of a complex value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/collection.js` | `deepMap` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createConj`

---

### `src/complex/im.ts` - Get the imaginary part of a complex number.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/collection.js` | `deepMap` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createIm`

---

### `src/complex/re.ts` - Get the real part of a complex number.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/collection.js` | `deepMap` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createRe`

---

## Core Dependencies

### `src/core/config.ts` - Configuration interface for math.js

**Exports:**
- Interfaces: `ConfigOptions`
- Constants: `DEFAULT_CONFIG`

---

### `src/core/create.ts` - Type for the mathjs instance

**External Dependencies:**
| Package | Import |
|---------|--------|
| `@danielsimonjr/typed-function` | `typedFunction` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../error/ArgumentsError.ts` | `ArgumentsError` | Import |
| `../error/DimensionError.ts` | `DimensionError` | Import |
| `../error/IndexError.ts` | `IndexError` | Import |
| `../utils/factory.ts` | `factory, isFactory` | Import |
| `../utils/factory.ts` | `FactoryFunction, LegacyFactory` | Import (type-only) |
| `../utils/is.ts` | `isAccessorNode, isArray, isArrayNode, isAssignmentNode, isBigInt, isBigNumber, isBlockNode, isBoolean, isChain, isCollection, isComplex, isConditionalNode, isConstantNode, isDate, isDenseMatrix, isFraction, isFunction, isFunctionAssignmentNode, isFunctionNode, isHelp, isIndex, isIndexNode, isMap, isMatrix, isNode, isNull, isNumber, isObject, isObjectNode, isObjectWrappingMap, isOperatorNode, isParenthesisNode, isPartitionedMap, isRange, isRangeNode, isRegExp, isRelationalNode, isResultSet, isSparseMatrix, isString, isSymbolNode, isUndefined, isUnit` | Import |
| `../utils/object.ts` | `deepFlatten, isLegacyFactory` | Import |
| `./../utils/emitter.ts` | `* as emitter` | Import |
| `./config.ts` | `DEFAULT_CONFIG` | Import |
| `./config.ts` | `ConfigOptions, MathJsConfig` | Import (type-only) |
| `./function/config.ts` | `configFactory` | Import |
| `./function/import.ts` | `importFactory` | Import |

**Exports:**
- Interfaces: `MathJsInstance`, `ImportOptions`
- Functions: `create`

---

### `src/core/function/config.ts` - Type for partial config options

**External Dependencies:**
| Package | Import |
|---------|--------|
| `mathjs` | `create, all` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/object.ts` | `clone, deepExtend` | Import |
| `../config.ts` | `DEFAULT_CONFIG, MathJsConfig` | Import |

**Exports:**
- Interfaces: `ConfigFunction`
- Functions: `configFactory`
- Constants: `MATRIX_OPTIONS`, `NUMBER_OPTIONS`

---

### `src/core/function/import.ts` - Options for the import function

**External Dependencies:**
| Package | Import |
|---------|--------|
| `mathjs` | `create, all` |
| `numbers` | `* as numbers` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isBigNumber, isComplex, isFraction, isMatrix, isObject, isUnit` | Import |
| `../../utils/factory.ts` | `isFactory, stripOptionalNotation, FactoryFunction, FactoryMeta` | Import |
| `../../utils/object.ts` | `hasOwnProperty, lazy` | Import |
| `../../error/ArgumentsError.ts` | `ArgumentsError` | Import |
| `./typed.ts` | `TypedFunction` | Import (type-only) |

**Exports:**
- Interfaces: `ImportOptions`
- Functions: `importFactory`
- Constants: `path`

---

### `src/core/function/typed.ts` - Create a typed-function which checks the types of the arguments and

**External Dependencies:**
| Package | Import |
|---------|--------|
| `@danielsimonjr/typed-function` | `typedFunction` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/is.ts` | `isAccessorNode, isArray, isArrayNode, isAssignmentNode, isBigInt, isBigNumber, isBlockNode, isBoolean, isChain, isCollection, isComplex, isConditionalNode, isConstantNode, isDate, isDenseMatrix, isFraction, isFunction, isFunctionAssignmentNode, isFunctionNode, isHelp, isIndex, isIndexNode, isMap, isMatrix, isNode, isNull, isNumber, isObject, isObjectNode, isOperatorNode, isParenthesisNode, isRange, isRangeNode, isRegExp, isRelationalNode, isResultSet, isSparseMatrix, isString, isSymbolNode, isUndefined, isUnit` | Import |
| `../../utils/number.ts` | `digits` | Import |

**Exports:**
- Interfaces: `TypedFunction`
- Constants: `createTyped`

---

## Error Dependencies

### `src/error/ArgumentsError.ts` - Custom error type for wrong number of arguments

**Exports:**
- Classes: `ArgumentsError`
- Functions: `createArgumentsError`

---

### `src/error/DimensionError.ts` - Create a range error with the message:

**Exports:**
- Classes: `DimensionError`

---

### `src/error/IndexError.ts` - Custom error type for index out of range errors

**Exports:**
- Classes: `IndexError`
- Functions: `createIndexError`

---

## Expression Dependencies

### `src/expression/embeddedDocs/constants/e.ts` - e module

**Exports:**
- Constants: `eDocs`

---

### `src/expression/embeddedDocs/constants/false.ts` - false module

**Exports:**
- Constants: `falseDocs`

---

### `src/expression/embeddedDocs/constants/i.ts` - i module

**Exports:**
- Constants: `iDocs`

---

### `src/expression/embeddedDocs/constants/Infinity.ts` - Infinity module

**Exports:**
- Constants: `InfinityDocs`

---

### `src/expression/embeddedDocs/constants/LN10.ts` - LN10 module

**Exports:**
- Constants: `LN10Docs`

---

### `src/expression/embeddedDocs/constants/LN2.ts` - LN2 module

**Exports:**
- Constants: `LN2Docs`

---

### `src/expression/embeddedDocs/constants/LOG10E.ts` - LOG10E module

**Exports:**
- Constants: `LOG10EDocs`

---

### `src/expression/embeddedDocs/constants/LOG2E.ts` - LOG2E module

**Exports:**
- Constants: `LOG2EDocs`

---

### `src/expression/embeddedDocs/constants/NaN.ts` - NaN module

**Exports:**
- Constants: `NaNDocs`

---

### `src/expression/embeddedDocs/constants/null.ts` - null module

**Exports:**
- Constants: `nullDocs`

---

### `src/expression/embeddedDocs/constants/phi.ts` - phi module

**Exports:**
- Constants: `phiDocs`

---

### `src/expression/embeddedDocs/constants/pi.ts` - pi module

**Exports:**
- Constants: `piDocs`

---

### `src/expression/embeddedDocs/constants/SQRT1_2.ts` - SQRT1_2 module

**Exports:**
- Constants: `SQRT12Docs`

---

### `src/expression/embeddedDocs/constants/SQRT2.ts` - SQRT2 module

**Exports:**
- Constants: `SQRT2Docs`

---

### `src/expression/embeddedDocs/constants/tau.ts` - tau module

**Exports:**
- Constants: `tauDocs`

---

### `src/expression/embeddedDocs/constants/true.ts` - true module

**Exports:**
- Constants: `trueDocs`

---

### `src/expression/embeddedDocs/constants/version.ts` - version module

**Exports:**
- Constants: `versionDocs`

---

### `src/expression/embeddedDocs/construction/bigint.ts` - bigint module

**Exports:**
- Constants: `bigintDocs`

---

### `src/expression/embeddedDocs/construction/bignumber.ts` - bignumber module

**Exports:**
- Constants: `bignumberDocs`

---

### `src/expression/embeddedDocs/construction/boolean.ts` - boolean module

**Exports:**
- Constants: `booleanDocs`

---

### `src/expression/embeddedDocs/construction/complex.ts` - complex module

**Exports:**
- Constants: `complexDocs`

---

### `src/expression/embeddedDocs/construction/createUnit.ts` - createUnit module

**Exports:**
- Constants: `createUnitDocs`

---

### `src/expression/embeddedDocs/construction/fraction.ts` - fraction module

**Exports:**
- Constants: `fractionDocs`

---

### `src/expression/embeddedDocs/construction/index.ts` - index module

**Exports:**
- Constants: `indexDocs`

---

### `src/expression/embeddedDocs/construction/matrix.ts` - matrix module

**Exports:**
- Constants: `matrixDocs`

---

### `src/expression/embeddedDocs/construction/number.ts` - number module

**Exports:**
- Constants: `numberDocs`

---

### `src/expression/embeddedDocs/construction/sparse.ts` - sparse module

**Exports:**
- Constants: `sparseDocs`

---

### `src/expression/embeddedDocs/construction/splitUnit.ts` - splitUnit module

**Exports:**
- Constants: `splitUnitDocs`

---

### `src/expression/embeddedDocs/construction/string.ts` - string module

**Exports:**
- Constants: `stringDocs`

---

### `src/expression/embeddedDocs/construction/unit.ts` - unit module

**Exports:**
- Constants: `unitDocs`

---

### `src/expression/embeddedDocs/core/config.ts` - config module

**Exports:**
- Constants: `configDocs`

---

### `src/expression/embeddedDocs/core/import.ts` - import module

**Exports:**
- Constants: `importDocs`

---

### `src/expression/embeddedDocs/core/typed.ts` - typed module

**Exports:**
- Constants: `typedDocs`

---

### `src/expression/embeddedDocs/embeddedDocs.ts` - embeddedDocs module

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./constants/e.ts` | `eDocs` | Import |
| `./constants/false.ts` | `falseDocs` | Import |
| `./constants/i.ts` | `iDocs` | Import |
| `./constants/Infinity.ts` | `InfinityDocs` | Import |
| `./constants/LN10.ts` | `LN10Docs` | Import |
| `./constants/LN2.ts` | `LN2Docs` | Import |
| `./constants/LOG10E.ts` | `LOG10EDocs` | Import |
| `./constants/LOG2E.ts` | `LOG2EDocs` | Import |
| `./constants/NaN.ts` | `NaNDocs` | Import |
| `./constants/null.ts` | `nullDocs` | Import |
| `./constants/phi.ts` | `phiDocs` | Import |
| `./constants/pi.ts` | `piDocs` | Import |
| `./constants/SQRT1_2.ts` | `SQRT12Docs` | Import |
| `./constants/SQRT2.ts` | `SQRT2Docs` | Import |
| `./constants/tau.ts` | `tauDocs` | Import |
| `./constants/true.ts` | `trueDocs` | Import |
| `./constants/version.ts` | `versionDocs` | Import |
| `./construction/bignumber.ts` | `bignumberDocs` | Import |
| `./construction/bigint.ts` | `bigintDocs` | Import |
| `./construction/boolean.ts` | `booleanDocs` | Import |
| `./construction/complex.ts` | `complexDocs` | Import |
| `./construction/createUnit.ts` | `createUnitDocs` | Import |
| `./construction/fraction.ts` | `fractionDocs` | Import |
| `./construction/index.ts` | `indexDocs` | Import |
| `./construction/matrix.ts` | `matrixDocs` | Import |
| `./construction/number.ts` | `numberDocs` | Import |
| `./construction/sparse.ts` | `sparseDocs` | Import |
| `./construction/splitUnit.ts` | `splitUnitDocs` | Import |
| `./construction/string.ts` | `stringDocs` | Import |
| `./construction/unit.ts` | `unitDocs` | Import |
| `./core/config.ts` | `configDocs` | Import |
| `./core/import.ts` | `importDocs` | Import |
| `./core/typed.ts` | `typedDocs` | Import |
| `./function/algebra/derivative.ts` | `derivativeDocs` | Import |
| `./function/algebra/leafCount.ts` | `leafCountDocs` | Import |
| `./function/algebra/lsolve.ts` | `lsolveDocs` | Import |
| `./function/algebra/lsolveAll.ts` | `lsolveAllDocs` | Import |
| `./function/algebra/lup.ts` | `lupDocs` | Import |
| `./function/algebra/lusolve.ts` | `lusolveDocs` | Import |
| `./function/algebra/polynomialRoot.ts` | `polynomialRootDocs` | Import |
| `./function/algebra/qr.ts` | `qrDocs` | Import |
| `./function/algebra/rationalize.ts` | `rationalizeDocs` | Import |
| `./function/algebra/resolve.ts` | `resolveDocs` | Import |
| `./function/algebra/simplify.ts` | `simplifyDocs` | Import |
| `./function/algebra/simplifyConstant.ts` | `simplifyConstantDocs` | Import |
| `./function/algebra/simplifyCore.ts` | `simplifyCoreDocs` | Import |
| `./function/algebra/slu.ts` | `sluDocs` | Import |
| `./function/algebra/symbolicEqual.ts` | `symbolicEqualDocs` | Import |
| `./function/algebra/usolve.ts` | `usolveDocs` | Import |
| `./function/algebra/usolveAll.ts` | `usolveAllDocs` | Import |
| `./function/arithmetic/abs.ts` | `absDocs` | Import |
| `./function/arithmetic/add.ts` | `addDocs` | Import |
| `./function/arithmetic/cbrt.ts` | `cbrtDocs` | Import |
| `./function/arithmetic/ceil.ts` | `ceilDocs` | Import |
| `./function/arithmetic/cube.ts` | `cubeDocs` | Import |
| `./function/arithmetic/divide.ts` | `divideDocs` | Import |
| `./function/arithmetic/dotDivide.ts` | `dotDivideDocs` | Import |
| `./function/arithmetic/dotMultiply.ts` | `dotMultiplyDocs` | Import |
| `./function/arithmetic/dotPow.ts` | `dotPowDocs` | Import |
| `./function/arithmetic/exp.ts` | `expDocs` | Import |
| `./function/arithmetic/expm.ts` | `expmDocs` | Import |
| `./function/arithmetic/expm1.ts` | `expm1Docs` | Import |
| `./function/arithmetic/fix.ts` | `fixDocs` | Import |
| `./function/arithmetic/floor.ts` | `floorDocs` | Import |
| `./function/arithmetic/gcd.ts` | `gcdDocs` | Import |
| `./function/arithmetic/hypot.ts` | `hypotDocs` | Import |
| `./function/arithmetic/invmod.ts` | `invmodDocs` | Import |
| `./function/arithmetic/lcm.ts` | `lcmDocs` | Import |
| `./function/arithmetic/log.ts` | `logDocs` | Import |
| `./function/arithmetic/log10.ts` | `log10Docs` | Import |
| `./function/arithmetic/log1p.ts` | `log1pDocs` | Import |
| `./function/arithmetic/log2.ts` | `log2Docs` | Import |
| `./function/arithmetic/mod.ts` | `modDocs` | Import |
| `./function/arithmetic/multiply.ts` | `multiplyDocs` | Import |
| `./function/arithmetic/norm.ts` | `normDocs` | Import |
| `./function/arithmetic/nthRoot.ts` | `nthRootDocs` | Import |
| `./function/arithmetic/nthRoots.ts` | `nthRootsDocs` | Import |
| `./function/arithmetic/pow.ts` | `powDocs` | Import |
| `./function/arithmetic/round.ts` | `roundDocs` | Import |
| `./function/arithmetic/sign.ts` | `signDocs` | Import |
| `./function/arithmetic/sqrt.ts` | `sqrtDocs` | Import |
| `./function/arithmetic/sqrtm.ts` | `sqrtmDocs` | Import |
| `./function/algebra/sylvester.ts` | `sylvesterDocs` | Import |
| `./function/algebra/schur.ts` | `schurDocs` | Import |
| `./function/algebra/lyap.ts` | `lyapDocs` | Import |
| `./function/arithmetic/square.ts` | `squareDocs` | Import |
| `./function/arithmetic/subtract.ts` | `subtractDocs` | Import |
| `./function/arithmetic/unaryMinus.ts` | `unaryMinusDocs` | Import |
| `./function/arithmetic/unaryPlus.ts` | `unaryPlusDocs` | Import |
| `./function/arithmetic/xgcd.ts` | `xgcdDocs` | Import |
| `./function/bitwise/bitAnd.ts` | `bitAndDocs` | Import |
| `./function/bitwise/bitNot.ts` | `bitNotDocs` | Import |
| `./function/bitwise/bitOr.ts` | `bitOrDocs` | Import |
| `./function/bitwise/bitXor.ts` | `bitXorDocs` | Import |
| `./function/bitwise/leftShift.ts` | `leftShiftDocs` | Import |
| `./function/bitwise/rightArithShift.ts` | `rightArithShiftDocs` | Import |
| `./function/bitwise/rightLogShift.ts` | `rightLogShiftDocs` | Import |
| `./function/combinatorics/bellNumbers.ts` | `bellNumbersDocs` | Import |
| `./function/combinatorics/catalan.ts` | `catalanDocs` | Import |
| `./function/combinatorics/composition.ts` | `compositionDocs` | Import |
| `./function/combinatorics/stirlingS2.ts` | `stirlingS2Docs` | Import |
| `./function/complex/arg.ts` | `argDocs` | Import |
| `./function/complex/conj.ts` | `conjDocs` | Import |
| `./function/complex/im.ts` | `imDocs` | Import |
| `./function/complex/re.ts` | `reDocs` | Import |
| `./function/expression/evaluate.ts` | `evaluateDocs` | Import |
| `./function/expression/parser.ts` | `parserDocs` | Import |
| `./function/expression/parse.ts` | `parseDocs` | Import |
| `./function/expression/compile.ts` | `compileDocs` | Import |
| `./function/expression/help.ts` | `helpDocs` | Import |
| `./function/geometry/distance.ts` | `distanceDocs` | Import |
| `./function/geometry/intersect.ts` | `intersectDocs` | Import |
| `./function/logical/and.ts` | `andDocs` | Import |
| `./function/logical/not.ts` | `notDocs` | Import |
| `./function/logical/nullish.ts` | `nullishDocs` | Import |
| `./function/logical/or.ts` | `orDocs` | Import |
| `./function/logical/xor.ts` | `xorDocs` | Import |
| `./function/matrix/mapSlices.ts` | `mapSlicesDocs` | Import |
| `./function/matrix/column.ts` | `columnDocs` | Import |
| `./function/matrix/concat.ts` | `concatDocs` | Import |
| `./function/matrix/count.ts` | `countDocs` | Import |
| `./function/matrix/cross.ts` | `crossDocs` | Import |
| `./function/matrix/ctranspose.ts` | `ctransposeDocs` | Import |
| `./function/matrix/det.ts` | `detDocs` | Import |
| `./function/matrix/diag.ts` | `diagDocs` | Import |
| `./function/matrix/diff.ts` | `diffDocs` | Import |
| `./function/matrix/dot.ts` | `dotDocs` | Import |
| `./function/matrix/eigs.ts` | `eigsDocs` | Import |
| `./function/matrix/filter.ts` | `filterDocs` | Import |
| `./function/matrix/flatten.ts` | `flattenDocs` | Import |
| `./function/matrix/forEach.ts` | `forEachDocs` | Import |
| `./function/matrix/getMatrixDataType.ts` | `getMatrixDataTypeDocs` | Import |
| `./function/matrix/identity.ts` | `identityDocs` | Import |
| `./function/matrix/inv.ts` | `invDocs` | Import |
| `./function/matrix/pinv.ts` | `pinvDocs` | Import |
| `./function/matrix/kron.ts` | `kronDocs` | Import |
| `./function/matrix/map.ts` | `mapDocs` | Import |
| `./function/matrix/matrixFromColumns.ts` | `matrixFromColumnsDocs` | Import |
| `./function/matrix/matrixFromFunction.ts` | `matrixFromFunctionDocs` | Import |
| `./function/matrix/matrixFromRows.ts` | `matrixFromRowsDocs` | Import |
| `./function/matrix/ones.ts` | `onesDocs` | Import |
| `./function/matrix/partitionSelect.ts` | `partitionSelectDocs` | Import |
| `./function/matrix/range.ts` | `rangeDocs` | Import |
| `./function/matrix/reshape.ts` | `reshapeDocs` | Import |
| `./function/matrix/resize.ts` | `resizeDocs` | Import |
| `./function/matrix/rotate.ts` | `rotateDocs` | Import |
| `./function/matrix/rotationMatrix.ts` | `rotationMatrixDocs` | Import |
| `./function/matrix/row.ts` | `rowDocs` | Import |
| `./function/matrix/size.ts` | `sizeDocs` | Import |
| `./function/matrix/sort.ts` | `sortDocs` | Import |
| `./function/matrix/squeeze.ts` | `squeezeDocs` | Import |
| `./function/matrix/subset.ts` | `subsetDocs` | Import |
| `./function/matrix/trace.ts` | `traceDocs` | Import |
| `./function/matrix/transpose.ts` | `transposeDocs` | Import |
| `./function/matrix/zeros.ts` | `zerosDocs` | Import |
| `./function/matrix/fft.ts` | `fftDocs` | Import |
| `./function/matrix/ifft.ts` | `ifftDocs` | Import |
| `./function/probability/bernoulli.ts` | `bernoulliDocs` | Import |
| `./function/probability/combinations.ts` | `combinationsDocs` | Import |
| `./function/probability/combinationsWithRep.ts` | `combinationsWithRepDocs` | Import |
| `./function/probability/factorial.ts` | `factorialDocs` | Import |
| `./function/probability/gamma.ts` | `gammaDocs` | Import |
| `./function/probability/lgamma.ts` | `lgammaDocs` | Import |
| `./function/probability/kldivergence.ts` | `kldivergenceDocs` | Import |
| `./function/probability/multinomial.ts` | `multinomialDocs` | Import |
| `./function/probability/permutations.ts` | `permutationsDocs` | Import |
| `./function/probability/pickRandom.ts` | `pickRandomDocs` | Import |
| `./function/probability/random.ts` | `randomDocs` | Import |
| `./function/probability/randomInt.ts` | `randomIntDocs` | Import |
| `./function/relational/compare.ts` | `compareDocs` | Import |
| `./function/relational/compareNatural.ts` | `compareNaturalDocs` | Import |
| `./function/relational/compareText.ts` | `compareTextDocs` | Import |
| `./function/relational/deepEqual.ts` | `deepEqualDocs` | Import |
| `./function/relational/equal.ts` | `equalDocs` | Import |
| `./function/relational/equalText.ts` | `equalTextDocs` | Import |
| `./function/relational/larger.ts` | `largerDocs` | Import |
| `./function/relational/largerEq.ts` | `largerEqDocs` | Import |
| `./function/relational/smaller.ts` | `smallerDocs` | Import |
| `./function/relational/smallerEq.ts` | `smallerEqDocs` | Import |
| `./function/relational/unequal.ts` | `unequalDocs` | Import |
| `./function/set/setCartesian.ts` | `setCartesianDocs` | Import |
| `./function/set/setDifference.ts` | `setDifferenceDocs` | Import |
| `./function/set/setDistinct.ts` | `setDistinctDocs` | Import |
| `./function/set/setIntersect.ts` | `setIntersectDocs` | Import |
| `./function/set/setIsSubset.ts` | `setIsSubsetDocs` | Import |
| `./function/set/setMultiplicity.ts` | `setMultiplicityDocs` | Import |
| `./function/set/setPowerset.ts` | `setPowersetDocs` | Import |
| `./function/set/setSize.ts` | `setSizeDocs` | Import |
| `./function/set/setSymDifference.ts` | `setSymDifferenceDocs` | Import |
| `./function/set/setUnion.ts` | `setUnionDocs` | Import |
| `./function/signal/zpk2tf.ts` | `zpk2tfDocs` | Import |
| `./function/signal/freqz.ts` | `freqzDocs` | Import |
| `./function/special/erf.ts` | `erfDocs` | Import |
| `./function/special/zeta.ts` | `zetaDocs` | Import |
| `./function/statistics/mad.ts` | `madDocs` | Import |
| `./function/statistics/max.ts` | `maxDocs` | Import |
| `./function/statistics/mean.ts` | `meanDocs` | Import |
| `./function/statistics/median.ts` | `medianDocs` | Import |
| `./function/statistics/min.ts` | `minDocs` | Import |
| `./function/statistics/mode.ts` | `modeDocs` | Import |
| `./function/statistics/prod.ts` | `prodDocs` | Import |
| `./function/statistics/quantileSeq.ts` | `quantileSeqDocs` | Import |
| `./function/statistics/std.ts` | `stdDocs` | Import |
| `./function/statistics/cumsum.ts` | `cumSumDocs` | Import |
| `./function/statistics/sum.ts` | `sumDocs` | Import |
| `./function/statistics/variance.ts` | `varianceDocs` | Import |
| `./function/statistics/corr.ts` | `corrDocs` | Import |
| `./function/trigonometry/acos.ts` | `acosDocs` | Import |
| `./function/trigonometry/acosh.ts` | `acoshDocs` | Import |
| `./function/trigonometry/acot.ts` | `acotDocs` | Import |
| `./function/trigonometry/acoth.ts` | `acothDocs` | Import |
| `./function/trigonometry/acsc.ts` | `acscDocs` | Import |
| `./function/trigonometry/acsch.ts` | `acschDocs` | Import |
| `./function/trigonometry/asec.ts` | `asecDocs` | Import |
| `./function/trigonometry/asech.ts` | `asechDocs` | Import |
| `./function/trigonometry/asin.ts` | `asinDocs` | Import |
| `./function/trigonometry/asinh.ts` | `asinhDocs` | Import |
| `./function/trigonometry/atan.ts` | `atanDocs` | Import |
| `./function/trigonometry/atan2.ts` | `atan2Docs` | Import |
| `./function/trigonometry/atanh.ts` | `atanhDocs` | Import |
| `./function/trigonometry/cos.ts` | `cosDocs` | Import |
| `./function/trigonometry/cosh.ts` | `coshDocs` | Import |
| `./function/trigonometry/cot.ts` | `cotDocs` | Import |
| `./function/trigonometry/coth.ts` | `cothDocs` | Import |
| `./function/trigonometry/csc.ts` | `cscDocs` | Import |
| `./function/trigonometry/csch.ts` | `cschDocs` | Import |
| `./function/trigonometry/sec.ts` | `secDocs` | Import |
| `./function/trigonometry/sech.ts` | `sechDocs` | Import |
| `./function/trigonometry/sin.ts` | `sinDocs` | Import |
| `./function/trigonometry/sinh.ts` | `sinhDocs` | Import |
| `./function/trigonometry/tan.ts` | `tanDocs` | Import |
| `./function/trigonometry/tanh.ts` | `tanhDocs` | Import |
| `./function/units/to.ts` | `toDocs` | Import |
| `./function/units/toBest.ts` | `toBestDocs` | Import |
| `./function/utils/bin.ts` | `binDocs` | Import |
| `./function/utils/clone.ts` | `cloneDocs` | Import |
| `./function/utils/format.ts` | `formatDocs` | Import |
| `./function/utils/hasNumericValue.ts` | `hasNumericValueDocs` | Import |
| `./function/utils/hex.ts` | `hexDocs` | Import |
| `./function/utils/isInteger.ts` | `isIntegerDocs` | Import |
| `./function/utils/isNaN.ts` | `isNaNDocs` | Import |
| `./function/utils/isBounded.ts` | `isBoundedDocs` | Import |
| `./function/utils/isFinite.ts` | `isFiniteDocs` | Import |
| `./function/utils/isNegative.ts` | `isNegativeDocs` | Import |
| `./function/utils/isNumeric.ts` | `isNumericDocs` | Import |
| `./function/utils/isPositive.ts` | `isPositiveDocs` | Import |
| `./function/utils/isPrime.ts` | `isPrimeDocs` | Import |
| `./function/utils/isZero.ts` | `isZeroDocs` | Import |
| `./function/utils/numeric.ts` | `numericDocs` | Import |
| `./function/utils/oct.ts` | `octDocs` | Import |
| `./function/utils/print.ts` | `printDocs` | Import |
| `./function/utils/typeOf.ts` | `typeOfDocs` | Import |
| `./function/numeric/solveODE.ts` | `solveODEDocs` | Import |

**Exports:**
- Constants: `embeddedDocs`

---

### `src/expression/embeddedDocs/function/algebra/derivative.ts` - derivative module

**Exports:**
- Constants: `derivativeDocs`

---

### `src/expression/embeddedDocs/function/algebra/leafCount.ts` - leafCount module

**Exports:**
- Constants: `leafCountDocs`

---

### `src/expression/embeddedDocs/function/algebra/lsolve.ts` - lsolve module

**Exports:**
- Constants: `lsolveDocs`

---

### `src/expression/embeddedDocs/function/algebra/lsolveAll.ts` - lsolveAll module

**Exports:**
- Constants: `lsolveAllDocs`

---

### `src/expression/embeddedDocs/function/algebra/lup.ts` - lup module

**Exports:**
- Constants: `lupDocs`

---

### `src/expression/embeddedDocs/function/algebra/lusolve.ts` - lusolve module

**Exports:**
- Constants: `lusolveDocs`

---

### `src/expression/embeddedDocs/function/algebra/lyap.ts` - lyap module

**Exports:**
- Constants: `lyapDocs`

---

### `src/expression/embeddedDocs/function/algebra/polynomialRoot.ts` - polynomialRoot module

**Exports:**
- Constants: `polynomialRootDocs`

---

### `src/expression/embeddedDocs/function/algebra/qr.ts` - qr module

**Exports:**
- Constants: `qrDocs`

---

### `src/expression/embeddedDocs/function/algebra/rationalize.ts` - rationalize module

**Exports:**
- Constants: `rationalizeDocs`

---

### `src/expression/embeddedDocs/function/algebra/resolve.ts` - resolve module

**Exports:**
- Constants: `resolveDocs`

---

### `src/expression/embeddedDocs/function/algebra/schur.ts` - schur module

**Exports:**
- Constants: `schurDocs`

---

### `src/expression/embeddedDocs/function/algebra/simplify.ts` - simplify module

**Exports:**
- Constants: `simplifyDocs`

---

### `src/expression/embeddedDocs/function/algebra/simplifyConstant.ts` - simplifyConstant module

**Exports:**
- Constants: `simplifyConstantDocs`

---

### `src/expression/embeddedDocs/function/algebra/simplifyCore.ts` - simplifyCore module

**Exports:**
- Constants: `simplifyCoreDocs`

---

### `src/expression/embeddedDocs/function/algebra/slu.ts` - slu module

**Exports:**
- Constants: `sluDocs`

---

### `src/expression/embeddedDocs/function/algebra/sylvester.ts` - sylvester module

**Exports:**
- Constants: `sylvesterDocs`

---

### `src/expression/embeddedDocs/function/algebra/symbolicEqual.ts` - symbolicEqual module

**Exports:**
- Constants: `symbolicEqualDocs`

---

### `src/expression/embeddedDocs/function/algebra/usolve.ts` - usolve module

**Exports:**
- Constants: `usolveDocs`

---

### `src/expression/embeddedDocs/function/algebra/usolveAll.ts` - usolveAll module

**Exports:**
- Constants: `usolveAllDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/abs.ts` - abs module

**Exports:**
- Constants: `absDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/add.ts` - add module

**Exports:**
- Constants: `addDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/cbrt.ts` - cbrt module

**Exports:**
- Constants: `cbrtDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/ceil.ts` - ceil module

**Exports:**
- Constants: `ceilDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/cube.ts` - cube module

**Exports:**
- Constants: `cubeDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/divide.ts` - divide module

**Exports:**
- Constants: `divideDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/dotDivide.ts` - dotDivide module

**Exports:**
- Constants: `dotDivideDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/dotMultiply.ts` - dotMultiply module

**Exports:**
- Constants: `dotMultiplyDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/dotPow.ts` - dotPow module

**Exports:**
- Constants: `dotPowDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/exp.ts` - exp module

**Exports:**
- Constants: `expDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/expm.ts` - expm module

**Exports:**
- Constants: `expmDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/expm1.ts` - expm1 module

**Exports:**
- Constants: `expm1Docs`

---

### `src/expression/embeddedDocs/function/arithmetic/fix.ts` - fix module

**Exports:**
- Constants: `fixDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/floor.ts` - floor module

**Exports:**
- Constants: `floorDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/gcd.ts` - gcd module

**Exports:**
- Constants: `gcdDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/hypot.ts` - hypot module

**Exports:**
- Constants: `hypotDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/invmod.ts` - invmod module

**Exports:**
- Constants: `invmodDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/lcm.ts` - lcm module

**Exports:**
- Constants: `lcmDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/log.ts` - log module

**Exports:**
- Constants: `logDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/log10.ts` - log10 module

**Exports:**
- Constants: `log10Docs`

---

### `src/expression/embeddedDocs/function/arithmetic/log1p.ts` - log1p module

**Exports:**
- Constants: `log1pDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/log2.ts` - log2 module

**Exports:**
- Constants: `log2Docs`

---

### `src/expression/embeddedDocs/function/arithmetic/mod.ts` - mod module

**Exports:**
- Constants: `modDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/multiply.ts` - multiply module

**Exports:**
- Constants: `multiplyDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/norm.ts` - norm module

**Exports:**
- Constants: `normDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/nthRoot.ts` - nthRoot module

**Exports:**
- Constants: `nthRootDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/nthRoots.ts` - nthRoots module

**Exports:**
- Constants: `nthRootsDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/pow.ts` - pow module

**Exports:**
- Constants: `powDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/round.ts` - round module

**Exports:**
- Constants: `roundDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/sign.ts` - sign module

**Exports:**
- Constants: `signDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/sqrt.ts` - sqrt module

**Exports:**
- Constants: `sqrtDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/sqrtm.ts` - sqrtm module

**Exports:**
- Constants: `sqrtmDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/square.ts` - square module

**Exports:**
- Constants: `squareDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/subtract.ts` - subtract module

**Exports:**
- Constants: `subtractDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/unaryMinus.ts` - unaryMinus module

**Exports:**
- Constants: `unaryMinusDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/unaryPlus.ts` - unaryPlus module

**Exports:**
- Constants: `unaryPlusDocs`

---

### `src/expression/embeddedDocs/function/arithmetic/xgcd.ts` - xgcd module

**Exports:**
- Constants: `xgcdDocs`

---

### `src/expression/embeddedDocs/function/bitwise/bitAnd.ts` - bitAnd module

**Exports:**
- Constants: `bitAndDocs`

---

### `src/expression/embeddedDocs/function/bitwise/bitNot.ts` - bitNot module

**Exports:**
- Constants: `bitNotDocs`

---

### `src/expression/embeddedDocs/function/bitwise/bitOr.ts` - bitOr module

**Exports:**
- Constants: `bitOrDocs`

---

### `src/expression/embeddedDocs/function/bitwise/bitXor.ts` - bitXor module

**Exports:**
- Constants: `bitXorDocs`

---

### `src/expression/embeddedDocs/function/bitwise/leftShift.ts` - leftShift module

**Exports:**
- Constants: `leftShiftDocs`

---

### `src/expression/embeddedDocs/function/bitwise/rightArithShift.ts` - rightArithShift module

**Exports:**
- Constants: `rightArithShiftDocs`

---

### `src/expression/embeddedDocs/function/bitwise/rightLogShift.ts` - rightLogShift module

**Exports:**
- Constants: `rightLogShiftDocs`

---

### `src/expression/embeddedDocs/function/combinatorics/bellNumbers.ts` - bellNumbers module

**Exports:**
- Constants: `bellNumbersDocs`

---

### `src/expression/embeddedDocs/function/combinatorics/catalan.ts` - catalan module

**Exports:**
- Constants: `catalanDocs`

---

### `src/expression/embeddedDocs/function/combinatorics/composition.ts` - composition module

**Exports:**
- Constants: `compositionDocs`

---

### `src/expression/embeddedDocs/function/combinatorics/stirlingS2.ts` - stirlingS2 module

**Exports:**
- Constants: `stirlingS2Docs`

---

### `src/expression/embeddedDocs/function/complex/arg.ts` - arg module

**Exports:**
- Constants: `argDocs`

---

### `src/expression/embeddedDocs/function/complex/conj.ts` - conj module

**Exports:**
- Constants: `conjDocs`

---

### `src/expression/embeddedDocs/function/complex/im.ts` - im module

**Exports:**
- Constants: `imDocs`

---

### `src/expression/embeddedDocs/function/complex/re.ts` - re module

**Exports:**
- Constants: `reDocs`

---

### `src/expression/embeddedDocs/function/expression/compile.ts` - compile module

**Exports:**
- Constants: `compileDocs`

---

### `src/expression/embeddedDocs/function/expression/evaluate.ts` - evaluate module

**Exports:**
- Constants: `evaluateDocs`

---

### `src/expression/embeddedDocs/function/expression/help.ts` - help module

**Exports:**
- Constants: `helpDocs`

---

### `src/expression/embeddedDocs/function/expression/parse.ts` - parse module

**Exports:**
- Constants: `parseDocs`

---

### `src/expression/embeddedDocs/function/expression/parser.ts` - parser module

**Exports:**
- Constants: `parserDocs`

---

### `src/expression/embeddedDocs/function/geometry/distance.ts` - distance module

**Exports:**
- Constants: `distanceDocs`

---

### `src/expression/embeddedDocs/function/geometry/intersect.ts` - intersect module

**Exports:**
- Constants: `intersectDocs`

---

### `src/expression/embeddedDocs/function/logical/and.ts` - and module

**Exports:**
- Constants: `andDocs`

---

### `src/expression/embeddedDocs/function/logical/not.ts` - not module

**Exports:**
- Constants: `notDocs`

---

### `src/expression/embeddedDocs/function/logical/nullish.ts` - nullish module

**Exports:**
- Constants: `nullishDocs`

---

### `src/expression/embeddedDocs/function/logical/or.ts` - or module

**Exports:**
- Constants: `orDocs`

---

### `src/expression/embeddedDocs/function/logical/xor.ts` - xor module

**Exports:**
- Constants: `xorDocs`

---

### `src/expression/embeddedDocs/function/matrix/column.ts` - column module

**Exports:**
- Constants: `columnDocs`

---

### `src/expression/embeddedDocs/function/matrix/concat.ts` - concat module

**Exports:**
- Constants: `concatDocs`

---

### `src/expression/embeddedDocs/function/matrix/count.ts` - count module

**Exports:**
- Constants: `countDocs`

---

### `src/expression/embeddedDocs/function/matrix/cross.ts` - cross module

**Exports:**
- Constants: `crossDocs`

---

### `src/expression/embeddedDocs/function/matrix/ctranspose.ts` - ctranspose module

**Exports:**
- Constants: `ctransposeDocs`

---

### `src/expression/embeddedDocs/function/matrix/det.ts` - det module

**Exports:**
- Constants: `detDocs`

---

### `src/expression/embeddedDocs/function/matrix/diag.ts` - diag module

**Exports:**
- Constants: `diagDocs`

---

### `src/expression/embeddedDocs/function/matrix/diff.ts` - diff module

**Exports:**
- Constants: `diffDocs`

---

### `src/expression/embeddedDocs/function/matrix/dot.ts` - dot module

**Exports:**
- Constants: `dotDocs`

---

### `src/expression/embeddedDocs/function/matrix/eigs.ts` - eigs module

**Exports:**
- Constants: `eigsDocs`

---

### `src/expression/embeddedDocs/function/matrix/fft.ts` - fft module

**Exports:**
- Constants: `fftDocs`

---

### `src/expression/embeddedDocs/function/matrix/filter.ts` - filter module

**Exports:**
- Constants: `filterDocs`

---

### `src/expression/embeddedDocs/function/matrix/flatten.ts` - flatten module

**Exports:**
- Constants: `flattenDocs`

---

### `src/expression/embeddedDocs/function/matrix/forEach.ts` - forEach module

**Exports:**
- Constants: `forEachDocs`

---

### `src/expression/embeddedDocs/function/matrix/getMatrixDataType.ts` - getMatrixDataType module

**Exports:**
- Constants: `getMatrixDataTypeDocs`

---

### `src/expression/embeddedDocs/function/matrix/identity.ts` - identity module

**Exports:**
- Constants: `identityDocs`

---

### `src/expression/embeddedDocs/function/matrix/ifft.ts` - ifft module

**Exports:**
- Constants: `ifftDocs`

---

### `src/expression/embeddedDocs/function/matrix/inv.ts` - inv module

**Exports:**
- Constants: `invDocs`

---

### `src/expression/embeddedDocs/function/matrix/kron.ts` - kron module

**Exports:**
- Constants: `kronDocs`

---

### `src/expression/embeddedDocs/function/matrix/map.ts` - map module

**Exports:**
- Constants: `mapDocs`

---

### `src/expression/embeddedDocs/function/matrix/mapSlices.ts` - mapSlices module

**Exports:**
- Constants: `mapSlicesDocs`

---

### `src/expression/embeddedDocs/function/matrix/matrixFromColumns.ts` - matrixFromColumns module

**Exports:**
- Constants: `matrixFromColumnsDocs`

---

### `src/expression/embeddedDocs/function/matrix/matrixFromFunction.ts` - matrixFromFunction module

**Exports:**
- Constants: `matrixFromFunctionDocs`

---

### `src/expression/embeddedDocs/function/matrix/matrixFromRows.ts` - matrixFromRows module

**Exports:**
- Constants: `matrixFromRowsDocs`

---

### `src/expression/embeddedDocs/function/matrix/ones.ts` - ones module

**Exports:**
- Constants: `onesDocs`

---

### `src/expression/embeddedDocs/function/matrix/partitionSelect.ts` - partitionSelect module

**Exports:**
- Constants: `partitionSelectDocs`

---

### `src/expression/embeddedDocs/function/matrix/pinv.ts` - pinv module

**Exports:**
- Constants: `pinvDocs`

---

### `src/expression/embeddedDocs/function/matrix/range.ts` - range module

**Exports:**
- Constants: `rangeDocs`

---

### `src/expression/embeddedDocs/function/matrix/reshape.ts` - reshape module

**Exports:**
- Constants: `reshapeDocs`

---

### `src/expression/embeddedDocs/function/matrix/resize.ts` - resize module

**Exports:**
- Constants: `resizeDocs`

---

### `src/expression/embeddedDocs/function/matrix/rotate.ts` - rotate module

**Exports:**
- Constants: `rotateDocs`

---

### `src/expression/embeddedDocs/function/matrix/rotationMatrix.ts` - rotationMatrix module

**Exports:**
- Constants: `rotationMatrixDocs`

---

### `src/expression/embeddedDocs/function/matrix/row.ts` - row module

**Exports:**
- Constants: `rowDocs`

---

### `src/expression/embeddedDocs/function/matrix/size.ts` - size module

**Exports:**
- Constants: `sizeDocs`

---

### `src/expression/embeddedDocs/function/matrix/sort.ts` - sort module

**Exports:**
- Constants: `sortDocs`

---

### `src/expression/embeddedDocs/function/matrix/squeeze.ts` - squeeze module

**Exports:**
- Constants: `squeezeDocs`

---

### `src/expression/embeddedDocs/function/matrix/subset.ts` - subset module

**Exports:**
- Constants: `subsetDocs`

---

### `src/expression/embeddedDocs/function/matrix/trace.ts` - trace module

**Exports:**
- Constants: `traceDocs`

---

### `src/expression/embeddedDocs/function/matrix/transpose.ts` - transpose module

**Exports:**
- Constants: `transposeDocs`

---

### `src/expression/embeddedDocs/function/matrix/zeros.ts` - zeros module

**Exports:**
- Constants: `zerosDocs`

---

### `src/expression/embeddedDocs/function/numeric/solveODE.ts` - solveODE module

**Exports:**
- Constants: `solveODEDocs`

---

### `src/expression/embeddedDocs/function/probability/bernoulli.ts` - bernoulli module

**Exports:**
- Constants: `bernoulliDocs`

---

### `src/expression/embeddedDocs/function/probability/combinations.ts` - combinations module

**Exports:**
- Constants: `combinationsDocs`

---

### `src/expression/embeddedDocs/function/probability/combinationsWithRep.ts` - combinationsWithRep module

**Exports:**
- Constants: `combinationsWithRepDocs`

---

### `src/expression/embeddedDocs/function/probability/distribution.ts` - distribution module

**Exports:**
- Constants: `distributionDocs`

---

### `src/expression/embeddedDocs/function/probability/factorial.ts` - factorial module

**Exports:**
- Constants: `factorialDocs`

---

### `src/expression/embeddedDocs/function/probability/gamma.ts` - gamma module

**Exports:**
- Constants: `gammaDocs`

---

### `src/expression/embeddedDocs/function/probability/kldivergence.ts` - kldivergence module

**Exports:**
- Constants: `kldivergenceDocs`

---

### `src/expression/embeddedDocs/function/probability/lgamma.ts` - lgamma module

**Exports:**
- Constants: `lgammaDocs`

---

### `src/expression/embeddedDocs/function/probability/multinomial.ts` - multinomial module

**Exports:**
- Constants: `multinomialDocs`

---

### `src/expression/embeddedDocs/function/probability/permutations.ts` - permutations module

**Exports:**
- Constants: `permutationsDocs`

---

### `src/expression/embeddedDocs/function/probability/pickRandom.ts` - pickRandom module

**Exports:**
- Constants: `pickRandomDocs`

---

### `src/expression/embeddedDocs/function/probability/random.ts` - random module

**Exports:**
- Constants: `randomDocs`

---

### `src/expression/embeddedDocs/function/probability/randomInt.ts` - randomInt module

**Exports:**
- Constants: `randomIntDocs`

---

### `src/expression/embeddedDocs/function/relational/compare.ts` - compare module

**Exports:**
- Constants: `compareDocs`

---

### `src/expression/embeddedDocs/function/relational/compareNatural.ts` - compareNatural module

**Exports:**
- Constants: `compareNaturalDocs`

---

### `src/expression/embeddedDocs/function/relational/compareText.ts` - compareText module

**Exports:**
- Constants: `compareTextDocs`

---

### `src/expression/embeddedDocs/function/relational/deepEqual.ts` - deepEqual module

**Exports:**
- Constants: `deepEqualDocs`

---

### `src/expression/embeddedDocs/function/relational/equal.ts` - equal module

**Exports:**
- Constants: `equalDocs`

---

### `src/expression/embeddedDocs/function/relational/equalText.ts` - equalText module

**Exports:**
- Constants: `equalTextDocs`

---

### `src/expression/embeddedDocs/function/relational/larger.ts` - larger module

**Exports:**
- Constants: `largerDocs`

---

### `src/expression/embeddedDocs/function/relational/largerEq.ts` - largerEq module

**Exports:**
- Constants: `largerEqDocs`

---

### `src/expression/embeddedDocs/function/relational/smaller.ts` - smaller module

**Exports:**
- Constants: `smallerDocs`

---

### `src/expression/embeddedDocs/function/relational/smallerEq.ts` - smallerEq module

**Exports:**
- Constants: `smallerEqDocs`

---

### `src/expression/embeddedDocs/function/relational/unequal.ts` - unequal module

**Exports:**
- Constants: `unequalDocs`

---

### `src/expression/embeddedDocs/function/set/setCartesian.ts` - setCartesian module

**Exports:**
- Constants: `setCartesianDocs`

---

### `src/expression/embeddedDocs/function/set/setDifference.ts` - setDifference module

**Exports:**
- Constants: `setDifferenceDocs`

---

### `src/expression/embeddedDocs/function/set/setDistinct.ts` - setDistinct module

**Exports:**
- Constants: `setDistinctDocs`

---

### `src/expression/embeddedDocs/function/set/setIntersect.ts` - setIntersect module

**Exports:**
- Constants: `setIntersectDocs`

---

### `src/expression/embeddedDocs/function/set/setIsSubset.ts` - setIsSubset module

**Exports:**
- Constants: `setIsSubsetDocs`

---

### `src/expression/embeddedDocs/function/set/setMultiplicity.ts` - setMultiplicity module

**Exports:**
- Constants: `setMultiplicityDocs`

---

### `src/expression/embeddedDocs/function/set/setPowerset.ts` - setPowerset module

**Exports:**
- Constants: `setPowersetDocs`

---

### `src/expression/embeddedDocs/function/set/setSize.ts` - setSize module

**Exports:**
- Constants: `setSizeDocs`

---

### `src/expression/embeddedDocs/function/set/setSymDifference.ts` - setSymDifference module

**Exports:**
- Constants: `setSymDifferenceDocs`

---

### `src/expression/embeddedDocs/function/set/setUnion.ts` - setUnion module

**Exports:**
- Constants: `setUnionDocs`

---

### `src/expression/embeddedDocs/function/signal/freqz.ts` - freqz module

**Exports:**
- Constants: `freqzDocs`

---

### `src/expression/embeddedDocs/function/signal/zpk2tf.ts` - zpk2tf module

**Exports:**
- Constants: `zpk2tfDocs`

---

### `src/expression/embeddedDocs/function/special/erf.ts` - erf module

**Exports:**
- Constants: `erfDocs`

---

### `src/expression/embeddedDocs/function/special/zeta.ts` - zeta module

**Exports:**
- Constants: `zetaDocs`

---

### `src/expression/embeddedDocs/function/statistics/corr.ts` - corr module

**Exports:**
- Constants: `corrDocs`

---

### `src/expression/embeddedDocs/function/statistics/cumsum.ts` - cumsum module

**Exports:**
- Constants: `cumSumDocs`

---

### `src/expression/embeddedDocs/function/statistics/mad.ts` - mad module

**Exports:**
- Constants: `madDocs`

---

### `src/expression/embeddedDocs/function/statistics/max.ts` - max module

**Exports:**
- Constants: `maxDocs`

---

### `src/expression/embeddedDocs/function/statistics/mean.ts` - mean module

**Exports:**
- Constants: `meanDocs`

---

### `src/expression/embeddedDocs/function/statistics/median.ts` - median module

**Exports:**
- Constants: `medianDocs`

---

### `src/expression/embeddedDocs/function/statistics/min.ts` - min module

**Exports:**
- Constants: `minDocs`

---

### `src/expression/embeddedDocs/function/statistics/mode.ts` - mode module

**Exports:**
- Constants: `modeDocs`

---

### `src/expression/embeddedDocs/function/statistics/prod.ts` - prod module

**Exports:**
- Constants: `prodDocs`

---

### `src/expression/embeddedDocs/function/statistics/quantileSeq.ts` - quantileSeq module

**Exports:**
- Constants: `quantileSeqDocs`

---

### `src/expression/embeddedDocs/function/statistics/std.ts` - std module

**Exports:**
- Constants: `stdDocs`

---

### `src/expression/embeddedDocs/function/statistics/sum.ts` - sum module

**Exports:**
- Constants: `sumDocs`

---

### `src/expression/embeddedDocs/function/statistics/variance.ts` - variance module

**Exports:**
- Constants: `varianceDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/acos.ts` - acos module

**Exports:**
- Constants: `acosDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/acosh.ts` - acosh module

**Exports:**
- Constants: `acoshDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/acot.ts` - acot module

**Exports:**
- Constants: `acotDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/acoth.ts` - acoth module

**Exports:**
- Constants: `acothDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/acsc.ts` - acsc module

**Exports:**
- Constants: `acscDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/acsch.ts` - acsch module

**Exports:**
- Constants: `acschDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/asec.ts` - asec module

**Exports:**
- Constants: `asecDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/asech.ts` - asech module

**Exports:**
- Constants: `asechDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/asin.ts` - asin module

**Exports:**
- Constants: `asinDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/asinh.ts` - asinh module

**Exports:**
- Constants: `asinhDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/atan.ts` - atan module

**Exports:**
- Constants: `atanDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/atan2.ts` - atan2 module

**Exports:**
- Constants: `atan2Docs`

---

### `src/expression/embeddedDocs/function/trigonometry/atanh.ts` - atanh module

**Exports:**
- Constants: `atanhDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/cos.ts` - cos module

**Exports:**
- Constants: `cosDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/cosh.ts` - cosh module

**Exports:**
- Constants: `coshDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/cot.ts` - cot module

**Exports:**
- Constants: `cotDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/coth.ts` - coth module

**Exports:**
- Constants: `cothDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/csc.ts` - csc module

**Exports:**
- Constants: `cscDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/csch.ts` - csch module

**Exports:**
- Constants: `cschDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/sec.ts` - sec module

**Exports:**
- Constants: `secDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/sech.ts` - sech module

**Exports:**
- Constants: `sechDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/sin.ts` - sin module

**Exports:**
- Constants: `sinDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/sinh.ts` - sinh module

**Exports:**
- Constants: `sinhDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/tan.ts` - tan module

**Exports:**
- Constants: `tanDocs`

---

### `src/expression/embeddedDocs/function/trigonometry/tanh.ts` - tanh module

**Exports:**
- Constants: `tanhDocs`

---

### `src/expression/embeddedDocs/function/units/to.ts` - to module

**Exports:**
- Constants: `toDocs`

---

### `src/expression/embeddedDocs/function/units/toBest.ts` - toBest module

**Exports:**
- Constants: `toBestDocs`

---

### `src/expression/embeddedDocs/function/utils/bin.ts` - bin module

**Exports:**
- Constants: `binDocs`

---

### `src/expression/embeddedDocs/function/utils/clone.ts` - clone module

**Exports:**
- Constants: `cloneDocs`

---

### `src/expression/embeddedDocs/function/utils/format.ts` - format module

**Exports:**
- Constants: `formatDocs`

---

### `src/expression/embeddedDocs/function/utils/hasNumericValue.ts` - hasNumericValue module

**Exports:**
- Constants: `hasNumericValueDocs`

---

### `src/expression/embeddedDocs/function/utils/hex.ts` - hex module

**Exports:**
- Constants: `hexDocs`

---

### `src/expression/embeddedDocs/function/utils/isBounded.ts` - isBounded module

**Exports:**
- Constants: `isBoundedDocs`

---

### `src/expression/embeddedDocs/function/utils/isFinite.ts` - isFinite module

**Exports:**
- Constants: `isFiniteDocs`

---

### `src/expression/embeddedDocs/function/utils/isInteger.ts` - isInteger module

**Exports:**
- Constants: `isIntegerDocs`

---

### `src/expression/embeddedDocs/function/utils/isNaN.ts` - isNaN module

**Exports:**
- Constants: `isNaNDocs`

---

### `src/expression/embeddedDocs/function/utils/isNegative.ts` - isNegative module

**Exports:**
- Constants: `isNegativeDocs`

---

### `src/expression/embeddedDocs/function/utils/isNumeric.ts` - isNumeric module

**Exports:**
- Constants: `isNumericDocs`

---

### `src/expression/embeddedDocs/function/utils/isPositive.ts` - isPositive module

**Exports:**
- Constants: `isPositiveDocs`

---

### `src/expression/embeddedDocs/function/utils/isPrime.ts` - isPrime module

**Exports:**
- Constants: `isPrimeDocs`

---

### `src/expression/embeddedDocs/function/utils/isZero.ts` - isZero module

**Exports:**
- Constants: `isZeroDocs`

---

### `src/expression/embeddedDocs/function/utils/numeric.ts` - numeric module

**Exports:**
- Constants: `numericDocs`

---

### `src/expression/embeddedDocs/function/utils/oct.ts` - oct module

**Exports:**
- Constants: `octDocs`

---

### `src/expression/embeddedDocs/function/utils/print.ts` - print module

**Exports:**
- Constants: `printDocs`

---

### `src/expression/embeddedDocs/function/utils/typeOf.ts` - typeOf module

**Exports:**
- Constants: `typeOfDocs`

---

### `src/expression/function/compile.ts` - Parse and compile an expression.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/collection.ts` | `deepMap` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../../types/index.ts` | `MathArray, Matrix` | Import (type-only) |

**Exports:**
- Constants: `createCompile`

---

### `src/expression/function/evaluate.ts` - Evaluate an expression.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/collection.ts` | `deepMap` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/map.ts` | `createEmptyMap` | Import |
| `../../../types/index.ts` | `MathArray, Matrix` | Import (type-only) |

**Exports:**
- Constants: `createEvaluate`

---

### `src/expression/function/help.ts` - Retrieve help on a function or data type.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/customs.ts` | `getSafeProperty` | Import |
| `../embeddedDocs/embeddedDocs.ts` | `embeddedDocs` | Import |
| `../../utils/object.ts` | `hasOwnProperty` | Import |

**Exports:**
- Constants: `createHelp`

---

### `src/expression/function/parser.ts` - Create a `math.Parser` object that keeps a context of variables and their values, allowing the evaluation of expressions in that context.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `../../core/function/typed.ts` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createParser`

---

### `src/expression/Help.ts` - Documentation object

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.ts` | `isHelp` | Import |
| `../utils/object.ts` | `clone` | Import |
| `../utils/string.ts` | `format` | Import |
| `../utils/factory.ts` | `factory` | Import |

**Exports:**
- Constants: `createHelpClass`

---

### `src/expression/keywords.ts` - Reserved keywords not allowed to use in the parser

**Exports:**
- Constants: `keywords`

---

### `src/expression/node/AccessorNode.ts` - Are parenthesis needed?

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isAccessorNode, isArrayNode, isConstantNode, isFunctionNode, isIndexNode, isNode, isObjectNode, isParenthesisNode, isSymbolNode` | Import |
| `../../utils/customs.ts` | `getSafeProperty` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `./utils/access.ts` | `accessFactory` | Import |
| `./Node.ts` | `MathNode` | Import (type-only) |

**Exports:**
- Constants: `createAccessorNode`

---

### `src/expression/node/ArrayNode.ts` - Holds an 1-dimensional array with items

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isArrayNode, isNode` | Import |
| `../../utils/array.ts` | `map` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `./Node.ts` | `MathNode` | Import (type-only) |

**Exports:**
- Constants: `createArrayNode`

---

### `src/expression/node/AssignmentNode.ts` - Interface for SymbolNode with name property

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isAccessorNode, isIndexNode, isNode, isSymbolNode` | Import |
| `../../utils/customs.ts` | `getSafeProperty, setSafeProperty` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `./utils/access.ts` | `accessFactory` | Import |
| `./utils/assign.ts` | `assignFactory` | Import |
| `../operators.ts` | `getPrecedence` | Import |
| `./Node.ts` | `MathNode, Scope, CompileFunction, StringOptions` | Import (type-only) |

**Exports:**
- Constants: `createAssignmentNode`

---

### `src/expression/node/BlockNode.ts` - Holds a set with blocks

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isNode` | Import |
| `../../utils/array.ts` | `forEach, map` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `./Node.ts` | `MathNode` | Import (type-only) |

**Exports:**
- Constants: `createBlockNode`

---

### `src/expression/node/ConditionalNode.ts` - Test whether a condition is met

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isBigNumber, isComplex, isNode, isUnit, typeOf` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../operators.ts` | `getPrecedence` | Import |
| `./Node.ts` | `MathNode` | Import (type-only) |

**Exports:**
- Constants: `createConditionalNode`

---

### `src/expression/node/ConstantNode.ts` - A ConstantNode holds a constant value like a number or string.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/string.ts` | `format` | Import |
| `../../utils/is.ts` | `typeOf` | Import |
| `../../utils/latex.ts` | `escapeLatex` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `./Node.ts` | `MathNode` | Import (type-only) |

**Exports:**
- Constants: `createConstantNode`

---

### `src/expression/node/FunctionAssignmentNode.ts` - Is parenthesis needed?

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isNode` | Import |
| `../keywords.ts` | `keywords` | Import |
| `../../utils/string.ts` | `escape` | Import |
| `../../utils/array.ts` | `forEach, join` | Import |
| `../../utils/latex.ts` | `toSymbol` | Import |
| `../operators.ts` | `getPrecedence` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `./Node.ts` | `MathNode` | Import (type-only) |
| `../../core/function/typed.ts` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createFunctionAssignmentNode`

---

### `src/expression/node/FunctionNode.ts` - Interface for SymbolNode with name property

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isAccessorNode, isFunctionAssignmentNode, isIndexNode, isNode, isSymbolNode` | Import |
| `../../utils/string.ts` | `escape, format` | Import |
| `../../utils/object.ts` | `hasOwnProperty` | Import |
| `../../utils/customs.ts` | `getSafeProperty, getSafeMethod` | Import |
| `../../utils/scope.ts` | `createSubScope` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/latex.ts` | `defaultTemplate, latexFunctions` | Import |
| `./Node.ts` | `MathNode, Scope, CompileFunction, StringOptions` | Import (type-only) |

**Exports:**
- Constants: `createFunctionNode`

---

### `src/expression/node/IndexNode.ts` - Describes a subset of a matrix or an object property.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/array.ts` | `map` | Import |
| `../../utils/customs.ts` | `getSafeProperty` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/is.ts` | `isArray, isConstantNode, isMatrix, isNode, isString, typeOf` | Import |
| `../../utils/string.ts` | `escape` | Import |

**Exports:**
- Constants: `createIndexNode`

---

### `src/expression/node/Node.ts` - Validate the symbol names of a scope.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isNode` | Import |
| `../keywords.ts` | `keywords` | Import |
| `../../utils/object.ts` | `deepStrictEqual` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/map.ts` | `createMap` | Import |

**Exports:**
- Interfaces: `CompiledExpression`, `StringOptions`
- Constants: `createNode`

---

### `src/expression/node/ObjectNode.ts` - Holds an object with keys/values

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/customs.ts` | `getSafeProperty` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/is.ts` | `isNode` | Import |
| `../../utils/object.ts` | `hasOwnProperty` | Import |
| `../../utils/string.ts` | `escape, stringify` | Import |

**Exports:**
- Constants: `createObjectNode`

---

### `src/expression/node/OperatorNode.ts` - Returns true if the expression starts with a constant, under

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isNode, isConstantNode, isOperatorNode, isParenthesisNode` | Import |
| `../../utils/array.ts` | `map` | Import |
| `../../utils/scope.ts` | `createSubScope` | Import |
| `../../utils/string.ts` | `escape` | Import |
| `../../utils/customs.ts` | `getSafeProperty, isSafeMethod` | Import |
| `../operators.ts` | `getAssociativity, getPrecedence, isAssociativeWith, properties` | Import |
| `../../utils/latex.ts` | `latexOperators` | Import |
| `../../utils/factory.ts` | `factory` | Import |

**Exports:**
- Constants: `createOperatorNode`

---

### `src/expression/node/ParenthesisNode.ts` - A parenthesis node describes manual parenthesis from the user input

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isNode` | Import |
| `../../utils/factory.ts` | `factory` | Import |

**Exports:**
- Constants: `createParenthesisNode`

---

### `src/expression/node/RangeNode.ts` - Calculate the necessary parentheses

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isNode, isSymbolNode` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../operators.ts` | `getPrecedence` | Import |

**Exports:**
- Constants: `createRangeNode`

---

### `src/expression/node/RelationalNode.ts` - A node representing a chained conditional expression, such as 'x > y > z'

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../operators.ts` | `getPrecedence` | Import |
| `../../utils/string.ts` | `escape` | Import |
| `../../utils/customs.ts` | `getSafeProperty` | Import |
| `../../utils/latex.ts` | `latexOperators` | Import |
| `../../utils/factory.ts` | `factory` | Import |

**Exports:**
- Constants: `createRelationalNode`

---

### `src/expression/node/SymbolNode.ts` - Check whether some name is a valueless unit like "inch".

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/string.ts` | `escape` | Import |
| `../../utils/customs.ts` | `getSafeProperty` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/latex.ts` | `toSymbol` | Import |

**Exports:**
- Constants: `createSymbolNode`

---

### `src/expression/node/utils/access.ts` - Retrieve part of an object:

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../transform/utils/errorTransform.ts` | `errorTransform` | Import |
| `../../../utils/customs.ts` | `getSafeProperty` | Import |
| `../../../core/function/typed.ts` | `TypedFunction` | Import (type-only) |

**Exports:**
- Functions: `accessFactory`

---

### `src/expression/node/utils/assign.ts` - Replace part of an object:

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../transform/utils/errorTransform.ts` | `errorTransform` | Import |
| `../../../utils/customs.ts` | `setSafeProperty` | Import |

**Exports:**
- Functions: `assignFactory`

---

### `src/expression/operators.ts` - Returns the first non-parenthesis internal node, but only

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/object.ts` | `hasOwnProperty` | Import |
| `../utils/is.ts` | `isConstantNode, isParenthesisNode, rule2Node` | Import |

**Exports:**
- Functions: `getPrecedence`, `getAssociativity`, `isAssociativeWith`, `getOperator`
- Constants: `properties`

---

### `src/expression/parse.ts` - Parse an expression. Returns a node tree, which can be evaluated by

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.ts` | `factory` | Import |
| `../utils/is.ts` | `isAccessorNode, isConstantNode, isFunctionNode, isOperatorNode, isSymbolNode, rule2Node` | Import |
| `../utils/collection.ts` | `deepMap` | Import |
| `../utils/number.ts` | `safeNumberType` | Import |
| `../utils/object.ts` | `hasOwnProperty` | Import |
| `./node/Node.ts` | `MathNode` | Import (type-only) |

**Exports:**
- Constants: `createParse`

---

### `src/expression/Parser.ts` - Parser contains methods to evaluate or parse expressions, and has a number

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.ts` | `factory` | Import |
| `../utils/is.ts` | `isFunction` | Import |
| `../utils/map.ts` | `createEmptyMap, toObject` | Import |
| `../core/function/typed.ts` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createParserClass`

---

### `src/expression/transform/and.transform.ts` - and.transform module

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../function/logical/and.ts` | `createAnd` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/is.ts` | `isCollection` | Import |
| `./types.ts` | `TypedFunction, MathFunction, ExpressionNode, EvaluationScope, MathJsLike, RawArgsTransformFunction` | Import (type-only) |

**Exports:**
- Constants: `createAndTransform`

---

### `src/expression/transform/bitAnd.transform.ts` - bitAnd.transform module

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../function/bitwise/bitAnd.ts` | `createBitAnd` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/is.ts` | `isCollection` | Import |
| `./types.ts` | `TypedFunction, MathFunction, ExpressionNode, EvaluationScope, MathJsLike, RawArgsTransformFunction` | Import (type-only) |

**Exports:**
- Constants: `createBitAndTransform`

---

### `src/expression/transform/bitOr.transform.ts` - bitOr.transform module

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../function/bitwise/bitOr.ts` | `createBitOr` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/is.ts` | `isCollection` | Import |
| `./types.ts` | `TypedFunction, MathFunction, ExpressionNode, EvaluationScope, MathJsLike, DenseMatrixConstructor, RawArgsTransformFunction` | Import (type-only) |

**Exports:**
- Constants: `createBitOrTransform`

---

### `src/expression/transform/column.transform.ts` - Attach a transform function to matrix.column

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./utils/errorTransform.ts` | `errorTransform` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../function/matrix/column.ts` | `createColumn` | Import |
| `../../utils/is.ts` | `isNumber` | Import |
| `./types.ts` | `TypedFunction, MathFunction, IndexConstructor, VariadicArgs` | Import (type-only) |

**Exports:**
- Constants: `createColumnTransform`

---

### `src/expression/transform/concat.transform.ts` - Attach a transform function to math.range

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isBigNumber, isNumber` | Import |
| `./utils/errorTransform.ts` | `errorTransform` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../function/matrix/concat.ts` | `createConcat` | Import |
| `./types.ts` | `TypedFunction, MathFunction, BigNumberLike, VariadicArgs` | Import (type-only) |

**Exports:**
- Constants: `createConcatTransform`

---

### `src/expression/transform/cumsum.transform.ts` - Attach a transform function to math.sum

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isBigNumber, isCollection, isNumber` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `./utils/errorTransform.ts` | `errorTransform` | Import |
| `../../function/statistics/cumsum.ts` | `createCumSum` | Import |
| `./types.ts` | `TypedFunction, MathFunction, BigNumberLike, VariadicArgs` | Import (type-only) |

**Exports:**
- Constants: `createCumSumTransform`

---

### `src/expression/transform/diff.transform.ts` - Attach a transform function to math.diff

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `./utils/errorTransform.ts` | `errorTransform` | Import |
| `../../function/matrix/diff.ts` | `createDiff` | Import |
| `./utils/lastDimToZeroBase.ts` | `lastDimToZeroBase` | Import |
| `./types.ts` | `TypedFunction, MathFunction, VariadicArgs` | Import (type-only) |

**Exports:**
- Constants: `createDiffTransform`

---

### `src/expression/transform/filter.transform.ts` - Attach a transform function to math.filter

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../function/matrix/filter.ts` | `createFilter` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/is.ts` | `isFunctionAssignmentNode, isSymbolNode` | Import |
| `./utils/compileInlineExpression.ts` | `compileInlineExpression` | Import |
| `./utils/transformCallback.ts` | `createTransformCallback` | Import |
| `./types.ts` | `TypedFunction, ExpressionNode, EvaluationScope, MathJsLike, CallbackFunction, RawArgsTransformFunction` | Import (type-only) |

**Exports:**
- Constants: `createFilterTransform`

---

### `src/expression/transform/forEach.transform.ts` - Attach a transform function to math.forEach

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../function/matrix/forEach.ts` | `createForEach` | Import |
| `./utils/transformCallback.ts` | `createTransformCallback` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/is.ts` | `isFunctionAssignmentNode, isSymbolNode` | Import |
| `./utils/compileInlineExpression.ts` | `compileInlineExpression` | Import |
| `./types.ts` | `TypedFunction, ExpressionNode, EvaluationScope, MathJsLike, CallbackFunction, RawArgsTransformFunction` | Import (type-only) |

**Exports:**
- Constants: `createForEachTransform`

---

### `src/expression/transform/index.transform.ts` - Attach a transform function to math.index

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isArray, isBigInt, isBigNumber, isMatrix, isNumber, isRange` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `./types.ts` | `IndexConstructor, IndexInstance, BigNumberLike, RangeLike, SetLike, MatrixLike` | Import (type-only) |

**Exports:**
- Constants: `createIndexTransform`

---

### `src/expression/transform/map.transform.ts` - Attach a transform function to math.map

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/is.ts` | `isFunctionAssignmentNode, isSymbolNode` | Import |
| `../../function/matrix/map.ts` | `createMap` | Import |
| `./utils/compileInlineExpression.ts` | `compileInlineExpression` | Import |
| `./utils/transformCallback.ts` | `createTransformCallback` | Import |
| `./types.ts` | `TypedFunction, ExpressionNode, EvaluationScope, MathJsLike, CallbackFunction, RawArgsTransformFunction` | Import (type-only) |

**Exports:**
- Constants: `createMapTransform`

---

### `src/expression/transform/mapSlices.transform.ts` - Attach a transform function to math.mapSlices

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./utils/errorTransform.ts` | `errorTransform` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../function/matrix/mapSlices.ts` | `createMapSlices` | Import |
| `../../utils/is.ts` | `isBigNumber, isNumber` | Import |
| `./types.ts` | `TypedFunction, BigNumberLike, VariadicArgs` | Import (type-only) |

**Exports:**
- Constants: `createMapSlicesTransform`

---

### `src/expression/transform/max.transform.ts` - Attach a transform function to math.max

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `./utils/errorTransform.ts` | `errorTransform` | Import |
| `../../function/statistics/max.ts` | `createMax` | Import |
| `./utils/lastDimToZeroBase.ts` | `lastDimToZeroBase` | Import |
| `./types.ts` | `TypedFunction, MathFunction, MathJsConfig, VariadicArgs` | Import (type-only) |

**Exports:**
- Constants: `createMaxTransform`

---

### `src/expression/transform/mean.transform.ts` - Attach a transform function to math.mean

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `./utils/errorTransform.ts` | `errorTransform` | Import |
| `../../function/statistics/mean.ts` | `createMean` | Import |
| `./utils/lastDimToZeroBase.ts` | `lastDimToZeroBase` | Import |
| `./types.ts` | `TypedFunction, VariadicArgs` | Import (type-only) |

**Exports:**
- Constants: `createMeanTransform`

---

### `src/expression/transform/min.transform.ts` - Attach a transform function to math.min

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `./utils/errorTransform.ts` | `errorTransform` | Import |
| `../../function/statistics/min.ts` | `createMin` | Import |
| `./utils/lastDimToZeroBase.ts` | `lastDimToZeroBase` | Import |
| `./types.ts` | `TypedFunction, MathFunction, MathJsConfig, VariadicArgs` | Import (type-only) |

**Exports:**
- Constants: `createMinTransform`

---

### `src/expression/transform/nullish.transform.ts` - nullish.transform module

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../function/logical/nullish.ts` | `createNullish` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/is.ts` | `isCollection` | Import |
| `./types.ts` | `TypedFunction, MathFunction, ExpressionNode, EvaluationScope, MathJsLike, RawArgsTransformFunction` | Import (type-only) |

**Exports:**
- Constants: `createNullishTransform`

---

### `src/expression/transform/or.transform.ts` - or.transform module

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../function/logical/or.ts` | `createOr` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/is.ts` | `isCollection` | Import |
| `./types.ts` | `TypedFunction, MathFunction, ExpressionNode, EvaluationScope, MathJsLike, DenseMatrixConstructor, RawArgsTransformFunction` | Import (type-only) |

**Exports:**
- Constants: `createOrTransform`

---

### `src/expression/transform/print.transform.ts` - Print format options

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../function/string/print.ts` | `createPrint` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/print.ts` | `printTemplate` | Import |
| `./types.ts` | `TypedFunction, MathFunction` | Import (type-only) |

**Exports:**
- Constants: `createPrintTransform`

---

### `src/expression/transform/quantileSeq.transform.ts` - Attach a transform function to math.quantileSeq

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `../../function/statistics/quantileSeq.ts` | `createQuantileSeq` | Import |
| `./utils/lastDimToZeroBase.ts` | `lastDimToZeroBase` | Import |
| `./types.ts` | `TypedFunction, MathFunction, VariadicArgs` | Import (type-only) |

**Exports:**
- Constants: `createQuantileSeqTransform`

---

### `src/expression/transform/range.transform.ts` - Attach a transform function to math.range

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `../../function/matrix/range.ts` | `createRange` | Import |
| `./types.ts` | `TypedFunction, MathFunction, MathJsConfig, VariadicArgs` | Import (type-only) |

**Exports:**
- Constants: `createRangeTransform`

---

### `src/expression/transform/row.transform.ts` - Attach a transform function to matrix.column

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `../../function/matrix/row.ts` | `createRow` | Import |
| `./utils/errorTransform.ts` | `errorTransform` | Import |
| `../../utils/is.ts` | `isNumber` | Import |
| `./types.ts` | `TypedFunction, MathFunction, IndexConstructor, VariadicArgs` | Import (type-only) |

**Exports:**
- Constants: `createRowTransform`

---

### `src/expression/transform/std.transform.ts` - Attach a transform function to math.std

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `../../function/statistics/std.ts` | `createStd` | Import |
| `./utils/errorTransform.ts` | `errorTransform` | Import |
| `./utils/lastDimToZeroBase.ts` | `lastDimToZeroBase` | Import |
| `./types.ts` | `TypedFunction, VariadicArgs` | Import (type-only) |

**Exports:**
- Constants: `createStdTransform`

---

### `src/expression/transform/subset.transform.ts` - Attach a transform function to math.subset

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `./utils/errorTransform.ts` | `errorTransform` | Import |
| `../../function/matrix/subset.ts` | `createSubset` | Import |
| `./types.ts` | `TypedFunction, MathFunction, VariadicArgs` | Import (type-only) |

**Exports:**
- Constants: `createSubsetTransform`

---

### `src/expression/transform/sum.transform.ts` - Attach a transform function to math.sum

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `./utils/errorTransform.ts` | `errorTransform` | Import |
| `../../function/statistics/sum.ts` | `createSum` | Import |
| `./utils/lastDimToZeroBase.ts` | `lastDimToZeroBase` | Import |
| `./types.ts` | `TypedFunction, MathFunction, MathJsConfig, VariadicArgs` | Import (type-only) |

**Exports:**
- Constants: `createSumTransform`

---

### `src/expression/transform/types.ts` - Shared type definitions for transform functions

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../core/function/typed.ts` | `TypedFunction` | Import (type-only) |

---

### `src/expression/transform/utils/compileInlineExpression.ts` - Compile an inline expression like "x > 0"

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/is.ts` | `isSymbolNode` | Import |
| `../../../utils/map.ts` | `PartitionedMap` | Import |
| `../types.ts` | `ExpressionNode, EvaluationScope, MathJsLike` | Import (type-only) |

**Exports:**
- Functions: `compileInlineExpression`

---

### `src/expression/transform/utils/dimToZeroBase.ts` - Change last argument dim from one-based to zero-based.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/is.ts` | `isNumber, isBigNumber` | Import |
| `../types.ts` | `BigNumberLike, DimensionValue` | Import (type-only) |

**Exports:**
- Functions: `dimToZeroBase`, `isNumberOrBigNumber`

---

### `src/expression/transform/utils/errorTransform.ts` - Transform zero-based indices to one-based indices in errors

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../error/IndexError.ts` | `IndexError` | Import |
| `../types.ts` | `IndexError` | Import (type-only) |

**Exports:**
- Functions: `errorTransform`

---

### `src/expression/transform/utils/lastDimToZeroBase.ts` - Change last argument dim from one-based to zero-based.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/is.ts` | `isCollection` | Import |
| `./dimToZeroBase.ts` | `dimToZeroBase, isNumberOrBigNumber` | Import |
| `../types.ts` | `VariadicArgs` | Import (type-only) |

**Exports:**
- Functions: `lastDimToZeroBase`

---

### `src/expression/transform/utils/transformCallback.ts` - Typed-function signatures record type

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../types.ts` | `TypedFunction, CallbackFunction` | Import (type-only) |

**Exports:**
- Constants: `createTransformCallback`

---

### `src/expression/transform/variance.transform.ts` - Attach a transform function to math.var

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `./utils/errorTransform.ts` | `errorTransform` | Import |
| `../../function/statistics/variance.ts` | `createVariance` | Import |
| `./utils/lastDimToZeroBase.ts` | `lastDimToZeroBase` | Import |
| `./types.ts` | `TypedFunction, VariadicArgs` | Import (type-only) |

**Exports:**
- Constants: `createVarianceTransform`

---

### `src/expression/types.ts` - Type definitions for expression module

---

## Geometry Dependencies

### `src/geometry/distance.ts` - Calculates:

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isBigNumber` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../../types.js` | `MathNumericType` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createDistance`

---

### `src/geometry/intersect.ts` - Calculates the point of intersection of two lines in two or three dimensions

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../../types.js` | `MathNumericType` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createIntersect`

---

## Entry Dependencies

### `src/index.ts` - Mathematical functions for MathTS - arithmetic, algebra,

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./typed/index.js` | `*` | Re-export |

**Exports:**
- Re-exports: `* from ./typed/index.js`

---

## Logical Dependencies

### `src/logical/and.ts` - Logical `and`. Test whether two values are both defined with a nonzero/nonempty value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../type/matrix/utils/matAlgo02xDS0.js` | `createMatAlgo02xDS0` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matAlgo14xDs.js` | `createMatAlgo14xDs` | Import |
| `../type/matrix/utils/matAlgo06xS0S0.js` | `createMatAlgo06xS0S0` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `../plain/number/index.js` | `andNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createAnd`

---

### `src/logical/not.ts` - Logical `not`. Flips boolean value of a given parameter.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../plain/number/index.js` | `notNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createNot`

---

### `src/logical/nullish.ts` - Nullish coalescing operator (??). Returns the right-hand side operand

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matAlgo03xDSf.js` | `createMatAlgo03xDSf` | Import |
| `../type/matrix/utils/matAlgo14xDs.js` | `createMatAlgo14xDs` | Import |
| `../type/matrix/utils/matAlgo13xDD.js` | `createMatAlgo13xDD` | Import |
| `../error/DimensionError.js` | `DimensionError` | Import |
| `../../types.js` | `TypedFunction, Matrix, SparseMatrix, MatrixConstructor, Complex, BigNumber, Fraction, Unit` | Import |

**Exports:**
- Constants: `createNullish`

---

### `src/logical/or.ts` - Logical `or`. Test if at least one value is defined with a nonzero/nonempty value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../type/matrix/utils/matAlgo03xDSf.js` | `createMatAlgo03xDSf` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matAlgo05xSfSf.js` | `createMatAlgo05xSfSf` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `../plain/number/index.js` | `orNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createOr`

---

### `src/logical/xor.ts` - Logical `xor`. Test whether one and only one value is defined with a nonzero/nonempty value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../type/matrix/utils/matAlgo03xDSf.js` | `createMatAlgo03xDSf` | Import |
| `../type/matrix/utils/matAlgo07xSSf.js` | `createMatAlgo07xSSf` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `../plain/number/index.js` | `xorNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createXor`

---

## Matrix Dependencies

### `src/matrix/column.ts` - Return a column from a Matrix.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/is.js` | `isMatrix` | Import |
| `../utils/object.js` | `clone` | Import |
| `../utils/array.js` | `validateIndex` | Import |

**Exports:**
- Constants: `createColumn`

---

### `src/matrix/concat.ts` - Concatenate two or more matrices.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isBigNumber, isMatrix, isNumber` | Import |
| `../utils/object.js` | `clone` | Import |
| `../utils/array.js` | `arraySize, concat` | Import |
| `../error/IndexError.js` | `IndexError` | Import |
| `../error/DimensionError.js` | `DimensionError` | Import |
| `../utils/factory.js` | `factory` | Import |

**Exports:**
- Constants: `createConcat`

---

### `src/matrix/count.ts` - Count the number of elements of a matrix, array or string.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCount`

---

### `src/matrix/cross.ts` - Calculate the cross product for two vectors in three dimensional space.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `arraySize, squeeze` | Import |
| `../utils/factory.js` | `factory` | Import |

**Exports:**
- Constants: `createCross`

---

### `src/matrix/ctranspose.ts` - Transpose and complex conjugate a matrix. All values of the matrix are

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCtranspose`

---

### `src/matrix/det.ts` - Check if a 2D array contains only plain numbers

**External Dependencies:**
| Package | Import |
|---------|--------|
| `bignumber.js` | `BigNumber` |
| `complex.js` | `Complex` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isMatrix` | Import |
| `../utils/object.js` | `clone` | Import |
| `../utils/string.js` | `format` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |

**Exports:**
- Constants: `createDet`

---

### `src/matrix/diag.ts` - Create a diagonal matrix or retrieve the diagonal of a matrix

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isMatrix` | Import |
| `../utils/array.js` | `arraySize` | Import |
| `../utils/number.js` | `isInteger` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createDiag`

---

### `src/matrix/diff.ts` - Create a new matrix or array of the difference between elements of the given array

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/number.js` | `isInteger` | Import |
| `../utils/is.js` | `isMatrix` | Import |
| `../../types.js` | `TypedFunction, Matrix, MatrixConstructor` | Import |

**Exports:**
- Constants: `createDiff`

---

### `src/matrix/dot.ts` - Calculate the dot product of two vectors. The dot product of

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/is.js` | `isMatrix` | Import |

**Exports:**
- Constants: `createDot`

---

### `src/matrix/eigs/complexEigs.ts` - Flatten a 2D array to a Float64Array in row-major order

**External Dependencies:**
| Package | Import |
|---------|--------|
| `bignumber.js` | `BigNumber` |
| `complex.js` | `Complex` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/object.js` | `clone` | Import |
| `../../wasm/WasmLoader.js` | `wasmLoader` | Import |

**Exports:**
- Functions: `createComplexEigs`

---

### `src/matrix/eigs/realSymmetric.ts` - Flatten a 2D array to a Float64Array in row-major order

**External Dependencies:**
| Package | Import |
|---------|--------|
| `bignumber.js` | `BigNumber` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/object.js` | `clone` | Import |
| `../../wasm/WasmLoader.js` | `wasmLoader` | Import |

**Exports:**
- Functions: `createRealSymmetric`

---

### `src/matrix/eigs.ts` - Compute eigenvalues and optionally eigenvectors of a square matrix.

**External Dependencies:**
| Package | Import |
|---------|--------|
| `bignumber.js` | `BigNumber` |
| `complex.js` | `Complex` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/string.js` | `format` | Import |
| `./eigs/complexEigs.js` | `createComplexEigs` | Import |
| `./eigs/realSymmetric.js` | `createRealSymmetric` | Import |
| `../utils/is.js` | `typeOf, isNumber, isBigNumber, isComplex, isFraction` | Import |

**Exports:**
- Constants: `createEigs`

---

### `src/matrix/expm.ts` - Compute the matrix exponential, expm(A) = e^A. The matrix must be square.

**External Dependencies:**
| Package | Import |
|---------|--------|
| `bignumber.js` | `BigNumber` |
| `complex.js` | `Complex` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isSparseMatrix` | Import |
| `../utils/string.js` | `format` | Import |
| `../utils/factory.js` | `factory` | Import |

**Exports:**
- Constants: `createExpm`

---

### `src/matrix/fft.ts` - Check if n is a power of 2

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `arraySize` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |

**Exports:**
- Constants: `createFft`

---

### `src/matrix/filter.ts` - Filter the items in an array or one dimensional matrix.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/optimizeCallback.js` | `optimizeCallback` | Import |
| `../utils/array.js` | `filter, filterRegExp` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createFilter`

---

### `src/matrix/flatten.ts` - Flatten a multidimensional matrix into a single dimensional matrix.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `flatten` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createFlatten`

---

### `src/matrix/forEach.ts` - Iterate over all elements of a matrix/array, and executes the given callback function.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/optimizeCallback.js` | `optimizeCallback` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/array.js` | `deepForEach` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createForEach`

---

### `src/matrix/getMatrixDataType.ts` - Find the data type of all elements in a matrix or array,

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/array.js` | `getArrayDataType` | Import |
| `../utils/is.js` | `typeOf` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createGetMatrixDataType`

---

### `src/matrix/identity.ts` - Create a 2-dimensional identity matrix with size m x n or n x n.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isBigNumber` | Import |
| `../utils/array.js` | `resize` | Import |
| `../utils/number.js` | `isInteger` | Import |
| `../utils/factory.js` | `factory` | Import |

**Exports:**
- Constants: `createIdentity`

---

### `src/matrix/ifft.ts` - Check if n is a power of 2

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `arraySize` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/is.js` | `isMatrix` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |

**Exports:**
- Constants: `createIfft`

---

### `src/matrix/inv.ts` - Check if a 2D array contains only plain numbers

**External Dependencies:**
| Package | Import |
|---------|--------|
| `bignumber.js` | `BigNumber` |
| `complex.js` | `Complex` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isMatrix` | Import |
| `../utils/array.js` | `arraySize` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/string.js` | `format` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |

**Exports:**
- Constants: `createInv`

---

### `src/matrix/kron.ts` - Check if a 2D array contains only plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `arraySize` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |

**Exports:**
- Constants: `createKron`

---

### `src/matrix/map.ts` - Create a new matrix or array with the results of a callback function executed on

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/optimizeCallback.js` | `optimizeCallback` | Import |
| `../utils/array.js` | `arraySize, broadcastSizes, broadcastTo, get, deepMap` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createMap`

---

### `src/matrix/mapSlices.ts` - Apply a function that maps an array to a scalar

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/array.js` | `arraySize` | Import |
| `../utils/is.js` | `isMatrix` | Import |
| `../error/IndexError.js` | `IndexError` | Import |
| `../../types.js` | `TypedFunction, Matrix, BigNumber` | Import |

**Exports:**
- Constants: `createMapSlices`

---

### `src/matrix/matrixFromColumns.ts` - Create a dense matrix from vectors as individual columns.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |

**Exports:**
- Constants: `createMatrixFromColumns`

---

### `src/matrix/matrixFromFunction.ts` - Create a matrix by evaluating a generating function at each index.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../../types.js` | `TypedFunction, Matrix` | Import |

**Exports:**
- Constants: `createMatrixFromFunction`

---

### `src/matrix/matrixFromRows.ts` - Create a dense matrix from vectors as individual rows.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |

**Exports:**
- Constants: `createMatrixFromRows`

---

### `src/matrix/ones.ts` - Create a matrix filled with ones. The created matrix can have one or

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isBigNumber` | Import |
| `../utils/number.js` | `isInteger` | Import |
| `../utils/array.js` | `resize` | Import |
| `../utils/factory.js` | `factory` | Import |

**Exports:**
- Constants: `createOnes`

---

### `src/matrix/partitionSelect.ts` - Check if an array is a flat array of plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isMatrix` | Import |
| `../utils/number.js` | `isInteger` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |

**Exports:**
- Constants: `createPartitionSelect`

---

### `src/matrix/pinv.ts` - Calculate the Moore–Penrose inverse of a matrix.

**External Dependencies:**
| Package | Import |
|---------|--------|
| `bignumber.js` | `BigNumber` |
| `complex.js` | `Complex` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isMatrix` | Import |
| `../utils/array.js` | `arraySize` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/string.js` | `format` | Import |
| `../utils/object.js` | `clone` | Import |

**Exports:**
- Constants: `createPinv`

---

### `src/matrix/range.ts` - Create a matrix or array containing a range of values.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/noop.js` | `noBignumber, noMatrix` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `MathJsConfig` | Import (type-only) |

**Exports:**
- Constants: `createRange`

---

### `src/matrix/reshape.ts` - Reshape a multi dimensional array to fit the specified dimensions

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `reshape` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createReshape`

---

### `src/matrix/resize.ts` - Resize a matrix

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isBigNumber, isMatrix` | Import |
| `../error/DimensionError.js` | `DimensionError` | Import |
| `../error/ArgumentsError.js` | `ArgumentsError` | Import |
| `../utils/number.js` | `isInteger` | Import |
| `../utils/string.js` | `format` | Import |
| `../utils/object.js` | `clone` | Import |
| `../utils/array.js` | `resize` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/config.js` | `MathJsConfig` | Import (type-only) |

**Exports:**
- Constants: `createResize`

---

### `src/matrix/rotate.ts` - Rotate a vector of size 1x2 counter-clockwise by a given angle

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/array.js` | `arraySize` | Import |
| `../../types.js` | `TypedFunction, Matrix, BigNumber, Complex, Unit` | Import |

**Exports:**
- Constants: `createRotate`

---

### `src/matrix/rotationMatrix.ts` - Create a 2-dimensional counter-clockwise rotation matrix (2x2) for a given angle (expressed in radians).

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isBigNumber` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../../types.js` | `TypedFunction, Matrix, MatrixConstructor, BigNumber, Complex, Unit` | Import |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createRotationMatrix`

---

### `src/matrix/row.ts` - Return a row from a Matrix.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/is.js` | `isMatrix` | Import |
| `../utils/object.js` | `clone` | Import |
| `../utils/array.js` | `validateIndex` | Import |

**Exports:**
- Constants: `createRow`

---

### `src/matrix/size.ts` - Calculate the size of a matrix or scalar. Always returns an Array containing numbers.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `arraySize` | Import |
| `../utils/factory.js` | `factory` | Import |

**Exports:**
- Constants: `createSize`

---

### `src/matrix/sort.ts` - Sort the items in a matrix.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `arraySize` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../../types.js` | `TypedFunction, Matrix` | Import |

**Exports:**
- Constants: `createSort`

---

### `src/matrix/sqrtm.ts` - Calculate the principal square root matrix using the Denman-Beavers iterative method

**External Dependencies:**
| Package | Import |
|---------|--------|
| `bignumber.js` | `BigNumber` |
| `complex.js` | `Complex` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isMatrix` | Import |
| `../utils/string.js` | `format` | Import |
| `../utils/array.js` | `arraySize` | Import |
| `../utils/factory.js` | `factory` | Import |

**Exports:**
- Constants: `createSqrtm`

---

### `src/matrix/squeeze.ts` - Squeeze a matrix, remove inner and outer singleton dimensions from a matrix.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/object.js` | `clone` | Import |
| `../utils/array.js` | `squeeze` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createSqueeze`

---

### `src/matrix/subset.ts` - Get or set a subset of a matrix or string.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isIndex` | Import |
| `../utils/object.js` | `clone` | Import |
| `../utils/array.js` | `isEmptyIndex, validateIndex, validateIndexSourceSize` | Import |
| `../utils/customs.js` | `getSafeProperty, setSafeProperty` | Import |
| `../error/DimensionError.js` | `DimensionError` | Import |
| `../utils/factory.js` | `factory` | Import |

**Exports:**
- Constants: `createSubset`

---

### `src/matrix/trace.ts` - Calculate the trace of a matrix: the sum of the elements on the main

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/object.js` | `clone` | Import |
| `../utils/string.js` | `format` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createTrace`

---

### `src/matrix/transpose.ts` - Check if a 2D array contains only plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/object.js` | `clone` | Import |
| `../utils/string.js` | `format` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createTranspose`

---

### `src/matrix/zeros.ts` - Create a matrix filled with zeros. The created matrix can have one or

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isBigNumber` | Import |
| `../utils/number.js` | `isInteger` | Import |
| `../utils/array.js` | `resize` | Import |
| `../utils/factory.js` | `factory` | Import |

**Exports:**
- Constants: `createZeros`

---

## Numeric Dependencies

### `src/numeric/solveODE.ts` - Butcher Tableau structure for Runge-Kutta methods

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isUnit, isNumber, isBigNumber` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../../types.js` | `MathNumericType, MathArray, Matrix, Unit, BigNumber` | Import (type-only) |

**Exports:**
- Constants: `createSolveODE`

---

## Plain Dependencies

### `src/plain/bignumber/arithmetic.ts` - Interface for functions with a signature property

**External Dependencies:**
| Package | Import |
|---------|--------|
| `decimal.js` | `Decimal` |

**Exports:**
- Constants: `absBigNumber`, `addBigNumber`, `subtractBigNumber`, `multiplyBigNumber`, `divideBigNumber`

---

### `src/plain/bignumber/index.ts` - Extended BigNumber interface with mathjs-specific properties

**External Dependencies:**
| Package | Import |
|---------|--------|
| `decimal.js` | `Decimal` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./arithmetic.ts` | `*` | Re-export |

**Exports:**
- Interfaces: `PlainBigNumber`, `PlainBigNumberConstructor`
- Functions: `bignumber`
- Re-exports: `* from ./arithmetic.ts`

---

### `src/plain/number/arithmetic.ts` - Calculate gcd for numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/number.ts` | `cbrt, expm1, isInteger, log10, log1p, log2, sign, toFixed` | Import |

**Exports:**
- Functions: `absNumber`, `addNumber`, `subtractNumber`, `multiplyNumber`, `divideNumber`, `unaryMinusNumber`, `unaryPlusNumber`, `cbrtNumber`, `cubeNumber`, `expNumber`, `expm1Number`, `gcdNumber`, `lcmNumber`, `logNumber`, `log10Number`, `log2Number`, `log1pNumber`, `modNumber`, `nthRootNumber`, `signNumber`, `sqrtNumber`, `squareNumber`, `xgcdNumber`, `powNumber`, `roundNumber`, `normNumber`

---

### `src/plain/number/bitwise.ts` - bitwise module

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/number.ts` | `isInteger` | Import |

**Exports:**
- Functions: `bitAndNumber`, `bitNotNumber`, `bitOrNumber`, `bitXorNumber`, `leftShiftNumber`, `rightArithShiftNumber`, `rightLogShiftNumber`

---

### `src/plain/number/combinations.ts` - combinations module

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/number.ts` | `isInteger` | Import |
| `../../utils/product.ts` | `product` | Import |

**Exports:**
- Functions: `combinationsNumber`

---

### `src/plain/number/constants.ts` - constants module

**Exports:**
- Constants: `pi`, `tau`, `e`, `phi`

---

### `src/plain/number/index.ts` - index module

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./arithmetic.ts` | `*` | Re-export |
| `./bitwise.ts` | `*` | Re-export |
| `./combinations.ts` | `*` | Re-export |
| `./constants.ts` | `*` | Re-export |
| `./logical.ts` | `*` | Re-export |
| `./relational.ts` | `*` | Re-export |
| `./probability.ts` | `*` | Re-export |
| `./trigonometry.ts` | `*` | Re-export |
| `./utils.ts` | `*` | Re-export |

**Exports:**
- Re-exports: `* from ./arithmetic.ts`, `* from ./bitwise.ts`, `* from ./combinations.ts`, `* from ./constants.ts`, `* from ./logical.ts`, `* from ./relational.ts`, `* from ./probability.ts`, `* from ./trigonometry.ts`, `* from ./utils.ts`

---

### `src/plain/number/logical.ts` - logical module

**Exports:**
- Functions: `notNumber`, `orNumber`, `xorNumber`, `andNumber`

---

### `src/plain/number/probability.ts` - TODO: comment on the variables g and p

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/number.ts` | `isInteger` | Import |
| `../../utils/product.ts` | `product` | Import |

**Exports:**
- Functions: `gammaNumber`, `lgammaNumber`
- Constants: `gammaG`, `gammaP`, `lnSqrt2PI`, `lgammaG`, `lgammaN`, `lgammaSeries`

---

### `src/plain/number/relational.ts` - Relational operations for plain numbers

**Exports:**
- Functions: `equalNumber`, `unequalNumber`, `smallerNumber`, `smallerEqNumber`, `largerNumber`, `largerEqNumber`, `compareNumber`

---

### `src/plain/number/trigonometry.ts` - trigonometry module

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/number.ts` | `acosh, asinh, atanh, cosh, sign, sinh, tanh` | Import |

**Exports:**
- Functions: `acosNumber`, `acoshNumber`, `acotNumber`, `acothNumber`, `acscNumber`, `acschNumber`, `asecNumber`, `asechNumber`, `asinNumber`, `asinhNumber`, `atanNumber`, `atan2Number`, `atanhNumber`, `cosNumber`, `coshNumber`, `cotNumber`, `cothNumber`, `cscNumber`, `cschNumber`, `secNumber`, `sechNumber`, `sinNumber`, `sinhNumber`, `tanNumber`, `tanhNumber`

---

### `src/plain/number/utils.ts` - utils module

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/number.ts` | `isInteger` | Import |

**Exports:**
- Functions: `isIntegerNumber`, `isNegativeNumber`, `isPositiveNumber`, `isZeroNumber`, `isNaNNumber`

---

## Probability Dependencies

### `src/probability/bernoulli.ts` - Return the `n`th Bernoulli number, for positive integers `n`

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/number.js` | `isInteger` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createBernoulli`

---

### `src/probability/combinations.ts` - Compute the number of ways of picking `k` unordered outcomes from `n`

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../plain/number/combinations.js` | `combinationsNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCombinations`

---

### `src/probability/combinationsWithRep.ts` - Compute the number of ways of picking `k` unordered outcomes from `n`

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/number.js` | `isInteger` | Import |
| `../utils/product.js` | `product` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCombinationsWithRep`

---

### `src/probability/factorial.ts` - Compute the factorial of a value

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createFactorial`

---

### `src/probability/gamma.ts` - Compute the gamma function of a value using Lanczos approximation for

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../plain/number/index.js` | `gammaG, gammaNumber, gammaP` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createGamma`

---

### `src/probability/kldivergence.ts` - Calculate the Kullback-Leibler (KL) divergence  between two distributions

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createKldivergence`

---

### `src/probability/lgamma.ts` - The coefficients are B[2*n]/(2*n*(2*n - 1)) where B[2*n] is the (2*n)th Bernoulli number. See (1.1) in [1].

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../plain/number/index.js` | `lgammaNumber, lnSqrt2PI` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/number.js` | `copysign` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createLgamma`

---

### `src/probability/multinomial.ts` - Multinomial Coefficients compute the number of ways of picking a1, a2, ..., ai unordered outcomes from `n` possibilities.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `deepForEach` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createMultinomial`

---

### `src/probability/permutations.ts` - Compute the number of ways of obtaining an ordered subset of `k` elements

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/number.js` | `isInteger` | Import |
| `../utils/product.js` | `product` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createPermutations`

---

### `src/probability/pickRandom.ts` - Random pick one or more values from a one dimensional array.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `flatten` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/is.js` | `isMatrix, isNumber` | Import |
| `./util/seededRNG.js` | `createRng` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createPickRandom`

---

### `src/probability/random.ts` - Return a random number larger or equal to `min` and smaller than `max`

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/is.js` | `isMatrix` | Import |
| `./util/seededRNG.js` | `createRng` | Import |
| `./util/randomMatrix.js` | `randomMatrix` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createRandom`, `createRandomNumber`

---

### `src/probability/randomInt.ts` - Return a random integer number larger or equal to `min` and smaller than `max`

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `./util/randomMatrix.js` | `randomMatrix` | Import |
| `./util/seededRNG.js` | `createRng` | Import |
| `../utils/is.js` | `isMatrix` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createRandomInt`

---

### `src/probability/util/randomMatrix.ts` - This is a util function for generating a random matrix recursively.

**Exports:**
- Functions: `randomMatrix`

---

### `src/probability/util/seededRNG.ts` - @ts-ignore - seedrandom may not have type declarations

**External Dependencies:**
| Package | Import |
|---------|--------|
| `seedrandom` | `seedrandom` |

**Exports:**
- Functions: `createRng`

---

## Relational Dependencies

### `src/relational/compare.ts` - Compare two values. Returns 1 when x > y, -1 when x < y, and 0 when x == y.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/bignumber/nearlyEqual.js` | `nearlyEqual` | Import |
| `../utils/number.js` | `nearlyEqual` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matAlgo03xDSf.js` | `createMatAlgo03xDSf` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matAlgo05xSfSf.js` | `createMatAlgo05xSfSf` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `./compareUnits.js` | `createCompareUnits` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createCompare`, `createCompareNumber`

---

### `src/relational/compareNatural.ts` - Compare two values of any type in a deterministic, natural way.

**External Dependencies:**
| Package | Import |
|---------|--------|
| `javascript-natural-sort` | `naturalSort` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isDenseMatrix, isSparseMatrix, typeOf` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCompareNatural`

---

### `src/relational/compareText.ts` - Compare two strings lexically. Comparison is case sensitive.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/string.js` | `compareText` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCompareText`, `createCompareTextNumber`

---

### `src/relational/compareUnits.ts` - Type definitions for compareUnits

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCompareUnits`

---

### `src/relational/deepEqual.ts` - Test element wise whether two matrices are equal.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createDeepEqual`

---

### `src/relational/equal.ts` - Test whether two values are equal.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matAlgo03xDSf.js` | `createMatAlgo03xDSf` | Import |
| `../type/matrix/utils/matAlgo07xSSf.js` | `createMatAlgo07xSSf` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createEqual`, `createEqualNumber`

---

### `src/relational/equalScalar.ts` - Test whether two scalar values are nearly equal.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/bignumber/nearlyEqual.js` | `nearlyEqual` | Import |
| `../utils/number.js` | `nearlyEqual` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/complex.js` | `complexEquals` | Import |
| `./compareUnits.js` | `createCompareUnits` | Import |
| `../../types.js` | `TypedFunction, BigNumber, Complex, Fraction` | Import |
| `../core/config.js` | `ConfigOptions` | Import |

**Exports:**
- Constants: `createEqualScalar`, `createEqualScalarNumber`

---

### `src/relational/equalText.ts` - Check equality of two strings. Comparison is case sensitive.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createEqualText`

---

### `src/relational/larger.ts` - Test whether value x is larger than y.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/bignumber/nearlyEqual.js` | `nearlyEqual` | Import |
| `../utils/number.js` | `nearlyEqual` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matAlgo03xDSf.js` | `createMatAlgo03xDSf` | Import |
| `../type/matrix/utils/matAlgo07xSSf.js` | `createMatAlgo07xSSf` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `./compareUnits.js` | `createCompareUnits` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createLarger`, `createLargerNumber`

---

### `src/relational/largerEq.ts` - Test whether value x is larger or equal to y.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/bignumber/nearlyEqual.js` | `nearlyEqual` | Import |
| `../utils/number.js` | `nearlyEqual` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matAlgo03xDSf.js` | `createMatAlgo03xDSf` | Import |
| `../type/matrix/utils/matAlgo07xSSf.js` | `createMatAlgo07xSSf` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `./compareUnits.js` | `createCompareUnits` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createLargerEq`, `createLargerEqNumber`

---

### `src/relational/smaller.ts` - Test whether value x is smaller than y.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/bignumber/nearlyEqual.js` | `nearlyEqual` | Import |
| `../utils/number.js` | `nearlyEqual` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matAlgo03xDSf.js` | `createMatAlgo03xDSf` | Import |
| `../type/matrix/utils/matAlgo07xSSf.js` | `createMatAlgo07xSSf` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `./compareUnits.js` | `createCompareUnits` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createSmaller`, `createSmallerNumber`

---

### `src/relational/smallerEq.ts` - Test whether value x is smaller or equal to y.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/bignumber/nearlyEqual.js` | `nearlyEqual` | Import |
| `../utils/number.js` | `nearlyEqual` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matAlgo03xDSf.js` | `createMatAlgo03xDSf` | Import |
| `../type/matrix/utils/matAlgo07xSSf.js` | `createMatAlgo07xSSf` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `./compareUnits.js` | `createCompareUnits` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createSmallerEq`, `createSmallerEqNumber`

---

### `src/relational/unequal.ts` - Test whether two values are unequal.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matAlgo03xDSf.js` | `createMatAlgo03xDSf` | Import |
| `../type/matrix/utils/matAlgo07xSSf.js` | `createMatAlgo07xSSf` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createUnequal`, `createUnequalNumber`

---

## Set Dependencies

### `src/set/setCartesian.ts` - Create the cartesian product of two (multi)sets.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `flatten` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../../../types/index.js` | `MathArray, Matrix, MathNumericType` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createSetCartesian`

---

### `src/set/setDifference.ts` - Create the difference of two (multi)sets: every element of set1, that is not the element of set2.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `flatten, generalize, identify` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../../../types/index.js` | `MathArray, Matrix` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createSetDifference`

---

### `src/set/setDistinct.ts` - Collect the distinct elements of a multiset.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `flatten` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../../../types/index.js` | `MathArray, Matrix, MathNumericType` | Import (type-only) |

**Exports:**
- Constants: `createSetDistinct`

---

### `src/set/setIntersect.ts` - Create the intersection of two (multi)sets.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `flatten, generalize, identify` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../../../types/index.js` | `MathArray, Matrix` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createSetIntersect`

---

### `src/set/setIsSubset.ts` - Check whether a (multi)set is a subset of another (multi)set. (Every element of set1 is the element of set2.)

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `flatten, identify` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../../../types/index.js` | `MathArray, Matrix` | Import (type-only) |

**Exports:**
- Constants: `createSetIsSubset`

---

### `src/set/setMultiplicity.ts` - Count the multiplicity of an element in a multiset.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `flatten` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../../../types/index.js` | `MathArray, Matrix, MathNumericType` | Import (type-only) |

**Exports:**
- Constants: `createSetMultiplicity`

---

### `src/set/setPowerset.ts` - Create the powerset of a (multi)set. (The powerset contains very possible subsets of a (multi)set.)

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `flatten` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../../../types/index.js` | `MathArray, Matrix, MathNumericType` | Import (type-only) |

**Exports:**
- Constants: `createSetPowerset`

---

### `src/set/setSize.ts` - Count the number of elements of a (multi)set. When a second parameter is 'true', count only the unique values.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `flatten` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../../../types/index.js` | `MathArray, Matrix` | Import (type-only) |

**Exports:**
- Constants: `createSetSize`

---

### `src/set/setSymDifference.ts` - Create the symmetric difference of two (multi)sets.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `flatten` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../../../types/index.js` | `MathArray, Matrix, MathNumericType` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createSetSymDifference`

---

### `src/set/setUnion.ts` - Create the union of two (multi)sets.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `flatten` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../../../types/index.js` | `MathArray, Matrix, MathNumericType` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createSetUnion`

---

## Signal Dependencies

### `src/signal/conv.ts` - Convolution Operations

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./fft.js` | `fft, ifft, fft2, ifft2, complex, ComplexNumber` | Import |

**Exports:**
- Functions: `convDirect`, `convFFT`, `conv`, `xcorr`, `autocorr`, `conv2Direct`, `conv2FFT`, `conv2`

---

### `src/signal/fft.ts` - Fast Fourier Transform (FFT)

**Exports:**
- Interfaces: `ComplexNumber`, `FFTResult`
- Functions: `complex`, `complexConj`, `complexAbs`, `complexArg`, `fft`, `ifft`, `ifftReal`, `fftMagnitude`, `fftPower`, `fftPhase`, `fftFrequencies`, `fft2`, `ifft2`, `fftshift`, `ifftshift`

---

### `src/signal/freqz.ts` - Frequency response result

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../../types.js` | `Matrix, Complex` | Import (type-only) |

**Exports:**
- Constants: `createFreqz`

---

### `src/signal/index.ts` - Signal Processing Module

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./freqz.js` | `*` | Re-export |
| `./zpk2tf.js` | `*` | Re-export |
| `./fft.js` | `fft, ifft, ifftReal, fftMagnitude, fftPower, fftPhase, fftFrequencies, fft2, ifft2, fftshift, ifftshift, complex, complexConj, complexAbs, complexArg, type FFTResult, type ComplexNumber` | Re-export |
| `./conv.js` | `conv, convDirect, convFFT, conv2, conv2Direct, conv2FFT, xcorr, autocorr, type ConvMode` | Re-export |

**Exports:**
- Re-exports: `* from ./freqz.js`, `* from ./zpk2tf.js`, `fft`, `ifft`, `ifftReal`, `fftMagnitude`, `fftPower`, `fftPhase`, `fftFrequencies`, `fft2`, `ifft2`, `fftshift`, `ifftshift`, `complex`, `complexConj`, `complexAbs`, `complexArg`, `type FFTResult`, `type ComplexNumber`, `conv`, `convDirect`, `convFFT`, `conv2`, `conv2Direct`, `conv2FFT`, `xcorr`, `autocorr`, `type ConvMode`

---

### `src/signal/zpk2tf.ts` - Transfer function representation [numerator, denominator]

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../../types.js` | `Matrix, Complex` | Import (type-only) |

**Exports:**
- Constants: `createZpk2tf`

---

## Special Dependencies

### `src/special/erf.ts` - Compute the erf function of a value using a rational Chebyshev

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/number.js` | `sign` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createErf`

---

### `src/special/zeta.ts` - Compute the Riemann Zeta function of a value using an infinite series for

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createZeta`

---

## Statistics Dependencies

### `src/statistics/corr.ts` - Check if an array contains only plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCorr`

---

### `src/statistics/cumsum.ts` - Check if an array is a flat array of plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `containsCollections` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/switch.js` | `_switch` | Import |
| `./utils/improveErrorMessage.js` | `improveErrorMessage` | Import |
| `../utils/array.js` | `arraySize` | Import |
| `../error/IndexError.js` | `IndexError` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCumSum`

---

### `src/statistics/mad.ts` - Check if an array contains only plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `flatten` | Import |
| `../utils/factory.js` | `factory` | Import |
| `./utils/improveErrorMessage.js` | `improveErrorMessage` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createMad`

---

### `src/statistics/max.ts` - Check if an array is a flat array of plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `deepForEach, reduce, containsCollections` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/number.js` | `safeNumberType` | Import |
| `./utils/improveErrorMessage.js` | `improveErrorMessage` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createMax`

---

### `src/statistics/mean.ts` - Check if an array is a flat array of plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `containsCollections, deepForEach, reduce` | Import |
| `../utils/array.js` | `arraySize` | Import |
| `../utils/factory.js` | `factory` | Import |
| `./utils/improveErrorMessage.js` | `improveErrorMessage` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createMean`

---

### `src/statistics/median.ts` - Recursively calculate the median of an n-dimensional array

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `containsCollections` | Import |
| `../utils/array.js` | `flatten` | Import |
| `../utils/factory.js` | `factory` | Import |
| `./utils/improveErrorMessage.js` | `improveErrorMessage` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createMedian`

---

### `src/statistics/min.ts` - Check if an array is a flat array of plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `containsCollections, deepForEach, reduce` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/number.js` | `safeNumberType` | Import |
| `./utils/improveErrorMessage.js` | `improveErrorMessage` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createMin`

---

### `src/statistics/mode.ts` - Computes the mode of a set of numbers or a list with values(numbers or characters).

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/array.js` | `flatten` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createMode`

---

### `src/statistics/prod.ts` - Check if an array is a flat array of plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `deepForEach` | Import |
| `../utils/factory.js` | `factory` | Import |
| `./utils/improveErrorMessage.js` | `improveErrorMessage` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createProd`

---

### `src/statistics/quantileSeq.ts` - Compute the prob order quantile of a matrix or a list with values.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `isNumber, isBigNumber` | Import |
| `../utils/array.js` | `flatten` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createQuantileSeq`

---

### `src/statistics/std.ts` - Check if an array is a flat array of plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/is.js` | `isCollection` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createStd`

---

### `src/statistics/sum.ts` - Check if an array is a flat array of plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `containsCollections, deepForEach, reduce` | Import |
| `../utils/factory.js` | `factory` | Import |
| `./utils/improveErrorMessage.js` | `improveErrorMessage` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createSum`

---

### `src/statistics/utils/improveErrorMessage.ts` - Improve error messages for statistics functions. Errors are typically

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.js` | `typeOf` | Import |

**Exports:**
- Functions: `improveErrorMessage`

---

### `src/statistics/variance.ts` - Check if an array is a flat array of plain numbers

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `deepForEach` | Import |
| `../utils/is.js` | `isBigNumber` | Import |
| `../utils/factory.js` | `factory` | Import |
| `./utils/improveErrorMessage.js` | `improveErrorMessage` | Import |
| `../wasm/WasmLoader.js` | `wasmLoader` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createVariance`

---

## String Dependencies

### `src/string/bin.ts` - Format a number as binary.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createBin`

---

### `src/string/format.ts` - Format a value of any type into a string.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/string.js` | `format` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createFormat`

---

### `src/string/hex.ts` - Format a number as hexadecimal.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createHex`

---

### `src/string/oct.ts` - Format a number as octal.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createOct`

---

### `src/string/print.ts` - Interpolate values into a string template.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/string.js` | `format` | Import |
| `../utils/is.js` | `isString` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/print.js` | `printTemplate` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createPrint`

---

## Trigonometry Dependencies

### `src/trigonometry/acos.ts` - Calculate the inverse cosine of a value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createAcos`

---

### `src/trigonometry/acosh.ts` - Calculate the hyperbolic arccos of a value,

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |
| `../type/complex/Complex.js` | `Complex` | Import (type-only) |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../plain/number/index.js` | `acoshNumber` | Import |

**Exports:**
- Constants: `createAcosh`

---

### `src/trigonometry/acot.ts` - Calculate the inverse cotangent of a value, defined as `acot(x) = atan(1/x)`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../type/complex/Complex.js` | `Complex` | Import (type-only) |
| `../plain/number/index.js` | `acotNumber` | Import |

**Exports:**
- Constants: `createAcot`

---

### `src/trigonometry/acoth.ts` - Calculate the inverse hyperbolic tangent of a value,

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |
| `../type/complex/Complex.js` | `Complex` | Import (type-only) |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../plain/number/index.js` | `acothNumber` | Import |

**Exports:**
- Constants: `createAcoth`

---

### `src/trigonometry/acsc.ts` - Calculate the inverse cosecant of a value, defined as `acsc(x) = asin(1/x)`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |
| `../type/complex/Complex.js` | `Complex` | Import (type-only) |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../plain/number/index.js` | `acscNumber` | Import |

**Exports:**
- Constants: `createAcsc`

---

### `src/trigonometry/acsch.ts` - Calculate the inverse hyperbolic cosecant of a value,

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../type/complex/Complex.js` | `Complex` | Import (type-only) |
| `../plain/number/index.js` | `acschNumber` | Import |

**Exports:**
- Constants: `createAcsch`

---

### `src/trigonometry/asec.ts` - Calculate the inverse secant of a value. Defined as `asec(x) = acos(1/x)`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |
| `../type/complex/Complex.js` | `Complex` | Import (type-only) |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../plain/number/index.js` | `asecNumber` | Import |

**Exports:**
- Constants: `createAsec`

---

### `src/trigonometry/asech.ts` - Calculate the hyperbolic arcsecant of a value,

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |
| `../type/complex/Complex.js` | `Complex` | Import (type-only) |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../plain/number/index.js` | `asechNumber` | Import |

**Exports:**
- Constants: `createAsech`

---

### `src/trigonometry/asin.ts` - Calculate the inverse sine of a value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createAsin`

---

### `src/trigonometry/asinh.ts` - Calculate the hyperbolic arcsine of a value,

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../type/complex/Complex.js` | `Complex` | Import (type-only) |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../plain/number/index.js` | `asinhNumber` | Import |

**Exports:**
- Constants: `createAsinh`

---

### `src/trigonometry/atan.ts` - Calculate the inverse tangent of a value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createAtan`

---

### `src/trigonometry/atan2.ts` - Calculate the inverse tangent function with two arguments, y/x.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matAlgo02xDS0.js` | `createMatAlgo02xDS0` | Import |
| `../type/matrix/utils/matAlgo03xDSf.js` | `createMatAlgo03xDSf` | Import |
| `../type/matrix/utils/matAlgo09xS0Sf.js` | `createMatAlgo09xS0Sf` | Import |
| `../type/matrix/utils/matAlgo11xS0s.js` | `createMatAlgo11xS0s` | Import |
| `../type/matrix/utils/matAlgo12xSfs.js` | `createMatAlgo12xSfs` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createAtan2`

---

### `src/trigonometry/atanh.ts` - Calculate the hyperbolic arctangent of a value,

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |
| `../type/complex/Complex.js` | `Complex` | Import (type-only) |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../plain/number/index.js` | `atanhNumber` | Import |

**Exports:**
- Constants: `createAtanh`

---

### `src/trigonometry/cos.ts` - Calculate the cosine of a value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `./trigUnit.js` | `createTrigUnit` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCos`

---

### `src/trigonometry/cosh.ts` - Calculate the hyperbolic cosine of a value,

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../utils/number.js` | `cosh` | Import |

**Exports:**
- Constants: `createCosh`

---

### `src/trigonometry/cot.ts` - Calculate the cotangent of a value. Defined as `cot(x) = 1 / tan(x)`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../type/complex/Complex.js` | `Complex` | Import (type-only) |
| `../plain/number/index.js` | `cotNumber` | Import |
| `./trigUnit.js` | `createTrigUnit` | Import |

**Exports:**
- Constants: `createCot`

---

### `src/trigonometry/coth.ts` - Calculate the hyperbolic cotangent of a value,

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../type/complex/Complex.js` | `Complex` | Import (type-only) |
| `../plain/number/index.js` | `cothNumber` | Import |

**Exports:**
- Constants: `createCoth`

---

### `src/trigonometry/csc.ts` - Calculate the cosecant of a value, defined as `csc(x) = 1/sin(x)`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../type/complex/Complex.js` | `Complex` | Import (type-only) |
| `../plain/number/index.js` | `cscNumber` | Import |
| `./trigUnit.js` | `createTrigUnit` | Import |

**Exports:**
- Constants: `createCsc`

---

### `src/trigonometry/csch.ts` - Calculate the hyperbolic cosecant of a value,

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../type/complex/Complex.js` | `Complex` | Import (type-only) |
| `../plain/number/index.js` | `cschNumber` | Import |

**Exports:**
- Constants: `createCsch`

---

### `src/trigonometry/sec.ts` - Calculate the secant of a value, defined as `sec(x) = 1/cos(x)`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../type/complex/Complex.js` | `Complex` | Import (type-only) |
| `../plain/number/index.js` | `secNumber` | Import |
| `./trigUnit.js` | `createTrigUnit` | Import |

**Exports:**
- Constants: `createSec`

---

### `src/trigonometry/sech.ts` - Calculate the hyperbolic secant of a value,

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../type/bignumber/BigNumber.js` | `BigNumber` | Import (type-only) |
| `../type/complex/Complex.js` | `Complex` | Import (type-only) |
| `../plain/number/index.js` | `sechNumber` | Import |

**Exports:**
- Constants: `createSech`

---

### `src/trigonometry/sin.ts` - Calculate the sine of a value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `./trigUnit.js` | `createTrigUnit` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createSin`

---

### `src/trigonometry/sinh.ts` - Calculate the hyperbolic sine of a value,

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../plain/number/index.js` | `sinhNumber` | Import |

**Exports:**
- Constants: `createSinh`

---

### `src/trigonometry/tan.ts` - Calculate the tangent of a value. `tan(x)` is equal to `sin(x) / cos(x)`.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `./trigUnit.js` | `createTrigUnit` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createTan`

---

### `src/trigonometry/tanh.ts` - Calculate the hyperbolic tangent of a value,

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../utils/number.js` | `tanh` | Import |

**Exports:**
- Constants: `createTanh`

---

### `src/trigonometry/trigUnit.ts` - Type definitions for trigUnit

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createTrigUnit`

---

## Type Dependencies

### `src/type/bigint.ts` - Create a bigint or convert a string, boolean, or unit to a bigint.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.ts` | `factory` | Import |
| `../utils/collection.ts` | `deepMap` | Import |
| `../types.ts` | `TypedFunction, BigNumber, Fraction` | Import |

**Exports:**
- Constants: `createBigint`

---

### `src/type/bignumber/BigNumber.ts` - JSON representation of a BigNumber

**External Dependencies:**
| Package | Import |
|---------|--------|
| `decimal.js` | `Decimal` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |

**Exports:**
- Interfaces: `BigNumberJSON`, `ConfigChangeEvent`, `BigNumberClass`, `BigNumberInstance`
- Constants: `createBigNumberClass`

---

### `src/type/bignumber/function/bignumber.ts` - Create a BigNumber, which can store numbers with arbitrary precision.

**External Dependencies:**
| Package | Import |
|---------|--------|
| `decimal.js` | `Decimal` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../utils/collection.ts` | `deepMap` | Import |
| `../../../core/function/typed.ts` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createBignumber`

---

### `src/type/boolean.ts` - Create a boolean or convert a string or number to a boolean.

**External Dependencies:**
| Package | Import |
|---------|--------|
| `decimal.js` | `Decimal` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.ts` | `factory` | Import |
| `../utils/collection.ts` | `deepMap` | Import |
| `../core/function/typed.ts` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createBoolean`

---

### `src/type/chain/Chain.ts` - JSON representation of a Chain

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isChain` | Import |
| `../../utils/string.ts` | `format` | Import |
| `../../utils/object.ts` | `hasOwnProperty, lazy` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../core/function/typed.ts` | `TypedFunction` | Import (type-only) |

**Exports:**
- Interfaces: `ChainJSON`, `ChainInstance`, `ChainConstructor`
- Constants: `createChainClass`

---

### `src/type/chain/function/chain.ts` - Wrap any value in a chain, allowing to perform chained operations on

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../types.ts` | `TypedFunction` | Import |

**Exports:**
- Constants: `createChain`

---

### `src/type/complex/Complex.ts` - JSON representation of a Complex number

**External Dependencies:**
| Package | Import |
|---------|--------|
| `complex.js` | `Complex, ComplexJs` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/number.ts` | `format` | Import |
| `../../utils/is.ts` | `isNumber, isUnit` | Import |
| `../../utils/factory.ts` | `factory` | Import |

**Exports:**
- Interfaces: `ComplexJSON`, `PolarCoordinates`, `ComplexFormatOptions`, `Complex`, `PolarInput`, `AbsArgInput`, `ComplexConstructor`
- Constants: `createComplexClass`

---

### `src/type/complex/function/complex.ts` - Dependencies for createComplex

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../utils/collection.ts` | `deepMap` | Import |
| `../../../core/function/typed.ts` | `TypedFunction` | Import (type-only) |
| `../Complex.ts` | `Complex, ComplexConstructor, ComplexJSON, PolarInput, AbsArgInput` | Import (type-only) |
| `../../../types.ts` | `MathCollection` | Import (type-only) |

**Exports:**
- Constants: `createComplex`

---

### `src/type/fraction/Fraction.ts` - JSON representation of a Fraction

**External Dependencies:**
| Package | Import |
|---------|--------|
| `fraction.js` | `Fraction, NumeratorDenominator, FractionJs` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |

**Exports:**
- Interfaces: `FractionJSON`, `Fraction`, `FractionConstructor`
- Constants: `createFractionClass`

---

### `src/type/fraction/function/fraction.ts` - Create a fraction or convert a value to a fraction.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../utils/collection.ts` | `deepMap` | Import |
| `../../../types.ts` | `MathCollection` | Import (type-only) |
| `../Fraction.ts` | `Fraction` | Import (type-only) |
| `../../../core/function/typed.ts` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createFraction`

---

### `src/type/local/Complex.ts` - Local Complex number implementation.

**Exports:**
- Classes: `Complex`
- Interfaces: `ComplexJSON`, `PolarForm`, `ComplexLike`
- Default: `Complex`

---

### `src/type/local/Decimal.ts` - Local Decimal implementation for arbitrary precision arithmetic.

**Exports:**
- Classes: `Decimal`
- Interfaces: `DecimalConfig`
- Constants: `ROUND_UP`, `ROUND_DOWN`, `ROUND_CEIL`, `ROUND_FLOOR`, `ROUND_HALF_UP`, `ROUND_HALF_DOWN`, `ROUND_HALF_EVEN`, `ROUND_HALF_CEIL`, `ROUND_HALF_FLOOR`, `EUCLID`
- Default: `Decimal`

---

### `src/type/local/Fraction.ts` - Local Fraction implementation for arbitrary precision rational numbers.

**Exports:**
- Classes: `Fraction`
- Interfaces: `FractionJSON`, `FractionLike`
- Default: `Fraction`

---

### `src/type/local/index.ts` - Local implementations of external numeric libraries.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./Decimal.ts` | `Decimal, type DecimalConfig` | Re-export |
| `./Complex.ts` | `Complex, type ComplexJSON, type PolarForm, type ComplexLike` | Re-export |
| `./Fraction.ts` | `Fraction, type FractionJSON, type FractionLike` | Re-export |
| `./Decimal.ts` | `Decimal` | Re-export |

**Exports:**
- Re-exports: `Decimal`, `type DecimalConfig`, `Complex`, `type ComplexJSON`, `type PolarForm`, `type ComplexLike`, `Fraction`, `type FractionJSON`, `type FractionLike`

---

### `src/type/matrix/DenseMatrix.ts` - Local Index interface for DenseMatrix operations.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isArray, isBigNumber, isCollection, isIndex, isMatrix, isNumber, isString, typeOf` | Import |
| `../../utils/array.ts` | `arraySize, getArrayDataType, processSizesWildcard, reshape, resize, unsqueeze, validate, validateIndex, broadcastTo, get` | Import |
| `../../utils/string.ts` | `format` | Import |
| `../../utils/number.ts` | `isInteger` | Import |
| `../../utils/object.ts` | `clone, deepStrictEqual` | Import |
| `../../error/DimensionError.ts` | `DimensionError` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/optimizeCallback.ts` | `optimizeCallback` | Import |
| `../../core/config.ts` | `MathJsConfig` | Import (type-only) |
| `./types.ts` | `DenseMatrixData, DataType, MatrixValue, IndexInterface, MatrixFormatOptions, DenseMatrixJSON, DenseMatrixConstructorData, MatrixEntry, BigNumberLike` | Import (type-only) |

**Exports:**
- Constants: `createDenseMatrixClass`

---

### `src/type/matrix/FibonacciHeap.ts` - Comparison function type for heap operations.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `./types.ts` | `FibonacciHeapNode, MatrixValue` | Import (type-only) |

**Exports:**
- Constants: `createFibonacciHeapClass`

---

### `src/type/matrix/function/index.ts` - Create an index. An Index can store ranges having start, step, and end

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/is.ts` | `isBigNumber, isMatrix, isArray` | Import |
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../core/function/typed.ts` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createIndex`

---

### `src/type/matrix/function/matrix.ts` - Create a Matrix. The function creates a new `math.Matrix` object from

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |

**Exports:**
- Constants: `createMatrix`

---

### `src/type/matrix/function/sparse.ts` - Create a Sparse Matrix. The function creates a new `math.Matrix` object from

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../core/function/typed.ts` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createSparse`

---

### `src/type/matrix/ImmutableDenseMatrix.ts` - Interface for Index objects (local copy to avoid circular deps)

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isArray, isMatrix, isString, typeOf` | Import |
| `../../utils/object.ts` | `clone` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `./types.ts` | `DenseMatrixData, DataType, MatrixValue, IndexInterface, ImmutableDenseMatrixJSON, ImmutableDenseMatrixConstructorData` | Import (type-only) |

**Exports:**
- Constants: `createImmutableDenseMatrixClass`

---

### `src/type/matrix/Matrix.ts` - Callback function for matrix forEach operations

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `./types.ts` | `MatrixFormatOptions, ForEachCallback, MapCallback, IndexInterface, NestedArray, DataType, MatrixValue` | Import (type-only) |

**Exports:**
- Constants: `createMatrixClass`

---

### `src/type/matrix/MatrixIndex.ts` - Type representing a single dimension in an Index.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isArray, isMatrix, isRange, isNumber, isString` | Import |
| `../../utils/object.ts` | `clone` | Import |
| `../../utils/number.ts` | `isInteger` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `./types.ts` | `IndexJSON, RangeInterface, MatrixValue` | Import (type-only) |

**Exports:**
- Constants: `createIndexClass`

---

### `src/type/matrix/Range.ts` - Create a range of numbers. A range has a start, step, and end,

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isBigInt, isBigNumber` | Import |
| `../../utils/number.ts` | `format, sign, nearlyEqual` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `./types.ts` | `BigNumberLike, RangeForEachCallback, RangeMapCallback, RangeFormatOptions, RangeJSON` | Import (type-only) |

**Exports:**
- Constants: `createRangeClass`

---

### `src/type/matrix/Spa.ts` - Value type for Spa elements.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `./types.ts` | `FibonacciHeapNode, FibonacciHeapInterface, MatrixValue, EqualScalarFunction` | Import (type-only) |

**Exports:**
- Constants: `createSpaClass`

---

### `src/type/matrix/SparseMatrix.ts` - Size type for sparse matrices (always 2D)

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isArray, isBigNumber, isCollection, isIndex, isMatrix, isNumber, isString, typeOf` | Import |
| `../../utils/number.ts` | `isInteger` | Import |
| `../../utils/string.ts` | `format` | Import |
| `../../utils/object.ts` | `clone, deepStrictEqual` | Import |
| `../../utils/array.ts` | `arraySize, getArrayDataType, processSizesWildcard, unsqueeze, validateIndex` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../error/DimensionError.ts` | `DimensionError` | Import |
| `../../utils/optimizeCallback.ts` | `optimizeCallback` | Import |
| `./types.ts` | `DataType, MatrixValue, MatrixArray, TypedFunction, EqualScalarFunction, SparseMatrixConstructorData, SparseMatrixJSON, MatrixFormatOptions, BigNumberLike` | Import (type-only) |

**Exports:**
- Constants: `createSparseMatrixClass`

---

### `src/type/matrix/types.ts` - Type Philosophy:

---

### `src/type/matrix/utils/broadcast.ts` - Broadcasts two matrices, and return both in an array

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/array.ts` | `broadcastSizes, broadcastTo` | Import |
| `../../../utils/object.ts` | `deepStrictEqual` | Import |

**Exports:**
- Functions: `broadcast`

---

### `src/type/matrix/utils/matAlgo01xDSid.ts` - DenseMatrix interface for algorithm operations.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../error/DimensionError.ts` | `DimensionError` | Import |
| `../types.ts` | `DataType, MatrixValue, MatrixArray, MatrixCallback, TypedFunction, DenseMatrixConstructorData` | Import (type-only) |

**Exports:**
- Constants: `createMatAlgo01xDSid`

---

### `src/type/matrix/utils/matAlgo02xDS0.ts` - DenseMatrix interface for algorithm operations.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../error/DimensionError.ts` | `DimensionError` | Import |
| `../types.ts` | `DataType, MatrixValue, MatrixArray, MatrixCallback, EqualScalarFunction, TypedFunction, SparseMatrixConstructorData` | Import (type-only) |

**Exports:**
- Constants: `createMatAlgo02xDS0`

---

### `src/type/matrix/utils/matAlgo03xDSf.ts` - DenseMatrix interface for algorithm operations.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../error/DimensionError.ts` | `DimensionError` | Import |
| `../types.ts` | `DataType, MatrixValue, MatrixArray, MatrixCallback, TypedFunction, DenseMatrixConstructorData` | Import (type-only) |

**Exports:**
- Constants: `createMatAlgo03xDSf`

---

### `src/type/matrix/utils/matAlgo04xSidSid.ts` - SparseMatrix interface for algorithm operations.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../error/DimensionError.ts` | `DimensionError` | Import |
| `../types.ts` | `DataType, MatrixValue, MatrixArray, MatrixCallback, EqualScalarFunction, TypedFunction, SparseMatrixConstructorData` | Import (type-only) |

**Exports:**
- Constants: `createMatAlgo04xSidSid`

---

### `src/type/matrix/utils/matAlgo05xSfSf.ts` - SparseMatrix interface for algorithm operations.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../error/DimensionError.ts` | `DimensionError` | Import |
| `../types.ts` | `DataType, MatrixValue, MatrixArray, MatrixCallback, EqualScalarFunction, TypedFunction, SparseMatrixConstructorData` | Import (type-only) |

**Exports:**
- Constants: `createMatAlgo05xSfSf`

---

### `src/type/matrix/utils/matAlgo06xS0S0.ts` - SparseMatrix interface for algorithm operations.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../error/DimensionError.ts` | `DimensionError` | Import |
| `../../../utils/collection.ts` | `scatter` | Import |
| `../types.ts` | `DataType, MatrixValue, MatrixArray, MatrixCallback, EqualScalarFunction, TypedFunction, SparseMatrixConstructorData` | Import (type-only) |

**Exports:**
- Constants: `createMatAlgo06xS0S0`

---

### `src/type/matrix/utils/matAlgo07xSSf.ts` - SparseMatrix interface for algorithm operations.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../error/DimensionError.ts` | `DimensionError` | Import |
| `../types.ts` | `DataType, MatrixValue, MatrixArray, MatrixCallback, TypedFunction, SparseMatrixConstructorData` | Import (type-only) |

**Exports:**
- Constants: `createMatAlgo07xSSf`

---

### `src/type/matrix/utils/matAlgo08xS0Sid.ts` - SparseMatrix interface for algorithm operations.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../error/DimensionError.ts` | `DimensionError` | Import |
| `../types.ts` | `DataType, MatrixValue, MatrixArray, MatrixCallback, EqualScalarFunction, TypedFunction, SparseMatrixConstructorData` | Import (type-only) |

**Exports:**
- Constants: `createMatAlgo08xS0Sid`

---

### `src/type/matrix/utils/matAlgo09xS0Sf.ts` - SparseMatrix interface for algorithm operations.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../error/DimensionError.ts` | `DimensionError` | Import |
| `../types.ts` | `DataType, MatrixValue, MatrixArray, MatrixCallback, EqualScalarFunction, TypedFunction, SparseMatrixConstructorData` | Import (type-only) |

**Exports:**
- Constants: `createMatAlgo09xS0Sf`

---

### `src/type/matrix/utils/matAlgo10xSids.ts` - DenseMatrix interface for algorithm operations.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../types.ts` | `DataType, MatrixValue, MatrixArray, MatrixCallback, TypedFunction, DenseMatrixConstructorData` | Import (type-only) |

**Exports:**
- Constants: `createMatAlgo10xSids`

---

### `src/type/matrix/utils/matAlgo11xS0s.ts` - SparseMatrix interface for algorithm operations.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../types.ts` | `DataType, MatrixValue, MatrixCallback, EqualScalarFunction, TypedFunction, SparseMatrixConstructorData` | Import (type-only) |

**Exports:**
- Constants: `createMatAlgo11xS0s`

---

### `src/type/matrix/utils/matAlgo12xSfs.ts` - DenseMatrix interface for algorithm operations.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../types.ts` | `DataType, MatrixValue, MatrixArray, MatrixCallback, TypedFunction, DenseMatrixConstructorData` | Import (type-only) |

**Exports:**
- Constants: `createMatAlgo12xSfs`

---

### `src/type/matrix/utils/matAlgo13xDD.ts` - Interface for DenseMatrix in algorithm context.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../error/DimensionError.ts` | `DimensionError` | Import |
| `../types.ts` | `DataType, DenseMatrixData, MatrixCallback, TypedFunction, DenseMatrixConstructorData, MatrixValue` | Import (type-only) |

**Exports:**
- Constants: `createMatAlgo13xDD`

---

### `src/type/matrix/utils/matAlgo14xDs.ts` - DenseMatrix interface for algorithm operations.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../utils/object.ts` | `clone` | Import |
| `../types.ts` | `DataType, DenseMatrixData, MatrixCallback, TypedFunction, DenseMatrixConstructorData, MatrixValue` | Import (type-only) |

**Exports:**
- Constants: `createMatAlgo14xDs`

---

### `src/type/matrix/utils/matrixAlgorithmSuite.ts` - Interface for matrix used in algorithm suite.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../utils/object.ts` | `extend` | Import |
| `./matAlgo13xDD.ts` | `createMatAlgo13xDD` | Import |
| `./matAlgo14xDs.ts` | `createMatAlgo14xDs` | Import |
| `./broadcast.ts` | `broadcast` | Import |
| `../types.ts` | `TypedFunction, MatrixAlgorithmSuiteOptions, MatrixSignatures, MatrixInterface, DenseMatrixData` | Import (type-only) |

**Exports:**
- Constants: `createMatrixAlgorithmSuite`

---

### `src/type/number.ts` - Separates the radix, integer part, and fractional part of a non decimal number string

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.ts` | `factory` | Import |
| `../utils/collection.ts` | `deepMap` | Import |
| `../core/function/typed.ts` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createNumber`

---

### `src/type/resultset/ResultSet.ts` - JSON representation of a ResultSet

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |

**Exports:**
- Interfaces: `ResultSetJSON`, `ResultSetInstance`, `ResultSetConstructor`
- Constants: `createResultSet`

---

### `src/type/string.ts` - Create a string or convert any object into a string.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.ts` | `factory` | Import |
| `../utils/collection.ts` | `deepMap` | Import |
| `../utils/number.ts` | `format` | Import |
| `../core/function/typed.ts` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createString`

---

### `src/type/unit/function/createUnit.ts` - Unit definition options

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../core/function/typed.ts` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createCreateUnit`

---

### `src/type/unit/function/splitUnit.ts` - Unit instance interface with splitUnit method

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../core/function/typed.ts` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createSplitUnit`

---

### `src/type/unit/function/unit.ts` - Unit class interface

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../../utils/factory.ts` | `factory` | Import |
| `../../../utils/collection.ts` | `deepMap` | Import |
| `../../../core/function/typed.ts` | `TypedFunction` | Import (type-only) |
| `../../../types.ts` | `MathCollection` | Import (type-only) |

**Exports:**
- Constants: `createUnitFunction`

---

### `src/type/unit/physicalConstants.ts` - Constructor for BigNumber instances

**External Dependencies:**
| Package | Import |
|---------|--------|
| `decimal.js` | `Decimal` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/factory.ts` | `factory` | Import |
| `../../core/config.ts` | `MathJsConfig` | Import (type-only) |

**Exports:**
- Constants: `createSpeedOfLight`, `createGravitationConstant`, `createPlanckConstant`, `createReducedPlanckConstant`, `createMagneticConstant`, `createElectricConstant`, `createVacuumImpedance`, `createCoulomb`, `createCoulombConstant`, `createElementaryCharge`, `createBohrMagneton`, `createConductanceQuantum`, `createInverseConductanceQuantum`, `createMagneticFluxQuantum`, `createNuclearMagneton`, `createKlitzing`, `createJosephson`, `createBohrRadius`, `createClassicalElectronRadius`, `createElectronMass`, `createFermiCoupling`, `createFineStructure`, `createHartreeEnergy`, `createProtonMass`, `createDeuteronMass`, `createNeutronMass`, `createQuantumOfCirculation`, `createRydberg`, `createThomsonCrossSection`, `createWeakMixingAngle`, `createEfimovFactor`, `createAtomicMass`, `createAvogadro`, `createBoltzmann`, `createFaraday`, `createFirstRadiation`, `createLoschmidt`, `createGasConstant`, `createMolarPlanckConstant`, `createMolarVolume`, `createSackurTetrode`, `createSecondRadiation`, `createStefanBoltzmann`, `createWienDisplacement`, `createMolarMass`, `createMolarMassC12`, `createGravity`, `createPlanckLength`, `createPlanckMass`, `createPlanckTime`, `createPlanckCharge`, `createPlanckTemperature`

---

### `src/type/unit/Unit.ts` - A unit can be constructed in the following ways:

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../../utils/is.ts` | `isComplex, isUnit, typeOf` | Import |
| `../../utils/factory.ts` | `factory` | Import |
| `../../utils/function.ts` | `memoize` | Import |
| `../../utils/string.ts` | `endsWith` | Import |
| `../../utils/object.ts` | `clone, hasOwnProperty` | Import |
| `../../utils/bignumber/constants.ts` | `createBigNumberPi` | Import |

**Exports:**
- Constants: `createUnitClass`

---

## Typed Dependencies

### `src/typed/arithmetic.ts` - Typed Arithmetic Functions (Parallel-First)

**External Dependencies:**
| Package | Import |
|---------|--------|
| `@mathts/core` | `mathTyped, Complex, Fraction, BigNumber` |
| `@mathts/parallel` | `computePool, ComputePool` |

**Exports:**
- Functions: `matmul`, `transpose`, `matvec`, `outer`, `initializePool`, `terminatePool`, `shouldParallelize`, `getComputePool`
- Constants: `add`, `subtract`, `multiply`, `divide`, `unaryMinus`, `unaryPlus`, `abs`, `sign`, `pow`, `sqrt`, `square`, `cube`, `cbrt`, `nthRoot`, `exp`, `log`, `log10`, `log2`, `log1p`, `expm1`, `round`, `floor`, `ceil`, `fix`, `mod`, `gcd`, `lcm`, `xgcd`, `norm`, `sinh`, `cosh`, `tanh`, `equal`, `smaller`, `larger`, `smallerEq`, `largerEq`, `compare`, `min`, `max`, `sum`, `mean`, `variance`, `std`, `dot`, `typedArithmetic`

---

### `src/typed/index.ts` - Typed Functions Index (Parallel-First)

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./arithmetic.js` | `typedArithmetic` | Import |
| `./trigonometry.js` | `typedTrigonometry` | Import |
| `./statistics.js` | `typedStatistics` | Import |
| `./signal.js` | `typedSignal` | Import |
| `./arithmetic.js` | `*` | Re-export |
| `./trigonometry.js` | `*` | Re-export |
| `./statistics.js` | `*` | Re-export |
| `./signal.js` | `*` | Re-export |
| `./arithmetic.js` | `typedArithmetic` | Re-export |
| `./trigonometry.js` | `typedTrigonometry` | Re-export |
| `./statistics.js` | `typedStatistics` | Re-export |
| `./signal.js` | `typedSignal` | Re-export |

**Exports:**
- Constants: `typedFunctions`
- Re-exports: `* from ./arithmetic.js`, `* from ./trigonometry.js`, `* from ./statistics.js`, `* from ./signal.js`, `typedArithmetic`, `typedTrigonometry`, `typedStatistics`, `typedSignal`

---

### `src/typed/signal.ts` - Typed Signal Processing Functions (Parallel-First)

**External Dependencies:**
| Package | Import |
|---------|--------|
| `@mathts/core` | `mathTyped, Complex` |
| `@mathts/parallel` | `computePool` |

**Exports:**
- Functions: `initializeSignal`, `terminateSignal`
- Constants: `parallelFFT`, `parallelIFFT`, `parallelFFTMagnitude`, `parallelFFTPower`, `parallelConv`, `parallelXCorr`, `parallelAutoCorr`, `typedSignal`

---

### `src/typed/statistics.ts` - Typed Statistics Functions (Parallel-First)

**External Dependencies:**
| Package | Import |
|---------|--------|
| `@mathts/core` | `mathTyped, Complex, Fraction, BigNumber` |
| `@mathts/parallel` | `computePool` |

**Exports:**
- Functions: `initializeStatistics`, `terminateStatistics`
- Constants: `parallelStatSum`, `parallelStatMean`, `parallelStatVariance`, `parallelStatStd`, `parallelStatMin`, `parallelStatMax`, `parallelStatMinMax`, `parallelStatMedian`, `parallelStatMode`, `parallelStatProd`, `parallelStatNorm`, `parallelStatDistance`, `parallelStatCorr`, `parallelStatMAD`, `parallelStatCumsum`, `parallelStatQuantile`, `parallelStatHistogram`, `typedStatistics`

---

### `src/typed/trigonometry.ts` - Typed Trigonometric Functions (Parallel-First)

**External Dependencies:**
| Package | Import |
|---------|--------|
| `@mathts/core` | `mathTyped, Complex, BigNumber` |
| `@mathts/parallel` | `computePool` |

**Exports:**
- Constants: `sin`, `cos`, `tan`, `csc`, `sec`, `cot`, `asin`, `acos`, `atan`, `atan2`, `acsc`, `asec`, `acot`, `asinh`, `acosh`, `atanh`, `toRadians`, `toDegrees`, `hypot`, `typedTrigonometry`

---

## Unit Dependencies

### `src/unit/to.ts` - Change the unit of a value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../type/matrix/utils/matrixAlgorithmSuite.js` | `createMatrixAlgorithmSuite` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createTo`

---

### `src/unit/toBest.ts` - Converts a unit to the most appropriate display unit.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createToBest`

---

## Utils Dependencies

### `src/utils/array.ts` - Calculate the size of a multi dimensional array.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./number.ts` | `isInteger` | Import |
| `./is.ts` | `isNumber, isBigNumber, isArray, isString, Index, Matrix, IndexDimension` | Import |
| `./string.ts` | `format` | Import |
| `../error/DimensionError.ts` | `DimensionError` | Import |
| `../error/IndexError.ts` | `IndexError` | Import |
| `./object.ts` | `deepStrictEqual` | Import |

**Exports:**
- Interfaces: `IdentifiedValue`
- Functions: `arraySize`, `validate`, `validateIndexSourceSize`, `validateIndex`, `isEmptyIndex`, `resize`, `reshape`, `processSizesWildcard`, `squeeze`, `unsqueeze`, `flatten`, `map`, `forEach`, `filter`, `filterRegExp`, `join`, `identify`, `generalize`, `getArrayDataType`, `last`, `initial`, `concat`, `broadcastSizes`, `checkBroadcastingRules`, `broadcastTo`, `broadcastArrays`, `stretch`, `get`, `deepMap`, `deepForEach`, `clone`

---

### `src/utils/bigint.ts` - Build a bigint logarithm function from a number logarithm,

**Exports:**
- Functions: `promoteLogarithm`

---

### `src/utils/bignumber/bitwise.ts` - Bitwise and for Bignumbers

**Exports:**
- Functions: `bitAndBigNumber`, `bitNotBigNumber`, `bitOrBigNumber`, `bitwise`, `bitXor`, `leftShiftBigNumber`, `rightArithShiftBigNumber`

---

### `src/utils/bignumber/constants.ts` - Calculate BigNumber e

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../function.ts` | `memoize` | Import |

**Exports:**
- Constants: `createBigNumberE`, `createBigNumberPhi`, `createBigNumberPi`, `createBigNumberTau`

---

### `src/utils/bignumber/formatter.ts` - Formats a BigNumber in a given base

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../is.ts` | `isBigNumber, isNumber` | Import |
| `../number.ts` | `isInteger, normalizeFormatOptions` | Import |

**Exports:**
- Functions: `format`, `toEngineering`, `toExponential`, `toFixed`

---

### `src/utils/bignumber/nearlyEqual.ts` - Compares two BigNumbers.

**Exports:**
- Functions: `nearlyEqual`

---

### `src/utils/clone.ts` - Clone an object. Will make a deep copy of the data.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/object.js` | `clone` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createClone`

---

### `src/utils/collection.ts` - Test whether an array contains collections

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./is.ts` | `isCollection, isMatrix` | Import |
| `../error/IndexError.ts` | `IndexError` | Import |
| `./array.ts` | `arraySize, deepMap, deepForEach` | Import |
| `./switch.ts` | `_switch` | Import |

**Exports:**
- Functions: `containsCollections`, `deepForEach`, `deepMap`, `reduce`, `scatter`

---

### `src/utils/complex.ts` - Test whether two complex values are equal provided a given relTol and absTol.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./number.ts` | `nearlyEqual` | Import |

**Exports:**
- Functions: `complexEquals`

---

### `src/utils/customs.ts` - Get a property of a plain object

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./shared.ts` | `hasOwnProperty` | Import |

**Exports:**

---

### `src/utils/emitter.ts` - Extend given object with emitter functions `on`, `off`, `once`, `emit`

**External Dependencies:**
| Package | Import |
|---------|--------|
| `tiny-emitter` | `Emitter` |

**Exports:**
- Interfaces: `EmitterMixin`
- Functions: `mixin`

---

### `src/utils/factory.ts` - Type for a factory function that creates instances

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./object.ts` | `pickShallow` | Import |

**Exports:**
- Interfaces: `FactoryFunction`, `LegacyFactory`, `FactoryMeta`
- Functions: `factory`, `sortFactories`, `create`, `isFactory`, `assertDependencies`, `isOptionalDependency`, `stripOptionalNotation`
- Constants: `createLog`

---

### `src/utils/function.ts` - Memoize a given function by caching the computed result.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./lruQueue.ts` | `lruQueue` | Import |

**Exports:**
- Interfaces: `MemoizeCache`, `MemoizedFunction`
- Functions: `memoize`, `memoizeCompare`

---

### `src/utils/hasNumericValue.ts` - Test whether a value is an numeric value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createHasNumericValue`

---

### `src/utils/is.ts` - Test whether a value is a collection: an Array or Matrix

**Exports:**
- Interfaces: `BigNumber`, `Complex`, `Fraction`, `Unit`, `Matrix`, `DenseMatrix`, `SparseMatrix`, `Range`, `IndexDimension`, `Index`, `ResultSet`, `Help`, `Chain`, `Node`, `AccessorNode`, `ArrayNode`, `AssignmentNode`, `BlockNode`, `ConditionalNode`, `ConstantNode`, `FunctionAssignmentNode`, `FunctionNode`, `IndexNode`, `ObjectNode`, `OperatorNode`, `ParenthesisNode`, `RangeNode`, `RelationalNode`, `SymbolNode`, `PartitionedMap`
- Functions: `isNumber`, `isBigNumber`, `isBigInt`, `isComplex`, `isFraction`, `isUnit`, `isString`, `isMatrix`, `isCollection`, `isDenseMatrix`, `isSparseMatrix`, `isRange`, `isIndex`, `isBoolean`, `isResultSet`, `isHelp`, `isFunction`, `isDate`, `isRegExp`, `isObject`, `isMap`, `isPartitionedMap`, `isObjectWrappingMap`, `isNull`, `isUndefined`, `isAccessorNode`, `isArrayNode`, `isAssignmentNode`, `isBlockNode`, `isConditionalNode`, `isConstantNode`, `rule2Node`, `isFunctionAssignmentNode`, `isFunctionNode`, `isIndexNode`, `isNode`, `isObjectNode`, `isOperatorNode`, `isParenthesisNode`, `isRangeNode`, `isRelationalNode`, `isSymbolNode`, `isChain`, `typeOf`
- Constants: `isArray`

---

### `src/utils/isBounded.ts` - Test whether a value is bounded. For scalars, this test is equivalent

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../../types.js` | `TypedFunction, BigNumber, Complex` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createIsBounded`

---

### `src/utils/isFinite.ts` - Test whether a value is finite.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../../types.js` | `TypedFunction, Matrix` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createIsFinite`

---

### `src/utils/isInteger.ts` - Test whether a value is an integer number.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createIsInteger`

---

### `src/utils/isNaN.ts` - Test whether a value is NaN (not a number).

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../plain/number/index.js` | `isNaNNumber` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createIsNaN`

---

### `src/utils/isNegative.ts` - Test whether a value is negative: smaller than zero.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../plain/number/index.js` | `isNegativeNumber` | Import |
| `../utils/bignumber/nearlyEqual.js` | `nearlyEqual` | Import |
| `../utils/number.js` | `nearlyEqual` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createIsNegative`

---

### `src/utils/isNumeric.ts` - Test whether a value is an numeric value.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../../types.js` | `TypedFunction` | Import (type-only) |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createIsNumeric`

---

### `src/utils/isPositive.ts` - Test whether a value is positive: larger than zero.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../plain/number/index.js` | `isPositiveNumber` | Import |
| `../utils/bignumber/nearlyEqual.js` | `nearlyEqual` | Import |
| `../utils/number.js` | `nearlyEqual` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |
| `../core/config.js` | `ConfigOptions` | Import (type-only) |

**Exports:**
- Constants: `createIsPositive`

---

### `src/utils/isPrime.ts` - Test whether a value is prime: has no divisors other than itself and one.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createIsPrime`

---

### `src/utils/isZero.ts` - Test whether a value is zero.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/collection.js` | `deepMap` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createIsZero`

---

### `src/utils/latex.ts` - @ts-ignore - escape-latex may not have type declarations

**External Dependencies:**
| Package | Import |
|---------|--------|
| `escape-latex` | `escapeLatexLib` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./object.ts` | `hasOwnProperty` | Import |

**Exports:**
- Functions: `escapeLatex`, `toSymbol`
- Constants: `latexSymbols`, `latexOperators`, `latexFunctions`, `defaultTemplate`

---

### `src/utils/log.ts` - Log a console.warn message only once

**Exports:**
- Constants: `warnOnce`

---

### `src/utils/lruQueue.ts` - (c) 2018, Mariusz Nowak

**Exports:**
- Functions: `lruQueue`

---

### `src/utils/map.ts` - A map facade on a bare object.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./customs.ts` | `getSafeProperty, isSafeProperty, setSafeProperty` | Import |
| `./is.ts` | `isMap, isObject` | Import |

**Exports:**
- Classes: `ObjectWrappingMap`, `PartitionedMap`
- Functions: `createEmptyMap`, `createMap`, `toObject`, `assign`

---

### `src/utils/node.ts` - Type definitions for Math.js AST nodes

---

### `src/utils/noop.ts` - noop module

**Exports:**
- Functions: `noBignumber`, `noFraction`, `noMatrix`, `noIndex`, `noSubset`

---

### `src/utils/number.ts` - Split value representation with sign, coefficients, and exponent

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./is.ts` | `isBigNumber, isNumber, isObject` | Import |

**Exports:**
- Interfaces: `SplitValue`, `NumberTypeConfig`, `FormatOptions`, `NormalizedFormatOptions`
- Functions: `isInteger`, `safeNumberType`, `format`, `normalizeFormatOptions`, `splitNumber`, `toEngineering`, `toFixed`, `toExponential`, `toPrecision`, `roundDigits`, `digits`, `nearlyEqual`, `copysign`
- Constants: `sign`, `log2`, `log10`, `log1p`, `cbrt`, `expm1`, `acosh`, `asinh`, `atanh`, `cosh`, `sinh`, `tanh`

---

### `src/utils/numeric.ts` - Convert a numeric input to a specific numeric type: number, BigNumber, bigint, or Fraction.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/is.js` | `typeOf` | Import |
| `../utils/factory.js` | `factory` | Import |
| `../utils/noop.js` | `noBignumber, noFraction` | Import |

**Exports:**
- Constants: `createNumeric`

---

### `src/utils/object.ts` - Clone an object

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./is.ts` | `isBigNumber, isObject` | Import |
| `./shared.ts` | `hasOwnProperty` | Import |

**Exports:**
- Functions: `clone`, `mapObject`, `extend`, `deepExtend`, `deepStrictEqual`, `deepFlatten`, `canDefineProperty`, `lazy`, `traverse`, `isLegacyFactory`, `get`, `set`, `pick`, `pickShallow`

---

### `src/utils/optimizeCallback.ts` - Simplifies a callback function by reducing its complexity and potentially improving its performance.

**External Dependencies:**
| Package | Import |
|---------|--------|
| `@danielsimonjr/typed-function` | `typed` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./array.ts` | `get, arraySize` | Import |
| `./is.ts` | `typeOf` | Import |

**Exports:**
- Functions: `optimizeCallback`

---

### `src/utils/parseNumber.ts` - Parse a string to a number type based on the config.number setting.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./factory.ts` | `factory` | Import |

**Exports:**
- Constants: `createParseNumberWithConfig`

---

### `src/utils/print.ts` - print module

**Exports:**
- Constants: `printTemplate`

---

### `src/utils/product.ts` - product module

**Exports:**
- Functions: `product`

---

### `src/utils/scope.ts` - Create a new scope which can access the parent scope,

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./map.ts` | `ObjectWrappingMap, PartitionedMap` | Import |

**Exports:**
- Functions: `createSubScope`

---

### `src/utils/shared.ts` - Shared utility functions used across utility modules.

**Exports:**
- Functions: `hasOwnProperty`

---

### `src/utils/snapshot.ts` - This file contains helper methods to create expected snapshot structures

**Node.js Built-in Dependencies:**
| Module | Import |
|--------|--------|
| `assert` | `assert` |

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./is.ts` | `* as allIsFunctions` | Import |
| `../core/create.ts` | `create` | Import |
| `./string.ts` | `endsWith` | Import |

**Exports:**
- Functions: `validateBundle`, `createSnapshotFromFactories`
- Constants: `validateTypeOf`

---

### `src/utils/string.ts` - Check if a text ends with a certain string.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./is.ts` | `isBigNumber, isString, typeOf` | Import |
| `./number.ts` | `format` | Import |
| `./bignumber/formatter.ts` | `format` | Import |

**Exports:**
- Functions: `endsWith`, `format`, `stringify`, `escape`, `compareText`

---

### `src/utils/switch.ts` - Transpose a matrix

**Exports:**
- Functions: `_switch`

---

### `src/utils/typeOf.ts` - Determine the type of an entity.

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `../utils/factory.js` | `factory` | Import |
| `../utils/is.js` | `typeOf` | Import |
| `../core/function/typed.js` | `TypedFunction` | Import (type-only) |

**Exports:**
- Constants: `createTypeOf`

---

## Wasm Dependencies

### `src/wasm/algebra/decomposition.ts` - WASM-optimized linear algebra decompositions

**Exports:**
- Functions: `luDecomposition`, `qrDecomposition`, `choleskyDecomposition`, `luSolve`, `luDeterminant`, `luDecompositionSIMD`, `qrDecompositionSIMD`, `choleskyDecompositionSIMD`

---

### `src/wasm/algebra/equations.ts` - WASM-optimized matrix equation solvers

**Exports:**
- Functions: `sylvester`, `lyap`, `dlyap`, `sylvesterResidual`, `lyapResidual`, `dlyapResidual`

---

### `src/wasm/algebra/polynomial.ts` - WASM-optimized polynomial operations

**Exports:**
- Functions: `polyEval`, `polyEvalWithDerivative`, `quadraticRoots`, `cubicRoots`, `quarticRoots`, `polyRoots`, `polyDerivative`, `polyMultiply`, `polyDivide`

---

### `src/wasm/algebra/schur.ts` - WASM-optimized Schur decomposition

**Exports:**
- Functions: `schur`, `getSchurQ`, `getSchurT`, `schurEigenvalues`, `schurResidual`, `schurOrthogonalityError`

---

### `src/wasm/algebra/solver.ts` - WASM-optimized triangular system solvers

**Exports:**
- Functions: `lsolve`, `lsolveUnit`, `usolve`, `usolveUnit`, `lsolveMultiple`, `usolveMultiple`, `lsolveHasSolution`, `usolveHasSolution`, `lsolveBanded`, `usolveBanded`, `solveTridiagonal`, `lowerTriangularMV`, `upperTriangularMV`, `lowerTriangularInverse`, `upperTriangularInverse`, `triangularDeterminant`, `lsolveAll`, `usolveAll`, `lowerTriangularRank`, `upperTriangularRank`

---

### `src/wasm/algebra/sparse/amd.ts` - WASM-optimized sparse matrix ordering algorithms

**Exports:**
- Functions: `amd`, `amdAggressive`, `rcm`, `inversePerm`, `permuteVector`, `permuteMatrix`, `symbolicCholeskyNnz`, `bandwidth`, `findPeripheralNode`

---

### `src/wasm/algebra/sparse/operations.ts` - WASM-optimized sparse matrix factorizations

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./utilities` | `csFlip, csUnflip, csMarked, csMark, csCumsum, csEtree, csDfs` | Import |

**Exports:**
- Functions: `sparseMatVec`, `sparseTranspose`, `symbolicCholesky`, `sparseCholesky`, `sparseLU`, `sparseLsolve`, `sparseUsolve`, `sparseQR`, `sparseSolve`

---

### `src/wasm/algebra/sparse/utilities.ts` - WASM-optimized sparse matrix utility operations

**Exports:**
- Functions: `csFlip`, `csUnflip`, `csMarked`, `csMark`, `csCumsum`, `csPermute`, `csLeaf`, `csEtree`, `csDfs`, `csSpsolve`

---

### `src/wasm/algebra/sparseChol.ts` - WASM-optimized sparse Cholesky decomposition using AssemblyScript

**Exports:**
- Functions: `sparseChol`, `sparseCholSolve`, `eliminationTree`, `columnCounts`

---

### `src/wasm/algebra/sparseLu.ts` - WASM-optimized sparse LU decomposition using AssemblyScript

**Exports:**
- Functions: `sparseLu`, `sparseForwardSolve`, `sparseBackwardSolve`, `sparseLuSolve`

---

### `src/wasm/arithmetic/advanced.ts` - WASM-optimized advanced arithmetic operations

**Exports:**
- Functions: `gcd`, `lcm`, `xgcd`, `invmod`, `hypot2`, `hypot3`, `hypotArray`, `norm1`, `norm2`, `normInf`, `normP`, `mod`, `modArray`, `gcdArray`, `lcmArray`, `nthRootsOfUnity`, `nthRootsReal`, `nthRootsComplex`, `nthRoot`, `nthRootSigned`, `gcdF64`, `lcmF64`, `xgcdF64`, `invmodF64`

---

### `src/wasm/arithmetic/basic.ts` - WASM-optimized basic arithmetic operations

**Exports:**
- Functions: `unaryMinus`, `unaryPlus`, `cbrt`, `cube`, `square`, `fix`, `fixDecimals`, `ceil`, `ceilDecimals`, `floor`, `floorDecimals`, `round`, `roundDecimals`, `abs`, `sign`, `add`, `subtract`, `multiply`, `divide`, `addInt`, `subtractInt`, `multiplyInt`, `divideInt`, `unaryMinusArray`, `squareArray`, `cubeArray`, `absArray`, `signArray`, `addArray`, `subtractArray`, `multiplyArray`, `divideArray`, `addScalarArray`, `multiplyScalarArray`

---

### `src/wasm/arithmetic/logarithmic.ts` - WASM-optimized logarithmic and exponential operations

**Exports:**
- Functions: `exp`, `expm1`, `log`, `log10`, `log2`, `log1p`, `logBase`, `nthRoot`, `sqrt`, `pow`, `expArray`, `logArray`, `log10Array`, `log2Array`, `sqrtArray`, `powConstantArray`

---

### `src/wasm/bitwise/operations.ts` - WASM-optimized bitwise operations

**Exports:**
- Functions: `bitAnd`, `bitOr`, `bitXor`, `bitNot`, `leftShift`, `rightArithShift`, `rightLogShift`, `bitAndArray`, `bitOrArray`, `bitXorArray`, `bitNotArray`, `leftShiftArray`, `rightArithShiftArray`, `rightLogShiftArray`, `popcount`, `ctz`, `clz`, `rotl`, `rotr`

---

### `src/wasm/combinatorics/basic.ts` - WASM-optimized combinatorics operations

**Exports:**
- Functions: `factorial`, `combinations`, `combinationsWithRep`, `permutations`, `stirlingS2`, `bellNumbers`, `catalan`, `composition`, `multinomial`, `factorialArray`, `combinationsArray`, `permutationsArray`, `doubleFactorial`, `subfactorial`, `fallingFactorial`, `risingFactorial`, `fibonacci`, `lucas`

---

### `src/wasm/complex/operations.ts` - WASM-optimized complex number operations using AssemblyScript

**Exports:**
- Functions: `arg`, `argArray`, `conj`, `conjArray`, `re`, `reArray`, `im`, `imArray`, `abs`, `absArray`, `addComplex`, `subComplex`, `mulComplex`, `divComplex`, `sqrtComplex`, `expComplex`, `logComplex`, `sinComplex`, `cosComplex`, `tanComplex`, `powComplexReal`

---

### `src/wasm/geometry/operations.ts` - WASM-optimized geometry operations using AssemblyScript

**Exports:**
- Functions: `distance2D`, `distance3D`, `distanceND`, `manhattanDistance2D`, `manhattanDistanceND`, `intersect2DLines`, `intersect2DInfiniteLines`, `intersectLinePlane`, `cross3D`, `dotND`, `angle2D`, `angle3D`, `triangleArea2D`, `pointInTriangle2D`, `normalizeND`, `intersectLineCircle`, `intersectLineSphere`, `intersectCircles`, `projectPointOnLine2D`, `distancePointToLine2D`, `distancePointToPlane`, `polygonCentroid2D`, `polygonArea2D`, `pointInConvexPolygon2D`

---

### `src/wasm/index.ts` - WASM module entry point

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./matrix/multiply` | `multiplyDense, multiplyDenseSIMD, multiplyVector, transpose, add, subtract, scalarMultiply, dotProduct, // SIMD and cache-optimized versions
  multiplyBlockedSIMD, addSIMD, subtractSIMD, scalarMultiplySIMD, dotProductSIMD, multiplyVectorSIMD, transposeSIMD` | Re-export |
| `./algebra/decomposition` | `luDecomposition, qrDecomposition, choleskyDecomposition, luSolve, luDeterminant, // SIMD-accelerated decompositions
  luDecompositionSIMD, qrDecompositionSIMD, choleskyDecompositionSIMD` | Re-export |
| `./algebra/schur` | `schur, getSchurQ, getSchurT, schurEigenvalues, schurResidual, schurOrthogonalityError` | Re-export |
| `./signal/fft` | `fft, fft2d, convolve, rfft, irfft, isPowerOf2, // SIMD-accelerated signal processing
  fftSIMD, convolveSIMD, powerSpectrumSIMD, crossCorrelationSIMD` | Re-export |
| `./signal/processing` | `freqz, freqzUniform, polyMultiply, zpk2tf, magnitude, magnitudeDb, phase, unwrapPhase, groupDelay` | Re-export |
| `./numeric/ode` | `rk45Step, rk23Step, maxError, computeStepAdjustment, interpolate, vectorCopy, vectorScale, vectorAdd, wouldOvershoot, trimStep` | Re-export |
| `./complex/operations` | `arg, argArray, conj, conjArray, re, reArray, im, imArray, abs, absArray, addComplex, subComplex, mulComplex, divComplex, sqrtComplex, expComplex, logComplex, sinComplex, cosComplex, tanComplex, powComplexReal` | Re-export |
| `./geometry/operations` | `distance2D, distance3D, distanceND, manhattanDistance2D, manhattanDistanceND, intersect2DLines, intersect2DInfiniteLines, intersectLinePlane, cross3D, dotND, angle2D, angle3D, triangleArea2D, pointInTriangle2D, normalizeND` | Re-export |
| `./logical/operations` | `and, or, not, xor, nand, nor, xnor, all, any, countTrue, findFirst, findLast, findAll, select, selectArray, andArray, orArray, notArray, xorArray` | Re-export |
| `./relational/operations` | `compare, compareArray, equal, nearlyEqual, equalArray, unequal, unequalArray, larger, largerArray, largerEq, largerEqArray, smaller, smallerArray, smallerEq, smallerEqArray, min, max, argmin, argmax, clamp, clampArray, inRange, inRangeArray, isPositive, isNegative, isZero, isNaN, isFinite, isInteger, sign, signArray` | Re-export |
| `./set/operations` | `createSet, setUnion, setIntersect, setDifference, setSymDifference, setIsSubset, setIsProperSubset, setIsSuperset, setIsProperSuperset, setEquals, setIsDisjoint, setSize, setContains, setAdd, setRemove, setCartesian, setPowerSetSize, setGetSubset` | Re-export |
| `./special/functions` | `erf, erfArray, erfc, erfcArray, gamma, gammaArray, lgamma, lgammaArray, zeta, zetaArray, beta, gammainc, digamma, digammaArray, besselJ0, besselJ1, besselY0, besselY1` | Re-export |
| `./string/operations` | `isDigit, isLetter, isAlphanumeric, isWhitespace, toLowerCode, toUpperCode, parseIntFromCodes, parseFloatFromCodes, countDigits, formatIntToCodes, formatFloatToCodes, compareCodeArrays, hashCodes, findPattern, countPattern, utf8ByteLength, isNumericString` | Re-export |
| `./simd/operations` | `// Vector operations (f64x2)
  simdAddF64, simdSubF64, simdMulF64, simdDivF64, simdScaleF64, simdDotF64, simdSumF64, simdSumSquaresF64, simdNormF64, simdMinF64, simdMaxF64, simdAbsF64, simdSqrtF64, simdNegF64, // Matrix operations (SIMD)
  simdMatVecMulF64, simdMatAddF64, simdMatSubF64, simdMatDotMulF64, simdMatScaleF64, simdMatMulF64, simdMatTransposeF64, // Statistical operations (SIMD)
  simdMeanF64, simdVarianceF64, simdStdF64, // f32x4 operations (4-wide SIMD)
  simdAddF32, simdMulF32, simdDotF32, simdSumF32, // i32x4 operations
  simdAddI32, simdMulI32, // Complex operations (SIMD)
  simdComplexMulF64, simdComplexAddF64, // Utilities
  simdSupported, simdVectorSizeF64, simdVectorSizeF32` | Re-export |
| `./statistics/select` | `partitionSelect, selectMedian, selectMin, selectMax` | Re-export |
| `./statistics/basic` | `mean, median, medianUnsorted, variance, std, sum, prod, min, max, mad, kurtosis, skewness, coefficientOfVariation, correlation, covariance, geometricMean, harmonicMean, rms, quantile, percentile, interquartileRange, range, cumsum, zscore` | Re-export |
| `./matrix/linalg` | `det, inv, inv2x2, inv3x3, norm1, norm2, normP, normInf, normFro, matrixNorm1, matrixNormInf, normalize, kron, cross, dot, outer, cond1, condInf, rank, solve, lsolve, usolve` | Re-export |
| `./matrix/eigs` | `eigsSymmetric, powerIteration, spectralRadius, inverseIteration, // SIMD-accelerated eigenvalue operations
  eigsSymmetricSIMD, powerIterationSIMD` | Re-export |
| `./matrix/complexEigs` | `balanceMatrix, reduceToHessenberg, eigenvalues2x2, qrIterationStep, qrAlgorithm, hessenbergQRStep` | Re-export |
| `./matrix/expm` | `expm, expmSmall, expmv` | Re-export |
| `./matrix/sqrtm` | `sqrtm, sqrtmNewtonSchulz, sqrtmCholesky` | Re-export |
| `./algebra/sparseLu` | `sparseLu, sparseForwardSolve, sparseBackwardSolve, sparseLuSolve` | Re-export |
| `./algebra/sparseChol` | `sparseChol, sparseCholSolve, eliminationTree, columnCounts` | Re-export |
| `./plain/operations` | `abs, add, subtract, multiply, divide, unaryMinus, unaryPlus, cbrt, cube, exp, expm1, gcd, lcm, log, log2, log10, log1p, mod, nthRoot, sign, sqrt, square, pow, norm, bitAnd, bitNot, bitOr, bitXor, leftShift, rightArithShift, rightLogShift, combinations, PI, TAU, E, PHI, not, or, xor, and, equal, unequal, smaller, smallerEq, larger, largerEq, compare, gamma, lgamma, acos, acosh, acot, acoth, acsc, acsch, asec, asech, asin, asinh, atan, atan2, atanh, cos, cosh, cot, coth, csc, csch, sec, sech, sin, sinh, tan, tanh, isIntegerValue, isNegative, isPositive, isZero, isNaN` | Re-export |
| `./utils/workPtrValidation` | `WORK_EIGS_SYMMETRIC, WORK_POWER_ITERATION, WORK_INVERSE_ITERATION_VECTOR, WORK_INVERSE_ITERATION_MATRIX, WORK_QR_ALGORITHM_VECTOR, WORK_QR_ALGORITHM_MATRIX, WORK_BALANCE_MATRIX, WORK_EXPM, WORK_EXPMV, WORK_SQRTM, WORK_SQRTM_NEWTON_SCHULZ, WORK_SPARSE_LU_VECTOR, WORK_SPARSE_LU_INT, WORK_SPARSE_CHOL_VECTOR, WORK_SPARSE_CHOL_INT, WORK_COLUMN_COUNTS, WORK_LU_DECOMPOSITION, WORK_QR_DECOMPOSITION, WORK_CHOLESKY_DECOMPOSITION, WORK_FFT_2D, WORK_IRFFT, WORK_BLOCKED_MULTIPLY, eigsSymmetricWorkSize, powerIterationWorkSize, inverseIterationWorkSize, qrAlgorithmWorkSize, expmWorkSize, sqrtmWorkSize, sqrtmNewtonSchulzWorkSize, sparseLuWorkSize, sparseCholWorkSize, columnCountsWorkSize, fft2dWorkSize, irfftWorkSize, blockedMultiplyWorkSize, condWorkSize, validateWorkPtrSize, getWorkPtrRequirement` | Re-export |

**Exports:**
- Re-exports: `multiplyDense`, `multiplyDenseSIMD`, `multiplyVector`, `transpose`, `add`, `subtract`, `scalarMultiply`, `dotProduct`, `// SIMD and cache-optimized versions
  multiplyBlockedSIMD`, `addSIMD`, `subtractSIMD`, `scalarMultiplySIMD`, `dotProductSIMD`, `multiplyVectorSIMD`, `transposeSIMD`, `luDecomposition`, `qrDecomposition`, `choleskyDecomposition`, `luSolve`, `luDeterminant`, `// SIMD-accelerated decompositions
  luDecompositionSIMD`, `qrDecompositionSIMD`, `choleskyDecompositionSIMD`, `schur`, `getSchurQ`, `getSchurT`, `schurEigenvalues`, `schurResidual`, `schurOrthogonalityError`, `fft`, `fft2d`, `convolve`, `rfft`, `irfft`, `isPowerOf2`, `// SIMD-accelerated signal processing
  fftSIMD`, `convolveSIMD`, `powerSpectrumSIMD`, `crossCorrelationSIMD`, `freqz`, `freqzUniform`, `polyMultiply`, `zpk2tf`, `magnitude`, `magnitudeDb`, `phase`, `unwrapPhase`, `groupDelay`, `rk45Step`, `rk23Step`, `maxError`, `computeStepAdjustment`, `interpolate`, `vectorCopy`, `vectorScale`, `vectorAdd`, `wouldOvershoot`, `trimStep`, `arg`, `argArray`, `conj`, `conjArray`, `re`, `reArray`, `im`, `imArray`, `abs`, `absArray`, `addComplex`, `subComplex`, `mulComplex`, `divComplex`, `sqrtComplex`, `expComplex`, `logComplex`, `sinComplex`, `cosComplex`, `tanComplex`, `powComplexReal`, `distance2D`, `distance3D`, `distanceND`, `manhattanDistance2D`, `manhattanDistanceND`, `intersect2DLines`, `intersect2DInfiniteLines`, `intersectLinePlane`, `cross3D`, `dotND`, `angle2D`, `angle3D`, `triangleArea2D`, `pointInTriangle2D`, `normalizeND`, `and`, `or`, `not`, `xor`, `nand`, `nor`, `xnor`, `all`, `any`, `countTrue`, `findFirst`, `findLast`, `findAll`, `select`, `selectArray`, `andArray`, `orArray`, `notArray`, `xorArray`, `compare`, `compareArray`, `equal`, `nearlyEqual`, `equalArray`, `unequal`, `unequalArray`, `larger`, `largerArray`, `largerEq`, `largerEqArray`, `smaller`, `smallerArray`, `smallerEq`, `smallerEqArray`, `min`, `max`, `argmin`, `argmax`, `clamp`, `clampArray`, `inRange`, `inRangeArray`, `isPositive`, `isNegative`, `isZero`, `isNaN`, `isFinite`, `isInteger`, `sign`, `signArray`, `createSet`, `setUnion`, `setIntersect`, `setDifference`, `setSymDifference`, `setIsSubset`, `setIsProperSubset`, `setIsSuperset`, `setIsProperSuperset`, `setEquals`, `setIsDisjoint`, `setSize`, `setContains`, `setAdd`, `setRemove`, `setCartesian`, `setPowerSetSize`, `setGetSubset`, `erf`, `erfArray`, `erfc`, `erfcArray`, `gamma`, `gammaArray`, `lgamma`, `lgammaArray`, `zeta`, `zetaArray`, `beta`, `gammainc`, `digamma`, `digammaArray`, `besselJ0`, `besselJ1`, `besselY0`, `besselY1`, `isDigit`, `isLetter`, `isAlphanumeric`, `isWhitespace`, `toLowerCode`, `toUpperCode`, `parseIntFromCodes`, `parseFloatFromCodes`, `countDigits`, `formatIntToCodes`, `formatFloatToCodes`, `compareCodeArrays`, `hashCodes`, `findPattern`, `countPattern`, `utf8ByteLength`, `isNumericString`, `// Vector operations (f64x2)
  simdAddF64`, `simdSubF64`, `simdMulF64`, `simdDivF64`, `simdScaleF64`, `simdDotF64`, `simdSumF64`, `simdSumSquaresF64`, `simdNormF64`, `simdMinF64`, `simdMaxF64`, `simdAbsF64`, `simdSqrtF64`, `simdNegF64`, `// Matrix operations (SIMD)
  simdMatVecMulF64`, `simdMatAddF64`, `simdMatSubF64`, `simdMatDotMulF64`, `simdMatScaleF64`, `simdMatMulF64`, `simdMatTransposeF64`, `// Statistical operations (SIMD)
  simdMeanF64`, `simdVarianceF64`, `simdStdF64`, `// f32x4 operations (4-wide SIMD)
  simdAddF32`, `simdMulF32`, `simdDotF32`, `simdSumF32`, `// i32x4 operations
  simdAddI32`, `simdMulI32`, `// Complex operations (SIMD)
  simdComplexMulF64`, `simdComplexAddF64`, `// Utilities
  simdSupported`, `simdVectorSizeF64`, `simdVectorSizeF32`, `partitionSelect`, `selectMedian`, `selectMin`, `selectMax`, `mean`, `median`, `medianUnsorted`, `variance`, `std`, `sum`, `prod`, `mad`, `kurtosis`, `skewness`, `coefficientOfVariation`, `correlation`, `covariance`, `geometricMean`, `harmonicMean`, `rms`, `quantile`, `percentile`, `interquartileRange`, `range`, `cumsum`, `zscore`, `det`, `inv`, `inv2x2`, `inv3x3`, `norm1`, `norm2`, `normP`, `normInf`, `normFro`, `matrixNorm1`, `matrixNormInf`, `normalize`, `kron`, `cross`, `dot`, `outer`, `cond1`, `condInf`, `rank`, `solve`, `lsolve`, `usolve`, `eigsSymmetric`, `powerIteration`, `spectralRadius`, `inverseIteration`, `// SIMD-accelerated eigenvalue operations
  eigsSymmetricSIMD`, `powerIterationSIMD`, `balanceMatrix`, `reduceToHessenberg`, `eigenvalues2x2`, `qrIterationStep`, `qrAlgorithm`, `hessenbergQRStep`, `expm`, `expmSmall`, `expmv`, `sqrtm`, `sqrtmNewtonSchulz`, `sqrtmCholesky`, `sparseLu`, `sparseForwardSolve`, `sparseBackwardSolve`, `sparseLuSolve`, `sparseChol`, `sparseCholSolve`, `eliminationTree`, `columnCounts`, `multiply`, `divide`, `unaryMinus`, `unaryPlus`, `cbrt`, `cube`, `exp`, `expm1`, `gcd`, `lcm`, `log`, `log2`, `log10`, `log1p`, `mod`, `nthRoot`, `sqrt`, `square`, `pow`, `norm`, `bitAnd`, `bitNot`, `bitOr`, `bitXor`, `leftShift`, `rightArithShift`, `rightLogShift`, `combinations`, `PI`, `TAU`, `E`, `PHI`, `acos`, `acosh`, `acot`, `acoth`, `acsc`, `acsch`, `asec`, `asech`, `asin`, `asinh`, `atan`, `atan2`, `atanh`, `cos`, `cosh`, `cot`, `coth`, `csc`, `csch`, `sec`, `sech`, `sin`, `sinh`, `tan`, `tanh`, `isIntegerValue`, `WORK_EIGS_SYMMETRIC`, `WORK_POWER_ITERATION`, `WORK_INVERSE_ITERATION_VECTOR`, `WORK_INVERSE_ITERATION_MATRIX`, `WORK_QR_ALGORITHM_VECTOR`, `WORK_QR_ALGORITHM_MATRIX`, `WORK_BALANCE_MATRIX`, `WORK_EXPM`, `WORK_EXPMV`, `WORK_SQRTM`, `WORK_SQRTM_NEWTON_SCHULZ`, `WORK_SPARSE_LU_VECTOR`, `WORK_SPARSE_LU_INT`, `WORK_SPARSE_CHOL_VECTOR`, `WORK_SPARSE_CHOL_INT`, `WORK_COLUMN_COUNTS`, `WORK_LU_DECOMPOSITION`, `WORK_QR_DECOMPOSITION`, `WORK_CHOLESKY_DECOMPOSITION`, `WORK_FFT_2D`, `WORK_IRFFT`, `WORK_BLOCKED_MULTIPLY`, `eigsSymmetricWorkSize`, `powerIterationWorkSize`, `inverseIterationWorkSize`, `qrAlgorithmWorkSize`, `expmWorkSize`, `sqrtmWorkSize`, `sqrtmNewtonSchulzWorkSize`, `sparseLuWorkSize`, `sparseCholWorkSize`, `columnCountsWorkSize`, `fft2dWorkSize`, `irfftWorkSize`, `blockedMultiplyWorkSize`, `condWorkSize`, `validateWorkPtrSize`, `getWorkPtrRequirement`

---

### `src/wasm/logical/operations.ts` - WASM-optimized logical operations using AssemblyScript

**Exports:**
- Functions: `and`, `andArray`, `or`, `orArray`, `not`, `notArray`, `xor`, `xorArray`, `nand`, `nor`, `xnor`, `countTrue`, `all`, `any`, `findFirst`, `findLast`, `findAll`, `select`, `selectArray`

---

### `src/wasm/matrix/algorithms.ts` - WASM-optimized matrix algorithm implementations

**Exports:**
- Functions: `algo01DenseSparseDensity`, `algo02DenseSparseZero`, `algo03DenseSparseFunction`, `algo04SparseIdentity`, `algo05SparseFunctionFunction`, `algo06SparseZeroZero`, `algo07SparseSparseFull`, `algo08SparseZeroIdentity`

---

### `src/wasm/matrix/basic.ts` - WASM-optimized basic matrix operations using AssemblyScript

**Exports:**
- Functions: `zeros`, `ones`, `identity`, `fill`, `diagFromVector`, `eye`, `diag`, `diagK`, `trace`, `traceRect`, `flatten`, `reshape`, `squeeze`, `countNonZero`, `min`, `max`, `argmin`, `argmax`, `getRow`, `getColumn`, `setRow`, `setColumn`, `swapRows`, `swapColumns`, `dotMultiply`, `dotDivide`, `dotPow`, `abs`, `sqrt`, `square`, `sum`, `prod`, `sumRows`, `sumCols`, `clone`, `copy`, `fillInPlace`, `concatHorizontal`, `concatVertical`

---

### `src/wasm/matrix/broadcast.ts` - WASM-optimized broadcast element-wise operations

**Exports:**
- Functions: `canBroadcast`, `broadcastShape`, `broadcastMultiply`, `broadcastDivide`, `broadcastAdd`, `broadcastSubtract`, `broadcastPow`, `broadcastMin`, `broadcastMax`, `broadcastMod`, `broadcastEqual`, `broadcastLess`, `broadcastGreater`, `broadcastScalarMultiply`, `broadcastScalarAdd`, `broadcastApply`

---

### `src/wasm/matrix/complexEigs.ts` - WASM-optimized complex eigenvalue decomposition using AssemblyScript

**Exports:**
- Functions: `balanceMatrix`, `reduceToHessenberg`, `eigenvalues2x2`, `qrIterationStep`, `qrAlgorithm`, `hessenbergQRStep`

---

### `src/wasm/matrix/eigs.ts` - WASM-optimized eigenvalue decomposition using AssemblyScript

**Exports:**
- Functions: `eigsSymmetric`, `powerIteration`, `spectralRadius`, `inverseIteration`, `eigsSymmetricSIMD`, `powerIterationSIMD`

---

### `src/wasm/matrix/expm.ts` - WASM-optimized matrix exponential using AssemblyScript

**Exports:**
- Functions: `expm`, `expmSmall`, `expmv`

---

### `src/wasm/matrix/functions.ts` - WASM-optimized advanced matrix functions

**Exports:**
- Functions: `pinv`, `sqrtm`, `sqrtmSPD`, `expm`, `powerIteration`, `eigsSymmetric`, `eigs`, `trace`, `spectralRadius`

---

### `src/wasm/matrix/linalg.ts` - WASM-optimized linear algebra operations using raw memory pointers

**Exports:**
- Functions: `det`, `inv`, `norm1`, `norm2`, `normP`, `normInf`, `normFro`, `matrixNorm1`, `matrixNormInf`, `normalize`, `kron`, `cross`, `dot`, `outer`, `rank`, `solve`, `lsolve`, `usolve`, `lsolveUnit`, `lsolveMultiple`, `usolveMultiple`, `inv2x2`, `inv3x3`, `cond1`, `condInf`

---

### `src/wasm/matrix/multiply.ts` - WASM-optimized matrix multiplication using AssemblyScript

**Exports:**
- Functions: `multiplyDense`, `multiplyDenseSIMD`, `multiplyVector`, `transpose`, `add`, `subtract`, `scalarMultiply`, `dotProduct`, `multiplyBlockedSIMD`, `addSIMD`, `subtractSIMD`, `scalarMultiplySIMD`, `dotProductSIMD`, `multiplyVectorSIMD`, `transposeSIMD`

---

### `src/wasm/matrix/rotation.ts` - WASM-optimized rotation matrix operations

**Exports:**
- Functions: `rotationMatrix2D`, `rotate2D`, `rotate2DAroundPoint`, `rotationMatrixX`, `rotationMatrixY`, `rotationMatrixZ`, `rotationMatrixAxisAngle`, `rotationMatrixEulerZYX`, `rotationMatrixEulerXYZ`, `rotationMatrixFromQuaternion`, `quaternionFromRotationMatrix`, `quaternionMultiply`, `quaternionSlerp`, `quaternionFromAxisAngle`, `axisAngleFromQuaternion`, `rotateByQuaternion`, `rotateByMatrix`, `eulerFromRotationMatrix`, `composeRotations`, `isRotationMatrix`

---

### `src/wasm/matrix/sparse.ts` - WASM-optimized sparse matrix graph algorithms and decompositions

**Exports:**
- Functions: `csDfs`, `csReach`, `csEtree`, `csPost`, `csPermute`, `csSpsolve`, `csCholSymbolic`, `csChol`, `csLu`, `csQr`, `csQmult`, `csAmd`, `csRcm`, `csInvPerm`, `csTranspose`, `csMult`, `csMultNnzEstimate`

---

### `src/wasm/matrix/sqrtm.ts` - WASM-optimized matrix square root using AssemblyScript

**Exports:**
- Functions: `sqrtm`, `sqrtmNewtonSchulz`, `sqrtmCholesky`

---

### `src/wasm/MatrixWasmBridge.ts` - Matrix WASM Bridge - Integrates WASM operations with mathjs Matrix types

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./WasmLoader.ts` | `wasmLoader, WasmModule` | Import |
| `../parallel/ParallelMatrix.ts` | `ParallelMatrix` | Import |

**Exports:**
- Classes: `MatrixWasmBridge`
- Interfaces: `MatrixOptions`
- Constants: `WasmThresholds`

---

### `src/wasm/numeric/calculus.ts` - WASM-optimized numerical calculus operations

**Exports:**
- Functions: `forwardDifference`, `backwardDifference`, `centralDifference`, `secondDerivative`, `fivePointStencil`, `richardsonExtrapolation`, `gradient`, `hessian`, `trapezoidalRule`, `simpsonsRule`, `simpsons38Rule`, `boolesRule`, `gaussLegendreNodes`, `gaussLegendreWeights`, `gaussLegendre`, `compositeGaussLegendre`, `romberg`, `jacobian`, `laplacian`, `divergence`, `curl3D`

---

### `src/wasm/numeric/interpolation.ts` - Interpolation algorithms for AssemblyScript/WASM

**Exports:**
- Functions: `linearInterp`, `linearInterpTable`, `bilinearInterp`, `lagrangeInterp`, `lagrangeBasis`, `dividedDifferences`, `newtonInterp`, `newtonInterpFull`, `barycentricWeights`, `barycentricInterp`, `naturalCubicSplineCoeffs`, `clampedCubicSplineCoeffs`, `cubicSplineEval`, `cubicSplineDerivative`, `hermiteInterp`, `pchipInterp`, `akimaInterp`, `polyEval`, `polyDerivEval`, `polyFit`, `batchInterpolate`

---

### `src/wasm/numeric/ode.ts` - WASM-optimized ODE (Ordinary Differential Equation) solvers

**Exports:**
- Functions: `rk45Step`, `rk23Step`, `maxError`, `computeStepAdjustment`, `interpolate`, `vectorCopy`, `vectorScale`, `vectorAdd`, `wouldOvershoot`, `trimStep`

---

### `src/wasm/numeric/rational.ts` - Rational Arithmetic for AssemblyScript/WASM

**Exports:**
- Functions: `gcd`, `lcm`, `reduce`, `add`, `subtract`, `multiply`, `divide`, `negate`, `abs`, `reciprocal`, `compare`, `equals`, `isZero`, `isPositive`, `isNegative`, `isInteger`, `toFloat`, `fromFloat`, `fromInteger`, `pow`, `isqrt`, `isPerfectSquare`, `simplifySqrt`, `modInverse`, `mod`, `sumArray`, `productArray`, `toContinuedFraction`, `fromContinuedFraction`, `mediant`, `bestApproximation`, `gcdF64`, `lcmF64`, `reduceF64`, `addF64`, `multiplyF64`, `compareF64`, `fromFloatF64`

---

### `src/wasm/numeric/rootfinding.ts` - WASM-optimized root finding algorithms

**Exports:**
- Functions: `bisectionSetup`, `bisectionStep`, `newtonSetup`, `newtonStep`, `secantSetup`, `secantStep`, `secantUpdate`, `brentSetup`, `brentStep`, `brentUpdate`, `fixedPointSetup`, `fixedPointStep`, `illinoisSetup`, `illinoisStep`, `illinoisNextX`, `mullerStep`, `steffensenStep`, `halleyStep`, `getStatus`, `getEstimate`

---

### `src/wasm/plain/arithmetic.ts` - Plain Number Arithmetic Operations - AssemblyScript

**Exports:**
- Functions: `absNumber`, `addNumber`, `subtractNumber`, `multiplyNumber`, `divideNumber`, `unaryMinusNumber`, `unaryPlusNumber`, `cbrtNumber`, `cubeNumber`, `sqrtNumber`, `squareNumber`, `nthRootNumber`, `expNumber`, `expm1Number`, `logNumber`, `log10Number`, `log2Number`, `log1pNumber`, `powNumber`, `gcdNumber`, `lcmNumber`, `xgcdNumber`, `modNumber`, `signNumber`, `roundNumber`, `normNumber`

---

### `src/wasm/plain/bitwise.ts` - Plain Number Bitwise Operations - AssemblyScript

**Exports:**
- Functions: `bitAndNumber`, `bitNotNumber`, `bitOrNumber`, `bitXorNumber`, `leftShiftNumber`, `rightArithShiftNumber`, `rightLogShiftNumber`

---

### `src/wasm/plain/combinations.ts` - Plain Number Combinatorics - AssemblyScript

**Exports:**
- Functions: `combinationsNumber`

---

### `src/wasm/plain/constants.ts` - Plain Number Mathematical Constants - AssemblyScript

**Exports:**
- Constants: `pi`, `tau`, `e`, `phi`

---

### `src/wasm/plain/index.ts` - Plain Number Operations - AssemblyScript Entry Point

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./arithmetic` | `*` | Re-export |
| `./bitwise` | `*` | Re-export |
| `./combinations` | `*` | Re-export |
| `./constants` | `*` | Re-export |
| `./logical` | `*` | Re-export |
| `./probability` | `*` | Re-export |
| `./trigonometry` | `*` | Re-export |
| `./utils` | `*` | Re-export |

**Exports:**
- Re-exports: `* from ./arithmetic`, `* from ./bitwise`, `* from ./combinations`, `* from ./constants`, `* from ./logical`, `* from ./probability`, `* from ./trigonometry`, `* from ./utils`

---

### `src/wasm/plain/logical.ts` - Plain Number Logical Operations - AssemblyScript

**Exports:**
- Functions: `notNumber`, `orNumber`, `xorNumber`, `andNumber`

---

### `src/wasm/plain/operations.ts` - AssemblyScript WASM module for plain number operations

**Exports:**
- Functions: `abs`, `add`, `subtract`, `multiply`, `divide`, `unaryMinus`, `unaryPlus`, `cbrt`, `cube`, `exp`, `expm1`, `gcd`, `lcm`, `log`, `log2`, `log10`, `log1p`, `mod`, `nthRoot`, `sign`, `sqrt`, `square`, `pow`, `norm`, `bitAnd`, `bitNot`, `bitOr`, `bitXor`, `leftShift`, `rightArithShift`, `rightLogShift`, `combinations`, `not`, `or`, `xor`, `and`, `equal`, `unequal`, `smaller`, `smallerEq`, `larger`, `largerEq`, `compare`, `gamma`, `lgamma`, `acos`, `acosh`, `acot`, `acoth`, `acsc`, `acsch`, `asec`, `asech`, `asin`, `asinh`, `atan`, `atan2`, `atanh`, `cos`, `cosh`, `cot`, `coth`, `csc`, `csch`, `sec`, `sech`, `sin`, `sinh`, `tan`, `tanh`, `isIntegerValue`, `isNegative`, `isPositive`, `isZero`, `isNaN`
- Constants: `PI`, `TAU`, `E`, `PHI`

---

### `src/wasm/plain/probability.ts` - Plain Number Probability Functions - AssemblyScript

**Exports:**
- Functions: `gammaNumber`, `lgammaNumber`
- Constants: `gammaG`, `lnSqrt2PI`, `lgammaG`, `lgammaN`

---

### `src/wasm/plain/trigonometry.ts` - Plain Number Trigonometric Functions - AssemblyScript

**Exports:**
- Functions: `sinNumber`, `cosNumber`, `tanNumber`, `asinNumber`, `acosNumber`, `atanNumber`, `atan2Number`, `sinhNumber`, `coshNumber`, `tanhNumber`, `asinhNumber`, `acoshNumber`, `atanhNumber`, `cotNumber`, `secNumber`, `cscNumber`, `acotNumber`, `asecNumber`, `acscNumber`, `cothNumber`, `sechNumber`, `cschNumber`, `acothNumber`, `asechNumber`, `acschNumber`

---

### `src/wasm/plain/utils.ts` - Plain Number Utility Functions - AssemblyScript

**Exports:**
- Functions: `isIntegerNumber`, `isNegativeNumber`, `isPositiveNumber`, `isZeroNumber`, `isNaNNumber`

---

### `src/wasm/probability/distributions.ts` - WASM-optimized probability distributions and random number generation

**Exports:**
- Functions: `setSeed`, `randomU32`, `random`, `randomInt`, `randomRange`, `uniform`, `normal`, `exponential`, `bernoulli`, `binomial`, `poisson`, `geometric`, `fillUniform`, `fillNormal`, `normalPDF`, `standardNormalCDF`, `normalCDF`, `exponentialPDF`, `exponentialCDF`, `klDivergence`, `jsDivergence`, `entropy`, `shuffle`, `sampleWithoutReplacement`, `sampleWithReplacement`

---

### `src/wasm/relational/operations.ts` - WASM-optimized relational operations using AssemblyScript

**Exports:**
- Functions: `compare`, `compareArray`, `equal`, `nearlyEqual`, `equalArray`, `unequal`, `unequalArray`, `larger`, `largerArray`, `largerEq`, `largerEqArray`, `smaller`, `smallerArray`, `smallerEq`, `smallerEqArray`, `min`, `max`, `argmin`, `argmax`, `clamp`, `clampArray`, `inRange`, `inRangeArray`, `isPositive`, `isNegative`, `isZero`, `isNaN`, `isFinite`, `isInteger`, `sign`, `signArray`

---

### `src/wasm/set/operations.ts` - WASM-optimized set operations using AssemblyScript

**Exports:**
- Functions: `createSet`, `setUnion`, `setIntersect`, `setDifference`, `setSymDifference`, `setIsSubset`, `setIsProperSubset`, `setIsSuperset`, `setIsProperSuperset`, `setEquals`, `setIsDisjoint`, `setSize`, `setContains`, `setAdd`, `setRemove`, `setCartesian`, `setPowerSetSize`, `setGetSubset`

---

### `src/wasm/signal/fft.ts` - WASM-optimized Fast Fourier Transform (FFT)

**Exports:**
- Functions: `fft`, `fft2d`, `convolve`, `rfft`, `irfft`, `isPowerOf2`, `powerSpectrum`, `magnitudeSpectrum`, `phaseSpectrum`, `crossCorrelation`, `autoCorrelation`, `fftSIMD`, `convolveSIMD`, `powerSpectrumSIMD`, `crossCorrelationSIMD`

---

### `src/wasm/signal/processing.ts` - WASM-optimized signal processing functions

**Exports:**
- Functions: `freqz`, `freqzUniform`, `polyMultiply`, `zpk2tf`, `magnitude`, `magnitudeDb`, `phase`, `unwrapPhase`, `groupDelay`

---

### `src/wasm/simd/operations.ts` - SIMD-Optimized Operations for AssemblyScript/WASM

**Exports:**
- Functions: `simdAddF64`, `simdSubF64`, `simdMulF64`, `simdDivF64`, `simdScaleF64`, `simdDotF64`, `simdSumF64`, `simdSumSquaresF64`, `simdNormF64`, `simdMinF64`, `simdMaxF64`, `simdAbsF64`, `simdSqrtF64`, `simdNegF64`, `simdMatVecMulF64`, `simdMatAddF64`, `simdMatSubF64`, `simdMatDotMulF64`, `simdMatScaleF64`, `simdMatMulF64`, `simdMatTransposeF64`, `simdMeanF64`, `simdVarianceF64`, `simdStdF64`, `simdAddF32`, `simdMulF32`, `simdDotF32`, `simdSumF32`, `simdAddI32`, `simdMulI32`, `simdComplexMulF64`, `simdComplexAddF64`, `simdSupported`, `simdVectorSizeF64`, `simdVectorSizeF32`

---

### `src/wasm/special/functions.ts` - WASM-optimized special mathematical functions using AssemblyScript

**Exports:**
- Functions: `erf`, `erfArray`, `erfc`, `erfcArray`, `gamma`, `gammaArray`, `lgamma`, `lgammaArray`, `zeta`, `zetaArray`, `beta`, `gammainc`, `digamma`, `digammaArray`, `besselJ0`, `besselJ1`, `besselY0`, `besselY1`

---

### `src/wasm/statistics/basic.ts` - WASM-optimized statistics operations using raw memory pointers

**Exports:**
- Functions: `mean`, `median`, `variance`, `std`, `sum`, `prod`, `min`, `max`, `cumsum`, `mad`, `quantile`, `covariance`, `correlation`, `range`, `geometricMean`, `harmonicMean`, `skewness`, `kurtosis`, `interquartileRange`, `zscore`, `percentile`, `medianUnsorted`, `rms`, `coefficientOfVariation`

---

### `src/wasm/statistics/select.ts` - WASM-optimized selection algorithms

**Exports:**
- Functions: `partitionSelect`, `selectMedian`, `selectMin`, `selectMax`, `selectKSmallest`, `selectKLargest`, `selectQuantile`, `partitionSelectIndex`

---

### `src/wasm/string/operations.ts` - WASM-optimized string/number operations using AssemblyScript

**Exports:**
- Functions: `isDigit`, `isLetter`, `isAlphanumeric`, `isWhitespace`, `toLowerCode`, `toUpperCode`, `parseIntFromCodes`, `parseFloatFromCodes`, `countDigits`, `formatIntToCodes`, `formatFloatToCodes`, `compareCodeArrays`, `hashCodes`, `findPattern`, `countPattern`, `utf8ByteLength`, `isNumericString`

---

### `src/wasm/trigonometry/basic.ts` - WASM-optimized trigonometric operations

**Exports:**
- Functions: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, `sinh`, `cosh`, `tanh`, `asinh`, `acosh`, `atanh`, `sec`, `csc`, `cot`, `sech`, `csch`, `coth`, `asec`, `acsc`, `acot`, `asech`, `acsch`, `acoth`, `degToRad`, `radToDeg`, `sinArray`, `cosArray`, `tanArray`, `sinhArray`, `coshArray`, `tanhArray`

---

### `src/wasm/unit/conversion.ts` - Unit Conversion for AssemblyScript/WASM

**Exports:**
- Functions: `getConversionFactor`, `getTemperatureOffset`, `isTemperatureUnit`, `convert`, `convertArray`, `toSI`, `fromSI`, `getDimensions`, `areCompatible`, `multiplyDimensions`, `divideDimensions`, `powerDimensions`, `isDimensionless`, `getPrefixMultiplier`, `applyPrefix`, `removePrefix`
- Constants: `UNIT_METER`, `UNIT_KILOMETER`, `UNIT_CENTIMETER`, `UNIT_MILLIMETER`, `UNIT_MICROMETER`, `UNIT_NANOMETER`, `UNIT_INCH`, `UNIT_FOOT`, `UNIT_YARD`, `UNIT_MILE`, `UNIT_NAUTICAL_MILE`, `UNIT_ANGSTROM`, `UNIT_LIGHT_YEAR`, `UNIT_PARSEC`, `UNIT_AU`, `UNIT_KILOGRAM`, `UNIT_GRAM`, `UNIT_MILLIGRAM`, `UNIT_MICROGRAM`, `UNIT_TONNE`, `UNIT_POUND`, `UNIT_OUNCE`, `UNIT_STONE`, `UNIT_GRAIN`, `UNIT_SLUG`, `UNIT_AMU`, `UNIT_SECOND`, `UNIT_MILLISECOND`, `UNIT_MICROSECOND`, `UNIT_NANOSECOND`, `UNIT_MINUTE`, `UNIT_HOUR`, `UNIT_DAY`, `UNIT_WEEK`, `UNIT_YEAR`, `UNIT_DECADE`, `UNIT_CENTURY`, `UNIT_KELVIN`, `UNIT_CELSIUS`, `UNIT_FAHRENHEIT`, `UNIT_RANKINE`, `UNIT_AMPERE`, `UNIT_MILLIAMPERE`, `UNIT_MICROAMPERE`, `UNIT_MOLE`, `UNIT_MILLIMOLE`, `UNIT_MICROMOLE`, `UNIT_CANDELA`, `UNIT_NEWTON`, `UNIT_DYNE`, `UNIT_POUND_FORCE`, `UNIT_KILOGRAM_FORCE`, `UNIT_JOULE`, `UNIT_KILOJOULE`, `UNIT_CALORIE`, `UNIT_KILOCALORIE`, `UNIT_BTU`, `UNIT_ELECTRON_VOLT`, `UNIT_WATT_HOUR`, `UNIT_KILOWATT_HOUR`, `UNIT_ERG`, `UNIT_WATT`, `UNIT_KILOWATT`, `UNIT_MEGAWATT`, `UNIT_HORSEPOWER`, `UNIT_PASCAL`, `UNIT_KILOPASCAL`, `UNIT_BAR`, `UNIT_ATMOSPHERE`, `UNIT_TORR`, `UNIT_PSI`, `UNIT_MMHG`, `UNIT_HERTZ`, `UNIT_KILOHERTZ`, `UNIT_MEGAHERTZ`, `UNIT_GIGAHERTZ`, `UNIT_VOLT`, `UNIT_MILLIVOLT`, `UNIT_OHM`, `UNIT_KILOHM`, `UNIT_MEGOHM`, `UNIT_FARAD`, `UNIT_MICROFARAD`, `UNIT_NANOFARAD`, `UNIT_PICOFARAD`, `UNIT_COULOMB`, `UNIT_HENRY`, `UNIT_SIEMENS`, `UNIT_WEBER`, `UNIT_TESLA`, `UNIT_SQUARE_METER`, `UNIT_SQUARE_KILOMETER`, `UNIT_HECTARE`, `UNIT_ACRE`, `UNIT_SQUARE_FOOT`, `UNIT_SQUARE_INCH`, `UNIT_SQUARE_MILE`, `UNIT_CUBIC_METER`, `UNIT_LITER`, `UNIT_MILLILITER`, `UNIT_GALLON`, `UNIT_QUART`, `UNIT_PINT`, `UNIT_CUP`, `UNIT_FLUID_OUNCE`, `UNIT_CUBIC_INCH`, `UNIT_CUBIC_FOOT`, `UNIT_METER_PER_SECOND`, `UNIT_KILOMETER_PER_HOUR`, `UNIT_MILE_PER_HOUR`, `UNIT_KNOT`, `UNIT_FOOT_PER_SECOND`, `UNIT_SPEED_OF_LIGHT`, `UNIT_RADIAN`, `UNIT_DEGREE`, `UNIT_GRADIAN`, `UNIT_ARCMINUTE`, `UNIT_ARCSECOND`, `UNIT_TURN`, `UNIT_BIT`, `UNIT_BYTE`, `UNIT_KILOBYTE`, `UNIT_MEGABYTE`, `UNIT_GIGABYTE`, `UNIT_TERABYTE`, `UNIT_KIBIBYTE`, `UNIT_MEBIBYTE`, `UNIT_GIBIBYTE`, `UNIT_TEBIBYTE`, `PREFIX_YOCTO`, `PREFIX_ZEPTO`, `PREFIX_ATTO`, `PREFIX_FEMTO`, `PREFIX_PICO`, `PREFIX_NANO`, `PREFIX_MICRO`, `PREFIX_MILLI`, `PREFIX_CENTI`, `PREFIX_DECI`, `PREFIX_NONE`, `PREFIX_DECA`, `PREFIX_HECTO`, `PREFIX_KILO`, `PREFIX_MEGA`, `PREFIX_GIGA`, `PREFIX_TERA`, `PREFIX_PETA`, `PREFIX_EXA`, `PREFIX_ZETTA`, `PREFIX_YOTTA`, `CONST_SPEED_OF_LIGHT`, `CONST_PLANCK`, `CONST_PLANCK_REDUCED`, `CONST_GRAVITATIONAL`, `CONST_ELEMENTARY_CHARGE`, `CONST_ELECTRON_MASS`, `CONST_PROTON_MASS`, `CONST_AVOGADRO`, `CONST_BOLTZMANN`, `CONST_GAS`, `CONST_STEFAN_BOLTZMANN`, `CONST_VACUUM_PERMITTIVITY`, `CONST_VACUUM_PERMEABILITY`

---

### `src/wasm/utils/checks.ts` - WASM-optimized utility functions for numeric checks

**Exports:**
- Functions: `isNaN`, `isFinite`, `isInteger`, `isPositive`, `isNegative`, `isZero`, `isNonNegative`, `isNonPositive`, `isPrime`, `isPrimeF64`, `isEven`, `isOdd`, `isBounded`, `isPerfectSquare`, `isPowerOfTwo`, `countCondition`, `allFinite`, `anyNaN`, `allPositive`, `allNonNegative`, `allIntegers`, `findFirst`, `sign`, `signArray`, `countPrimesUpTo`, `nthPrime`, `gcd`, `lcm`, `areCoprime`

---

### `src/wasm/utils/workPtrValidation.ts` - WorkPtr Size Validation Utilities

**Exports:**
- Functions: `eigsSymmetricWorkSize`, `powerIterationWorkSize`, `inverseIterationWorkSize`, `qrAlgorithmWorkSize`, `expmWorkSize`, `sqrtmWorkSize`, `sqrtmNewtonSchulzWorkSize`, `sparseLuWorkSize`, `sparseCholWorkSize`, `columnCountsWorkSize`, `fft2dWorkSize`, `irfftWorkSize`, `blockedMultiplyWorkSize`, `condWorkSize`, `validateWorkPtrSize`, `getWorkPtrRequirement`
- Constants: `WORK_EIGS_SYMMETRIC`, `WORK_POWER_ITERATION`, `WORK_INVERSE_ITERATION_VECTOR`, `WORK_INVERSE_ITERATION_MATRIX`, `WORK_QR_ALGORITHM_VECTOR`, `WORK_QR_ALGORITHM_MATRIX`, `WORK_BALANCE_MATRIX`, `WORK_EXPM`, `WORK_EXPMV`, `WORK_SQRTM`, `WORK_SQRTM_NEWTON_SCHULZ`, `WORK_SPARSE_LU_VECTOR`, `WORK_SPARSE_LU_INT`, `WORK_SPARSE_CHOL_VECTOR`, `WORK_SPARSE_CHOL_INT`, `WORK_COLUMN_COUNTS`, `WORK_LU_DECOMPOSITION`, `WORK_QR_DECOMPOSITION`, `WORK_CHOLESKY_DECOMPOSITION`, `WORK_FFT_2D`, `WORK_IRFFT`, `WORK_BLOCKED_MULTIPLY`

---

### `src/wasm/WasmLoader.ts` - WASM Loader - Loads and manages WebAssembly modules

**Exports:**
- Classes: `WasmLoader`
- Interfaces: `WasmModule`, `LoadingMetrics`
- Functions: `initWasm`
- Constants: `wasmLoader`

---

## Dependency Matrix

### File Import/Export Matrix

| File | Imports From | Exports To |
|------|--------------|------------|
| `lup` | 3 files | 0 files |
| `qr` | 2 files | 0 files |
| `schur` | 2 files | 0 files |
| `slu` | 4 files | 0 files |
| `derivative` | 6 files | 0 files |
| `leafCount` | 3 files | 0 files |
| `lyap` | 2 files | 0 files |
| `polynomialRoot` | 2 files | 0 files |
| `rationalize` | 5 files | 0 files |
| `resolve` | 5 files | 0 files |
| `util` | 4 files | 3 files |
| `wildcards` | 2 files | 1 files |
| `simplify` | 8 files | 0 files |
| `simplifyConstant` | 6 files | 0 files |
| `simplifyCore` | 5 files | 0 files |
| `lsolve` | 3 files | 0 files |
| `lsolveAll` | 2 files | 0 files |
| `lusolve` | 5 files | 0 files |
| `usolve` | 3 files | 0 files |
| `usolveAll` | 2 files | 0 files |
| `solveValidation` | 3 files | 5 files |
| `csAmd` | 5 files | 1 files |
| `csChol` | 4 files | 0 files |
| `csCounts` | 3 files | 1 files |
| `csCumsum` | 0 files | 1 files |
| `csDfs` | 3 files | 1 files |
| `csEreach` | 2 files | 1 files |
| `csEtree` | 0 files | 1 files |
| `csFkeep` | 0 files | 1 files |
| `csFlip` | 0 files | 3 files |

---

## Circular Dependency Analysis

**No circular dependencies detected.**
---

## Visual Dependency Graph

```mermaid
graph TD
    subgraph Algebra
        N0[lup]
        N1[qr]
        N2[schur]
        N3[slu]
        N4[derivative]
        N5[...40 more]
    end

    subgraph Arithmetic
        N6[abs]
        N7[add]
        N8[addScalar]
        N9[cbrt]
        N10[ceil]
        N11[...35 more]
    end

    subgraph Bitwise
        N12[bitAnd]
        N13[bitNot]
        N14[bitOr]
        N15[bitXor]
        N16[leftShift]
        N17[...3 more]
    end

    subgraph Combinatorics
        N18[bellNumbers]
        N19[catalan]
        N20[composition]
        N21[stirlingS2]
    end

    subgraph Complex
        N22[arg]
        N23[conj]
        N24[im]
        N25[re]
    end

    subgraph Core
        N26[config]
        N27[create]
        N28[config]
        N29[import]
        N30[typed]
    end

    subgraph Error
        N31[ArgumentsError]
        N32[DimensionError]
        N33[IndexError]
    end

    subgraph Expression
        N34[e]
        N35[false]
        N36[i]
        N37[Infinity]
        N38[LN10]
        N39[...309 more]
    end

    subgraph Geometry
        N40[distance]
        N41[intersect]
    end

    subgraph Entry
        N42[index]
    end

    subgraph Logical
        N43[and]
        N44[not]
        N45[nullish]
        N46[or]
        N47[xor]
    end

    subgraph Matrix
        N48[column]
        N49[concat]
        N50[count]
        N51[cross]
        N52[ctranspose]
        N53[...39 more]
    end

    subgraph Numeric
        N54[solveODE]
    end

    subgraph Plain
        N55[arithmetic]
        N56[index]
        N57[arithmetic]
        N58[bitwise]
        N59[combinations]
        N60[...7 more]
    end

    subgraph Probability
        N61[bernoulli]
        N62[combinations]
        N63[combinationsWithRep]
        N64[factorial]
        N65[gamma]
        N66[...9 more]
    end

    subgraph Relational
        N67[compare]
        N68[compareNatural]
        N69[compareText]
        N70[compareUnits]
        N71[deepEqual]
        N72[...8 more]
    end

    subgraph Set
        N73[setCartesian]
        N74[setDifference]
        N75[setDistinct]
        N76[setIntersect]
        N77[setIsSubset]
        N78[...5 more]
    end

    subgraph Signal
        N79[conv]
        N80[fft]
        N81[freqz]
        N82[index]
        N83[zpk2tf]
    end

    subgraph Special
        N84[erf]
        N85[zeta]
    end

    subgraph Statistics
        N86[corr]
        N87[cumsum]
        N88[mad]
        N89[max]
        N90[mean]
        N91[...9 more]
    end

    subgraph String
        N92[bin]
        N93[format]
        N94[hex]
        N95[oct]
        N96[print]
    end

    subgraph Trigonometry
        N97[acos]
        N98[acosh]
        N99[acot]
        N100[acoth]
        N101[acsc]
        N102[...21 more]
    end

    subgraph Type
        N103[bigint]
        N104[BigNumber]
        N105[bignumber]
        N106[boolean]
        N107[Chain]
        N108[...45 more]
    end

    subgraph Typed
        N109[arithmetic]
        N110[index]
        N111[signal]
        N112[statistics]
        N113[trigonometry]
    end

    subgraph Unit
        N114[to]
        N115[toBest]
    end

    subgraph Utils
        N116[array]
        N117[bigint]
        N118[bitwise]
        N119[constants]
        N120[formatter]
        N121[...38 more]
    end

    subgraph Wasm
        N122[decomposition]
        N123[equations]
        N124[polynomial]
        N125[schur]
        N126[solver]
        N127[...57 more]
    end

    N4 --> N30
    N4 --> N26
    N6 --> N30
    N8 --> N30
    N9 --> N30
    N9 --> N26
    N10 --> N30
    N10 --> N26
    N12 --> N118
    N12 --> N30
    N13 --> N118
    N13 --> N30
    N14 --> N118
    N14 --> N30
    N15 --> N118
    N15 --> N30
    N16 --> N118
    N16 --> N104
    N16 --> N30
    N18 --> N30
    N19 --> N30
    N20 --> N30
    N21 --> N30
    N22 --> N30
    N23 --> N30
    N24 --> N30
    N25 --> N30
    N27 --> N31
    N27 --> N32
    N27 --> N33
```

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Total TypeScript Files | 739 |
| Total Modules | 27 |
| Total Lines of Code | 122907 |
| Total Exports | 2742 |
| Total Re-exports | 468 |
| Total Classes | 10 |
| Total Interfaces | 121 |
| Total Functions | 1285 |
| Total Type Guards | 102 |
| Total Enums | 0 |
| Type-only Imports | 377 |
| Runtime Circular Deps | 0 |
| Type-only Circular Deps | 0 |

---

*Last Updated*: 2026-02-06
*Version*: 0.1.0
