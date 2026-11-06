/**
 * Scientific Toolkit Example
 *
 * Exercises a handful of the functions added in the 2026-11-04 gap closure
 * (functions@0.72.0): weighted/robust statistics and effect sizes, special
 * functions, quadrature and global optimization, number theory, integer
 * normal forms, real-root isolation, signal windows/systems, special matrices,
 * and computational geometry. Every printed value is deterministic.
 *
 * Run from repo root:
 *   bun --tsconfig-override=tsconfig.base.json examples/scientific-toolkit.ts
 */

import {
  // statistics
  weightedMean,
  weightedMedian,
  cohensD,
  hedgesG,
  theilSen,
  signTest,
  wassersteinDistance,
  // special functions
  erfinv,
  erfcx,
  dawson,
  expIntegralE1,
  sphericalBesselJ,
  besselJZeros,
  besselJ,
  wigner3j,
  clebschGordan,
  sphericalHarmonic,
  hurwitzZeta,
  dirichletEta,
  bernoulliPolynomial,
  // numerics
  tanhSinh,
  clenshawCurtis,
  dblquad,
  gaussHermiteIntegrate,
  finiteDifferenceCoefficients,
  ridders,
  fixedPoint,
  differentialEvolution,
  // number theory
  modPow,
  sqrtMod,
  legendreSymbol,
  isCarmichael,
  zeckendorf,
  pellSolve,
  linearDiophantine,
  frobeniusNumber,
  smithNormalForm,
  lll,
  realRoots,
  primitiveRoot,
  // signal
  kaiserWindow,
  tf2ss,
  dtw,
  // linear algebra
  hilbertMatrix,
  hadamardMatrix,
  subspaceAngles,
  // geometry
  orient2D,
  inCircle,
  polygonClip,
  douglasPeucker,
  hausdorffDistance,
} from '@danielsimonjr/mathts-functions';

const r = (x: number, d = 6) => Number(x.toFixed(d));

console.log('=== MathTS Scientific Toolkit (functions@0.72.0 additions) ===\n');

console.log('--- Weighted / robust statistics and effect sizes ---');
const x = [1, 2, 3, 4, 10];
const w = [1, 1, 1, 1, 4];
console.log('weightedMean(x, w) =', weightedMean(x, w));
console.log('weightedMedian(x, w) =', weightedMedian(x, w));
const control = [2.1, 2.5, 2.3, 2.8, 2.4];
const treatment = [3.1, 3.5, 2.9, 3.2, 3.4];
console.log('cohensD =', r(cohensD(control, treatment)));
console.log('hedgesG =', r(hedgesG(control, treatment)));
console.log('theilSen slope/intercept =', theilSen([0, 1, 2, 3, 4], [1, 3, 5, 7, 100]));
console.log('signTest([1,2,3,4,5,6,7,8,9,10], 0) =', signTest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0));
console.log('wassersteinDistance([0,1,2],[1,2,3]) =', wassersteinDistance([0, 1, 2], [1, 2, 3]));

console.log('\n--- Special functions ---');
console.log('erfinv(0.5) =', r(erfinv(0.5), 8));
console.log('erfcx(10) =', r(erfcx(10), 8), '(≈ 1/(10·sqrt(pi)))');
console.log('dawson(1) =', r(dawson(1), 8));
console.log('expIntegralE1(1) =', r(expIntegralE1(1), 8));
console.log('sphericalBesselJ(0, pi) =', r(sphericalBesselJ(0, Math.PI), 8), '(sin(pi)/pi = 0)');
console.log(
  'besselJZeros(0, 3) =',
  besselJZeros(0, 3).map((v) => r(v, 6))
);
console.log(
  'besselJ(0.5, 1) =',
  r(besselJ(0.5, 1) as number, 8),
  '(real order; = sqrt(2/pi)·sin(1))'
);
console.log('wigner3j(1,1,0, 0,0,0) =', r(wigner3j(1, 1, 0, 0, 0, 0), 8), '(= -1/sqrt(3))');
console.log(
  'clebschGordan(1/2,1/2, 1/2,-1/2, 0,0) =',
  r(clebschGordan(0.5, 0.5, 0.5, -0.5, 0, 0), 8)
);
console.log(
  'sphericalHarmonic(1, 0, 0, 0) =',
  sphericalHarmonic(1, 0, 0, 0).toString(),
  '(= sqrt(3/(4pi)))'
);
console.log('hurwitzZeta(2, 1) =', r(hurwitzZeta(2, 1), 8), '(= pi^2/6)');
console.log('dirichletEta(1) =', r(dirichletEta(1), 8), '(= ln 2)');
console.log('bernoulliPolynomial(3, 0.5) =', bernoulliPolynomial(3, 0.5));

console.log('\n--- Quadrature, derivatives, solvers, global optimization ---');
const gauss = (t: number) => Math.exp(-t * t);
console.log(
  'tanhSinh(exp(-x^2), -5, 5) =',
  r(tanhSinh(gauss, -5, 5).value, 10),
  '(sqrt(pi) = 1.7724538509)'
);
console.log('clenshawCurtis(exp(-x^2), -5, 5, 64) =', r(clenshawCurtis(gauss, -5, 5, 64), 10));
console.log(
  'dblquad(x*y over [0,1]^2) =',
  r(dblquad((y, xx) => xx * y, 0, 1, 0, 1).value, 10),
  '(= 0.25)'
);
console.log(
  'gaussHermiteIntegrate(x^2, 10) =',
  r(
    gaussHermiteIntegrate((t) => t * t, 10),
    10
  ),
  '(= sqrt(pi)/2)'
);
console.log(
  'finiteDifferenceCoefficients(2, [-1,0,1]) =',
  finiteDifferenceCoefficients(2, [-1, 0, 1])
);
console.log(
  'ridders(cos(x) - x, 0, 1) =',
  r(
    ridders((t) => Math.cos(t) - t, 0, 1),
    10
  )
);
console.log('fixedPoint(cos, 1) =', r(fixedPoint(Math.cos, 1), 10));
const rosen = ([a, b]: number[]) => (1 - a) ** 2 + 100 * (b - a * a) ** 2;
const de = differentialEvolution(
  rosen,
  [
    [-5, 5],
    [-5, 5],
  ],
  { seed: 1 }
);
console.log(
  'differentialEvolution(rosenbrock) x =',
  de.x.map((v) => r(v, 4)),
  'fx =',
  r(de.fx, 8),
  'converged =',
  de.converged
);

console.log('\n--- Number theory ---');
console.log('modPow(2, 100, 1_000_000_007) =', modPow(2, 100, 1_000_000_007));
console.log('sqrtMod(2, 7) =', sqrtMod(2, 7), '(3^2 = 9 ≡ 2 mod 7)');
console.log(
  'legendreSymbol(2, 7) =',
  legendreSymbol(2, 7),
  ' legendreSymbol(3, 7) =',
  legendreSymbol(3, 7)
);
console.log('isCarmichael(561) =', isCarmichael(561), ' isCarmichael(560) =', isCarmichael(560));
console.log('zeckendorf(100) =', zeckendorf(100));
console.log('pellSolve(61) =', pellSolve(61));
console.log('linearDiophantine(3, 5, 1) =', linearDiophantine(3, 5, 1));
console.log('frobeniusNumber([6, 9, 20]) =', frobeniusNumber([6, 9, 20]), '(McNuggets)');
console.log('primitiveRoot(7) =', primitiveRoot(7));
console.log(
  'smithNormalForm([[2,4,4],[-6,6,12],[10,-4,-16]]) =',
  smithNormalForm([
    [2, 4, 4],
    [-6, 6, 12],
    [10, -4, -16],
  ]).invariants
);
console.log(
  'lll([[1,1,1],[-1,0,2],[3,5,6]]) =',
  lll([
    [1, 1, 1],
    [-1, 0, 2],
    [3, 5, 6],
  ])
);
console.log(
  'realRoots(-6 + 11x - 6x^2 + x^3) =',
  realRoots([-6, 11, -6, 1]).map((v) => r(v, 8))
);

console.log('\n--- Signal processing ---');
console.log(
  'kaiserWindow(5, 2) =',
  kaiserWindow(5, 2).map((v) => r(v, 6))
);
console.log('tf2ss([1], [1, 3, 2]) =', JSON.stringify(tf2ss([1], [1, 3, 2])));
const warp = dtw([1, 2, 3], [1, 2, 2, 3]);
console.log(
  'dtw([1,2,3],[1,2,2,3]) distance =',
  warp.distance,
  'path =',
  JSON.stringify(warp.path)
);

console.log('\n--- Special matrices and subspaces ---');
console.log('hilbertMatrix(3) =', JSON.stringify(hilbertMatrix(3)));
console.log('hadamardMatrix(4) =', JSON.stringify(hadamardMatrix(4)));
console.log(
  'subspaceAngles(e1, e2) =',
  subspaceAngles([[1], [0]], [[0], [1]]).map((v) => r(v, 8)),
  '(= pi/2)'
);

console.log('\n--- Computational geometry ---');
console.log(
  'orient2D((0,0),(1,0),(0,1)) =',
  orient2D([0, 0], [1, 0], [0, 1]),
  '(counter-clockwise)'
);
console.log(
  'inCircle(unit circle, origin) =',
  inCircle([1, 0], [0, 1], [-1, 0], [0, 0]),
  '(inside)'
);
const square = [
  [0, 0],
  [2, 0],
  [2, 2],
  [0, 2],
] as [number, number][];
const clip = [
  [1, 1],
  [3, 1],
  [3, 3],
  [1, 3],
] as [number, number][];
console.log('polygonClip(square, offset square) =', JSON.stringify(polygonClip(square, clip)));
const noisy = [
  [0, 0],
  [1, 0.1],
  [2, -0.1],
  [3, 5],
  [4, 6],
  [5, 7],
] as [number, number][];
console.log('douglasPeucker(noisy, 0.5) =', JSON.stringify(douglasPeucker(noisy, 0.5)));
console.log(
  'hausdorffDistance(square, clip) =',
  r(hausdorffDistance(square, clip), 8),
  '(= sqrt(2))'
);
