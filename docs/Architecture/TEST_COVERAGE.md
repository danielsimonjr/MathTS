# Test Coverage Analysis

**Generated**: 2026-05-23

## Summary

| Metric | Count |
|--------|-------|
| Total Source Files | 491 |
| Total Test Files | 164 |
| Source Files with Tests | 135 |
| Source Files without Tests | 356 |
| Coverage | 27.5% |

---

## Source Files Without Test Coverage

The following 356 source files are not directly imported by any test file:

### src/

- `assembly/src/algebra/decomposition.ts` → Expected test: `tests/unit/src/decomposition.test.ts`
- `assembly/src/index.ts` → Expected test: `tests/unit/src/index.test.ts`
- `assembly/src/ops/approx.ts` → Expected test: `tests/unit/src/approx.test.ts`
- `assembly/src/ops/array.ts` → Expected test: `tests/unit/src/array.test.ts`
- `assembly/src/ops/bitwise.ts` → Expected test: `tests/unit/src/bitwise.test.ts`
- `assembly/src/ops/complex-array.ts` → Expected test: `tests/unit/src/complex-array.test.ts`
- `assembly/src/ops/complex-ops.ts` → Expected test: `tests/unit/src/complex-ops.test.ts`
- `assembly/src/ops/curvefit.ts` → Expected test: `tests/unit/src/curvefit.test.ts`
- `assembly/src/ops/linalg.ts` → Expected test: `tests/unit/src/linalg.test.ts`
- `assembly/src/ops/matrix.ts` → Expected test: `tests/unit/src/matrix.test.ts`
- `assembly/src/ops/number-theory.ts` → Expected test: `tests/unit/src/number-theory.test.ts`
- `assembly/src/ops/optimization.ts` → Expected test: `tests/unit/src/optimization.test.ts`
- `assembly/src/ops/polynomial.ts` → Expected test: `tests/unit/src/polynomial.test.ts`
- `assembly/src/ops/scalar.ts` → Expected test: `tests/unit/src/scalar.test.ts`
- `assembly/src/ops/signal.ts` → Expected test: `tests/unit/src/signal.test.ts`
- `assembly/src/ops/special.ts` → Expected test: `tests/unit/src/special.test.ts`
- `assembly/src/ops/svd.ts` → Expected test: `tests/unit/src/svd.test.ts`
- `assembly/src/ops/tensor.ts` → Expected test: `tests/unit/src/tensor.test.ts`
- `assembly/src/types/complex.ts` → Expected test: `tests/unit/src/complex.test.ts`
- `core/src/types/interfaces.ts` → Expected test: `tests/unit/src/interfaces.test.ts`
- `expression/src/compiler/index.ts` → Expected test: `tests/unit/src/index.test.ts`
- `expression/src/evaluator/index.ts` → Expected test: `tests/unit/src/index.test.ts`
- `expression/src/index.ts` → Expected test: `tests/unit/src/index.test.ts`
- `expression/src/parse.ts` → Expected test: `tests/unit/src/parse.test.ts`
- `expression/src/types.ts` → Expected test: `tests/unit/src/types.test.ts`
- `functions/src/algebra/decomposition/lup.ts` → Expected test: `tests/unit/src/lup.test.ts`
- `functions/src/algebra/decomposition/qr.ts` → Expected test: `tests/unit/src/qr.test.ts`
- `functions/src/algebra/decomposition/schur.ts` → Expected test: `tests/unit/src/schur.test.ts`
- `functions/src/algebra/decomposition/slu.ts` → Expected test: `tests/unit/src/slu.test.ts`
- `functions/src/algebra/derivative.ts` → Expected test: `tests/unit/src/derivative.test.ts`
- `functions/src/algebra/leafCount.ts` → Expected test: `tests/unit/src/leafCount.test.ts`
- `functions/src/algebra/lyap.ts` → Expected test: `tests/unit/src/lyap.test.ts`
- `functions/src/algebra/polynomialRoot.ts` → Expected test: `tests/unit/src/polynomialRoot.test.ts`
- `functions/src/algebra/rationalize.ts` → Expected test: `tests/unit/src/rationalize.test.ts`
- `functions/src/algebra/resolve.ts` → Expected test: `tests/unit/src/resolve.test.ts`
- `functions/src/algebra/simplify.ts` → Expected test: `tests/unit/src/simplify.test.ts`
- `functions/src/algebra/simplify/util.ts` → Expected test: `tests/unit/src/util.test.ts`
- `functions/src/algebra/simplify/wildcards.ts` → Expected test: `tests/unit/src/wildcards.test.ts`
- `functions/src/algebra/simplifyConstant.ts` → Expected test: `tests/unit/src/simplifyConstant.test.ts`
- `functions/src/algebra/simplifyCore.ts` → Expected test: `tests/unit/src/simplifyCore.test.ts`
- `functions/src/algebra/solver/lsolve.ts` → Expected test: `tests/unit/src/lsolve.test.ts`
- `functions/src/algebra/solver/lsolveAll.ts` → Expected test: `tests/unit/src/lsolveAll.test.ts`
- `functions/src/algebra/solver/lusolve.ts` → Expected test: `tests/unit/src/lusolve.test.ts`
- `functions/src/algebra/solver/usolve.ts` → Expected test: `tests/unit/src/usolve.test.ts`
- `functions/src/algebra/solver/usolveAll.ts` → Expected test: `tests/unit/src/usolveAll.test.ts`
- `functions/src/algebra/solver/utils/solveValidation.ts` → Expected test: `tests/unit/src/solveValidation.test.ts`
- `functions/src/algebra/sparse/csAmd.ts` → Expected test: `tests/unit/src/csAmd.test.ts`
- `functions/src/algebra/sparse/csChol.ts` → Expected test: `tests/unit/src/csChol.test.ts`
- `functions/src/algebra/sparse/csCounts.ts` → Expected test: `tests/unit/src/csCounts.test.ts`
- `functions/src/algebra/sparse/csCumsum.ts` → Expected test: `tests/unit/src/csCumsum.test.ts`
- `functions/src/algebra/sparse/csDfs.ts` → Expected test: `tests/unit/src/csDfs.test.ts`
- `functions/src/algebra/sparse/csEreach.ts` → Expected test: `tests/unit/src/csEreach.test.ts`
- `functions/src/algebra/sparse/csEtree.ts` → Expected test: `tests/unit/src/csEtree.test.ts`
- `functions/src/algebra/sparse/csFkeep.ts` → Expected test: `tests/unit/src/csFkeep.test.ts`
- `functions/src/algebra/sparse/csFlip.ts` → Expected test: `tests/unit/src/csFlip.test.ts`
- `functions/src/algebra/sparse/csIpvec.ts` → Expected test: `tests/unit/src/csIpvec.test.ts`
- `functions/src/algebra/sparse/csLeaf.ts` → Expected test: `tests/unit/src/csLeaf.test.ts`
- `functions/src/algebra/sparse/csLu.ts` → Expected test: `tests/unit/src/csLu.test.ts`
- `functions/src/algebra/sparse/csMark.ts` → Expected test: `tests/unit/src/csMark.test.ts`
- `functions/src/algebra/sparse/csMarked.ts` → Expected test: `tests/unit/src/csMarked.test.ts`
- `functions/src/algebra/sparse/csPermute.ts` → Expected test: `tests/unit/src/csPermute.test.ts`
- `functions/src/algebra/sparse/csPost.ts` → Expected test: `tests/unit/src/csPost.test.ts`
- `functions/src/algebra/sparse/csReach.ts` → Expected test: `tests/unit/src/csReach.test.ts`
- `functions/src/algebra/sparse/csSpsolve.ts` → Expected test: `tests/unit/src/csSpsolve.test.ts`
- `functions/src/algebra/sparse/csSqr.ts` → Expected test: `tests/unit/src/csSqr.test.ts`
- `functions/src/algebra/sparse/csSymperm.ts` → Expected test: `tests/unit/src/csSymperm.test.ts`
- `functions/src/algebra/sparse/csTdfs.ts` → Expected test: `tests/unit/src/csTdfs.test.ts`
- `functions/src/algebra/sparse/csUnflip.ts` → Expected test: `tests/unit/src/csUnflip.test.ts`
- `functions/src/algebra/sylvester.ts` → Expected test: `tests/unit/src/sylvester.test.ts`
- `functions/src/algebra/symbolicEqual.ts` → Expected test: `tests/unit/src/symbolicEqual.test.ts`
- `functions/src/arithmetic/abs.ts` → Expected test: `tests/unit/src/abs.test.ts`
- `functions/src/arithmetic/addScalar.ts` → Expected test: `tests/unit/src/addScalar.test.ts`
- `functions/src/arithmetic/cbrt.ts` → Expected test: `tests/unit/src/cbrt.test.ts`
- `functions/src/arithmetic/ceil.ts` → Expected test: `tests/unit/src/ceil.test.ts`
- `functions/src/arithmetic/cube.ts` → Expected test: `tests/unit/src/cube.test.ts`
- `functions/src/arithmetic/divide.ts` → Expected test: `tests/unit/src/divide.test.ts`
- `functions/src/arithmetic/divideScalar.ts` → Expected test: `tests/unit/src/divideScalar.test.ts`
- `functions/src/arithmetic/dotDivide.ts` → Expected test: `tests/unit/src/dotDivide.test.ts`
- `functions/src/arithmetic/dotMultiply.ts` → Expected test: `tests/unit/src/dotMultiply.test.ts`
- `functions/src/arithmetic/dotPow.ts` → Expected test: `tests/unit/src/dotPow.test.ts`
- `functions/src/arithmetic/exp.ts` → Expected test: `tests/unit/src/exp.test.ts`
- `functions/src/arithmetic/expm1.ts` → Expected test: `tests/unit/src/expm1.test.ts`
- `functions/src/arithmetic/fix.ts` → Expected test: `tests/unit/src/fix.test.ts`
- `functions/src/arithmetic/floor.ts` → Expected test: `tests/unit/src/floor.test.ts`
- `functions/src/arithmetic/gcd.ts` → Expected test: `tests/unit/src/gcd.test.ts`
- `functions/src/arithmetic/hypot.ts` → Expected test: `tests/unit/src/hypot.test.ts`
- `functions/src/arithmetic/invmod.ts` → Expected test: `tests/unit/src/invmod.test.ts`
- `functions/src/arithmetic/lcm.ts` → Expected test: `tests/unit/src/lcm.test.ts`
- `functions/src/arithmetic/log.ts` → Expected test: `tests/unit/src/log.test.ts`
- `functions/src/arithmetic/log10.ts` → Expected test: `tests/unit/src/log10.test.ts`
- `functions/src/arithmetic/log1p.ts` → Expected test: `tests/unit/src/log1p.test.ts`
- `functions/src/arithmetic/log2.ts` → Expected test: `tests/unit/src/log2.test.ts`
- `functions/src/arithmetic/mod.ts` → Expected test: `tests/unit/src/mod.test.ts`
- `functions/src/arithmetic/multiplyScalar.ts` → Expected test: `tests/unit/src/multiplyScalar.test.ts`
- `functions/src/arithmetic/norm.ts` → Expected test: `tests/unit/src/norm.test.ts`
- `functions/src/arithmetic/nthRoot.ts` → Expected test: `tests/unit/src/nthRoot.test.ts`
- `functions/src/arithmetic/nthRoots.ts` → Expected test: `tests/unit/src/nthRoots.test.ts`
- `functions/src/arithmetic/pow.ts` → Expected test: `tests/unit/src/pow.test.ts`
- `functions/src/arithmetic/round.ts` → Expected test: `tests/unit/src/round.test.ts`
- `functions/src/arithmetic/sign.ts` → Expected test: `tests/unit/src/sign.test.ts`
- `functions/src/arithmetic/sqrt.ts` → Expected test: `tests/unit/src/sqrt.test.ts`
- `functions/src/arithmetic/square.ts` → Expected test: `tests/unit/src/square.test.ts`
- `functions/src/arithmetic/subtract.ts` → Expected test: `tests/unit/src/subtract.test.ts`
- `functions/src/arithmetic/subtractScalar.ts` → Expected test: `tests/unit/src/subtractScalar.test.ts`
- `functions/src/arithmetic/unaryMinus.ts` → Expected test: `tests/unit/src/unaryMinus.test.ts`
- `functions/src/arithmetic/unaryPlus.ts` → Expected test: `tests/unit/src/unaryPlus.test.ts`
- `functions/src/arithmetic/utils/nodeOperations.ts` → Expected test: `tests/unit/src/nodeOperations.test.ts`
- `functions/src/arithmetic/xgcd.ts` → Expected test: `tests/unit/src/xgcd.test.ts`
- `functions/src/bitwise/bitAnd.ts` → Expected test: `tests/unit/src/bitAnd.test.ts`
- `functions/src/bitwise/bitNot.ts` → Expected test: `tests/unit/src/bitNot.test.ts`
- `functions/src/bitwise/bitOr.ts` → Expected test: `tests/unit/src/bitOr.test.ts`
- `functions/src/bitwise/bitXor.ts` → Expected test: `tests/unit/src/bitXor.test.ts`
- `functions/src/bitwise/leftShift.ts` → Expected test: `tests/unit/src/leftShift.test.ts`
- `functions/src/bitwise/rightArithShift.ts` → Expected test: `tests/unit/src/rightArithShift.test.ts`
- `functions/src/bitwise/rightLogShift.ts` → Expected test: `tests/unit/src/rightLogShift.test.ts`
- `functions/src/bitwise/useMatrixForArrayScalar.ts` → Expected test: `tests/unit/src/useMatrixForArrayScalar.test.ts`
- `functions/src/combinatorics/bellNumbers.ts` → Expected test: `tests/unit/src/bellNumbers.test.ts`
- `functions/src/combinatorics/catalan.ts` → Expected test: `tests/unit/src/catalan.test.ts`
- `functions/src/combinatorics/composition.ts` → Expected test: `tests/unit/src/composition.test.ts`
- `functions/src/combinatorics/stirlingS2.ts` → Expected test: `tests/unit/src/stirlingS2.test.ts`
- `functions/src/complex/arg.ts` → Expected test: `tests/unit/src/arg.test.ts`
- `functions/src/complex/conj.ts` → Expected test: `tests/unit/src/conj.test.ts`
- `functions/src/complex/im.ts` → Expected test: `tests/unit/src/im.test.ts`
- `functions/src/complex/re.ts` → Expected test: `tests/unit/src/re.test.ts`
- `functions/src/core/config.ts` → Expected test: `tests/unit/src/config.test.ts`
- `functions/src/core/function/typed.ts` → Expected test: `tests/unit/src/typed.test.ts`
- `functions/src/error/ArgumentsError.ts` → Expected test: `tests/unit/src/ArgumentsError.test.ts`
- `functions/src/error/DimensionError.ts` → Expected test: `tests/unit/src/DimensionError.test.ts`
- `functions/src/error/IndexError.ts` → Expected test: `tests/unit/src/IndexError.test.ts`
- `functions/src/expression/operators.ts` → Expected test: `tests/unit/src/operators.test.ts`
- `functions/src/geometry/distance.ts` → Expected test: `tests/unit/src/distance.test.ts`
- `functions/src/geometry/intersect.ts` → Expected test: `tests/unit/src/intersect.test.ts`
- `functions/src/logical/and.ts` → Expected test: `tests/unit/src/and.test.ts`
- `functions/src/logical/not.ts` → Expected test: `tests/unit/src/not.test.ts`
- `functions/src/logical/nullish.ts` → Expected test: `tests/unit/src/nullish.test.ts`
- `functions/src/logical/or.ts` → Expected test: `tests/unit/src/or.test.ts`
- `functions/src/logical/xor.ts` → Expected test: `tests/unit/src/xor.test.ts`
- `functions/src/matrix/column.ts` → Expected test: `tests/unit/src/column.test.ts`
- `functions/src/matrix/concat.ts` → Expected test: `tests/unit/src/concat.test.ts`
- `functions/src/matrix/count.ts` → Expected test: `tests/unit/src/count.test.ts`
- `functions/src/matrix/cross.ts` → Expected test: `tests/unit/src/cross.test.ts`
- `functions/src/matrix/ctranspose.ts` → Expected test: `tests/unit/src/ctranspose.test.ts`
- `functions/src/matrix/det.ts` → Expected test: `tests/unit/src/det.test.ts`
- `functions/src/matrix/diag.ts` → Expected test: `tests/unit/src/diag.test.ts`
- `functions/src/matrix/diff.ts` → Expected test: `tests/unit/src/diff.test.ts`
- `functions/src/matrix/dot.ts` → Expected test: `tests/unit/src/dot.test.ts`
- `functions/src/matrix/eigs.ts` → Expected test: `tests/unit/src/eigs.test.ts`
- `functions/src/matrix/eigs/complexEigs.ts` → Expected test: `tests/unit/src/complexEigs.test.ts`
- `functions/src/matrix/eigs/realSymmetric.ts` → Expected test: `tests/unit/src/realSymmetric.test.ts`
- `functions/src/matrix/expm.ts` → Expected test: `tests/unit/src/expm.test.ts`
- `functions/src/matrix/fft.ts` → Expected test: `tests/unit/src/fft.test.ts`
- `functions/src/matrix/filter.ts` → Expected test: `tests/unit/src/filter.test.ts`
- `functions/src/matrix/flatten.ts` → Expected test: `tests/unit/src/flatten.test.ts`
- `functions/src/matrix/forEach.ts` → Expected test: `tests/unit/src/forEach.test.ts`
- `functions/src/matrix/getMatrixDataType.ts` → Expected test: `tests/unit/src/getMatrixDataType.test.ts`
- `functions/src/matrix/identity.ts` → Expected test: `tests/unit/src/identity.test.ts`
- `functions/src/matrix/ifft.ts` → Expected test: `tests/unit/src/ifft.test.ts`
- `functions/src/matrix/inv.ts` → Expected test: `tests/unit/src/inv.test.ts`
- `functions/src/matrix/kron.ts` → Expected test: `tests/unit/src/kron.test.ts`
- `functions/src/matrix/map.ts` → Expected test: `tests/unit/src/map.test.ts`
- `functions/src/matrix/mapSlices.ts` → Expected test: `tests/unit/src/mapSlices.test.ts`
- `functions/src/matrix/matrixFromColumns.ts` → Expected test: `tests/unit/src/matrixFromColumns.test.ts`
- `functions/src/matrix/matrixFromFunction.ts` → Expected test: `tests/unit/src/matrixFromFunction.test.ts`
- `functions/src/matrix/matrixFromRows.ts` → Expected test: `tests/unit/src/matrixFromRows.test.ts`
- `functions/src/matrix/ones.ts` → Expected test: `tests/unit/src/ones.test.ts`
- `functions/src/matrix/partitionSelect.ts` → Expected test: `tests/unit/src/partitionSelect.test.ts`
- `functions/src/matrix/pinv.ts` → Expected test: `tests/unit/src/pinv.test.ts`
- `functions/src/matrix/range.ts` → Expected test: `tests/unit/src/range.test.ts`
- `functions/src/matrix/reshape.ts` → Expected test: `tests/unit/src/reshape.test.ts`
- `functions/src/matrix/resize.ts` → Expected test: `tests/unit/src/resize.test.ts`
- `functions/src/matrix/rotate.ts` → Expected test: `tests/unit/src/rotate.test.ts`
- `functions/src/matrix/rotationMatrix.ts` → Expected test: `tests/unit/src/rotationMatrix.test.ts`
- `functions/src/matrix/row.ts` → Expected test: `tests/unit/src/row.test.ts`
- `functions/src/matrix/size.ts` → Expected test: `tests/unit/src/size.test.ts`
- `functions/src/matrix/sort.ts` → Expected test: `tests/unit/src/sort.test.ts`
- `functions/src/matrix/sqrtm.ts` → Expected test: `tests/unit/src/sqrtm.test.ts`
- `functions/src/matrix/squeeze.ts` → Expected test: `tests/unit/src/squeeze.test.ts`
- `functions/src/matrix/subset.ts` → Expected test: `tests/unit/src/subset.test.ts`
- `functions/src/matrix/trace.ts` → Expected test: `tests/unit/src/trace.test.ts`
- `functions/src/matrix/transpose.ts` → Expected test: `tests/unit/src/transpose.test.ts`
- `functions/src/matrix/zeros.ts` → Expected test: `tests/unit/src/zeros.test.ts`
- `functions/src/numeric/solveODE.ts` → Expected test: `tests/unit/src/solveODE.test.ts`
- `functions/src/plain/number/arithmetic.ts` → Expected test: `tests/unit/src/arithmetic.test.ts`
- `functions/src/plain/number/bitwise.ts` → Expected test: `tests/unit/src/bitwise.test.ts`
- `functions/src/plain/number/combinations.ts` → Expected test: `tests/unit/src/combinations.test.ts`
- `functions/src/plain/number/constants.ts` → Expected test: `tests/unit/src/constants.test.ts`
- `functions/src/plain/number/index.ts` → Expected test: `tests/unit/src/index.test.ts`
- `functions/src/plain/number/logical.ts` → Expected test: `tests/unit/src/logical.test.ts`
- `functions/src/plain/number/probability.ts` → Expected test: `tests/unit/src/probability.test.ts`
- `functions/src/plain/number/relational.ts` → Expected test: `tests/unit/src/relational.test.ts`
- `functions/src/plain/number/trigonometry.ts` → Expected test: `tests/unit/src/trigonometry.test.ts`
- `functions/src/plain/number/utils.ts` → Expected test: `tests/unit/src/utils.test.ts`
- `functions/src/probability/bernoulli.ts` → Expected test: `tests/unit/src/bernoulli.test.ts`
- `functions/src/probability/combinations.ts` → Expected test: `tests/unit/src/combinations.test.ts`
- `functions/src/probability/combinationsWithRep.ts` → Expected test: `tests/unit/src/combinationsWithRep.test.ts`
- `functions/src/probability/factorial.ts` → Expected test: `tests/unit/src/factorial.test.ts`
- `functions/src/probability/gamma.ts` → Expected test: `tests/unit/src/gamma.test.ts`
- `functions/src/probability/kldivergence.ts` → Expected test: `tests/unit/src/kldivergence.test.ts`
- `functions/src/probability/lgamma.ts` → Expected test: `tests/unit/src/lgamma.test.ts`
- `functions/src/probability/multinomial.ts` → Expected test: `tests/unit/src/multinomial.test.ts`
- `functions/src/probability/permutations.ts` → Expected test: `tests/unit/src/permutations.test.ts`
- `functions/src/probability/pickRandom.ts` → Expected test: `tests/unit/src/pickRandom.test.ts`
- `functions/src/probability/random.ts` → Expected test: `tests/unit/src/random.test.ts`
- `functions/src/probability/randomInt.ts` → Expected test: `tests/unit/src/randomInt.test.ts`
- `functions/src/probability/util/randomMatrix.ts` → Expected test: `tests/unit/src/randomMatrix.test.ts`
- `functions/src/probability/util/seededRNG.ts` → Expected test: `tests/unit/src/seededRNG.test.ts`
- `functions/src/relational/compare.ts` → Expected test: `tests/unit/src/compare.test.ts`
- `functions/src/relational/compareNatural.ts` → Expected test: `tests/unit/src/compareNatural.test.ts`
- `functions/src/relational/compareText.ts` → Expected test: `tests/unit/src/compareText.test.ts`
- `functions/src/relational/compareUnits.ts` → Expected test: `tests/unit/src/compareUnits.test.ts`
- `functions/src/relational/deepEqual.ts` → Expected test: `tests/unit/src/deepEqual.test.ts`
- `functions/src/relational/equal.ts` → Expected test: `tests/unit/src/equal.test.ts`
- `functions/src/relational/equalScalar.ts` → Expected test: `tests/unit/src/equalScalar.test.ts`
- `functions/src/relational/equalText.ts` → Expected test: `tests/unit/src/equalText.test.ts`
- `functions/src/relational/larger.ts` → Expected test: `tests/unit/src/larger.test.ts`
- `functions/src/relational/largerEq.ts` → Expected test: `tests/unit/src/largerEq.test.ts`
- `functions/src/relational/smaller.ts` → Expected test: `tests/unit/src/smaller.test.ts`
- `functions/src/relational/smallerEq.ts` → Expected test: `tests/unit/src/smallerEq.test.ts`
- `functions/src/relational/unequal.ts` → Expected test: `tests/unit/src/unequal.test.ts`
- `functions/src/set/setCartesian.ts` → Expected test: `tests/unit/src/setCartesian.test.ts`
- `functions/src/set/setDifference.ts` → Expected test: `tests/unit/src/setDifference.test.ts`
- `functions/src/set/setDistinct.ts` → Expected test: `tests/unit/src/setDistinct.test.ts`
- `functions/src/set/setIntersect.ts` → Expected test: `tests/unit/src/setIntersect.test.ts`
- `functions/src/set/setIsSubset.ts` → Expected test: `tests/unit/src/setIsSubset.test.ts`
- `functions/src/set/setMultiplicity.ts` → Expected test: `tests/unit/src/setMultiplicity.test.ts`
- `functions/src/set/setPowerset.ts` → Expected test: `tests/unit/src/setPowerset.test.ts`
- `functions/src/set/setSize.ts` → Expected test: `tests/unit/src/setSize.test.ts`
- `functions/src/set/setSymDifference.ts` → Expected test: `tests/unit/src/setSymDifference.test.ts`
- `functions/src/set/setUnion.ts` → Expected test: `tests/unit/src/setUnion.test.ts`
- `functions/src/signal/freqz.ts` → Expected test: `tests/unit/src/freqz.test.ts`
- `functions/src/signal/zpk2tf.ts` → Expected test: `tests/unit/src/zpk2tf.test.ts`
- `functions/src/special/erf.ts` → Expected test: `tests/unit/src/erf.test.ts`
- `functions/src/special/zeta.ts` → Expected test: `tests/unit/src/zeta.test.ts`
- `functions/src/statistics/corr.ts` → Expected test: `tests/unit/src/corr.test.ts`
- `functions/src/statistics/cumsum.ts` → Expected test: `tests/unit/src/cumsum.test.ts`
- `functions/src/statistics/mad.ts` → Expected test: `tests/unit/src/mad.test.ts`
- `functions/src/statistics/max.ts` → Expected test: `tests/unit/src/max.test.ts`
- `functions/src/statistics/mean.ts` → Expected test: `tests/unit/src/mean.test.ts`
- `functions/src/statistics/median.ts` → Expected test: `tests/unit/src/median.test.ts`
- `functions/src/statistics/min.ts` → Expected test: `tests/unit/src/min.test.ts`
- `functions/src/statistics/mode.ts` → Expected test: `tests/unit/src/mode.test.ts`
- `functions/src/statistics/prod.ts` → Expected test: `tests/unit/src/prod.test.ts`
- `functions/src/statistics/quantileSeq.ts` → Expected test: `tests/unit/src/quantileSeq.test.ts`
- `functions/src/statistics/std.ts` → Expected test: `tests/unit/src/std.test.ts`
- `functions/src/statistics/sum.ts` → Expected test: `tests/unit/src/sum.test.ts`
- `functions/src/statistics/utils/improveErrorMessage.ts` → Expected test: `tests/unit/src/improveErrorMessage.test.ts`
- `functions/src/statistics/variance.ts` → Expected test: `tests/unit/src/variance.test.ts`
- `functions/src/string/bin.ts` → Expected test: `tests/unit/src/bin.test.ts`
- `functions/src/string/format.ts` → Expected test: `tests/unit/src/format.test.ts`
- `functions/src/string/hex.ts` → Expected test: `tests/unit/src/hex.test.ts`
- `functions/src/string/oct.ts` → Expected test: `tests/unit/src/oct.test.ts`
- `functions/src/string/print.ts` → Expected test: `tests/unit/src/print.test.ts`
- `functions/src/trigonometry/acos.ts` → Expected test: `tests/unit/src/acos.test.ts`
- `functions/src/trigonometry/acosh.ts` → Expected test: `tests/unit/src/acosh.test.ts`
- `functions/src/trigonometry/acot.ts` → Expected test: `tests/unit/src/acot.test.ts`
- `functions/src/trigonometry/acoth.ts` → Expected test: `tests/unit/src/acoth.test.ts`
- `functions/src/trigonometry/acsc.ts` → Expected test: `tests/unit/src/acsc.test.ts`
- `functions/src/trigonometry/acsch.ts` → Expected test: `tests/unit/src/acsch.test.ts`
- `functions/src/trigonometry/asec.ts` → Expected test: `tests/unit/src/asec.test.ts`
- `functions/src/trigonometry/asech.ts` → Expected test: `tests/unit/src/asech.test.ts`
- `functions/src/trigonometry/asin.ts` → Expected test: `tests/unit/src/asin.test.ts`
- `functions/src/trigonometry/asinh.ts` → Expected test: `tests/unit/src/asinh.test.ts`
- `functions/src/trigonometry/atan.ts` → Expected test: `tests/unit/src/atan.test.ts`
- `functions/src/trigonometry/atan2.ts` → Expected test: `tests/unit/src/atan2.test.ts`
- `functions/src/trigonometry/atanh.ts` → Expected test: `tests/unit/src/atanh.test.ts`
- `functions/src/trigonometry/cos.ts` → Expected test: `tests/unit/src/cos.test.ts`
- `functions/src/trigonometry/cosh.ts` → Expected test: `tests/unit/src/cosh.test.ts`
- `functions/src/trigonometry/cot.ts` → Expected test: `tests/unit/src/cot.test.ts`
- `functions/src/trigonometry/coth.ts` → Expected test: `tests/unit/src/coth.test.ts`
- `functions/src/trigonometry/csc.ts` → Expected test: `tests/unit/src/csc.test.ts`
- `functions/src/trigonometry/csch.ts` → Expected test: `tests/unit/src/csch.test.ts`
- `functions/src/trigonometry/sec.ts` → Expected test: `tests/unit/src/sec.test.ts`
- `functions/src/trigonometry/sech.ts` → Expected test: `tests/unit/src/sech.test.ts`
- `functions/src/trigonometry/sin.ts` → Expected test: `tests/unit/src/sin.test.ts`
- `functions/src/trigonometry/sinh.ts` → Expected test: `tests/unit/src/sinh.test.ts`
- `functions/src/trigonometry/tan.ts` → Expected test: `tests/unit/src/tan.test.ts`
- `functions/src/trigonometry/tanh.ts` → Expected test: `tests/unit/src/tanh.test.ts`
- `functions/src/trigonometry/trigUnit.ts` → Expected test: `tests/unit/src/trigUnit.test.ts`
- `functions/src/type/bignumber/BigNumber.ts` → Expected test: `tests/unit/src/BigNumber.test.ts`
- `functions/src/type/chain/Chain.ts` → Expected test: `tests/unit/src/Chain.test.ts`
- `functions/src/type/chain/function/chain.ts` → Expected test: `tests/unit/src/chain.test.ts`
- `functions/src/type/complex/Complex.ts` → Expected test: `tests/unit/src/Complex.test.ts`
- `functions/src/type/matrix/FibonacciHeap.ts` → Expected test: `tests/unit/src/FibonacciHeap.test.ts`
- `functions/src/type/matrix/ImmutableDenseMatrix.ts` → Expected test: `tests/unit/src/ImmutableDenseMatrix.test.ts`
- `functions/src/type/matrix/MatrixIndex.ts` → Expected test: `tests/unit/src/MatrixIndex.test.ts`
- `functions/src/type/matrix/Spa.ts` → Expected test: `tests/unit/src/Spa.test.ts`
- `functions/src/type/matrix/function/index.ts` → Expected test: `tests/unit/src/index.test.ts`
- `functions/src/type/matrix/types.ts` → Expected test: `tests/unit/src/types.test.ts`
- `functions/src/type/matrix/utils/broadcast.ts` → Expected test: `tests/unit/src/broadcast.test.ts`
- `functions/src/type/matrix/utils/matAlgo01xDSid.ts` → Expected test: `tests/unit/src/matAlgo01xDSid.test.ts`
- `functions/src/type/matrix/utils/matAlgo02xDS0.ts` → Expected test: `tests/unit/src/matAlgo02xDS0.test.ts`
- `functions/src/type/matrix/utils/matAlgo03xDSf.ts` → Expected test: `tests/unit/src/matAlgo03xDSf.test.ts`
- `functions/src/type/matrix/utils/matAlgo04xSidSid.ts` → Expected test: `tests/unit/src/matAlgo04xSidSid.test.ts`
- `functions/src/type/matrix/utils/matAlgo05xSfSf.ts` → Expected test: `tests/unit/src/matAlgo05xSfSf.test.ts`
- `functions/src/type/matrix/utils/matAlgo06xS0S0.ts` → Expected test: `tests/unit/src/matAlgo06xS0S0.test.ts`
- `functions/src/type/matrix/utils/matAlgo07xSSf.ts` → Expected test: `tests/unit/src/matAlgo07xSSf.test.ts`
- `functions/src/type/matrix/utils/matAlgo08xS0Sid.ts` → Expected test: `tests/unit/src/matAlgo08xS0Sid.test.ts`
- `functions/src/type/matrix/utils/matAlgo09xS0Sf.ts` → Expected test: `tests/unit/src/matAlgo09xS0Sf.test.ts`
- `functions/src/type/matrix/utils/matAlgo10xSids.ts` → Expected test: `tests/unit/src/matAlgo10xSids.test.ts`
- `functions/src/type/matrix/utils/matAlgo11xS0s.ts` → Expected test: `tests/unit/src/matAlgo11xS0s.test.ts`
- `functions/src/type/matrix/utils/matAlgo12xSfs.ts` → Expected test: `tests/unit/src/matAlgo12xSfs.test.ts`
- `functions/src/type/matrix/utils/matAlgo13xDD.ts` → Expected test: `tests/unit/src/matAlgo13xDD.test.ts`
- `functions/src/type/matrix/utils/matAlgo14xDs.ts` → Expected test: `tests/unit/src/matAlgo14xDs.test.ts`
- `functions/src/type/matrix/utils/matrixAlgorithmSuite.ts` → Expected test: `tests/unit/src/matrixAlgorithmSuite.test.ts`
- `functions/src/type/resultset/ResultSet.ts` → Expected test: `tests/unit/src/ResultSet.test.ts`
- `functions/src/type/unit/Unit.ts` → Expected test: `tests/unit/src/Unit.test.ts`
- `functions/src/type/unit/function/createUnit.ts` → Expected test: `tests/unit/src/createUnit.test.ts`
- `functions/src/type/unit/function/splitUnit.ts` → Expected test: `tests/unit/src/splitUnit.test.ts`
- `functions/src/type/unit/function/unit.ts` → Expected test: `tests/unit/src/unit.test.ts`
- `functions/src/type/unit/physicalConstants.ts` → Expected test: `tests/unit/src/physicalConstants.test.ts`
- `functions/src/types.ts` → Expected test: `tests/unit/src/types.test.ts`
- `functions/src/unit/to.ts` → Expected test: `tests/unit/src/to.test.ts`
- `functions/src/unit/toBest.ts` → Expected test: `tests/unit/src/toBest.test.ts`
- `functions/src/utils/array.ts` → Expected test: `tests/unit/src/array.test.ts`
- `functions/src/utils/bigint.ts` → Expected test: `tests/unit/src/bigint.test.ts`
- `functions/src/utils/bignumber/bitwise.ts` → Expected test: `tests/unit/src/bitwise.test.ts`
- `functions/src/utils/bignumber/constants.ts` → Expected test: `tests/unit/src/constants.test.ts`
- `functions/src/utils/bignumber/formatter.ts` → Expected test: `tests/unit/src/formatter.test.ts`
- `functions/src/utils/bignumber/nearlyEqual.ts` → Expected test: `tests/unit/src/nearlyEqual.test.ts`
- `functions/src/utils/clone.ts` → Expected test: `tests/unit/src/clone.test.ts`
- `functions/src/utils/collection.ts` → Expected test: `tests/unit/src/collection.test.ts`
- `functions/src/utils/complex.ts` → Expected test: `tests/unit/src/complex.test.ts`
- `functions/src/utils/customs.ts` → Expected test: `tests/unit/src/customs.test.ts`
- `functions/src/utils/factory.ts` → Expected test: `tests/unit/src/factory.test.ts`
- `functions/src/utils/function.ts` → Expected test: `tests/unit/src/function.test.ts`
- `functions/src/utils/hasNumericValue.ts` → Expected test: `tests/unit/src/hasNumericValue.test.ts`
- `functions/src/utils/is.ts` → Expected test: `tests/unit/src/is.test.ts`
- `functions/src/utils/isBounded.ts` → Expected test: `tests/unit/src/isBounded.test.ts`
- `functions/src/utils/isFinite.ts` → Expected test: `tests/unit/src/isFinite.test.ts`
- `functions/src/utils/isInteger.ts` → Expected test: `tests/unit/src/isInteger.test.ts`
- `functions/src/utils/isNaN.ts` → Expected test: `tests/unit/src/isNaN.test.ts`
- `functions/src/utils/isNegative.ts` → Expected test: `tests/unit/src/isNegative.test.ts`
- `functions/src/utils/isNumeric.ts` → Expected test: `tests/unit/src/isNumeric.test.ts`
- `functions/src/utils/isPositive.ts` → Expected test: `tests/unit/src/isPositive.test.ts`
- `functions/src/utils/isPrime.ts` → Expected test: `tests/unit/src/isPrime.test.ts`
- `functions/src/utils/isZero.ts` → Expected test: `tests/unit/src/isZero.test.ts`
- `functions/src/utils/lruQueue.ts` → Expected test: `tests/unit/src/lruQueue.test.ts`
- `functions/src/utils/map.ts` → Expected test: `tests/unit/src/map.test.ts`
- `functions/src/utils/node.ts` → Expected test: `tests/unit/src/node.test.ts`
- `functions/src/utils/noop.ts` → Expected test: `tests/unit/src/noop.test.ts`
- `functions/src/utils/number.ts` → Expected test: `tests/unit/src/number.test.ts`
- `functions/src/utils/numeric.ts` → Expected test: `tests/unit/src/numeric.test.ts`
- `functions/src/utils/object.ts` → Expected test: `tests/unit/src/object.test.ts`
- `functions/src/utils/optimizeCallback.ts` → Expected test: `tests/unit/src/optimizeCallback.test.ts`
- `functions/src/utils/parseNumber.ts` → Expected test: `tests/unit/src/parseNumber.test.ts`
- `functions/src/utils/print.ts` → Expected test: `tests/unit/src/print.test.ts`
- `functions/src/utils/product.ts` → Expected test: `tests/unit/src/product.test.ts`
- `functions/src/utils/string.ts` → Expected test: `tests/unit/src/string.test.ts`
- `functions/src/utils/switch.ts` → Expected test: `tests/unit/src/switch.test.ts`
- `functions/src/utils/typeOf.ts` → Expected test: `tests/unit/src/typeOf.test.ts`
- `parallel/src/index.ts` → Expected test: `tests/unit/src/index.test.ts`
- `parallel/src/operations/index.ts` → Expected test: `tests/unit/src/index.test.ts`
- `parallel/src/ops/bitwise.ts` → Expected test: `tests/unit/src/bitwise.test.ts`
- `parallel/src/strategies/index.ts` → Expected test: `tests/unit/src/index.test.ts`
- `tensor/src/index.ts` → Expected test: `tests/unit/src/index.test.ts`
- `workbook/src/index.ts` → Expected test: `tests/unit/src/index.test.ts`

---

## Source Files With Test Coverage

| Source File | Test Files |
|-------------|------------|
| `src/dual-tensor.ts` | `scaffold.test.ts` |
| `src/forward-grad.ts` | `forward-grad.test.ts`, `scaffold.test.ts` |
| `src/index.ts` | `scaffold.test.ts` |
| `src/reverse-grad.ts` | `reverse-grad.test.ts`, `scaffold.test.ts` |
| `src/tape.ts` | `scaffold.test.ts` |
| `src/index.ts` | `compat.test.ts`, `create.test.ts` |
| `src/shims.ts` | `compat.test.ts`, `create.test.ts`, `shims.test.ts` |
| `factory/factory.ts` | `factory.test.ts`, `version.test.ts` |
| `factory/index.ts` | `factory.test.ts`, `version.test.ts` |
| `src/index.ts` | `version.test.ts` |
| `typed/index.ts` | `version.test.ts` |
| `typed/mathts-typed.ts` | `mathts-typed-extended.test.ts`, `mathts-typed.test.ts`, `version.test.ts` |
| `typed/type-bridge.ts` | `type-bridge.test.ts`, `version.test.ts` |
| `types/bignumber.ts` | `BigNumber-formatter-api.test.ts`, `mathts-typed-extended.test.ts`, `mathts-typed.test.ts`, `type-bridge.test.ts`, `bignumber-math.test.ts`, `bignumber.test.ts`, `version.test.ts` |
| `types/complex.ts` | `mathts-typed-extended.test.ts`, `mathts-typed.test.ts`, `type-bridge.test.ts`, `complex.test.ts`, `version.test.ts` |
| `types/fraction.ts` | `mathts-typed-extended.test.ts`, `mathts-typed.test.ts`, `type-bridge.test.ts`, `fraction.test.ts`, `version.test.ts` |
| `src/Help.ts` | `Help.test.ts` |
| `src/Parser.ts` | `Parser.test.ts` |
| `compiler/compile.ts` | `compile.test.ts`, `sandbox.test.ts` |
| `error/DimensionError.ts` | `DimensionError.test.ts` |
| `error/IndexError.ts` | `IndexError.test.ts`, `errorTransform.test.ts` |
| `evaluator/evaluate.ts` | `evaluate.test.ts`, `sandbox.test.ts` |
| `src/keywords.ts` | `keywords.test.ts` |
| `node/AccessorNode.ts` | `AccessorNode.test.ts` |
| `node/ArrayNode.ts` | `ArrayNode.test.ts` |
| `node/AssignmentNode.ts` | `AssignmentNode.test.ts` |
| `node/BlockNode.ts` | `BlockNode.test.ts` |
| `node/ConditionalNode.ts` | `ConditionalNode.test.ts` |
| `node/ConstantNode.ts` | `AccessorNode.test.ts`, `ArrayNode.test.ts`, `AssignmentNode.test.ts`, `BlockNode.test.ts`, `ConditionalNode.test.ts`, `ConstantNode.test.ts`, `FunctionAssignmentNode.test.ts`, `FunctionNode.test.ts`, `IndexNode.test.ts`, `Node.test.ts`, `ObjectNode.test.ts`, `OperatorNode.test.ts`, `ParenthesisNode.test.ts`, `RangeNode.test.ts`, `RelationalNode.test.ts`, `SymbolNode.test.ts` |
| `node/FunctionAssignmentNode.ts` | `FunctionAssignmentNode.test.ts` |
| `node/FunctionNode.ts` | `FunctionNode.test.ts` |
| `node/IndexNode.ts` | `AccessorNode.test.ts`, `AssignmentNode.test.ts`, `IndexNode.test.ts` |
| `node/Node.ts` | `AccessorNode.test.ts`, `ArrayNode.test.ts`, `AssignmentNode.test.ts`, `BlockNode.test.ts`, `ConditionalNode.test.ts`, `ConstantNode.test.ts`, `FunctionAssignmentNode.test.ts`, `FunctionNode.test.ts`, `IndexNode.test.ts`, `Node.test.ts`, `ObjectNode.test.ts`, `OperatorNode.test.ts`, `ParenthesisNode.test.ts`, `RangeNode.test.ts`, `RelationalNode.test.ts`, `SymbolNode.test.ts` |
| `node/ObjectNode.ts` | `ObjectNode.test.ts` |
| `node/OperatorNode.ts` | `Node.test.ts`, `OperatorNode.test.ts`, `ParenthesisNode.test.ts` |
| `node/ParenthesisNode.ts` | `Node.test.ts`, `OperatorNode.test.ts`, `ParenthesisNode.test.ts` |
| `node/RangeNode.ts` | `RangeNode.test.ts` |
| `node/RelationalNode.ts` | `RelationalNode.test.ts` |
| `node/SymbolNode.ts` | `AccessorNode.test.ts`, `AssignmentNode.test.ts`, `FunctionAssignmentNode.test.ts`, `FunctionNode.test.ts`, `IndexNode.test.ts`, `Node.test.ts`, `ObjectNode.test.ts`, `OperatorNode.test.ts`, `RangeNode.test.ts`, `SymbolNode.test.ts` |
| `utils/access.ts` | `access.test.ts` |
| `utils/assign.ts` | `assign.test.ts` |
| `src/operators.ts` | `operators.test.ts` |
| `utils/errorTransform.ts` | `errorTransform.test.ts` |
| `utils/array.ts` | `utils-array.test.ts` |
| `bignumber/formatter.ts` | `utils-bignumber-formatter.test.ts` |
| `utils/collection.ts` | `utils-collection.test.ts` |
| `utils/customs.ts` | `utils-customs.test.ts` |
| `utils/factory.ts` | `utils-factory.test.ts` |
| `utils/is.ts` | `utils-is.test.ts` |
| `utils/latex.ts` | `utils-latex.test.ts` |
| `utils/map.ts` | `utils-map.test.ts`, `utils-scope.test.ts` |
| `utils/number.ts` | `utils-number.test.ts` |
| `utils/object.ts` | `utils-object.test.ts` |
| `utils/scope.ts` | `utils-scope.test.ts` |
| `utils/string.ts` | `utils-string.test.ts` |
| `utils/switch.ts` | `utils-switch.test.ts` |
| `factories/evaluate.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `evaluate.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts`, `Parser.test.ts`, `parse.test.ts` |
| `factories/index.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `factories-final.test.ts`, `factories-leaf.test.ts`, `factories-matrix.test.ts`, `factories-tier2.test.ts`, `factories-tier4.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `physical-constants.test.ts`, `typed-arithmetic.test.ts` |
| `factories/matrix-bridge.ts` | `factories-matrix.test.ts`, `matrix-bridge-accel.test.ts`, `sparse-bridge.test.ts` |
| `factories/scope.ts` | `factory-scope.test.ts` |
| `src/index.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/algebra.ts` | `algebra.test.ts`, `conversions-parser.test.ts`, `docs-sync.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/arithmetic.ts` | `arithmetic-extended.test.ts`, `conversions-parser.test.ts`, `docs-sync.test.ts`, `parallel-arithmetic-unary.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts`, `typed-variadic.test.ts` |
| `typed/bitwise.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `factories-leaf.test.ts`, `factories-tier4.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts`, `typed-bitwise-wasm.test.ts`, `typed-bitwise.test.ts` |
| `typed/cas.ts` | `cas.test.ts`, `conversions-parser.test.ts`, `docs-sync.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/combinatorics.ts` | `combinatorics-extended.test.ts`, `combinatorics.test.ts`, `conversions-parser.test.ts`, `docs-sync.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/dist-objects.ts` | `conversions-parser.test.ts`, `dist-objects.test.ts`, `docs-sync.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/distributions.ts` | `conversions-parser.test.ts`, `distributions.test.ts`, `docs-sync.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/geometry.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `geometry-extended.test.ts`, `geometry.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/gpu.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `gpu.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/graph.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `graph.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/hypothesis.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `hypothesis.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/index.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/integration.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `integration.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/interpolation.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `interpolation.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/logical.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `factories-leaf.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts`, `typed-logical.test.ts` |
| `typed/matrix-ops.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `matrix-ops.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/numeric.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `numeric.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `typed-arithmetic.test.ts` |
| `typed/signal.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `signal-extended.test.ts`, `signal-extended2.test.ts`, `typed-arithmetic.test.ts` |
| `typed/special.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `special-extended.test.ts`, `special.test.ts`, `typed-arithmetic.test.ts` |
| `typed/statistics.ts` | `conversions-parser.test.ts`, `docs-sync.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `parallel-stat-prod.test.ts`, `statistics-extended.test.ts`, `statistics-extended2.test.ts`, `statistics-selection.test.ts`, `typed-arithmetic.test.ts` |
| `typed/trigonometry.ts` | `arithmetic-extended.test.ts`, `conversions-parser.test.ts`, `docs-sync.test.ts`, `parallel-arithmetic.test.ts`, `parallel-dispatch.test.ts`, `parallel-signal.test.ts`, `parallel-trig-unary.test.ts`, `typed-arithmetic.test.ts`, `typed-variadic.test.ts` |
| `typed/typed-bridge.ts` | `typed-bridge.test.ts` |
| `wasm/WasmLoader.ts` | `typed-bitwise-wasm.test.ts` |
| `bitwise/wasm-bridge.ts` | `typed-bitwise-wasm.test.ts` |
| `wasm/integrity.ts` | `wasm-integrity.test.ts` |
| `backends/Backend.ts` | `JSBackend.test.ts`, `typed-operations.test.ts`, `loading.test.ts`, `rust-wasm.test.ts` |
| `backends/BackendManager.ts` | `typed-operations.test.ts`, `loading.test.ts`, `rust-wasm.test.ts` |
| `backends/GPUBackend.ts` | `initialization.test.ts`, `operations.test.ts`, `typed-operations.test.ts`, `loading.test.ts` |
| `backends/GPUMatrixBackend.ts` | `typed-operations.test.ts`, `loading.test.ts` |
| `backends/JSBackend.ts` | `JSBackend.test.ts`, `typed-operations.test.ts`, `loading.test.ts`, `operations.test.ts` |
| `backends/ParallelBackend.ts` | `typed-operations.test.ts`, `loading.test.ts` |
| `backends/RustWASMBackend.ts` | `typed-operations.test.ts`, `loading.test.ts`, `rust-wasm.test.ts` |
| `backends/RustWasmLoader.ts` | `svd-wasm.test.ts`, `typed-operations.test.ts`, `loading.test.ts`, `rust-wasm.test.ts` |
| `backends/WASMBackend.ts` | `typed-operations.test.ts`, `accuracy.test.ts`, `decompositions-as.test.ts`, `loading.test.ts`, `operations.test.ts` |
| `backends/WasmLoader.ts` | `MatrixWasmBridge.test.ts`, `WasmLoader.test.ts`, `fft-wasm.test.ts` |
| `gpu/BatchExecutor.ts` | `integration.test.ts`, `typed-operations.test.ts`, `loading.test.ts` |
| `gpu/BufferPool.ts` | `initialization.test.ts`, `integration.test.ts`, `typed-operations.test.ts`, `loading.test.ts` |
| `gpu/GPUContext.ts` | `initialization.test.ts`, `integration.test.ts`, `typed-operations.test.ts`, `loading.test.ts` |
| `gpu/ShaderManager.ts` | `initialization.test.ts`, `integration.test.ts`, `typed-operations.test.ts`, `loading.test.ts` |
| `gpu/Sync.ts` | `integration.test.ts`, `typed-operations.test.ts`, `loading.test.ts` |
| `gpu/detect.ts` | `initialization.test.ts`, `typed-operations.test.ts`, `loading.test.ts` |
| `gpu/index.ts` | `typed-operations.test.ts`, `loading.test.ts` |
| `backends/index.ts` | `typed-operations.test.ts`, `loading.test.ts` |
| `wasm/detect.ts` | `typed-operations.test.ts`, `loading.test.ts` |
| `wasm/fft-wasm.ts` | `typed-operations.test.ts`, `fft-wasm.test.ts`, `loading.test.ts` |
| `wasm/index.ts` | `typed-operations.test.ts`, `loading.test.ts` |
| `src/config.ts` | `config.test.ts` |
| `src/index.ts` | `typed-operations.test.ts` |
| `operations/eig-wasm.ts` | `eig-wasm.test.ts`, `typed-operations.test.ts` |
| `operations/eig.ts` | `eig.test.ts`, `typed-operations.test.ts` |
| `operations/index.ts` | `typed-operations.test.ts` |
| `operations/svd-wasm.ts` | `svd-wasm.test.ts`, `typed-operations.test.ts` |
| `operations/svd.ts` | `svd.test.ts`, `svd-wasm.test.ts`, `typed-operations.test.ts` |
| `src/parallel-matrix.ts` | `typed-operations.test.ts` |
| `src/typed-operations.ts` | `typed-operations.test.ts` |
| `types/DenseMatrix.ts` | `DenseMatrix.test.ts`, `JSBackend.test.ts`, `SparseMatrix.test.ts`, `operations.test.ts`, `typed-operations.test.ts`, `accuracy.test.ts`, `decompositions-as.test.ts`, `operations.test.ts`, `rust-wasm.test.ts` |
| `types/Matrix.ts` | `typed-operations.test.ts` |
| `types/SparseMatrix.ts` | `SparseMatrix.test.ts`, `operations.test.ts`, `typed-operations.test.ts` |
| `types/index.ts` | `typed-operations.test.ts` |
| `src/index.ts` | `index.test.ts`, `robust-types.test.ts` |
| `src/fft-core.ts` | `fft-core.test.ts` |
| `src/index.ts` | `bitwise-dispatch.test.ts`, `index.test.ts`, `parallel-dispatch.test.ts` |
| `src/ComputePool.ts` | `ComputePool.test.ts`, `benchmark.test.ts`, `elementwise.test.ts`, `matmul.test.ts`, `threshold.test.ts` |
| `operations/elementwise.ts` | `benchmark.test.ts`, `elementwise.test.ts` |
| `operations/map.ts` | `map-extended.test.ts`, `map.test.ts` |
| `operations/matmul.ts` | `benchmark.test.ts`, `matmul.test.ts` |
| `operations/reduce.ts` | `benchmark.test.ts`, `reduce.test.ts` |
| `strategies/chunk.ts` | `chunk.test.ts`, `chunk-extended.test.ts` |
| `strategies/threshold.ts` | `threshold.test.ts` |
| `src/Tensor.ts` | `Tensor.matrix-bridge.test.ts`, `Tensor.ops.test.ts`, `Tensor.test.ts` |
| `src/executor.ts` | `executor.test.ts` |
| `src/graph.ts` | `graph.test.ts` |
| `src/parser.ts` | `parser.test.ts` |
| `src/types.ts` | `executor.test.ts`, `graph.test.ts`, `parser.test.ts` |

---

## Test File Details

| Test File | Imports from Source |
|-----------|---------------------|
| `tests/index.test.ts` | 1 files |
| `tests/robust-types.test.ts` | 1 files |
| `tests/bitwise-dispatch.test.ts` | 1 files |
| `tests/fft-core.test.ts` | 1 files |
| `tests/index.test.ts` | 1 files |
| `tests/parallel-dispatch.test.ts` | 1 files |
| `tests/BigNumber-formatter-api.test.ts` | 1 files |
| `tests/config.test.ts` | 0 files |
| `factory/factory.test.ts` | 2 files |
| `tests/shared.test.ts` | 0 files |
| `typed/mathts-typed-extended.test.ts` | 4 files |
| `typed/mathts-typed.test.ts` | 4 files |
| `typed/type-bridge.test.ts` | 4 files |
| `types/bignumber-math.test.ts` | 1 files |
| `types/bignumber.test.ts` | 1 files |
| `types/complex.test.ts` | 1 files |
| `types/fraction.test.ts` | 1 files |
| `tests/utils.test.ts` | 0 files |
| `tests/version.test.ts` | 9 files |
| `tests/DenseMatrix.test.ts` | 1 files |
| `tests/JSBackend.test.ts` | 3 files |
| `tests/MatrixWasmBridge.test.ts` | 1 files |
| `tests/WasmLoader.test.ts` | 1 files |
| `tests/config.test.ts` | 1 files |
| `decomposition/eig-wasm.test.ts` | 1 files |
| `decomposition/eig.test.ts` | 1 files |
| `decomposition/svd.test.ts` | 1 files |
| `gpu/initialization.test.ts` | 5 files |
| `gpu/integration.test.ts` | 5 files |
| `gpu/operations.test.ts` | 1 files |
| `sparse/SparseMatrix.test.ts` | 2 files |
| `sparse/operations.test.ts` | 2 files |
| `tests/svd-wasm.test.ts` | 3 files |
| `tests/typed-operations.test.ts` | 32 files |
| `wasm/accuracy.test.ts` | 2 files |
| `wasm/decompositions-as.test.ts` | 2 files |
| `wasm/fft-wasm.test.ts` | 2 files |
| `wasm/loading.test.ts` | 20 files |
| `wasm/operations.test.ts` | 3 files |
| `wasm/rust-wasm.test.ts` | 5 files |
| `tests/wasm-fft-fallback.test.ts` | 0 files |
| `tests/Tensor.matrix-bridge.test.ts` | 1 files |
| `tests/Tensor.ops.test.ts` | 1 files |
| `tests/Tensor.test.ts` | 1 files |
| `tests/forward-grad.test.ts` | 1 files |
| `tests/reverse-grad.test.ts` | 1 files |
| `tests/scaffold.test.ts` | 5 files |
| `tests/algebra.test.ts` | 1 files |
| `tests/arithmetic-extended.test.ts` | 2 files |
| `tests/cas.test.ts` | 1 files |
| `tests/combinatorics-extended.test.ts` | 1 files |
| `tests/combinatorics.test.ts` | 1 files |
| `tests/conversions-parser.test.ts` | 24 files |
| `tests/dist-objects.test.ts` | 1 files |
| `tests/distributions.test.ts` | 1 files |
| `tests/docs-sync.test.ts` | 24 files |
| `tests/evaluate.test.ts` | 1 files |
| `tests/factories-final.test.ts` | 1 files |
| `tests/factories-leaf.test.ts` | 3 files |
| `tests/factories-matrix.test.ts` | 2 files |
| `tests/factories-tier2.test.ts` | 1 files |
| `tests/factories-tier4.test.ts` | 2 files |
| `tests/factory-scope.test.ts` | 1 files |
| `tests/geometry-extended.test.ts` | 1 files |
| `tests/geometry.test.ts` | 1 files |
| `tests/gpu.test.ts` | 1 files |
| `tests/graph.test.ts` | 1 files |
| `tests/hypothesis.test.ts` | 1 files |
| `tests/integration.test.ts` | 1 files |
| `tests/interpolation.test.ts` | 1 files |
| `tests/matrix-bridge-accel.test.ts` | 1 files |
| `tests/matrix-ops.test.ts` | 1 files |
| `tests/numeric.test.ts` | 1 files |
| `tests/parallel-arithmetic-unary.test.ts` | 1 files |
| `tests/parallel-arithmetic.test.ts` | 24 files |
| `tests/parallel-dispatch.test.ts` | 24 files |
| `tests/parallel-signal.test.ts` | 24 files |
| `tests/parallel-stat-prod.test.ts` | 1 files |
| `tests/parallel-trig-unary.test.ts` | 1 files |
| `tests/physical-constants.test.ts` | 1 files |
| `security/wasm-integrity.test.ts` | 1 files |
| `signal/conv.test.ts` | 0 files |
| `signal/fft.test.ts` | 0 files |
| `tests/signal-extended.test.ts` | 1 files |
| `tests/signal-extended2.test.ts` | 1 files |
| `tests/sparse-bridge.test.ts` | 1 files |
| `tests/special-extended.test.ts` | 1 files |
| `tests/special.test.ts` | 1 files |
| `tests/statistics-extended.test.ts` | 1 files |
| `tests/statistics-extended2.test.ts` | 1 files |
| `tests/statistics-selection.test.ts` | 1 files |
| `tests/typed-arithmetic.test.ts` | 24 files |
| `tests/typed-bitwise-wasm.test.ts` | 3 files |
| `tests/typed-bitwise.test.ts` | 1 files |
| `tests/typed-bridge.test.ts` | 1 files |
| `tests/typed-logical.test.ts` | 1 files |
| `tests/typed-variadic.test.ts` | 2 files |
| `tests/AccessorNode.test.ts` | 5 files |
| `tests/ArrayNode.test.ts` | 3 files |
| `tests/AssignmentNode.test.ts` | 5 files |
| `tests/BlockNode.test.ts` | 3 files |
| `tests/ConditionalNode.test.ts` | 3 files |
| `tests/ConstantNode.test.ts` | 2 files |
| `tests/DimensionError.test.ts` | 1 files |
| `tests/FunctionAssignmentNode.test.ts` | 4 files |
| `tests/FunctionNode.test.ts` | 4 files |
| `tests/Help.test.ts` | 1 files |
| `tests/IndexError.test.ts` | 1 files |
| `tests/IndexNode.test.ts` | 4 files |
| `tests/Node.test.ts` | 5 files |
| `tests/ObjectNode.test.ts` | 4 files |
| `tests/OperatorNode.test.ts` | 5 files |
| `tests/ParenthesisNode.test.ts` | 4 files |
| `tests/Parser.test.ts` | 2 files |
| `tests/RangeNode.test.ts` | 4 files |
| `tests/RelationalNode.test.ts` | 3 files |
| `tests/SymbolNode.test.ts` | 3 files |
| `tests/access.test.ts` | 1 files |
| `tests/assign.test.ts` | 1 files |
| `tests/compile.test.ts` | 1 files |
| `tests/errorTransform.test.ts` | 2 files |
| `tests/evaluate.test.ts` | 1 files |
| `tests/keywords.test.ts` | 1 files |
| `tests/operators.test.ts` | 1 files |
| `tests/parse.test.ts` | 1 files |
| `security/sandbox.test.ts` | 2 files |
| `tests/utils-array.test.ts` | 1 files |
| `tests/utils-bignumber-formatter.test.ts` | 1 files |
| `tests/utils-collection.test.ts` | 1 files |
| `tests/utils-customs.test.ts` | 1 files |
| `tests/utils-factory.test.ts` | 1 files |
| `tests/utils-is.test.ts` | 1 files |
| `tests/utils-latex.test.ts` | 1 files |
| `tests/utils-map.test.ts` | 1 files |
| `tests/utils-number.test.ts` | 1 files |
| `tests/utils-object.test.ts` | 1 files |
| `tests/utils-scope.test.ts` | 2 files |
| `tests/utils-string.test.ts` | 1 files |
| `tests/utils-switch.test.ts` | 1 files |
| `tests/ComputePool.test.ts` | 1 files |
| `tests/ParallelMatrix.test.ts` | 0 files |
| `tests/WorkerPool.timeout.test.ts` | 0 files |
| `tests/benchmark.test.ts` | 4 files |
| `tests/chunk.test.ts` | 1 files |
| `operations/elementwise.test.ts` | 2 files |
| `operations/map-extended.test.ts` | 1 files |
| `operations/map.test.ts` | 1 files |
| `operations/matmul.test.ts` | 2 files |
| `operations/reduce.test.ts` | 1 files |
| `operations/threshold.test.ts` | 2 files |
| `strategies/chunk-extended.test.ts` | 1 files |
| `tests/executor.test.ts` | 2 files |
| `tests/graph.test.ts` | 2 files |
| `tests/parser.test.ts` | 2 files |
| `tests/compat.test.ts` | 2 files |
| `tests/create.test.ts` | 2 files |
| `tests/shims.test.ts` | 1 files |
| `benchmark/performance.test.ts` | 0 files |
| `benchmark/wasm-comparison.test.ts` | 0 files |
| `integration/functions.test.ts` | 0 files |
| `integration/instance.test.ts` | 0 files |
| `wasm/parallel-processing.test.ts` | 0 files |
| `wasm/typescript-integration.test.ts` | 0 files |
| `wasm/wasm-loader.test.ts` | 0 files |
