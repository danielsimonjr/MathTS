# Test Coverage Analysis

**Generated**: 2026-02-06

## Summary

| Metric | Count |
|--------|-------|
| Total Source Files | 738 |
| Total Test Files | 6 |
| Source Files with Tests | 8 |
| Source Files without Tests | 730 |
| Coverage | 1.1% |

---

## Source Files Without Test Coverage

The following 730 source files are not directly imported by any test file:

### algebra/

- `src/algebra/decomposition/lup.ts` → Expected test: `tests/unit/algebra/lup.test.ts`
- `src/algebra/decomposition/qr.ts` → Expected test: `tests/unit/algebra/qr.test.ts`
- `src/algebra/decomposition/schur.ts` → Expected test: `tests/unit/algebra/schur.test.ts`
- `src/algebra/decomposition/slu.ts` → Expected test: `tests/unit/algebra/slu.test.ts`
- `src/algebra/derivative.ts` → Expected test: `tests/unit/algebra/derivative.test.ts`
- `src/algebra/leafCount.ts` → Expected test: `tests/unit/algebra/leafCount.test.ts`
- `src/algebra/lyap.ts` → Expected test: `tests/unit/algebra/lyap.test.ts`
- `src/algebra/polynomialRoot.ts` → Expected test: `tests/unit/algebra/polynomialRoot.test.ts`
- `src/algebra/rationalize.ts` → Expected test: `tests/unit/algebra/rationalize.test.ts`
- `src/algebra/resolve.ts` → Expected test: `tests/unit/algebra/resolve.test.ts`
- `src/algebra/simplify.ts` → Expected test: `tests/unit/algebra/simplify.test.ts`
- `src/algebra/simplify/util.ts` → Expected test: `tests/unit/algebra/util.test.ts`
- `src/algebra/simplify/wildcards.ts` → Expected test: `tests/unit/algebra/wildcards.test.ts`
- `src/algebra/simplifyConstant.ts` → Expected test: `tests/unit/algebra/simplifyConstant.test.ts`
- `src/algebra/simplifyCore.ts` → Expected test: `tests/unit/algebra/simplifyCore.test.ts`
- `src/algebra/solver/lsolve.ts` → Expected test: `tests/unit/algebra/lsolve.test.ts`
- `src/algebra/solver/lsolveAll.ts` → Expected test: `tests/unit/algebra/lsolveAll.test.ts`
- `src/algebra/solver/lusolve.ts` → Expected test: `tests/unit/algebra/lusolve.test.ts`
- `src/algebra/solver/usolve.ts` → Expected test: `tests/unit/algebra/usolve.test.ts`
- `src/algebra/solver/usolveAll.ts` → Expected test: `tests/unit/algebra/usolveAll.test.ts`
- `src/algebra/solver/utils/solveValidation.ts` → Expected test: `tests/unit/algebra/solveValidation.test.ts`
- `src/algebra/sparse/csAmd.ts` → Expected test: `tests/unit/algebra/csAmd.test.ts`
- `src/algebra/sparse/csChol.ts` → Expected test: `tests/unit/algebra/csChol.test.ts`
- `src/algebra/sparse/csCounts.ts` → Expected test: `tests/unit/algebra/csCounts.test.ts`
- `src/algebra/sparse/csCumsum.ts` → Expected test: `tests/unit/algebra/csCumsum.test.ts`
- `src/algebra/sparse/csDfs.ts` → Expected test: `tests/unit/algebra/csDfs.test.ts`
- `src/algebra/sparse/csEreach.ts` → Expected test: `tests/unit/algebra/csEreach.test.ts`
- `src/algebra/sparse/csEtree.ts` → Expected test: `tests/unit/algebra/csEtree.test.ts`
- `src/algebra/sparse/csFkeep.ts` → Expected test: `tests/unit/algebra/csFkeep.test.ts`
- `src/algebra/sparse/csFlip.ts` → Expected test: `tests/unit/algebra/csFlip.test.ts`
- `src/algebra/sparse/csIpvec.ts` → Expected test: `tests/unit/algebra/csIpvec.test.ts`
- `src/algebra/sparse/csLeaf.ts` → Expected test: `tests/unit/algebra/csLeaf.test.ts`
- `src/algebra/sparse/csLu.ts` → Expected test: `tests/unit/algebra/csLu.test.ts`
- `src/algebra/sparse/csMark.ts` → Expected test: `tests/unit/algebra/csMark.test.ts`
- `src/algebra/sparse/csMarked.ts` → Expected test: `tests/unit/algebra/csMarked.test.ts`
- `src/algebra/sparse/csPermute.ts` → Expected test: `tests/unit/algebra/csPermute.test.ts`
- `src/algebra/sparse/csPost.ts` → Expected test: `tests/unit/algebra/csPost.test.ts`
- `src/algebra/sparse/csReach.ts` → Expected test: `tests/unit/algebra/csReach.test.ts`
- `src/algebra/sparse/csSpsolve.ts` → Expected test: `tests/unit/algebra/csSpsolve.test.ts`
- `src/algebra/sparse/csSqr.ts` → Expected test: `tests/unit/algebra/csSqr.test.ts`
- `src/algebra/sparse/csSymperm.ts` → Expected test: `tests/unit/algebra/csSymperm.test.ts`
- `src/algebra/sparse/csTdfs.ts` → Expected test: `tests/unit/algebra/csTdfs.test.ts`
- `src/algebra/sparse/csUnflip.ts` → Expected test: `tests/unit/algebra/csUnflip.test.ts`
- `src/algebra/sylvester.ts` → Expected test: `tests/unit/algebra/sylvester.test.ts`
- `src/algebra/symbolicEqual.ts` → Expected test: `tests/unit/algebra/symbolicEqual.test.ts`

### arithmetic/

- `src/arithmetic/abs.ts` → Expected test: `tests/unit/arithmetic/abs.test.ts`
- `src/arithmetic/add.ts` → Expected test: `tests/unit/arithmetic/add.test.ts`
- `src/arithmetic/addScalar.ts` → Expected test: `tests/unit/arithmetic/addScalar.test.ts`
- `src/arithmetic/cbrt.ts` → Expected test: `tests/unit/arithmetic/cbrt.test.ts`
- `src/arithmetic/ceil.ts` → Expected test: `tests/unit/arithmetic/ceil.test.ts`
- `src/arithmetic/cube.ts` → Expected test: `tests/unit/arithmetic/cube.test.ts`
- `src/arithmetic/divide.ts` → Expected test: `tests/unit/arithmetic/divide.test.ts`
- `src/arithmetic/divideScalar.ts` → Expected test: `tests/unit/arithmetic/divideScalar.test.ts`
- `src/arithmetic/dotDivide.ts` → Expected test: `tests/unit/arithmetic/dotDivide.test.ts`
- `src/arithmetic/dotMultiply.ts` → Expected test: `tests/unit/arithmetic/dotMultiply.test.ts`
- `src/arithmetic/dotPow.ts` → Expected test: `tests/unit/arithmetic/dotPow.test.ts`
- `src/arithmetic/exp.ts` → Expected test: `tests/unit/arithmetic/exp.test.ts`
- `src/arithmetic/expm1.ts` → Expected test: `tests/unit/arithmetic/expm1.test.ts`
- `src/arithmetic/fix.ts` → Expected test: `tests/unit/arithmetic/fix.test.ts`
- `src/arithmetic/floor.ts` → Expected test: `tests/unit/arithmetic/floor.test.ts`
- `src/arithmetic/gcd.ts` → Expected test: `tests/unit/arithmetic/gcd.test.ts`
- `src/arithmetic/hypot.ts` → Expected test: `tests/unit/arithmetic/hypot.test.ts`
- `src/arithmetic/invmod.ts` → Expected test: `tests/unit/arithmetic/invmod.test.ts`
- `src/arithmetic/lcm.ts` → Expected test: `tests/unit/arithmetic/lcm.test.ts`
- `src/arithmetic/log.ts` → Expected test: `tests/unit/arithmetic/log.test.ts`
- `src/arithmetic/log10.ts` → Expected test: `tests/unit/arithmetic/log10.test.ts`
- `src/arithmetic/log1p.ts` → Expected test: `tests/unit/arithmetic/log1p.test.ts`
- `src/arithmetic/log2.ts` → Expected test: `tests/unit/arithmetic/log2.test.ts`
- `src/arithmetic/mod.ts` → Expected test: `tests/unit/arithmetic/mod.test.ts`
- `src/arithmetic/multiply.ts` → Expected test: `tests/unit/arithmetic/multiply.test.ts`
- `src/arithmetic/multiplyScalar.ts` → Expected test: `tests/unit/arithmetic/multiplyScalar.test.ts`
- `src/arithmetic/norm.ts` → Expected test: `tests/unit/arithmetic/norm.test.ts`
- `src/arithmetic/nthRoot.ts` → Expected test: `tests/unit/arithmetic/nthRoot.test.ts`
- `src/arithmetic/nthRoots.ts` → Expected test: `tests/unit/arithmetic/nthRoots.test.ts`
- `src/arithmetic/pow.ts` → Expected test: `tests/unit/arithmetic/pow.test.ts`
- `src/arithmetic/round.ts` → Expected test: `tests/unit/arithmetic/round.test.ts`
- `src/arithmetic/sign.ts` → Expected test: `tests/unit/arithmetic/sign.test.ts`
- `src/arithmetic/sqrt.ts` → Expected test: `tests/unit/arithmetic/sqrt.test.ts`
- `src/arithmetic/square.ts` → Expected test: `tests/unit/arithmetic/square.test.ts`
- `src/arithmetic/subtract.ts` → Expected test: `tests/unit/arithmetic/subtract.test.ts`
- `src/arithmetic/subtractScalar.ts` → Expected test: `tests/unit/arithmetic/subtractScalar.test.ts`
- `src/arithmetic/unaryMinus.ts` → Expected test: `tests/unit/arithmetic/unaryMinus.test.ts`
- `src/arithmetic/unaryPlus.ts` → Expected test: `tests/unit/arithmetic/unaryPlus.test.ts`
- `src/arithmetic/utils/nodeOperations.ts` → Expected test: `tests/unit/arithmetic/nodeOperations.test.ts`
- `src/arithmetic/xgcd.ts` → Expected test: `tests/unit/arithmetic/xgcd.test.ts`

### bitwise/

- `src/bitwise/bitAnd.ts` → Expected test: `tests/unit/bitwise/bitAnd.test.ts`
- `src/bitwise/bitNot.ts` → Expected test: `tests/unit/bitwise/bitNot.test.ts`
- `src/bitwise/bitOr.ts` → Expected test: `tests/unit/bitwise/bitOr.test.ts`
- `src/bitwise/bitXor.ts` → Expected test: `tests/unit/bitwise/bitXor.test.ts`
- `src/bitwise/leftShift.ts` → Expected test: `tests/unit/bitwise/leftShift.test.ts`
- `src/bitwise/rightArithShift.ts` → Expected test: `tests/unit/bitwise/rightArithShift.test.ts`
- `src/bitwise/rightLogShift.ts` → Expected test: `tests/unit/bitwise/rightLogShift.test.ts`
- `src/bitwise/useMatrixForArrayScalar.ts` → Expected test: `tests/unit/bitwise/useMatrixForArrayScalar.test.ts`

### combinatorics/

- `src/combinatorics/bellNumbers.ts` → Expected test: `tests/unit/combinatorics/bellNumbers.test.ts`
- `src/combinatorics/catalan.ts` → Expected test: `tests/unit/combinatorics/catalan.test.ts`
- `src/combinatorics/composition.ts` → Expected test: `tests/unit/combinatorics/composition.test.ts`
- `src/combinatorics/stirlingS2.ts` → Expected test: `tests/unit/combinatorics/stirlingS2.test.ts`

### complex/

- `src/complex/arg.ts` → Expected test: `tests/unit/complex/arg.test.ts`
- `src/complex/conj.ts` → Expected test: `tests/unit/complex/conj.test.ts`
- `src/complex/im.ts` → Expected test: `tests/unit/complex/im.test.ts`
- `src/complex/re.ts` → Expected test: `tests/unit/complex/re.test.ts`

### core/

- `src/core/config.ts` → Expected test: `tests/unit/core/config.test.ts`
- `src/core/create.ts` → Expected test: `tests/unit/core/create.test.ts`
- `src/core/function/config.ts` → Expected test: `tests/unit/core/config.test.ts`
- `src/core/function/import.ts` → Expected test: `tests/unit/core/import.test.ts`
- `src/core/function/typed.ts` → Expected test: `tests/unit/core/typed.test.ts`

### error/

- `src/error/ArgumentsError.ts` → Expected test: `tests/unit/error/ArgumentsError.test.ts`
- `src/error/DimensionError.ts` → Expected test: `tests/unit/error/DimensionError.test.ts`
- `src/error/IndexError.ts` → Expected test: `tests/unit/error/IndexError.test.ts`

### expression/

- `src/expression/Help.ts` → Expected test: `tests/unit/expression/Help.test.ts`
- `src/expression/Parser.ts` → Expected test: `tests/unit/expression/Parser.test.ts`
- `src/expression/embeddedDocs/constants/Infinity.ts` → Expected test: `tests/unit/expression/Infinity.test.ts`
- `src/expression/embeddedDocs/constants/LN10.ts` → Expected test: `tests/unit/expression/LN10.test.ts`
- `src/expression/embeddedDocs/constants/LN2.ts` → Expected test: `tests/unit/expression/LN2.test.ts`
- `src/expression/embeddedDocs/constants/LOG10E.ts` → Expected test: `tests/unit/expression/LOG10E.test.ts`
- `src/expression/embeddedDocs/constants/LOG2E.ts` → Expected test: `tests/unit/expression/LOG2E.test.ts`
- `src/expression/embeddedDocs/constants/NaN.ts` → Expected test: `tests/unit/expression/NaN.test.ts`
- `src/expression/embeddedDocs/constants/SQRT1_2.ts` → Expected test: `tests/unit/expression/SQRT1_2.test.ts`
- `src/expression/embeddedDocs/constants/SQRT2.ts` → Expected test: `tests/unit/expression/SQRT2.test.ts`
- `src/expression/embeddedDocs/constants/e.ts` → Expected test: `tests/unit/expression/e.test.ts`
- `src/expression/embeddedDocs/constants/false.ts` → Expected test: `tests/unit/expression/false.test.ts`
- `src/expression/embeddedDocs/constants/i.ts` → Expected test: `tests/unit/expression/i.test.ts`
- `src/expression/embeddedDocs/constants/null.ts` → Expected test: `tests/unit/expression/null.test.ts`
- `src/expression/embeddedDocs/constants/phi.ts` → Expected test: `tests/unit/expression/phi.test.ts`
- `src/expression/embeddedDocs/constants/pi.ts` → Expected test: `tests/unit/expression/pi.test.ts`
- `src/expression/embeddedDocs/constants/tau.ts` → Expected test: `tests/unit/expression/tau.test.ts`
- `src/expression/embeddedDocs/constants/true.ts` → Expected test: `tests/unit/expression/true.test.ts`
- `src/expression/embeddedDocs/constants/version.ts` → Expected test: `tests/unit/expression/version.test.ts`
- `src/expression/embeddedDocs/construction/bigint.ts` → Expected test: `tests/unit/expression/bigint.test.ts`
- `src/expression/embeddedDocs/construction/bignumber.ts` → Expected test: `tests/unit/expression/bignumber.test.ts`
- `src/expression/embeddedDocs/construction/boolean.ts` → Expected test: `tests/unit/expression/boolean.test.ts`
- `src/expression/embeddedDocs/construction/complex.ts` → Expected test: `tests/unit/expression/complex.test.ts`
- `src/expression/embeddedDocs/construction/createUnit.ts` → Expected test: `tests/unit/expression/createUnit.test.ts`
- `src/expression/embeddedDocs/construction/fraction.ts` → Expected test: `tests/unit/expression/fraction.test.ts`
- `src/expression/embeddedDocs/construction/index.ts` → Expected test: `tests/unit/expression/index.test.ts`
- `src/expression/embeddedDocs/construction/matrix.ts` → Expected test: `tests/unit/expression/matrix.test.ts`
- `src/expression/embeddedDocs/construction/number.ts` → Expected test: `tests/unit/expression/number.test.ts`
- `src/expression/embeddedDocs/construction/sparse.ts` → Expected test: `tests/unit/expression/sparse.test.ts`
- `src/expression/embeddedDocs/construction/splitUnit.ts` → Expected test: `tests/unit/expression/splitUnit.test.ts`
- `src/expression/embeddedDocs/construction/string.ts` → Expected test: `tests/unit/expression/string.test.ts`
- `src/expression/embeddedDocs/construction/unit.ts` → Expected test: `tests/unit/expression/unit.test.ts`
- `src/expression/embeddedDocs/core/config.ts` → Expected test: `tests/unit/expression/config.test.ts`
- `src/expression/embeddedDocs/core/import.ts` → Expected test: `tests/unit/expression/import.test.ts`
- `src/expression/embeddedDocs/core/typed.ts` → Expected test: `tests/unit/expression/typed.test.ts`
- `src/expression/embeddedDocs/embeddedDocs.ts` → Expected test: `tests/unit/expression/embeddedDocs.test.ts`
- `src/expression/embeddedDocs/function/algebra/derivative.ts` → Expected test: `tests/unit/expression/derivative.test.ts`
- `src/expression/embeddedDocs/function/algebra/leafCount.ts` → Expected test: `tests/unit/expression/leafCount.test.ts`
- `src/expression/embeddedDocs/function/algebra/lsolve.ts` → Expected test: `tests/unit/expression/lsolve.test.ts`
- `src/expression/embeddedDocs/function/algebra/lsolveAll.ts` → Expected test: `tests/unit/expression/lsolveAll.test.ts`
- `src/expression/embeddedDocs/function/algebra/lup.ts` → Expected test: `tests/unit/expression/lup.test.ts`
- `src/expression/embeddedDocs/function/algebra/lusolve.ts` → Expected test: `tests/unit/expression/lusolve.test.ts`
- `src/expression/embeddedDocs/function/algebra/lyap.ts` → Expected test: `tests/unit/expression/lyap.test.ts`
- `src/expression/embeddedDocs/function/algebra/polynomialRoot.ts` → Expected test: `tests/unit/expression/polynomialRoot.test.ts`
- `src/expression/embeddedDocs/function/algebra/qr.ts` → Expected test: `tests/unit/expression/qr.test.ts`
- `src/expression/embeddedDocs/function/algebra/rationalize.ts` → Expected test: `tests/unit/expression/rationalize.test.ts`
- `src/expression/embeddedDocs/function/algebra/resolve.ts` → Expected test: `tests/unit/expression/resolve.test.ts`
- `src/expression/embeddedDocs/function/algebra/schur.ts` → Expected test: `tests/unit/expression/schur.test.ts`
- `src/expression/embeddedDocs/function/algebra/simplify.ts` → Expected test: `tests/unit/expression/simplify.test.ts`
- `src/expression/embeddedDocs/function/algebra/simplifyConstant.ts` → Expected test: `tests/unit/expression/simplifyConstant.test.ts`
- `src/expression/embeddedDocs/function/algebra/simplifyCore.ts` → Expected test: `tests/unit/expression/simplifyCore.test.ts`
- `src/expression/embeddedDocs/function/algebra/slu.ts` → Expected test: `tests/unit/expression/slu.test.ts`
- `src/expression/embeddedDocs/function/algebra/sylvester.ts` → Expected test: `tests/unit/expression/sylvester.test.ts`
- `src/expression/embeddedDocs/function/algebra/symbolicEqual.ts` → Expected test: `tests/unit/expression/symbolicEqual.test.ts`
- `src/expression/embeddedDocs/function/algebra/usolve.ts` → Expected test: `tests/unit/expression/usolve.test.ts`
- `src/expression/embeddedDocs/function/algebra/usolveAll.ts` → Expected test: `tests/unit/expression/usolveAll.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/abs.ts` → Expected test: `tests/unit/expression/abs.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/add.ts` → Expected test: `tests/unit/expression/add.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/cbrt.ts` → Expected test: `tests/unit/expression/cbrt.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/ceil.ts` → Expected test: `tests/unit/expression/ceil.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/cube.ts` → Expected test: `tests/unit/expression/cube.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/divide.ts` → Expected test: `tests/unit/expression/divide.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/dotDivide.ts` → Expected test: `tests/unit/expression/dotDivide.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/dotMultiply.ts` → Expected test: `tests/unit/expression/dotMultiply.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/dotPow.ts` → Expected test: `tests/unit/expression/dotPow.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/exp.ts` → Expected test: `tests/unit/expression/exp.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/expm.ts` → Expected test: `tests/unit/expression/expm.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/expm1.ts` → Expected test: `tests/unit/expression/expm1.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/fix.ts` → Expected test: `tests/unit/expression/fix.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/floor.ts` → Expected test: `tests/unit/expression/floor.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/gcd.ts` → Expected test: `tests/unit/expression/gcd.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/hypot.ts` → Expected test: `tests/unit/expression/hypot.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/invmod.ts` → Expected test: `tests/unit/expression/invmod.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/lcm.ts` → Expected test: `tests/unit/expression/lcm.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/log.ts` → Expected test: `tests/unit/expression/log.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/log10.ts` → Expected test: `tests/unit/expression/log10.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/log1p.ts` → Expected test: `tests/unit/expression/log1p.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/log2.ts` → Expected test: `tests/unit/expression/log2.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/mod.ts` → Expected test: `tests/unit/expression/mod.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/multiply.ts` → Expected test: `tests/unit/expression/multiply.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/norm.ts` → Expected test: `tests/unit/expression/norm.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/nthRoot.ts` → Expected test: `tests/unit/expression/nthRoot.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/nthRoots.ts` → Expected test: `tests/unit/expression/nthRoots.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/pow.ts` → Expected test: `tests/unit/expression/pow.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/round.ts` → Expected test: `tests/unit/expression/round.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/sign.ts` → Expected test: `tests/unit/expression/sign.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/sqrt.ts` → Expected test: `tests/unit/expression/sqrt.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/sqrtm.ts` → Expected test: `tests/unit/expression/sqrtm.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/square.ts` → Expected test: `tests/unit/expression/square.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/subtract.ts` → Expected test: `tests/unit/expression/subtract.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/unaryMinus.ts` → Expected test: `tests/unit/expression/unaryMinus.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/unaryPlus.ts` → Expected test: `tests/unit/expression/unaryPlus.test.ts`
- `src/expression/embeddedDocs/function/arithmetic/xgcd.ts` → Expected test: `tests/unit/expression/xgcd.test.ts`
- `src/expression/embeddedDocs/function/bitwise/bitAnd.ts` → Expected test: `tests/unit/expression/bitAnd.test.ts`
- `src/expression/embeddedDocs/function/bitwise/bitNot.ts` → Expected test: `tests/unit/expression/bitNot.test.ts`
- `src/expression/embeddedDocs/function/bitwise/bitOr.ts` → Expected test: `tests/unit/expression/bitOr.test.ts`
- `src/expression/embeddedDocs/function/bitwise/bitXor.ts` → Expected test: `tests/unit/expression/bitXor.test.ts`
- `src/expression/embeddedDocs/function/bitwise/leftShift.ts` → Expected test: `tests/unit/expression/leftShift.test.ts`
- `src/expression/embeddedDocs/function/bitwise/rightArithShift.ts` → Expected test: `tests/unit/expression/rightArithShift.test.ts`
- `src/expression/embeddedDocs/function/bitwise/rightLogShift.ts` → Expected test: `tests/unit/expression/rightLogShift.test.ts`
- `src/expression/embeddedDocs/function/combinatorics/bellNumbers.ts` → Expected test: `tests/unit/expression/bellNumbers.test.ts`
- `src/expression/embeddedDocs/function/combinatorics/catalan.ts` → Expected test: `tests/unit/expression/catalan.test.ts`
- `src/expression/embeddedDocs/function/combinatorics/composition.ts` → Expected test: `tests/unit/expression/composition.test.ts`
- `src/expression/embeddedDocs/function/combinatorics/stirlingS2.ts` → Expected test: `tests/unit/expression/stirlingS2.test.ts`
- `src/expression/embeddedDocs/function/complex/arg.ts` → Expected test: `tests/unit/expression/arg.test.ts`
- `src/expression/embeddedDocs/function/complex/conj.ts` → Expected test: `tests/unit/expression/conj.test.ts`
- `src/expression/embeddedDocs/function/complex/im.ts` → Expected test: `tests/unit/expression/im.test.ts`
- `src/expression/embeddedDocs/function/complex/re.ts` → Expected test: `tests/unit/expression/re.test.ts`
- `src/expression/embeddedDocs/function/expression/compile.ts` → Expected test: `tests/unit/expression/compile.test.ts`
- `src/expression/embeddedDocs/function/expression/evaluate.ts` → Expected test: `tests/unit/expression/evaluate.test.ts`
- `src/expression/embeddedDocs/function/expression/help.ts` → Expected test: `tests/unit/expression/help.test.ts`
- `src/expression/embeddedDocs/function/expression/parse.ts` → Expected test: `tests/unit/expression/parse.test.ts`
- `src/expression/embeddedDocs/function/expression/parser.ts` → Expected test: `tests/unit/expression/parser.test.ts`
- `src/expression/embeddedDocs/function/geometry/distance.ts` → Expected test: `tests/unit/expression/distance.test.ts`
- `src/expression/embeddedDocs/function/geometry/intersect.ts` → Expected test: `tests/unit/expression/intersect.test.ts`
- `src/expression/embeddedDocs/function/logical/and.ts` → Expected test: `tests/unit/expression/and.test.ts`
- `src/expression/embeddedDocs/function/logical/not.ts` → Expected test: `tests/unit/expression/not.test.ts`
- `src/expression/embeddedDocs/function/logical/nullish.ts` → Expected test: `tests/unit/expression/nullish.test.ts`
- `src/expression/embeddedDocs/function/logical/or.ts` → Expected test: `tests/unit/expression/or.test.ts`
- `src/expression/embeddedDocs/function/logical/xor.ts` → Expected test: `tests/unit/expression/xor.test.ts`
- `src/expression/embeddedDocs/function/matrix/column.ts` → Expected test: `tests/unit/expression/column.test.ts`
- `src/expression/embeddedDocs/function/matrix/concat.ts` → Expected test: `tests/unit/expression/concat.test.ts`
- `src/expression/embeddedDocs/function/matrix/count.ts` → Expected test: `tests/unit/expression/count.test.ts`
- `src/expression/embeddedDocs/function/matrix/cross.ts` → Expected test: `tests/unit/expression/cross.test.ts`
- `src/expression/embeddedDocs/function/matrix/ctranspose.ts` → Expected test: `tests/unit/expression/ctranspose.test.ts`
- `src/expression/embeddedDocs/function/matrix/det.ts` → Expected test: `tests/unit/expression/det.test.ts`
- `src/expression/embeddedDocs/function/matrix/diag.ts` → Expected test: `tests/unit/expression/diag.test.ts`
- `src/expression/embeddedDocs/function/matrix/diff.ts` → Expected test: `tests/unit/expression/diff.test.ts`
- `src/expression/embeddedDocs/function/matrix/dot.ts` → Expected test: `tests/unit/expression/dot.test.ts`
- `src/expression/embeddedDocs/function/matrix/eigs.ts` → Expected test: `tests/unit/expression/eigs.test.ts`
- `src/expression/embeddedDocs/function/matrix/fft.ts` → Expected test: `tests/unit/expression/fft.test.ts`
- `src/expression/embeddedDocs/function/matrix/filter.ts` → Expected test: `tests/unit/expression/filter.test.ts`
- `src/expression/embeddedDocs/function/matrix/flatten.ts` → Expected test: `tests/unit/expression/flatten.test.ts`
- `src/expression/embeddedDocs/function/matrix/forEach.ts` → Expected test: `tests/unit/expression/forEach.test.ts`
- `src/expression/embeddedDocs/function/matrix/getMatrixDataType.ts` → Expected test: `tests/unit/expression/getMatrixDataType.test.ts`
- `src/expression/embeddedDocs/function/matrix/identity.ts` → Expected test: `tests/unit/expression/identity.test.ts`
- `src/expression/embeddedDocs/function/matrix/ifft.ts` → Expected test: `tests/unit/expression/ifft.test.ts`
- `src/expression/embeddedDocs/function/matrix/inv.ts` → Expected test: `tests/unit/expression/inv.test.ts`
- `src/expression/embeddedDocs/function/matrix/kron.ts` → Expected test: `tests/unit/expression/kron.test.ts`
- `src/expression/embeddedDocs/function/matrix/map.ts` → Expected test: `tests/unit/expression/map.test.ts`
- `src/expression/embeddedDocs/function/matrix/mapSlices.ts` → Expected test: `tests/unit/expression/mapSlices.test.ts`
- `src/expression/embeddedDocs/function/matrix/matrixFromColumns.ts` → Expected test: `tests/unit/expression/matrixFromColumns.test.ts`
- `src/expression/embeddedDocs/function/matrix/matrixFromFunction.ts` → Expected test: `tests/unit/expression/matrixFromFunction.test.ts`
- `src/expression/embeddedDocs/function/matrix/matrixFromRows.ts` → Expected test: `tests/unit/expression/matrixFromRows.test.ts`
- `src/expression/embeddedDocs/function/matrix/ones.ts` → Expected test: `tests/unit/expression/ones.test.ts`
- `src/expression/embeddedDocs/function/matrix/partitionSelect.ts` → Expected test: `tests/unit/expression/partitionSelect.test.ts`
- `src/expression/embeddedDocs/function/matrix/pinv.ts` → Expected test: `tests/unit/expression/pinv.test.ts`
- `src/expression/embeddedDocs/function/matrix/range.ts` → Expected test: `tests/unit/expression/range.test.ts`
- `src/expression/embeddedDocs/function/matrix/reshape.ts` → Expected test: `tests/unit/expression/reshape.test.ts`
- `src/expression/embeddedDocs/function/matrix/resize.ts` → Expected test: `tests/unit/expression/resize.test.ts`
- `src/expression/embeddedDocs/function/matrix/rotate.ts` → Expected test: `tests/unit/expression/rotate.test.ts`
- `src/expression/embeddedDocs/function/matrix/rotationMatrix.ts` → Expected test: `tests/unit/expression/rotationMatrix.test.ts`
- `src/expression/embeddedDocs/function/matrix/row.ts` → Expected test: `tests/unit/expression/row.test.ts`
- `src/expression/embeddedDocs/function/matrix/size.ts` → Expected test: `tests/unit/expression/size.test.ts`
- `src/expression/embeddedDocs/function/matrix/sort.ts` → Expected test: `tests/unit/expression/sort.test.ts`
- `src/expression/embeddedDocs/function/matrix/squeeze.ts` → Expected test: `tests/unit/expression/squeeze.test.ts`
- `src/expression/embeddedDocs/function/matrix/subset.ts` → Expected test: `tests/unit/expression/subset.test.ts`
- `src/expression/embeddedDocs/function/matrix/trace.ts` → Expected test: `tests/unit/expression/trace.test.ts`
- `src/expression/embeddedDocs/function/matrix/transpose.ts` → Expected test: `tests/unit/expression/transpose.test.ts`
- `src/expression/embeddedDocs/function/matrix/zeros.ts` → Expected test: `tests/unit/expression/zeros.test.ts`
- `src/expression/embeddedDocs/function/numeric/solveODE.ts` → Expected test: `tests/unit/expression/solveODE.test.ts`
- `src/expression/embeddedDocs/function/probability/bernoulli.ts` → Expected test: `tests/unit/expression/bernoulli.test.ts`
- `src/expression/embeddedDocs/function/probability/combinations.ts` → Expected test: `tests/unit/expression/combinations.test.ts`
- `src/expression/embeddedDocs/function/probability/combinationsWithRep.ts` → Expected test: `tests/unit/expression/combinationsWithRep.test.ts`
- `src/expression/embeddedDocs/function/probability/distribution.ts` → Expected test: `tests/unit/expression/distribution.test.ts`
- `src/expression/embeddedDocs/function/probability/factorial.ts` → Expected test: `tests/unit/expression/factorial.test.ts`
- `src/expression/embeddedDocs/function/probability/gamma.ts` → Expected test: `tests/unit/expression/gamma.test.ts`
- `src/expression/embeddedDocs/function/probability/kldivergence.ts` → Expected test: `tests/unit/expression/kldivergence.test.ts`
- `src/expression/embeddedDocs/function/probability/lgamma.ts` → Expected test: `tests/unit/expression/lgamma.test.ts`
- `src/expression/embeddedDocs/function/probability/multinomial.ts` → Expected test: `tests/unit/expression/multinomial.test.ts`
- `src/expression/embeddedDocs/function/probability/permutations.ts` → Expected test: `tests/unit/expression/permutations.test.ts`
- `src/expression/embeddedDocs/function/probability/pickRandom.ts` → Expected test: `tests/unit/expression/pickRandom.test.ts`
- `src/expression/embeddedDocs/function/probability/random.ts` → Expected test: `tests/unit/expression/random.test.ts`
- `src/expression/embeddedDocs/function/probability/randomInt.ts` → Expected test: `tests/unit/expression/randomInt.test.ts`
- `src/expression/embeddedDocs/function/relational/compare.ts` → Expected test: `tests/unit/expression/compare.test.ts`
- `src/expression/embeddedDocs/function/relational/compareNatural.ts` → Expected test: `tests/unit/expression/compareNatural.test.ts`
- `src/expression/embeddedDocs/function/relational/compareText.ts` → Expected test: `tests/unit/expression/compareText.test.ts`
- `src/expression/embeddedDocs/function/relational/deepEqual.ts` → Expected test: `tests/unit/expression/deepEqual.test.ts`
- `src/expression/embeddedDocs/function/relational/equal.ts` → Expected test: `tests/unit/expression/equal.test.ts`
- `src/expression/embeddedDocs/function/relational/equalText.ts` → Expected test: `tests/unit/expression/equalText.test.ts`
- `src/expression/embeddedDocs/function/relational/larger.ts` → Expected test: `tests/unit/expression/larger.test.ts`
- `src/expression/embeddedDocs/function/relational/largerEq.ts` → Expected test: `tests/unit/expression/largerEq.test.ts`
- `src/expression/embeddedDocs/function/relational/smaller.ts` → Expected test: `tests/unit/expression/smaller.test.ts`
- `src/expression/embeddedDocs/function/relational/smallerEq.ts` → Expected test: `tests/unit/expression/smallerEq.test.ts`
- `src/expression/embeddedDocs/function/relational/unequal.ts` → Expected test: `tests/unit/expression/unequal.test.ts`
- `src/expression/embeddedDocs/function/set/setCartesian.ts` → Expected test: `tests/unit/expression/setCartesian.test.ts`
- `src/expression/embeddedDocs/function/set/setDifference.ts` → Expected test: `tests/unit/expression/setDifference.test.ts`
- `src/expression/embeddedDocs/function/set/setDistinct.ts` → Expected test: `tests/unit/expression/setDistinct.test.ts`
- `src/expression/embeddedDocs/function/set/setIntersect.ts` → Expected test: `tests/unit/expression/setIntersect.test.ts`
- `src/expression/embeddedDocs/function/set/setIsSubset.ts` → Expected test: `tests/unit/expression/setIsSubset.test.ts`
- `src/expression/embeddedDocs/function/set/setMultiplicity.ts` → Expected test: `tests/unit/expression/setMultiplicity.test.ts`
- `src/expression/embeddedDocs/function/set/setPowerset.ts` → Expected test: `tests/unit/expression/setPowerset.test.ts`
- `src/expression/embeddedDocs/function/set/setSize.ts` → Expected test: `tests/unit/expression/setSize.test.ts`
- `src/expression/embeddedDocs/function/set/setSymDifference.ts` → Expected test: `tests/unit/expression/setSymDifference.test.ts`
- `src/expression/embeddedDocs/function/set/setUnion.ts` → Expected test: `tests/unit/expression/setUnion.test.ts`
- `src/expression/embeddedDocs/function/signal/freqz.ts` → Expected test: `tests/unit/expression/freqz.test.ts`
- `src/expression/embeddedDocs/function/signal/zpk2tf.ts` → Expected test: `tests/unit/expression/zpk2tf.test.ts`
- `src/expression/embeddedDocs/function/special/erf.ts` → Expected test: `tests/unit/expression/erf.test.ts`
- `src/expression/embeddedDocs/function/special/zeta.ts` → Expected test: `tests/unit/expression/zeta.test.ts`
- `src/expression/embeddedDocs/function/statistics/corr.ts` → Expected test: `tests/unit/expression/corr.test.ts`
- `src/expression/embeddedDocs/function/statistics/cumsum.ts` → Expected test: `tests/unit/expression/cumsum.test.ts`
- `src/expression/embeddedDocs/function/statistics/mad.ts` → Expected test: `tests/unit/expression/mad.test.ts`
- `src/expression/embeddedDocs/function/statistics/max.ts` → Expected test: `tests/unit/expression/max.test.ts`
- `src/expression/embeddedDocs/function/statistics/mean.ts` → Expected test: `tests/unit/expression/mean.test.ts`
- `src/expression/embeddedDocs/function/statistics/median.ts` → Expected test: `tests/unit/expression/median.test.ts`
- `src/expression/embeddedDocs/function/statistics/min.ts` → Expected test: `tests/unit/expression/min.test.ts`
- `src/expression/embeddedDocs/function/statistics/mode.ts` → Expected test: `tests/unit/expression/mode.test.ts`
- `src/expression/embeddedDocs/function/statistics/prod.ts` → Expected test: `tests/unit/expression/prod.test.ts`
- `src/expression/embeddedDocs/function/statistics/quantileSeq.ts` → Expected test: `tests/unit/expression/quantileSeq.test.ts`
- `src/expression/embeddedDocs/function/statistics/std.ts` → Expected test: `tests/unit/expression/std.test.ts`
- `src/expression/embeddedDocs/function/statistics/sum.ts` → Expected test: `tests/unit/expression/sum.test.ts`
- `src/expression/embeddedDocs/function/statistics/variance.ts` → Expected test: `tests/unit/expression/variance.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/acos.ts` → Expected test: `tests/unit/expression/acos.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/acosh.ts` → Expected test: `tests/unit/expression/acosh.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/acot.ts` → Expected test: `tests/unit/expression/acot.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/acoth.ts` → Expected test: `tests/unit/expression/acoth.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/acsc.ts` → Expected test: `tests/unit/expression/acsc.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/acsch.ts` → Expected test: `tests/unit/expression/acsch.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/asec.ts` → Expected test: `tests/unit/expression/asec.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/asech.ts` → Expected test: `tests/unit/expression/asech.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/asin.ts` → Expected test: `tests/unit/expression/asin.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/asinh.ts` → Expected test: `tests/unit/expression/asinh.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/atan.ts` → Expected test: `tests/unit/expression/atan.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/atan2.ts` → Expected test: `tests/unit/expression/atan2.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/atanh.ts` → Expected test: `tests/unit/expression/atanh.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/cos.ts` → Expected test: `tests/unit/expression/cos.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/cosh.ts` → Expected test: `tests/unit/expression/cosh.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/cot.ts` → Expected test: `tests/unit/expression/cot.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/coth.ts` → Expected test: `tests/unit/expression/coth.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/csc.ts` → Expected test: `tests/unit/expression/csc.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/csch.ts` → Expected test: `tests/unit/expression/csch.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/sec.ts` → Expected test: `tests/unit/expression/sec.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/sech.ts` → Expected test: `tests/unit/expression/sech.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/sin.ts` → Expected test: `tests/unit/expression/sin.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/sinh.ts` → Expected test: `tests/unit/expression/sinh.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/tan.ts` → Expected test: `tests/unit/expression/tan.test.ts`
- `src/expression/embeddedDocs/function/trigonometry/tanh.ts` → Expected test: `tests/unit/expression/tanh.test.ts`
- `src/expression/embeddedDocs/function/units/to.ts` → Expected test: `tests/unit/expression/to.test.ts`
- `src/expression/embeddedDocs/function/units/toBest.ts` → Expected test: `tests/unit/expression/toBest.test.ts`
- `src/expression/embeddedDocs/function/utils/bin.ts` → Expected test: `tests/unit/expression/bin.test.ts`
- `src/expression/embeddedDocs/function/utils/clone.ts` → Expected test: `tests/unit/expression/clone.test.ts`
- `src/expression/embeddedDocs/function/utils/format.ts` → Expected test: `tests/unit/expression/format.test.ts`
- `src/expression/embeddedDocs/function/utils/hasNumericValue.ts` → Expected test: `tests/unit/expression/hasNumericValue.test.ts`
- `src/expression/embeddedDocs/function/utils/hex.ts` → Expected test: `tests/unit/expression/hex.test.ts`
- `src/expression/embeddedDocs/function/utils/isBounded.ts` → Expected test: `tests/unit/expression/isBounded.test.ts`
- `src/expression/embeddedDocs/function/utils/isFinite.ts` → Expected test: `tests/unit/expression/isFinite.test.ts`
- `src/expression/embeddedDocs/function/utils/isInteger.ts` → Expected test: `tests/unit/expression/isInteger.test.ts`
- `src/expression/embeddedDocs/function/utils/isNaN.ts` → Expected test: `tests/unit/expression/isNaN.test.ts`
- `src/expression/embeddedDocs/function/utils/isNegative.ts` → Expected test: `tests/unit/expression/isNegative.test.ts`
- `src/expression/embeddedDocs/function/utils/isNumeric.ts` → Expected test: `tests/unit/expression/isNumeric.test.ts`
- `src/expression/embeddedDocs/function/utils/isPositive.ts` → Expected test: `tests/unit/expression/isPositive.test.ts`
- `src/expression/embeddedDocs/function/utils/isPrime.ts` → Expected test: `tests/unit/expression/isPrime.test.ts`
- `src/expression/embeddedDocs/function/utils/isZero.ts` → Expected test: `tests/unit/expression/isZero.test.ts`
- `src/expression/embeddedDocs/function/utils/numeric.ts` → Expected test: `tests/unit/expression/numeric.test.ts`
- `src/expression/embeddedDocs/function/utils/oct.ts` → Expected test: `tests/unit/expression/oct.test.ts`
- `src/expression/embeddedDocs/function/utils/print.ts` → Expected test: `tests/unit/expression/print.test.ts`
- `src/expression/embeddedDocs/function/utils/typeOf.ts` → Expected test: `tests/unit/expression/typeOf.test.ts`
- `src/expression/function/compile.ts` → Expected test: `tests/unit/expression/compile.test.ts`
- `src/expression/function/evaluate.ts` → Expected test: `tests/unit/expression/evaluate.test.ts`
- `src/expression/function/help.ts` → Expected test: `tests/unit/expression/help.test.ts`
- `src/expression/function/parser.ts` → Expected test: `tests/unit/expression/parser.test.ts`
- `src/expression/keywords.ts` → Expected test: `tests/unit/expression/keywords.test.ts`
- `src/expression/node/AccessorNode.ts` → Expected test: `tests/unit/expression/AccessorNode.test.ts`
- `src/expression/node/ArrayNode.ts` → Expected test: `tests/unit/expression/ArrayNode.test.ts`
- `src/expression/node/AssignmentNode.ts` → Expected test: `tests/unit/expression/AssignmentNode.test.ts`
- `src/expression/node/BlockNode.ts` → Expected test: `tests/unit/expression/BlockNode.test.ts`
- `src/expression/node/ConditionalNode.ts` → Expected test: `tests/unit/expression/ConditionalNode.test.ts`
- `src/expression/node/ConstantNode.ts` → Expected test: `tests/unit/expression/ConstantNode.test.ts`
- `src/expression/node/FunctionAssignmentNode.ts` → Expected test: `tests/unit/expression/FunctionAssignmentNode.test.ts`
- `src/expression/node/FunctionNode.ts` → Expected test: `tests/unit/expression/FunctionNode.test.ts`
- `src/expression/node/IndexNode.ts` → Expected test: `tests/unit/expression/IndexNode.test.ts`
- `src/expression/node/Node.ts` → Expected test: `tests/unit/expression/Node.test.ts`
- `src/expression/node/ObjectNode.ts` → Expected test: `tests/unit/expression/ObjectNode.test.ts`
- `src/expression/node/OperatorNode.ts` → Expected test: `tests/unit/expression/OperatorNode.test.ts`
- `src/expression/node/ParenthesisNode.ts` → Expected test: `tests/unit/expression/ParenthesisNode.test.ts`
- `src/expression/node/RangeNode.ts` → Expected test: `tests/unit/expression/RangeNode.test.ts`
- `src/expression/node/RelationalNode.ts` → Expected test: `tests/unit/expression/RelationalNode.test.ts`
- `src/expression/node/SymbolNode.ts` → Expected test: `tests/unit/expression/SymbolNode.test.ts`
- `src/expression/node/utils/access.ts` → Expected test: `tests/unit/expression/access.test.ts`
- `src/expression/node/utils/assign.ts` → Expected test: `tests/unit/expression/assign.test.ts`
- `src/expression/operators.ts` → Expected test: `tests/unit/expression/operators.test.ts`
- `src/expression/parse.ts` → Expected test: `tests/unit/expression/parse.test.ts`
- `src/expression/transform/and.transform.ts` → Expected test: `tests/unit/expression/and.transform.test.ts`
- `src/expression/transform/bitAnd.transform.ts` → Expected test: `tests/unit/expression/bitAnd.transform.test.ts`
- `src/expression/transform/bitOr.transform.ts` → Expected test: `tests/unit/expression/bitOr.transform.test.ts`
- `src/expression/transform/column.transform.ts` → Expected test: `tests/unit/expression/column.transform.test.ts`
- `src/expression/transform/concat.transform.ts` → Expected test: `tests/unit/expression/concat.transform.test.ts`
- `src/expression/transform/cumsum.transform.ts` → Expected test: `tests/unit/expression/cumsum.transform.test.ts`
- `src/expression/transform/diff.transform.ts` → Expected test: `tests/unit/expression/diff.transform.test.ts`
- `src/expression/transform/filter.transform.ts` → Expected test: `tests/unit/expression/filter.transform.test.ts`
- `src/expression/transform/forEach.transform.ts` → Expected test: `tests/unit/expression/forEach.transform.test.ts`
- `src/expression/transform/index.transform.ts` → Expected test: `tests/unit/expression/index.transform.test.ts`
- `src/expression/transform/map.transform.ts` → Expected test: `tests/unit/expression/map.transform.test.ts`
- `src/expression/transform/mapSlices.transform.ts` → Expected test: `tests/unit/expression/mapSlices.transform.test.ts`
- `src/expression/transform/max.transform.ts` → Expected test: `tests/unit/expression/max.transform.test.ts`
- `src/expression/transform/mean.transform.ts` → Expected test: `tests/unit/expression/mean.transform.test.ts`
- `src/expression/transform/min.transform.ts` → Expected test: `tests/unit/expression/min.transform.test.ts`
- `src/expression/transform/nullish.transform.ts` → Expected test: `tests/unit/expression/nullish.transform.test.ts`
- `src/expression/transform/or.transform.ts` → Expected test: `tests/unit/expression/or.transform.test.ts`
- `src/expression/transform/print.transform.ts` → Expected test: `tests/unit/expression/print.transform.test.ts`
- `src/expression/transform/quantileSeq.transform.ts` → Expected test: `tests/unit/expression/quantileSeq.transform.test.ts`
- `src/expression/transform/range.transform.ts` → Expected test: `tests/unit/expression/range.transform.test.ts`
- `src/expression/transform/row.transform.ts` → Expected test: `tests/unit/expression/row.transform.test.ts`
- `src/expression/transform/std.transform.ts` → Expected test: `tests/unit/expression/std.transform.test.ts`
- `src/expression/transform/subset.transform.ts` → Expected test: `tests/unit/expression/subset.transform.test.ts`
- `src/expression/transform/sum.transform.ts` → Expected test: `tests/unit/expression/sum.transform.test.ts`
- `src/expression/transform/types.ts` → Expected test: `tests/unit/expression/types.test.ts`
- `src/expression/transform/utils/compileInlineExpression.ts` → Expected test: `tests/unit/expression/compileInlineExpression.test.ts`
- `src/expression/transform/utils/dimToZeroBase.ts` → Expected test: `tests/unit/expression/dimToZeroBase.test.ts`
- `src/expression/transform/utils/errorTransform.ts` → Expected test: `tests/unit/expression/errorTransform.test.ts`
- `src/expression/transform/utils/lastDimToZeroBase.ts` → Expected test: `tests/unit/expression/lastDimToZeroBase.test.ts`
- `src/expression/transform/utils/transformCallback.ts` → Expected test: `tests/unit/expression/transformCallback.test.ts`
- `src/expression/transform/variance.transform.ts` → Expected test: `tests/unit/expression/variance.transform.test.ts`
- `src/expression/types.ts` → Expected test: `tests/unit/expression/types.test.ts`

### geometry/

- `src/geometry/distance.ts` → Expected test: `tests/unit/geometry/distance.test.ts`
- `src/geometry/intersect.ts` → Expected test: `tests/unit/geometry/intersect.test.ts`

### logical/

- `src/logical/and.ts` → Expected test: `tests/unit/logical/and.test.ts`
- `src/logical/not.ts` → Expected test: `tests/unit/logical/not.test.ts`
- `src/logical/nullish.ts` → Expected test: `tests/unit/logical/nullish.test.ts`
- `src/logical/or.ts` → Expected test: `tests/unit/logical/or.test.ts`
- `src/logical/xor.ts` → Expected test: `tests/unit/logical/xor.test.ts`

### matrix/

- `src/matrix/column.ts` → Expected test: `tests/unit/matrix/column.test.ts`
- `src/matrix/concat.ts` → Expected test: `tests/unit/matrix/concat.test.ts`
- `src/matrix/count.ts` → Expected test: `tests/unit/matrix/count.test.ts`
- `src/matrix/cross.ts` → Expected test: `tests/unit/matrix/cross.test.ts`
- `src/matrix/ctranspose.ts` → Expected test: `tests/unit/matrix/ctranspose.test.ts`
- `src/matrix/det.ts` → Expected test: `tests/unit/matrix/det.test.ts`
- `src/matrix/diag.ts` → Expected test: `tests/unit/matrix/diag.test.ts`
- `src/matrix/diff.ts` → Expected test: `tests/unit/matrix/diff.test.ts`
- `src/matrix/dot.ts` → Expected test: `tests/unit/matrix/dot.test.ts`
- `src/matrix/eigs.ts` → Expected test: `tests/unit/matrix/eigs.test.ts`
- `src/matrix/eigs/complexEigs.ts` → Expected test: `tests/unit/matrix/complexEigs.test.ts`
- `src/matrix/eigs/realSymmetric.ts` → Expected test: `tests/unit/matrix/realSymmetric.test.ts`
- `src/matrix/expm.ts` → Expected test: `tests/unit/matrix/expm.test.ts`
- `src/matrix/fft.ts` → Expected test: `tests/unit/matrix/fft.test.ts`
- `src/matrix/filter.ts` → Expected test: `tests/unit/matrix/filter.test.ts`
- `src/matrix/flatten.ts` → Expected test: `tests/unit/matrix/flatten.test.ts`
- `src/matrix/forEach.ts` → Expected test: `tests/unit/matrix/forEach.test.ts`
- `src/matrix/getMatrixDataType.ts` → Expected test: `tests/unit/matrix/getMatrixDataType.test.ts`
- `src/matrix/identity.ts` → Expected test: `tests/unit/matrix/identity.test.ts`
- `src/matrix/ifft.ts` → Expected test: `tests/unit/matrix/ifft.test.ts`
- `src/matrix/inv.ts` → Expected test: `tests/unit/matrix/inv.test.ts`
- `src/matrix/kron.ts` → Expected test: `tests/unit/matrix/kron.test.ts`
- `src/matrix/map.ts` → Expected test: `tests/unit/matrix/map.test.ts`
- `src/matrix/mapSlices.ts` → Expected test: `tests/unit/matrix/mapSlices.test.ts`
- `src/matrix/matrixFromColumns.ts` → Expected test: `tests/unit/matrix/matrixFromColumns.test.ts`
- `src/matrix/matrixFromFunction.ts` → Expected test: `tests/unit/matrix/matrixFromFunction.test.ts`
- `src/matrix/matrixFromRows.ts` → Expected test: `tests/unit/matrix/matrixFromRows.test.ts`
- `src/matrix/ones.ts` → Expected test: `tests/unit/matrix/ones.test.ts`
- `src/matrix/partitionSelect.ts` → Expected test: `tests/unit/matrix/partitionSelect.test.ts`
- `src/matrix/pinv.ts` → Expected test: `tests/unit/matrix/pinv.test.ts`
- `src/matrix/range.ts` → Expected test: `tests/unit/matrix/range.test.ts`
- `src/matrix/reshape.ts` → Expected test: `tests/unit/matrix/reshape.test.ts`
- `src/matrix/resize.ts` → Expected test: `tests/unit/matrix/resize.test.ts`
- `src/matrix/rotate.ts` → Expected test: `tests/unit/matrix/rotate.test.ts`
- `src/matrix/rotationMatrix.ts` → Expected test: `tests/unit/matrix/rotationMatrix.test.ts`
- `src/matrix/row.ts` → Expected test: `tests/unit/matrix/row.test.ts`
- `src/matrix/size.ts` → Expected test: `tests/unit/matrix/size.test.ts`
- `src/matrix/sort.ts` → Expected test: `tests/unit/matrix/sort.test.ts`
- `src/matrix/sqrtm.ts` → Expected test: `tests/unit/matrix/sqrtm.test.ts`
- `src/matrix/squeeze.ts` → Expected test: `tests/unit/matrix/squeeze.test.ts`
- `src/matrix/subset.ts` → Expected test: `tests/unit/matrix/subset.test.ts`
- `src/matrix/trace.ts` → Expected test: `tests/unit/matrix/trace.test.ts`
- `src/matrix/transpose.ts` → Expected test: `tests/unit/matrix/transpose.test.ts`
- `src/matrix/zeros.ts` → Expected test: `tests/unit/matrix/zeros.test.ts`

### numeric/

- `src/numeric/solveODE.ts` → Expected test: `tests/unit/numeric/solveODE.test.ts`

### plain/

- `src/plain/bignumber/arithmetic.ts` → Expected test: `tests/unit/plain/arithmetic.test.ts`
- `src/plain/bignumber/index.ts` → Expected test: `tests/unit/plain/index.test.ts`
- `src/plain/number/arithmetic.ts` → Expected test: `tests/unit/plain/arithmetic.test.ts`
- `src/plain/number/bitwise.ts` → Expected test: `tests/unit/plain/bitwise.test.ts`
- `src/plain/number/combinations.ts` → Expected test: `tests/unit/plain/combinations.test.ts`
- `src/plain/number/constants.ts` → Expected test: `tests/unit/plain/constants.test.ts`
- `src/plain/number/index.ts` → Expected test: `tests/unit/plain/index.test.ts`
- `src/plain/number/logical.ts` → Expected test: `tests/unit/plain/logical.test.ts`
- `src/plain/number/probability.ts` → Expected test: `tests/unit/plain/probability.test.ts`
- `src/plain/number/relational.ts` → Expected test: `tests/unit/plain/relational.test.ts`
- `src/plain/number/trigonometry.ts` → Expected test: `tests/unit/plain/trigonometry.test.ts`
- `src/plain/number/utils.ts` → Expected test: `tests/unit/plain/utils.test.ts`

### probability/

- `src/probability/bernoulli.ts` → Expected test: `tests/unit/probability/bernoulli.test.ts`
- `src/probability/combinations.ts` → Expected test: `tests/unit/probability/combinations.test.ts`
- `src/probability/combinationsWithRep.ts` → Expected test: `tests/unit/probability/combinationsWithRep.test.ts`
- `src/probability/factorial.ts` → Expected test: `tests/unit/probability/factorial.test.ts`
- `src/probability/gamma.ts` → Expected test: `tests/unit/probability/gamma.test.ts`
- `src/probability/kldivergence.ts` → Expected test: `tests/unit/probability/kldivergence.test.ts`
- `src/probability/lgamma.ts` → Expected test: `tests/unit/probability/lgamma.test.ts`
- `src/probability/multinomial.ts` → Expected test: `tests/unit/probability/multinomial.test.ts`
- `src/probability/permutations.ts` → Expected test: `tests/unit/probability/permutations.test.ts`
- `src/probability/pickRandom.ts` → Expected test: `tests/unit/probability/pickRandom.test.ts`
- `src/probability/random.ts` → Expected test: `tests/unit/probability/random.test.ts`
- `src/probability/randomInt.ts` → Expected test: `tests/unit/probability/randomInt.test.ts`
- `src/probability/util/randomMatrix.ts` → Expected test: `tests/unit/probability/randomMatrix.test.ts`
- `src/probability/util/seededRNG.ts` → Expected test: `tests/unit/probability/seededRNG.test.ts`

### relational/

- `src/relational/compare.ts` → Expected test: `tests/unit/relational/compare.test.ts`
- `src/relational/compareNatural.ts` → Expected test: `tests/unit/relational/compareNatural.test.ts`
- `src/relational/compareText.ts` → Expected test: `tests/unit/relational/compareText.test.ts`
- `src/relational/compareUnits.ts` → Expected test: `tests/unit/relational/compareUnits.test.ts`
- `src/relational/deepEqual.ts` → Expected test: `tests/unit/relational/deepEqual.test.ts`
- `src/relational/equal.ts` → Expected test: `tests/unit/relational/equal.test.ts`
- `src/relational/equalScalar.ts` → Expected test: `tests/unit/relational/equalScalar.test.ts`
- `src/relational/equalText.ts` → Expected test: `tests/unit/relational/equalText.test.ts`
- `src/relational/larger.ts` → Expected test: `tests/unit/relational/larger.test.ts`
- `src/relational/largerEq.ts` → Expected test: `tests/unit/relational/largerEq.test.ts`
- `src/relational/smaller.ts` → Expected test: `tests/unit/relational/smaller.test.ts`
- `src/relational/smallerEq.ts` → Expected test: `tests/unit/relational/smallerEq.test.ts`
- `src/relational/unequal.ts` → Expected test: `tests/unit/relational/unequal.test.ts`

### set/

- `src/set/setCartesian.ts` → Expected test: `tests/unit/set/setCartesian.test.ts`
- `src/set/setDifference.ts` → Expected test: `tests/unit/set/setDifference.test.ts`
- `src/set/setDistinct.ts` → Expected test: `tests/unit/set/setDistinct.test.ts`
- `src/set/setIntersect.ts` → Expected test: `tests/unit/set/setIntersect.test.ts`
- `src/set/setIsSubset.ts` → Expected test: `tests/unit/set/setIsSubset.test.ts`
- `src/set/setMultiplicity.ts` → Expected test: `tests/unit/set/setMultiplicity.test.ts`
- `src/set/setPowerset.ts` → Expected test: `tests/unit/set/setPowerset.test.ts`
- `src/set/setSize.ts` → Expected test: `tests/unit/set/setSize.test.ts`
- `src/set/setSymDifference.ts` → Expected test: `tests/unit/set/setSymDifference.test.ts`
- `src/set/setUnion.ts` → Expected test: `tests/unit/set/setUnion.test.ts`

### signal/

- `src/signal/freqz.ts` → Expected test: `tests/unit/signal/freqz.test.ts`
- `src/signal/index.ts` → Expected test: `tests/unit/signal/index.test.ts`
- `src/signal/zpk2tf.ts` → Expected test: `tests/unit/signal/zpk2tf.test.ts`

### special/

- `src/special/erf.ts` → Expected test: `tests/unit/special/erf.test.ts`
- `src/special/zeta.ts` → Expected test: `tests/unit/special/zeta.test.ts`

### statistics/

- `src/statistics/corr.ts` → Expected test: `tests/unit/statistics/corr.test.ts`
- `src/statistics/cumsum.ts` → Expected test: `tests/unit/statistics/cumsum.test.ts`
- `src/statistics/mad.ts` → Expected test: `tests/unit/statistics/mad.test.ts`
- `src/statistics/max.ts` → Expected test: `tests/unit/statistics/max.test.ts`
- `src/statistics/mean.ts` → Expected test: `tests/unit/statistics/mean.test.ts`
- `src/statistics/median.ts` → Expected test: `tests/unit/statistics/median.test.ts`
- `src/statistics/min.ts` → Expected test: `tests/unit/statistics/min.test.ts`
- `src/statistics/mode.ts` → Expected test: `tests/unit/statistics/mode.test.ts`
- `src/statistics/prod.ts` → Expected test: `tests/unit/statistics/prod.test.ts`
- `src/statistics/quantileSeq.ts` → Expected test: `tests/unit/statistics/quantileSeq.test.ts`
- `src/statistics/std.ts` → Expected test: `tests/unit/statistics/std.test.ts`
- `src/statistics/sum.ts` → Expected test: `tests/unit/statistics/sum.test.ts`
- `src/statistics/utils/improveErrorMessage.ts` → Expected test: `tests/unit/statistics/improveErrorMessage.test.ts`
- `src/statistics/variance.ts` → Expected test: `tests/unit/statistics/variance.test.ts`

### string/

- `src/string/bin.ts` → Expected test: `tests/unit/string/bin.test.ts`
- `src/string/format.ts` → Expected test: `tests/unit/string/format.test.ts`
- `src/string/hex.ts` → Expected test: `tests/unit/string/hex.test.ts`
- `src/string/oct.ts` → Expected test: `tests/unit/string/oct.test.ts`
- `src/string/print.ts` → Expected test: `tests/unit/string/print.test.ts`

### trigonometry/

- `src/trigonometry/acos.ts` → Expected test: `tests/unit/trigonometry/acos.test.ts`
- `src/trigonometry/acosh.ts` → Expected test: `tests/unit/trigonometry/acosh.test.ts`
- `src/trigonometry/acot.ts` → Expected test: `tests/unit/trigonometry/acot.test.ts`
- `src/trigonometry/acoth.ts` → Expected test: `tests/unit/trigonometry/acoth.test.ts`
- `src/trigonometry/acsc.ts` → Expected test: `tests/unit/trigonometry/acsc.test.ts`
- `src/trigonometry/acsch.ts` → Expected test: `tests/unit/trigonometry/acsch.test.ts`
- `src/trigonometry/asec.ts` → Expected test: `tests/unit/trigonometry/asec.test.ts`
- `src/trigonometry/asech.ts` → Expected test: `tests/unit/trigonometry/asech.test.ts`
- `src/trigonometry/asin.ts` → Expected test: `tests/unit/trigonometry/asin.test.ts`
- `src/trigonometry/asinh.ts` → Expected test: `tests/unit/trigonometry/asinh.test.ts`
- `src/trigonometry/atan.ts` → Expected test: `tests/unit/trigonometry/atan.test.ts`
- `src/trigonometry/atan2.ts` → Expected test: `tests/unit/trigonometry/atan2.test.ts`
- `src/trigonometry/atanh.ts` → Expected test: `tests/unit/trigonometry/atanh.test.ts`
- `src/trigonometry/cos.ts` → Expected test: `tests/unit/trigonometry/cos.test.ts`
- `src/trigonometry/cosh.ts` → Expected test: `tests/unit/trigonometry/cosh.test.ts`
- `src/trigonometry/cot.ts` → Expected test: `tests/unit/trigonometry/cot.test.ts`
- `src/trigonometry/coth.ts` → Expected test: `tests/unit/trigonometry/coth.test.ts`
- `src/trigonometry/csc.ts` → Expected test: `tests/unit/trigonometry/csc.test.ts`
- `src/trigonometry/csch.ts` → Expected test: `tests/unit/trigonometry/csch.test.ts`
- `src/trigonometry/sec.ts` → Expected test: `tests/unit/trigonometry/sec.test.ts`
- `src/trigonometry/sech.ts` → Expected test: `tests/unit/trigonometry/sech.test.ts`
- `src/trigonometry/sin.ts` → Expected test: `tests/unit/trigonometry/sin.test.ts`
- `src/trigonometry/sinh.ts` → Expected test: `tests/unit/trigonometry/sinh.test.ts`
- `src/trigonometry/tan.ts` → Expected test: `tests/unit/trigonometry/tan.test.ts`
- `src/trigonometry/tanh.ts` → Expected test: `tests/unit/trigonometry/tanh.test.ts`
- `src/trigonometry/trigUnit.ts` → Expected test: `tests/unit/trigonometry/trigUnit.test.ts`

### type/

- `src/type/bigint.ts` → Expected test: `tests/unit/type/bigint.test.ts`
- `src/type/bignumber/BigNumber.ts` → Expected test: `tests/unit/type/BigNumber.test.ts`
- `src/type/bignumber/function/bignumber.ts` → Expected test: `tests/unit/type/bignumber.test.ts`
- `src/type/boolean.ts` → Expected test: `tests/unit/type/boolean.test.ts`
- `src/type/chain/Chain.ts` → Expected test: `tests/unit/type/Chain.test.ts`
- `src/type/chain/function/chain.ts` → Expected test: `tests/unit/type/chain.test.ts`
- `src/type/complex/Complex.ts` → Expected test: `tests/unit/type/Complex.test.ts`
- `src/type/complex/function/complex.ts` → Expected test: `tests/unit/type/complex.test.ts`
- `src/type/fraction/Fraction.ts` → Expected test: `tests/unit/type/Fraction.test.ts`
- `src/type/fraction/function/fraction.ts` → Expected test: `tests/unit/type/fraction.test.ts`
- `src/type/local/Complex.ts` → Expected test: `tests/unit/type/Complex.test.ts`
- `src/type/local/Decimal.ts` → Expected test: `tests/unit/type/Decimal.test.ts`
- `src/type/local/Fraction.ts` → Expected test: `tests/unit/type/Fraction.test.ts`
- `src/type/local/index.ts` → Expected test: `tests/unit/type/index.test.ts`
- `src/type/matrix/DenseMatrix.ts` → Expected test: `tests/unit/type/DenseMatrix.test.ts`
- `src/type/matrix/FibonacciHeap.ts` → Expected test: `tests/unit/type/FibonacciHeap.test.ts`
- `src/type/matrix/ImmutableDenseMatrix.ts` → Expected test: `tests/unit/type/ImmutableDenseMatrix.test.ts`
- `src/type/matrix/Matrix.ts` → Expected test: `tests/unit/type/Matrix.test.ts`
- `src/type/matrix/MatrixIndex.ts` → Expected test: `tests/unit/type/MatrixIndex.test.ts`
- `src/type/matrix/Range.ts` → Expected test: `tests/unit/type/Range.test.ts`
- `src/type/matrix/Spa.ts` → Expected test: `tests/unit/type/Spa.test.ts`
- `src/type/matrix/SparseMatrix.ts` → Expected test: `tests/unit/type/SparseMatrix.test.ts`
- `src/type/matrix/function/index.ts` → Expected test: `tests/unit/type/index.test.ts`
- `src/type/matrix/function/matrix.ts` → Expected test: `tests/unit/type/matrix.test.ts`
- `src/type/matrix/function/sparse.ts` → Expected test: `tests/unit/type/sparse.test.ts`
- `src/type/matrix/types.ts` → Expected test: `tests/unit/type/types.test.ts`
- `src/type/matrix/utils/broadcast.ts` → Expected test: `tests/unit/type/broadcast.test.ts`
- `src/type/matrix/utils/matAlgo01xDSid.ts` → Expected test: `tests/unit/type/matAlgo01xDSid.test.ts`
- `src/type/matrix/utils/matAlgo02xDS0.ts` → Expected test: `tests/unit/type/matAlgo02xDS0.test.ts`
- `src/type/matrix/utils/matAlgo03xDSf.ts` → Expected test: `tests/unit/type/matAlgo03xDSf.test.ts`
- `src/type/matrix/utils/matAlgo04xSidSid.ts` → Expected test: `tests/unit/type/matAlgo04xSidSid.test.ts`
- `src/type/matrix/utils/matAlgo05xSfSf.ts` → Expected test: `tests/unit/type/matAlgo05xSfSf.test.ts`
- `src/type/matrix/utils/matAlgo06xS0S0.ts` → Expected test: `tests/unit/type/matAlgo06xS0S0.test.ts`
- `src/type/matrix/utils/matAlgo07xSSf.ts` → Expected test: `tests/unit/type/matAlgo07xSSf.test.ts`
- `src/type/matrix/utils/matAlgo08xS0Sid.ts` → Expected test: `tests/unit/type/matAlgo08xS0Sid.test.ts`
- `src/type/matrix/utils/matAlgo09xS0Sf.ts` → Expected test: `tests/unit/type/matAlgo09xS0Sf.test.ts`
- `src/type/matrix/utils/matAlgo10xSids.ts` → Expected test: `tests/unit/type/matAlgo10xSids.test.ts`
- `src/type/matrix/utils/matAlgo11xS0s.ts` → Expected test: `tests/unit/type/matAlgo11xS0s.test.ts`
- `src/type/matrix/utils/matAlgo12xSfs.ts` → Expected test: `tests/unit/type/matAlgo12xSfs.test.ts`
- `src/type/matrix/utils/matAlgo13xDD.ts` → Expected test: `tests/unit/type/matAlgo13xDD.test.ts`
- `src/type/matrix/utils/matAlgo14xDs.ts` → Expected test: `tests/unit/type/matAlgo14xDs.test.ts`
- `src/type/matrix/utils/matrixAlgorithmSuite.ts` → Expected test: `tests/unit/type/matrixAlgorithmSuite.test.ts`
- `src/type/number.ts` → Expected test: `tests/unit/type/number.test.ts`
- `src/type/resultset/ResultSet.ts` → Expected test: `tests/unit/type/ResultSet.test.ts`
- `src/type/string.ts` → Expected test: `tests/unit/type/string.test.ts`
- `src/type/unit/Unit.ts` → Expected test: `tests/unit/type/Unit.test.ts`
- `src/type/unit/function/createUnit.ts` → Expected test: `tests/unit/type/createUnit.test.ts`
- `src/type/unit/function/splitUnit.ts` → Expected test: `tests/unit/type/splitUnit.test.ts`
- `src/type/unit/function/unit.ts` → Expected test: `tests/unit/type/unit.test.ts`
- `src/type/unit/physicalConstants.ts` → Expected test: `tests/unit/type/physicalConstants.test.ts`

### unit/

- `src/unit/to.ts` → Expected test: `tests/unit/unit/to.test.ts`
- `src/unit/toBest.ts` → Expected test: `tests/unit/unit/toBest.test.ts`

### utils/

- `src/utils/array.ts` → Expected test: `tests/unit/utils/array.test.ts`
- `src/utils/bigint.ts` → Expected test: `tests/unit/utils/bigint.test.ts`
- `src/utils/bignumber/bitwise.ts` → Expected test: `tests/unit/utils/bitwise.test.ts`
- `src/utils/bignumber/constants.ts` → Expected test: `tests/unit/utils/constants.test.ts`
- `src/utils/bignumber/formatter.ts` → Expected test: `tests/unit/utils/formatter.test.ts`
- `src/utils/bignumber/nearlyEqual.ts` → Expected test: `tests/unit/utils/nearlyEqual.test.ts`
- `src/utils/clone.ts` → Expected test: `tests/unit/utils/clone.test.ts`
- `src/utils/collection.ts` → Expected test: `tests/unit/utils/collection.test.ts`
- `src/utils/complex.ts` → Expected test: `tests/unit/utils/complex.test.ts`
- `src/utils/customs.ts` → Expected test: `tests/unit/utils/customs.test.ts`
- `src/utils/emitter.ts` → Expected test: `tests/unit/utils/emitter.test.ts`
- `src/utils/factory.ts` → Expected test: `tests/unit/utils/factory.test.ts`
- `src/utils/function.ts` → Expected test: `tests/unit/utils/function.test.ts`
- `src/utils/hasNumericValue.ts` → Expected test: `tests/unit/utils/hasNumericValue.test.ts`
- `src/utils/is.ts` → Expected test: `tests/unit/utils/is.test.ts`
- `src/utils/isBounded.ts` → Expected test: `tests/unit/utils/isBounded.test.ts`
- `src/utils/isFinite.ts` → Expected test: `tests/unit/utils/isFinite.test.ts`
- `src/utils/isInteger.ts` → Expected test: `tests/unit/utils/isInteger.test.ts`
- `src/utils/isNaN.ts` → Expected test: `tests/unit/utils/isNaN.test.ts`
- `src/utils/isNegative.ts` → Expected test: `tests/unit/utils/isNegative.test.ts`
- `src/utils/isNumeric.ts` → Expected test: `tests/unit/utils/isNumeric.test.ts`
- `src/utils/isPositive.ts` → Expected test: `tests/unit/utils/isPositive.test.ts`
- `src/utils/isPrime.ts` → Expected test: `tests/unit/utils/isPrime.test.ts`
- `src/utils/isZero.ts` → Expected test: `tests/unit/utils/isZero.test.ts`
- `src/utils/latex.ts` → Expected test: `tests/unit/utils/latex.test.ts`
- `src/utils/log.ts` → Expected test: `tests/unit/utils/log.test.ts`
- `src/utils/lruQueue.ts` → Expected test: `tests/unit/utils/lruQueue.test.ts`
- `src/utils/map.ts` → Expected test: `tests/unit/utils/map.test.ts`
- `src/utils/node.ts` → Expected test: `tests/unit/utils/node.test.ts`
- `src/utils/noop.ts` → Expected test: `tests/unit/utils/noop.test.ts`
- `src/utils/number.ts` → Expected test: `tests/unit/utils/number.test.ts`
- `src/utils/numeric.ts` → Expected test: `tests/unit/utils/numeric.test.ts`
- `src/utils/object.ts` → Expected test: `tests/unit/utils/object.test.ts`
- `src/utils/optimizeCallback.ts` → Expected test: `tests/unit/utils/optimizeCallback.test.ts`
- `src/utils/parseNumber.ts` → Expected test: `tests/unit/utils/parseNumber.test.ts`
- `src/utils/print.ts` → Expected test: `tests/unit/utils/print.test.ts`
- `src/utils/product.ts` → Expected test: `tests/unit/utils/product.test.ts`
- `src/utils/scope.ts` → Expected test: `tests/unit/utils/scope.test.ts`
- `src/utils/snapshot.ts` → Expected test: `tests/unit/utils/snapshot.test.ts`
- `src/utils/string.ts` → Expected test: `tests/unit/utils/string.test.ts`
- `src/utils/switch.ts` → Expected test: `tests/unit/utils/switch.test.ts`
- `src/utils/typeOf.ts` → Expected test: `tests/unit/utils/typeOf.test.ts`

### wasm/

- `src/wasm/MatrixWasmBridge.ts` → Expected test: `tests/unit/wasm/MatrixWasmBridge.test.ts`
- `src/wasm/WasmLoader.ts` → Expected test: `tests/unit/wasm/WasmLoader.test.ts`
- `src/wasm/algebra/decomposition.ts` → Expected test: `tests/unit/wasm/decomposition.test.ts`
- `src/wasm/algebra/equations.ts` → Expected test: `tests/unit/wasm/equations.test.ts`
- `src/wasm/algebra/polynomial.ts` → Expected test: `tests/unit/wasm/polynomial.test.ts`
- `src/wasm/algebra/schur.ts` → Expected test: `tests/unit/wasm/schur.test.ts`
- `src/wasm/algebra/solver.ts` → Expected test: `tests/unit/wasm/solver.test.ts`
- `src/wasm/algebra/sparse/amd.ts` → Expected test: `tests/unit/wasm/amd.test.ts`
- `src/wasm/algebra/sparse/operations.ts` → Expected test: `tests/unit/wasm/operations.test.ts`
- `src/wasm/algebra/sparse/utilities.ts` → Expected test: `tests/unit/wasm/utilities.test.ts`
- `src/wasm/algebra/sparseChol.ts` → Expected test: `tests/unit/wasm/sparseChol.test.ts`
- `src/wasm/algebra/sparseLu.ts` → Expected test: `tests/unit/wasm/sparseLu.test.ts`
- `src/wasm/arithmetic/advanced.ts` → Expected test: `tests/unit/wasm/advanced.test.ts`
- `src/wasm/arithmetic/basic.ts` → Expected test: `tests/unit/wasm/basic.test.ts`
- `src/wasm/arithmetic/logarithmic.ts` → Expected test: `tests/unit/wasm/logarithmic.test.ts`
- `src/wasm/bitwise/operations.ts` → Expected test: `tests/unit/wasm/operations.test.ts`
- `src/wasm/combinatorics/basic.ts` → Expected test: `tests/unit/wasm/basic.test.ts`
- `src/wasm/complex/operations.ts` → Expected test: `tests/unit/wasm/operations.test.ts`
- `src/wasm/geometry/operations.ts` → Expected test: `tests/unit/wasm/operations.test.ts`
- `src/wasm/index.ts` → Expected test: `tests/unit/wasm/index.test.ts`
- `src/wasm/logical/operations.ts` → Expected test: `tests/unit/wasm/operations.test.ts`
- `src/wasm/matrix/algorithms.ts` → Expected test: `tests/unit/wasm/algorithms.test.ts`
- `src/wasm/matrix/basic.ts` → Expected test: `tests/unit/wasm/basic.test.ts`
- `src/wasm/matrix/broadcast.ts` → Expected test: `tests/unit/wasm/broadcast.test.ts`
- `src/wasm/matrix/complexEigs.ts` → Expected test: `tests/unit/wasm/complexEigs.test.ts`
- `src/wasm/matrix/eigs.ts` → Expected test: `tests/unit/wasm/eigs.test.ts`
- `src/wasm/matrix/expm.ts` → Expected test: `tests/unit/wasm/expm.test.ts`
- `src/wasm/matrix/functions.ts` → Expected test: `tests/unit/wasm/functions.test.ts`
- `src/wasm/matrix/linalg.ts` → Expected test: `tests/unit/wasm/linalg.test.ts`
- `src/wasm/matrix/multiply.ts` → Expected test: `tests/unit/wasm/multiply.test.ts`
- `src/wasm/matrix/rotation.ts` → Expected test: `tests/unit/wasm/rotation.test.ts`
- `src/wasm/matrix/sparse.ts` → Expected test: `tests/unit/wasm/sparse.test.ts`
- `src/wasm/matrix/sqrtm.ts` → Expected test: `tests/unit/wasm/sqrtm.test.ts`
- `src/wasm/numeric/calculus.ts` → Expected test: `tests/unit/wasm/calculus.test.ts`
- `src/wasm/numeric/interpolation.ts` → Expected test: `tests/unit/wasm/interpolation.test.ts`
- `src/wasm/numeric/ode.ts` → Expected test: `tests/unit/wasm/ode.test.ts`
- `src/wasm/numeric/rational.ts` → Expected test: `tests/unit/wasm/rational.test.ts`
- `src/wasm/numeric/rootfinding.ts` → Expected test: `tests/unit/wasm/rootfinding.test.ts`
- `src/wasm/plain/arithmetic.ts` → Expected test: `tests/unit/wasm/arithmetic.test.ts`
- `src/wasm/plain/bitwise.ts` → Expected test: `tests/unit/wasm/bitwise.test.ts`
- `src/wasm/plain/combinations.ts` → Expected test: `tests/unit/wasm/combinations.test.ts`
- `src/wasm/plain/constants.ts` → Expected test: `tests/unit/wasm/constants.test.ts`
- `src/wasm/plain/index.ts` → Expected test: `tests/unit/wasm/index.test.ts`
- `src/wasm/plain/logical.ts` → Expected test: `tests/unit/wasm/logical.test.ts`
- `src/wasm/plain/operations.ts` → Expected test: `tests/unit/wasm/operations.test.ts`
- `src/wasm/plain/probability.ts` → Expected test: `tests/unit/wasm/probability.test.ts`
- `src/wasm/plain/trigonometry.ts` → Expected test: `tests/unit/wasm/trigonometry.test.ts`
- `src/wasm/plain/utils.ts` → Expected test: `tests/unit/wasm/utils.test.ts`
- `src/wasm/probability/distributions.ts` → Expected test: `tests/unit/wasm/distributions.test.ts`
- `src/wasm/relational/operations.ts` → Expected test: `tests/unit/wasm/operations.test.ts`
- `src/wasm/set/operations.ts` → Expected test: `tests/unit/wasm/operations.test.ts`
- `src/wasm/signal/fft.ts` → Expected test: `tests/unit/wasm/fft.test.ts`
- `src/wasm/signal/processing.ts` → Expected test: `tests/unit/wasm/processing.test.ts`
- `src/wasm/simd/operations.ts` → Expected test: `tests/unit/wasm/operations.test.ts`
- `src/wasm/special/functions.ts` → Expected test: `tests/unit/wasm/functions.test.ts`
- `src/wasm/statistics/basic.ts` → Expected test: `tests/unit/wasm/basic.test.ts`
- `src/wasm/statistics/select.ts` → Expected test: `tests/unit/wasm/select.test.ts`
- `src/wasm/string/operations.ts` → Expected test: `tests/unit/wasm/operations.test.ts`
- `src/wasm/trigonometry/basic.ts` → Expected test: `tests/unit/wasm/basic.test.ts`
- `src/wasm/unit/conversion.ts` → Expected test: `tests/unit/wasm/conversion.test.ts`
- `src/wasm/utils/checks.ts` → Expected test: `tests/unit/wasm/checks.test.ts`
- `src/wasm/utils/workPtrValidation.ts` → Expected test: `tests/unit/wasm/workPtrValidation.test.ts`

---

## Source Files With Test Coverage

| Source File | Test Files |
|-------------|------------|
| `src/index.ts` | `parallel-arithmetic.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `signal/conv.ts` | `conv.test.ts` |
| `signal/fft.ts` | `fft.test.ts` |
| `typed/arithmetic.ts` | `arithmetic-extended.test.ts`, `parallel-arithmetic.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/index.ts` | `parallel-arithmetic.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/signal.ts` | `parallel-arithmetic.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/statistics.ts` | `parallel-arithmetic.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/trigonometry.ts` | `arithmetic-extended.test.ts`, `parallel-arithmetic.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |

---

## Test File Details

| Test File | Imports from Source |
|-----------|---------------------|
| `tests/arithmetic-extended.test.ts` | 2 files |
| `tests/parallel-arithmetic.test.ts` | 6 files |
| `tests/parallel-signal.test.ts` | 6 files |
| `signal/conv.test.ts` | 1 files |
| `signal/fft.test.ts` | 1 files |
| `tests/typed-arithmetic.test.ts` | 6 files |
