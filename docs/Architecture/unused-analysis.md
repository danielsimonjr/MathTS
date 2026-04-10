# Unused Files and Exports Analysis

**Generated**: 2026-04-10

## Summary

- **Potentially unused files**: 422
- **Potentially unused exports**: 495

## Potentially Unused Files

These files are not imported by any other file in the codebase:

- `packages/typed-function/src/typed-function.d.ts`
- `packages/workerpool/src/index.ts`
- `packages/workerpool/src/worker.ts`
- `packages/workerpool/src/workerpool.d.ts`
- `core/src/bigint.ts`
- `core/src/bignumber/bitwise.ts`
- `core/src/bignumber/constants.ts`
- `core/src/bignumber/nearlyEqual.ts`
- `core/src/collection.ts`
- `core/src/complex.ts`
- `core/src/constants.ts`
- `core/src/create.ts`
- `core/src/customs.d.ts`
- `core/src/emitter.ts`
- `core/src/error/ArgumentsError.ts`
- `core/src/error/IndexError.ts`
- `core/src/factory.ts`
- `core/src/function/typed.ts`
- `core/src/latex.d.ts`
- `core/src/latex.ts`
- `core/src/log.ts`
- `core/src/node.ts`
- `core/src/noop.ts`
- `core/src/optimizeCallback.ts`
- `core/src/print.ts`
- `core/src/product.ts`
- `core/src/scope.ts`
- `core/src/snapshot.ts`
- `core/src/string.d.ts`
- `core/src/typed-function.d.ts`
- `core/src/types/bigint.ts`
- `core/src/types/boolean.ts`
- `core/src/types/chain/Chain.ts`
- `core/src/types/chain/function/chain.ts`
- `core/src/types/matrix/DenseMatrix.ts`
- `core/src/types/matrix/FibonacciHeap.ts`
- `core/src/types/matrix/function/index.ts`
- `core/src/types/matrix/function/matrix.ts`
- `core/src/types/matrix/function/sparse.ts`
- `core/src/types/matrix/ImmutableDenseMatrix.ts`
- `core/src/types/matrix/Matrix.ts`
- `core/src/types/matrix/MatrixIndex.ts`
- `core/src/types/matrix/Range.ts`
- `core/src/types/matrix/Spa.ts`
- `core/src/types/matrix/SparseMatrix.ts`
- `core/src/types/matrix/utils/matAlgo01xDSid.ts`
- `core/src/types/matrix/utils/matAlgo02xDS0.ts`
- `core/src/types/matrix/utils/matAlgo03xDSf.ts`
- `core/src/types/matrix/utils/matAlgo04xSidSid.ts`
- `core/src/types/matrix/utils/matAlgo05xSfSf.ts`
- `core/src/types/matrix/utils/matAlgo06xS0S0.ts`
- `core/src/types/matrix/utils/matAlgo07xSSf.ts`
- `core/src/types/matrix/utils/matAlgo08xS0Sid.ts`
- `core/src/types/matrix/utils/matAlgo09xS0Sf.ts`
- `core/src/types/matrix/utils/matAlgo10xSids.ts`
- `core/src/types/matrix/utils/matAlgo11xS0s.ts`
- `core/src/types/matrix/utils/matAlgo12xSfs.ts`
- `core/src/types/matrix/utils/matrixAlgorithmSuite.ts`
- `core/src/types/number.ts`
- `core/src/types/resultset/ResultSet.ts`
- `core/src/types/string.ts`
- `core/src/types/unit/function/createUnit.ts`
- `core/src/types/unit/function/splitUnit.ts`
- `core/src/types/unit/function/unit.ts`
- `core/src/types/unit/physicalConstants.ts`
- `core/src/types/unit/Unit.ts`
- `core/src/utils.ts`
- `matrix/src/backends/MatrixWasmBridge.ts`
- `matrix/src/matrix.ts`
- `matrix/src/types/parallel.d.ts`
- `functions/src/core/function/config.ts`
- `functions/src/core/function/import.ts`
- `functions/src/defaultInstance.ts`
- `functions/src/expression/embeddedDocs/function/algebra/derivative.ts`
- `functions/src/expression/embeddedDocs/function/algebra/leafCount.ts`
- `functions/src/expression/embeddedDocs/function/algebra/lsolve.ts`
- `functions/src/expression/embeddedDocs/function/algebra/lsolveAll.ts`
- `functions/src/expression/embeddedDocs/function/algebra/lup.ts`
- `functions/src/expression/embeddedDocs/function/algebra/lusolve.ts`
- `functions/src/expression/embeddedDocs/function/algebra/lyap.ts`
- `functions/src/expression/embeddedDocs/function/algebra/polynomialRoot.ts`
- `functions/src/expression/embeddedDocs/function/algebra/qr.ts`
- `functions/src/expression/embeddedDocs/function/algebra/rationalize.ts`
- `functions/src/expression/embeddedDocs/function/algebra/resolve.ts`
- `functions/src/expression/embeddedDocs/function/algebra/schur.ts`
- `functions/src/expression/embeddedDocs/function/algebra/simplify.ts`
- `functions/src/expression/embeddedDocs/function/algebra/simplifyConstant.ts`
- `functions/src/expression/embeddedDocs/function/algebra/simplifyCore.ts`
- `functions/src/expression/embeddedDocs/function/algebra/slu.ts`
- `functions/src/expression/embeddedDocs/function/algebra/sylvester.ts`
- `functions/src/expression/embeddedDocs/function/algebra/symbolicEqual.ts`
- `functions/src/expression/embeddedDocs/function/algebra/usolve.ts`
- `functions/src/expression/embeddedDocs/function/algebra/usolveAll.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/abs.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/add.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/cbrt.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/ceil.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/cube.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/divide.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/dotDivide.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/dotMultiply.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/dotPow.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/exp.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/expm.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/expm1.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/fix.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/floor.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/gcd.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/hypot.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/invmod.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/lcm.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/log.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/log10.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/log1p.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/log2.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/mod.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/multiply.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/norm.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/nthRoot.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/nthRoots.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/pow.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/round.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/sign.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/sqrt.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/sqrtm.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/square.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/subtract.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/unaryMinus.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/unaryPlus.ts`
- `functions/src/expression/embeddedDocs/function/arithmetic/xgcd.ts`
- `functions/src/expression/embeddedDocs/function/bitwise/bitAnd.ts`
- `functions/src/expression/embeddedDocs/function/bitwise/bitNot.ts`
- `functions/src/expression/embeddedDocs/function/bitwise/bitOr.ts`
- `functions/src/expression/embeddedDocs/function/bitwise/bitXor.ts`
- `functions/src/expression/embeddedDocs/function/bitwise/leftShift.ts`
- `functions/src/expression/embeddedDocs/function/bitwise/rightArithShift.ts`
- `functions/src/expression/embeddedDocs/function/bitwise/rightLogShift.ts`
- `functions/src/expression/embeddedDocs/function/combinatorics/bellNumbers.ts`
- `functions/src/expression/embeddedDocs/function/combinatorics/catalan.ts`
- `functions/src/expression/embeddedDocs/function/combinatorics/composition.ts`
- `functions/src/expression/embeddedDocs/function/combinatorics/stirlingS2.ts`
- `functions/src/expression/embeddedDocs/function/complex/arg.ts`
- `functions/src/expression/embeddedDocs/function/complex/conj.ts`
- `functions/src/expression/embeddedDocs/function/complex/im.ts`
- `functions/src/expression/embeddedDocs/function/complex/re.ts`
- `functions/src/expression/embeddedDocs/function/expression/compile.ts`
- `functions/src/expression/embeddedDocs/function/expression/evaluate.ts`
- `functions/src/expression/embeddedDocs/function/expression/help.ts`
- `functions/src/expression/embeddedDocs/function/expression/parse.ts`
- `functions/src/expression/embeddedDocs/function/expression/parser.ts`
- `functions/src/expression/embeddedDocs/function/geometry/distance.ts`
- `functions/src/expression/embeddedDocs/function/geometry/intersect.ts`
- `functions/src/expression/embeddedDocs/function/logical/and.ts`
- `functions/src/expression/embeddedDocs/function/logical/not.ts`
- `functions/src/expression/embeddedDocs/function/logical/nullish.ts`
- `functions/src/expression/embeddedDocs/function/logical/or.ts`
- `functions/src/expression/embeddedDocs/function/logical/xor.ts`
- `functions/src/expression/embeddedDocs/function/matrix/column.ts`
- `functions/src/expression/embeddedDocs/function/matrix/concat.ts`
- `functions/src/expression/embeddedDocs/function/matrix/count.ts`
- `functions/src/expression/embeddedDocs/function/matrix/cross.ts`
- `functions/src/expression/embeddedDocs/function/matrix/ctranspose.ts`
- `functions/src/expression/embeddedDocs/function/matrix/det.ts`
- `functions/src/expression/embeddedDocs/function/matrix/diag.ts`
- `functions/src/expression/embeddedDocs/function/matrix/diff.ts`
- `functions/src/expression/embeddedDocs/function/matrix/dot.ts`
- `functions/src/expression/embeddedDocs/function/matrix/eigs.ts`
- `functions/src/expression/embeddedDocs/function/matrix/fft.ts`
- `functions/src/expression/embeddedDocs/function/matrix/filter.ts`
- `functions/src/expression/embeddedDocs/function/matrix/flatten.ts`
- `functions/src/expression/embeddedDocs/function/matrix/forEach.ts`
- `functions/src/expression/embeddedDocs/function/matrix/getMatrixDataType.ts`
- `functions/src/expression/embeddedDocs/function/matrix/identity.ts`
- `functions/src/expression/embeddedDocs/function/matrix/ifft.ts`
- `functions/src/expression/embeddedDocs/function/matrix/inv.ts`
- `functions/src/expression/embeddedDocs/function/matrix/kron.ts`
- `functions/src/expression/embeddedDocs/function/matrix/map.ts`
- `functions/src/expression/embeddedDocs/function/matrix/mapSlices.ts`
- `functions/src/expression/embeddedDocs/function/matrix/matrixFromColumns.ts`
- `functions/src/expression/embeddedDocs/function/matrix/matrixFromFunction.ts`
- `functions/src/expression/embeddedDocs/function/matrix/matrixFromRows.ts`
- `functions/src/expression/embeddedDocs/function/matrix/ones.ts`
- `functions/src/expression/embeddedDocs/function/matrix/partitionSelect.ts`
- `functions/src/expression/embeddedDocs/function/matrix/pinv.ts`
- `functions/src/expression/embeddedDocs/function/matrix/range.ts`
- `functions/src/expression/embeddedDocs/function/matrix/reshape.ts`
- `functions/src/expression/embeddedDocs/function/matrix/resize.ts`
- `functions/src/expression/embeddedDocs/function/matrix/rotate.ts`
- `functions/src/expression/embeddedDocs/function/matrix/rotationMatrix.ts`
- `functions/src/expression/embeddedDocs/function/matrix/row.ts`
- `functions/src/expression/embeddedDocs/function/matrix/size.ts`
- `functions/src/expression/embeddedDocs/function/matrix/sort.ts`
- `functions/src/expression/embeddedDocs/function/matrix/squeeze.ts`
- `functions/src/expression/embeddedDocs/function/matrix/subset.ts`
- `functions/src/expression/embeddedDocs/function/matrix/trace.ts`
- `functions/src/expression/embeddedDocs/function/matrix/transpose.ts`
- `functions/src/expression/embeddedDocs/function/matrix/zeros.ts`
- `functions/src/expression/embeddedDocs/function/numeric/solveODE.ts`
- `functions/src/expression/embeddedDocs/function/probability/bernoulli.ts`
- `functions/src/expression/embeddedDocs/function/probability/combinations.ts`
- `functions/src/expression/embeddedDocs/function/probability/combinationsWithRep.ts`
- `functions/src/expression/embeddedDocs/function/probability/distribution.ts`
- `functions/src/expression/embeddedDocs/function/probability/factorial.ts`
- `functions/src/expression/embeddedDocs/function/probability/gamma.ts`
- `functions/src/expression/embeddedDocs/function/probability/kldivergence.ts`
- `functions/src/expression/embeddedDocs/function/probability/lgamma.ts`
- `functions/src/expression/embeddedDocs/function/probability/multinomial.ts`
- `functions/src/expression/embeddedDocs/function/probability/permutations.ts`
- `functions/src/expression/embeddedDocs/function/probability/pickRandom.ts`
- `functions/src/expression/embeddedDocs/function/probability/random.ts`
- `functions/src/expression/embeddedDocs/function/probability/randomInt.ts`
- `functions/src/expression/embeddedDocs/function/relational/compare.ts`
- `functions/src/expression/embeddedDocs/function/relational/compareNatural.ts`
- `functions/src/expression/embeddedDocs/function/relational/compareText.ts`
- `functions/src/expression/embeddedDocs/function/relational/deepEqual.ts`
- `functions/src/expression/embeddedDocs/function/relational/equal.ts`
- `functions/src/expression/embeddedDocs/function/relational/equalText.ts`
- `functions/src/expression/embeddedDocs/function/relational/larger.ts`
- `functions/src/expression/embeddedDocs/function/relational/largerEq.ts`
- `functions/src/expression/embeddedDocs/function/relational/smaller.ts`
- `functions/src/expression/embeddedDocs/function/relational/smallerEq.ts`
- `functions/src/expression/embeddedDocs/function/relational/unequal.ts`
- `functions/src/expression/embeddedDocs/function/set/setCartesian.ts`
- `functions/src/expression/embeddedDocs/function/set/setDifference.ts`
- `functions/src/expression/embeddedDocs/function/set/setDistinct.ts`
- `functions/src/expression/embeddedDocs/function/set/setIntersect.ts`
- `functions/src/expression/embeddedDocs/function/set/setIsSubset.ts`
- `functions/src/expression/embeddedDocs/function/set/setMultiplicity.ts`
- `functions/src/expression/embeddedDocs/function/set/setPowerset.ts`
- `functions/src/expression/embeddedDocs/function/set/setSize.ts`
- `functions/src/expression/embeddedDocs/function/set/setSymDifference.ts`
- `functions/src/expression/embeddedDocs/function/set/setUnion.ts`
- `functions/src/expression/embeddedDocs/function/signal/freqz.ts`
- `functions/src/expression/embeddedDocs/function/signal/zpk2tf.ts`
- `functions/src/expression/embeddedDocs/function/special/erf.ts`
- `functions/src/expression/embeddedDocs/function/special/zeta.ts`
- `functions/src/expression/embeddedDocs/function/statistics/corr.ts`
- `functions/src/expression/embeddedDocs/function/statistics/cumsum.ts`
- `functions/src/expression/embeddedDocs/function/statistics/mad.ts`
- `functions/src/expression/embeddedDocs/function/statistics/max.ts`
- `functions/src/expression/embeddedDocs/function/statistics/mean.ts`
- `functions/src/expression/embeddedDocs/function/statistics/median.ts`
- `functions/src/expression/embeddedDocs/function/statistics/min.ts`
- `functions/src/expression/embeddedDocs/function/statistics/mode.ts`
- `functions/src/expression/embeddedDocs/function/statistics/prod.ts`
- `functions/src/expression/embeddedDocs/function/statistics/quantileSeq.ts`
- `functions/src/expression/embeddedDocs/function/statistics/std.ts`
- `functions/src/expression/embeddedDocs/function/statistics/sum.ts`
- `functions/src/expression/embeddedDocs/function/statistics/variance.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/acos.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/acosh.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/acot.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/acoth.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/acsc.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/acsch.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/asec.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/asech.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/asin.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/asinh.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/atan.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/atan2.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/atanh.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/cos.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/cosh.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/cot.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/coth.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/csc.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/csch.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/sec.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/sech.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/sin.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/sinh.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/tan.ts`
- `functions/src/expression/embeddedDocs/function/trigonometry/tanh.ts`
- `functions/src/expression/embeddedDocs/function/units/to.ts`
- `functions/src/expression/embeddedDocs/function/units/toBest.ts`
- `functions/src/expression/embeddedDocs/function/utils/bin.ts`
- `functions/src/expression/embeddedDocs/function/utils/clone.ts`
- `functions/src/expression/embeddedDocs/function/utils/format.ts`
- `functions/src/expression/embeddedDocs/function/utils/hasNumericValue.ts`
- `functions/src/expression/embeddedDocs/function/utils/hex.ts`
- `functions/src/expression/embeddedDocs/function/utils/isBounded.ts`
- `functions/src/expression/embeddedDocs/function/utils/isFinite.ts`
- `functions/src/expression/embeddedDocs/function/utils/isInteger.ts`
- `functions/src/expression/embeddedDocs/function/utils/isNaN.ts`
- `functions/src/expression/embeddedDocs/function/utils/isNegative.ts`
- `functions/src/expression/embeddedDocs/function/utils/isNumeric.ts`
- `functions/src/expression/embeddedDocs/function/utils/isPositive.ts`
- `functions/src/expression/embeddedDocs/function/utils/isPrime.ts`
- `functions/src/expression/embeddedDocs/function/utils/isZero.ts`
- `functions/src/expression/embeddedDocs/function/utils/numeric.ts`
- `functions/src/expression/embeddedDocs/function/utils/oct.ts`
- `functions/src/expression/embeddedDocs/function/utils/print.ts`
- `functions/src/expression/embeddedDocs/function/utils/typeOf.ts`
- `functions/src/expression/types.ts`
- `functions/src/factoriesNumber.ts`
- `functions/src/shared/types.ts`
- `functions/src/utils/customs.d.ts`
- `functions/src/utils/latex.d.ts`
- `functions/src/utils/log.ts`
- `functions/src/utils/shared.ts`
- `functions/src/utils/snapshot.ts`
- `functions/src/utils/string.d.ts`
- `functions/src/wasm/algebra/equations.ts`
- `functions/src/wasm/algebra/polynomial.ts`
- `functions/src/wasm/algebra/solver.ts`
- `functions/src/wasm/algebra/sparse/amd.ts`
- `functions/src/wasm/algebra/sparse/operations.ts`
- `functions/src/wasm/arithmetic/advanced.ts`
- `functions/src/wasm/arithmetic/basic.ts`
- `functions/src/wasm/arithmetic/logarithmic.ts`
- `functions/src/wasm/bitwise/operations.ts`
- `functions/src/wasm/combinatorics/basic.ts`
- `functions/src/wasm/matrix/algorithms.ts`
- `functions/src/wasm/matrix/basic.ts`
- `functions/src/wasm/matrix/broadcast.ts`
- `functions/src/wasm/matrix/functions.ts`
- `functions/src/wasm/matrix/rotation.ts`
- `functions/src/wasm/matrix/sparse.ts`
- `functions/src/wasm/MatrixWasmBridge.ts`
- `functions/src/wasm/numeric/calculus.ts`
- `functions/src/wasm/numeric/interpolation.ts`
- `functions/src/wasm/numeric/rational.ts`
- `functions/src/wasm/numeric/rootfinding.ts`
- `functions/src/wasm/probability/distributions.ts`
- `functions/src/wasm/trigonometry/basic.ts`
- `functions/src/wasm/unit/conversion.ts`
- `functions/src/wasm/utils/checks.ts`
- `functions/src/wasm/utils/constants.ts`
- `expression/src/embeddedDocs/function/combinatorics/doubleFactorial.ts`
- `expression/src/embeddedDocs/function/combinatorics/fallingFactorial.ts`
- `expression/src/embeddedDocs/function/combinatorics/fibonacci.ts`
- `expression/src/embeddedDocs/function/combinatorics/lucas.ts`
- `expression/src/embeddedDocs/function/combinatorics/risingFactorial.ts`
- `expression/src/embeddedDocs/function/combinatorics/subfactorial.ts`
- `expression/src/embeddedDocs/function/geometry/angle2D.ts`
- `expression/src/embeddedDocs/function/geometry/angle3D.ts`
- `expression/src/embeddedDocs/function/geometry/convexHull.ts`
- `expression/src/embeddedDocs/function/geometry/cross3D.ts`
- `expression/src/embeddedDocs/function/geometry/distance2D.ts`
- `expression/src/embeddedDocs/function/geometry/distance3D.ts`
- `expression/src/embeddedDocs/function/geometry/distanceND.ts`
- `expression/src/embeddedDocs/function/geometry/distancePointToLine2D.ts`
- `expression/src/embeddedDocs/function/geometry/dot3D.ts`
- `expression/src/embeddedDocs/function/geometry/intersectLines2D.ts`
- `expression/src/embeddedDocs/function/geometry/intersectSegments2D.ts`
- `expression/src/embeddedDocs/function/geometry/pointInPolygon.ts`
- `expression/src/embeddedDocs/function/geometry/polygonArea.ts`
- `expression/src/embeddedDocs/function/geometry/projectVector.ts`
- `expression/src/embeddedDocs/function/geometry/reflectVector.ts`
- `expression/src/embeddedDocs/function/geometry/rotateVector2D.ts`
- `expression/src/embeddedDocs/function/geometry/rotateVector3D.ts`
- `expression/src/embeddedDocs/function/geometry/triangleArea.ts`
- `expression/src/embeddedDocs/function/numeric/cubicSpline.ts`
- `expression/src/embeddedDocs/function/numeric/gaussQuad.ts`
- `expression/src/embeddedDocs/function/numeric/hermiteInterp.ts`
- `expression/src/embeddedDocs/function/numeric/lagrangeInterp.ts`
- `expression/src/embeddedDocs/function/numeric/linearInterp.ts`
- `expression/src/embeddedDocs/function/numeric/pchipInterp.ts`
- `expression/src/embeddedDocs/function/numeric/polyFit.ts`
- `expression/src/embeddedDocs/function/numeric/romberg.ts`
- `expression/src/embeddedDocs/function/numeric/simpson.ts`
- `expression/src/embeddedDocs/function/numeric/trapz.ts`
- `expression/src/embeddedDocs/function/probability/bernoulliPMF.ts`
- `expression/src/embeddedDocs/function/probability/binomialPMF.ts`
- `expression/src/embeddedDocs/function/probability/distribution.ts`
- `expression/src/embeddedDocs/function/probability/entropy.ts`
- `expression/src/embeddedDocs/function/probability/exponentialCDF.ts`
- `expression/src/embeddedDocs/function/probability/exponentialPDF.ts`
- `expression/src/embeddedDocs/function/probability/geometricPMF.ts`
- `expression/src/embeddedDocs/function/probability/jsDivergence.ts`
- `expression/src/embeddedDocs/function/probability/normalCDF.ts`
- `expression/src/embeddedDocs/function/probability/normalPDF.ts`
- `expression/src/embeddedDocs/function/probability/poissonPMF.ts`
- `expression/src/embeddedDocs/function/signal/autoCorrelation.ts`
- `expression/src/embeddedDocs/function/signal/crossCorrelation.ts`
- `expression/src/embeddedDocs/function/signal/groupDelay.ts`
- `expression/src/embeddedDocs/function/signal/unwrapPhase.ts`
- `expression/src/embeddedDocs/function/special/besselJ0.ts`
- `expression/src/embeddedDocs/function/special/besselJ1.ts`
- `expression/src/embeddedDocs/function/special/besselY0.ts`
- `expression/src/embeddedDocs/function/special/besselY1.ts`
- `expression/src/embeddedDocs/function/special/beta.ts`
- `expression/src/embeddedDocs/function/special/digamma.ts`
- `expression/src/embeddedDocs/function/special/erfc.ts`
- `expression/src/embeddedDocs/function/special/gammainc.ts`
- `expression/src/error/ArgumentsError.ts`
- `expression/src/function/compile.ts`
- `expression/src/function/evaluate.ts`
- `expression/src/function/help.ts`
- `expression/src/function/parser.ts`
- `expression/src/transform/and.transform.ts`
- `expression/src/transform/bitAnd.transform.ts`
- `expression/src/transform/bitOr.transform.ts`
- `expression/src/transform/column.transform.ts`
- `expression/src/transform/concat.transform.ts`
- `expression/src/transform/cumsum.transform.ts`
- `expression/src/transform/diff.transform.ts`
- `expression/src/transform/filter.transform.ts`
- `expression/src/transform/forEach.transform.ts`
- `expression/src/transform/index.transform.ts`
- `expression/src/transform/map.transform.ts`
- `expression/src/transform/mapSlices.transform.ts`
- `expression/src/transform/max.transform.ts`
- `expression/src/transform/mean.transform.ts`
- `expression/src/transform/min.transform.ts`
- `expression/src/transform/nullish.transform.ts`
- `expression/src/transform/or.transform.ts`
- `expression/src/transform/print.transform.ts`
- `expression/src/transform/quantileSeq.transform.ts`
- `expression/src/transform/range.transform.ts`
- `expression/src/transform/row.transform.ts`
- `expression/src/transform/std.transform.ts`
- `expression/src/transform/subset.transform.ts`
- `expression/src/transform/sum.transform.ts`
- `expression/src/transform/variance.transform.ts`
- `parallel/src/matrix.worker.ts`
- `parallel/src/ParallelMatrix.ts`
- `parallel/src/workers/compute.worker.ts`
- `workbook/src/cli.ts`
- `assembly/src/env/abort.ts`
- `compat/src/functions.d.ts`

## Potentially Unused Exports

These exports are not imported by any other file in the codebase:

### `core/src/array.ts`

- `validate` (function)
- `validateIndexSourceSize` (function)
- `validateIndex` (function)
- `isEmptyIndex` (function)
- `resize` (function)
- `reshape` (function)
- `processSizesWildcard` (function)
- `squeeze` (function)
- `unsqueeze` (function)
- `flatten` (function)
- `map` (function)
- `forEach` (function)
- `filter` (function)
- `filterRegExp` (function)
- `join` (function)
- `identify` (function)
- `generalize` (function)
- `getArrayDataType` (function)
- `last` (function)
- `initial` (function)
- `concat` (function)
- `broadcastSizes` (function)
- `checkBroadcastingRules` (function)
- `broadcastTo` (function)
- `broadcastArrays` (function)
- `stretch` (function)
- `clone` (function)
- `IdentifiedValue` (interface)
- `NestedArray` (type)
- `ArrayOrScalar` (type)

### `core/src/bignumber/formatter.ts`

- `toEngineering` (function)
- `toExponential` (function)
- `toFixed` (function)

### `core/src/factory/factory.ts`

- `MathTSConfig` (interface)
- `FactoryFunction` (interface)
- `FactoryDependencies` (interface)
- `FactoryImport` (type)

### `core/src/function/config.ts`

- `ConfigFunction` (interface)
- `MatrixOption` (type)
- `NumberOption` (type)
- `ConfigOptions` (type)
- `EmitFunction` (type)
- `MATRIX_OPTIONS` (constant)
- `NUMBER_OPTIONS` (constant)

### `core/src/function/import.ts`

- `path` (constant)

### `core/src/function.ts`

- `memoizeCompare` (function)

### `core/src/is.ts`

- `isBigInt` (function)
- `isComplex` (function)
- `isFraction` (function)
- `isUnit` (function)
- `isDenseMatrix` (function)
- `isSparseMatrix` (function)
- `isRange` (function)
- `isIndex` (function)
- `isBoolean` (function)
- `isResultSet` (function)
- `isHelp` (function)
- `isFunction` (function)
- `isDate` (function)
- `isRegExp` (function)
- `isPartitionedMap` (function)
- `isObjectWrappingMap` (function)
- `isNull` (function)
- `isUndefined` (function)
- `isAccessorNode` (function)
- `isArrayNode` (function)
- `isAssignmentNode` (function)
- `isBlockNode` (function)
- `isConditionalNode` (function)
- `isConstantNode` (function)
- `rule2Node` (function)
- `isFunctionAssignmentNode` (function)
- `isFunctionNode` (function)
- `isIndexNode` (function)
- `isNode` (function)
- `isObjectNode` (function)
- `isOperatorNode` (function)
- `isParenthesisNode` (function)
- `isRangeNode` (function)
- `isRelationalNode` (function)
- `isSymbolNode` (function)
- `isChain` (function)
- `Complex` (interface)
- `Fraction` (interface)
- `Unit` (interface)
- `DenseMatrix` (interface)
- `SparseMatrix` (interface)
- `Range` (interface)
- `ResultSet` (interface)
- `Help` (interface)
- `Chain` (interface)
- `Node` (interface)
- `AccessorNode` (interface)
- `ArrayNode` (interface)
- `AssignmentNode` (interface)
- `BlockNode` (interface)
- `ConditionalNode` (interface)
- `ConstantNode` (interface)
- `FunctionAssignmentNode` (interface)
- `FunctionNode` (interface)
- `IndexNode` (interface)
- `ObjectNode` (interface)
- `OperatorNode` (interface)
- `ParenthesisNode` (interface)
- `RangeNode` (interface)
- `RelationalNode` (interface)
- `SymbolNode` (interface)
- `PartitionedMap` (interface)

### `core/src/map.ts`

- `createEmptyMap` (function)
- `createMap` (function)
- `toObject` (function)
- `assign` (function)

### `core/src/number.ts`

- `safeNumberType` (function)
- `splitNumber` (function)
- `toEngineering` (function)
- `toFixed` (function)
- `toExponential` (function)
- `toPrecision` (function)
- `roundDigits` (function)
- `digits` (function)
- `copysign` (function)
- `SplitValue` (interface)
- `NumberTypeConfig` (interface)
- `FormatOptions` (interface)
- `NormalizedFormatOptions` (interface)
- `sign` (constant)
- `log2` (constant)
- `log10` (constant)
- `log1p` (constant)
- `cbrt` (constant)
- `expm1` (constant)
- `acosh` (constant)
- `asinh` (constant)
- `atanh` (constant)
- `cosh` (constant)
- `sinh` (constant)
- `tanh` (constant)

### `core/src/object.ts`

- `clone` (function)
- `mapObject` (function)
- `extend` (function)
- `deepExtend` (function)
- `deepFlatten` (function)
- `canDefineProperty` (function)
- `lazy` (function)
- `traverse` (function)
- `isLegacyFactory` (function)
- `get` (function)
- `set` (function)
- `pick` (function)

### `core/src/string.ts`

- `stringify` (function)
- `escape` (function)
- `compareText` (function)

### `core/src/typed/mathts-typed.ts`

- `TypeDef` (interface)
- `ConversionDef` (interface)
- `MathTSTypeDef` (interface)

### `core/src/types/bignumber.ts`

- `BigNumberConfig` (interface)
- `RoundingMode` (type)

### `core/src/types/interfaces.ts`

- `MatrixBackend` (interface)
- `IMatrix` (interface)
- `IBigNumber` (interface)
- `MatrixDimensions` (interface)
- `BackendType` (type)
- `NumericType` (type)

### `core/src/types.ts`

- `SparseMatrix` (interface)
- `Unit` (interface)
- `MatrixConstructor` (interface)
- `Complex` (type)

### `matrix/src/backends/wasm/fft-wasm.ts`

- `FFTResult` (interface)
- `FFTConfig` (interface)
- `FFTBackend` (type)

### `matrix/src/backends/WasmLoader.ts`

- `initWasm` (function)
- `WasmLoader` (class)
- `LoadingMetrics` (interface)

### `matrix/src/config.ts`

- `setConfig` (function)
- `resetConfig` (function)
- `setBackendPreference` (function)
- `setBackendThreshold` (function)
- `setBackendEnabled` (function)
- `getRecommendedBackend` (function)
- `forceBackend` (function)
- `enableProfiling` (function)
- `disableProfiling` (function)
- `enableAdaptiveTuning` (function)
- `disableAdaptiveTuning` (function)
- `configureAdaptiveTuning` (function)
- `BackendConfig` (interface)
- `AdaptiveTuningConfig` (interface)
- `ProfilingConfig` (interface)
- `BackendPreference` (type)
- `DEFAULT_CONFIG` (constant)

### `matrix/src/types/Matrix.ts`

- `MatrixDimensions` (interface)
- `MatrixIndex` (interface)
- `MatrixType` (type)

### `matrix/src/types.ts`

- `StorageFormat` (type)

### `functions/src/arithmetic/nthRoot.ts`

- `createNthRootNumber` (constant)

### `functions/src/arithmetic/utils/nodeOperations.ts`

- `name` (constant)
- `dependencies` (constant)

### `functions/src/core/create.ts`

- `MathJsInstance` (interface)
- `ImportOptions` (interface)
- `FactoriesInput` (type)

### `functions/src/core/function/typed.ts`

- `TypedSignatures` (type)
- `TypeTest` (type)
- `TypeConversion` (type)
- `TypeDefinition` (type)

### `functions/src/error/ArgumentsError.ts`

- `createArgumentsError` (function)

### `functions/src/error/IndexError.ts`

- `createIndexError` (function)

### `functions/src/expression/node/Node.ts`

- `CompiledExpression` (interface)

### `functions/src/expression/transform/types.ts`

- `ComplexLike` (interface)
- `FractionLike` (interface)
- `CompiledExpression` (interface)
- `MathValue` (type)
- `PredicateFunction` (type)
- `TypedCallback` (type)

### `functions/src/type/bignumber/BigNumber.ts`

- `BigNumberJSON` (interface)
- `ConfigChangeEvent` (interface)
- `BigNumberClass` (interface)
- `BigNumberInstance` (interface)

### `functions/src/type/chain/Chain.ts`

- `ChainJSON` (interface)
- `ChainInstance` (interface)
- `ChainConstructor` (interface)

### `functions/src/type/complex/Complex.ts`

- `PolarCoordinates` (interface)
- `ComplexFormatOptions` (interface)

### `functions/src/type/fraction/Fraction.ts`

- `FractionJSON` (interface)
- `FractionConstructor` (interface)
- `FractionValue` (type)

### `functions/src/type/local/Decimal.ts`

- `ROUND_UP` (constant)
- `ROUND_DOWN` (constant)
- `ROUND_CEIL` (constant)
- `ROUND_FLOOR` (constant)
- `ROUND_HALF_UP` (constant)
- `ROUND_HALF_DOWN` (constant)
- `ROUND_HALF_EVEN` (constant)
- `ROUND_HALF_CEIL` (constant)
- `ROUND_HALF_FLOOR` (constant)
- `EUCLID` (constant)

### `functions/src/type/matrix/Matrix.ts`

- `MatrixForEachCallback` (type)
- `MatrixMapCallback` (type)
- `Index` (type)
- `MatrixData` (type)

### `functions/src/type/matrix/MatrixIndex.ts`

- `IndexDimension` (type)
- `IndexForEachCallback` (type)

### `functions/src/type/matrix/types.ts`

- `ComplexLike` (interface)
- `FractionLike` (interface)
- `DenseMatrixInterface` (interface)
- `SparseMatrixInterface` (interface)
- `MathNumericValue` (type)
- `ElementwiseOperation` (type)
- `AlgorithmFunction` (type)

### `functions/src/type/resultset/ResultSet.ts`

- `ResultSetJSON` (interface)
- `ResultSetInstance` (interface)
- `ResultSetConstructor` (interface)

### `functions/src/type/unit/physicalConstants.ts`

- `createJosephson` (constant)

### `functions/src/utils/array.ts`

- `last` (function)
- `initial` (function)
- `checkBroadcastingRules` (function)
- `broadcastArrays` (function)
- `stretch` (function)
- `clone` (function)
- `IdentifiedValue` (interface)
- `NestedArray` (type)
- `ArrayOrScalar` (type)

### `functions/src/utils/bignumber/bitwise.ts`

- `bitwise` (function)

### `functions/src/utils/bignumber/formatter.ts`

- `toEngineering` (function)
- `toExponential` (function)
- `toFixed` (function)

### `functions/src/utils/emitter.ts`

- `mixin` (function)
- `EmitterMixin` (interface)

### `functions/src/utils/factory.ts`

- `sortFactories` (function)
- `create` (function)
- `assertDependencies` (function)
- `isOptionalDependency` (function)
- `DependencyName` (type)
- `CreateFunction` (type)

### `functions/src/utils/function.ts`

- `memoizeCompare` (function)
- `MemoizeCache` (interface)
- `MemoizedFunction` (interface)

### `functions/src/utils/is.ts`

- `BigNumber` (interface)
- `Complex` (interface)
- `Fraction` (interface)
- `Unit` (interface)
- `DenseMatrix` (interface)
- `SparseMatrix` (interface)
- `Range` (interface)
- `ResultSet` (interface)
- `Help` (interface)
- `Chain` (interface)
- `Node` (interface)
- `AccessorNode` (interface)
- `ArrayNode` (interface)
- `AssignmentNode` (interface)
- `BlockNode` (interface)
- `ConditionalNode` (interface)
- `ConstantNode` (interface)
- `FunctionAssignmentNode` (interface)
- `FunctionNode` (interface)
- `IndexNode` (interface)
- `ObjectNode` (interface)
- `OperatorNode` (interface)
- `ParenthesisNode` (interface)
- `RangeNode` (interface)
- `RelationalNode` (interface)
- `SymbolNode` (interface)
- `PartitionedMap` (interface)

### `functions/src/utils/latex.ts`

- `latexSymbols` (constant)

### `functions/src/utils/map.ts`

- `assign` (function)

### `functions/src/utils/number.ts`

- `toEngineering` (function)
- `toExponential` (function)
- `toPrecision` (function)
- `roundDigits` (function)
- `SplitValue` (interface)
- `NumberTypeConfig` (interface)
- `FormatOptions` (interface)
- `NormalizedFormatOptions` (interface)

### `functions/src/utils/object.ts`

- `mapObject` (function)
- `canDefineProperty` (function)
- `traverse` (function)
- `get` (function)
- `set` (function)
- `pick` (function)

### `functions/src/wasm/algebra/sparse/utilities.ts`

- `csPermute` (function)
- `csLeaf` (function)
- `csSpsolve` (function)

### `functions/src/wasm/geometry/operations.ts`

- `intersectLineCircle` (function)
- `intersectLineSphere` (function)
- `intersectCircles` (function)
- `projectPointOnLine2D` (function)
- `distancePointToLine2D` (function)
- `distancePointToPlane` (function)
- `polygonCentroid2D` (function)
- `polygonArea2D` (function)
- `pointInConvexPolygon2D` (function)

### `functions/src/wasm/matrix/linalg.ts`

- `lsolveUnit` (function)
- `lsolveMultiple` (function)
- `usolveMultiple` (function)

### `functions/src/wasm/signal/fft.ts`

- `powerSpectrum` (function)
- `magnitudeSpectrum` (function)
- `phaseSpectrum` (function)
- `crossCorrelation` (function)
- `autoCorrelation` (function)

### `functions/src/wasm/statistics/select.ts`

- `selectKSmallest` (function)
- `selectKLargest` (function)
- `selectQuantile` (function)
- `partitionSelectIndex` (function)

### `functions/src/wasm/WasmLoader.ts`

- `initWasm` (function)
- `WasmLoader` (class)
- `LoadingMetrics` (interface)

### `expression/src/error/IndexError.ts`

- `createIndexError` (function)

### `expression/src/node/Node.ts`

- `CompiledExpression` (interface)
- `StringOptions` (interface)

### `expression/src/utils/array.ts`

- `validate` (function)
- `validateIndexSourceSize` (function)
- `validateIndex` (function)
- `isEmptyIndex` (function)
- `resize` (function)
- `reshape` (function)
- `processSizesWildcard` (function)
- `squeeze` (function)
- `unsqueeze` (function)
- `flatten` (function)
- `filter` (function)
- `filterRegExp` (function)
- `identify` (function)
- `generalize` (function)
- `getArrayDataType` (function)
- `last` (function)
- `initial` (function)
- `concat` (function)
- `broadcastSizes` (function)
- `checkBroadcastingRules` (function)
- `broadcastTo` (function)
- `broadcastArrays` (function)
- `stretch` (function)
- `get` (function)
- `clone` (function)
- `IdentifiedValue` (interface)
- `NestedArray` (type)
- `ArrayOrScalar` (type)

### `expression/src/utils/bignumber/formatter.ts`

- `toEngineering` (function)
- `toExponential` (function)
- `toFixed` (function)

### `expression/src/utils/collection.ts`

- `containsCollections` (function)
- `deepForEach` (function)
- `reduce` (function)
- `scatter` (function)

### `expression/src/utils/factory.ts`

- `sortFactories` (function)
- `create` (function)
- `isFactory` (function)
- `assertDependencies` (function)
- `isOptionalDependency` (function)
- `stripOptionalNotation` (function)
- `FactoryFunction` (interface)
- `LegacyFactory` (interface)
- `FactoryMeta` (interface)
- `DependencyName` (type)
- `CreateFunction` (type)

### `expression/src/utils/is.ts`

- `isFraction` (function)
- `isDenseMatrix` (function)
- `isSparseMatrix` (function)
- `isIndex` (function)
- `isBoolean` (function)
- `isResultSet` (function)
- `isDate` (function)
- `isRegExp` (function)
- `isPartitionedMap` (function)
- `isObjectWrappingMap` (function)
- `isNull` (function)
- `isUndefined` (function)
- `isAssignmentNode` (function)
- `isBlockNode` (function)
- `isConditionalNode` (function)
- `isRangeNode` (function)
- `isRelationalNode` (function)
- `isChain` (function)
- `BigNumber` (interface)
- `Complex` (interface)
- `Fraction` (interface)
- `Unit` (interface)
- `DenseMatrix` (interface)
- `SparseMatrix` (interface)
- `Range` (interface)
- `ResultSet` (interface)
- `Help` (interface)
- `Chain` (interface)
- `Node` (interface)
- `AccessorNode` (interface)
- `ArrayNode` (interface)
- `AssignmentNode` (interface)
- `BlockNode` (interface)
- `ConditionalNode` (interface)
- `ConstantNode` (interface)
- `FunctionAssignmentNode` (interface)
- `FunctionNode` (interface)
- `IndexNode` (interface)
- `ObjectNode` (interface)
- `OperatorNode` (interface)
- `ParenthesisNode` (interface)
- `RangeNode` (interface)
- `RelationalNode` (interface)
- `SymbolNode` (interface)
- `PartitionedMap` (interface)

### `expression/src/utils/latex.ts`

- `latexSymbols` (constant)

### `expression/src/utils/map.ts`

- `assign` (function)

### `expression/src/utils/number.ts`

- `splitNumber` (function)
- `toEngineering` (function)
- `toFixed` (function)
- `toExponential` (function)
- `toPrecision` (function)
- `roundDigits` (function)
- `digits` (function)
- `nearlyEqual` (function)
- `copysign` (function)
- `SplitValue` (interface)
- `NumberTypeConfig` (interface)
- `FormatOptions` (interface)
- `NormalizedFormatOptions` (interface)
- `sign` (constant)
- `log2` (constant)
- `log10` (constant)
- `log1p` (constant)
- `cbrt` (constant)
- `expm1` (constant)
- `acosh` (constant)
- `asinh` (constant)
- `atanh` (constant)
- `cosh` (constant)
- `sinh` (constant)
- `tanh` (constant)

### `expression/src/utils/object.ts`

- `mapObject` (function)
- `extend` (function)
- `deepExtend` (function)
- `deepFlatten` (function)
- `canDefineProperty` (function)
- `lazy` (function)
- `traverse` (function)
- `isLegacyFactory` (function)
- `get` (function)
- `set` (function)
- `pick` (function)

### `expression/src/utils/string.ts`

- `endsWith` (function)
- `compareText` (function)

### `parallel/src/ComputePool.ts`

- `ComputePoolConfig` (interface)

### `parallel/src/strategies/chunk.ts`

- `memorySizeBytes` (function)

### `workbook/src/graph.ts`

- `detectCycles` (function)

### `workbook/src/index.ts`

- `VERSION` (constant)

### `workbook/src/types.ts`

- `WorkbookMetadata` (interface)
- `RuntimeConfig` (interface)
- `ExecutionMode` (type)

### `assembly/src/bindings/wasm-loader.ts`

- `MathTSWasmExports` (interface)
- `MathTSWasmInstance` (interface)

### `assembly/src/types/complex.ts`

- `complexFromReal` (function)
- `complexFromImaginary` (function)
- `COMPLEX_ZERO` (constant)
- `COMPLEX_ONE` (constant)
- `COMPLEX_I` (constant)
- `COMPLEX_NEG_ONE` (constant)

