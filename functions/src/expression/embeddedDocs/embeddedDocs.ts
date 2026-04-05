import { eDocs } from './constants/e.js'
import { falseDocs } from './constants/false.js'
import { iDocs } from './constants/i.js'
import { InfinityDocs } from './constants/Infinity.js'
import { LN10Docs } from './constants/LN10.js'
import { LN2Docs } from './constants/LN2.js'
import { LOG10EDocs } from './constants/LOG10E.js'
import { LOG2EDocs } from './constants/LOG2E.js'
import { NaNDocs } from './constants/NaN.js'
import { nullDocs } from './constants/null.js'
import { phiDocs } from './constants/phi.js'
import { piDocs } from './constants/pi.js'
import { SQRT12Docs } from './constants/SQRT1_2.js'
import { SQRT2Docs } from './constants/SQRT2.js'
import { tauDocs } from './constants/tau.js'
import { trueDocs } from './constants/true.js'
import { versionDocs } from './constants/version.js'
import { bignumberDocs } from './construction/bignumber.js'
import { bigintDocs } from './construction/bigint.js'
import { booleanDocs } from './construction/boolean.js'
import { complexDocs } from './construction/complex.js'
import { createUnitDocs } from './construction/createUnit.js'
import { fractionDocs } from './construction/fraction.js'
import { indexDocs } from './construction/index.js'
import { matrixDocs } from './construction/matrix.js'
import { numberDocs } from './construction/number.js'
import { sparseDocs } from './construction/sparse.js'
import { splitUnitDocs } from './construction/splitUnit.js'
import { stringDocs } from './construction/string.js'
import { unitDocs } from './construction/unit.js'
import { configDocs } from './core/config.js'
import { importDocs } from './core/import.js'
import { typedDocs } from './core/typed.js'
import { derivativeDocs } from './algebra/derivative.js'
import { leafCountDocs } from './algebra/leafCount.js'
import { lsolveDocs } from './algebra/lsolve.js'
import { lsolveAllDocs } from './algebra/lsolveAll.js'
import { lupDocs } from './algebra/lup.js'
import { lusolveDocs } from './algebra/lusolve.js'
import { polynomialRootDocs } from './algebra/polynomialRoot.js'
import { qrDocs } from './algebra/qr.js'
import { rationalizeDocs } from './algebra/rationalize.js'
import { resolveDocs } from './algebra/resolve.js'
import { simplifyDocs } from './algebra/simplify.js'
import { simplifyConstantDocs } from './algebra/simplifyConstant.js'
import { simplifyCoreDocs } from './algebra/simplifyCore.js'
import { sluDocs } from './algebra/slu.js'
import { symbolicEqualDocs } from './algebra/symbolicEqual.js'
import { usolveDocs } from './algebra/usolve.js'
import { usolveAllDocs } from './algebra/usolveAll.js'
import { absDocs } from './arithmetic/abs.js'
import { addDocs } from './arithmetic/add.js'
import { cbrtDocs } from './arithmetic/cbrt.js'
import { ceilDocs } from './arithmetic/ceil.js'
import { cubeDocs } from './arithmetic/cube.js'
import { divideDocs } from './arithmetic/divide.js'
import { dotDivideDocs } from './arithmetic/dotDivide.js'
import { dotMultiplyDocs } from './arithmetic/dotMultiply.js'
import { dotPowDocs } from './arithmetic/dotPow.js'
import { expDocs } from './arithmetic/exp.js'
import { expmDocs } from './arithmetic/expm.js'
import { expm1Docs } from './arithmetic/expm1.js'
import { fixDocs } from './arithmetic/fix.js'
import { floorDocs } from './arithmetic/floor.js'
import { gcdDocs } from './arithmetic/gcd.js'
import { hypotDocs } from './arithmetic/hypot.js'
import { invmodDocs } from './arithmetic/invmod.js'
import { lcmDocs } from './arithmetic/lcm.js'
import { logDocs } from './arithmetic/log.js'
import { log10Docs } from './arithmetic/log10.js'
import { log1pDocs } from './arithmetic/log1p.js'
import { log2Docs } from './arithmetic/log2.js'
import { modDocs } from './arithmetic/mod.js'
import { multiplyDocs } from './arithmetic/multiply.js'
import { normDocs } from './arithmetic/norm.js'
import { nthRootDocs } from './arithmetic/nthRoot.js'
import { nthRootsDocs } from './arithmetic/nthRoots.js'
import { powDocs } from './arithmetic/pow.js'
import { roundDocs } from './arithmetic/round.js'
import { signDocs } from './arithmetic/sign.js'
import { sqrtDocs } from './arithmetic/sqrt.js'
import { sqrtmDocs } from './arithmetic/sqrtm.js'
import { sylvesterDocs } from './algebra/sylvester.js'
import { schurDocs } from './algebra/schur.js'
import { lyapDocs } from './algebra/lyap.js'
import { squareDocs } from './arithmetic/square.js'
import { subtractDocs } from './arithmetic/subtract.js'
import { unaryMinusDocs } from './arithmetic/unaryMinus.js'
import { unaryPlusDocs } from './arithmetic/unaryPlus.js'
import { xgcdDocs } from './arithmetic/xgcd.js'
import { bitAndDocs } from './bitwise/bitAnd.js'
import { bitNotDocs } from './bitwise/bitNot.js'
import { bitOrDocs } from './bitwise/bitOr.js'
import { bitXorDocs } from './bitwise/bitXor.js'
import { leftShiftDocs } from './bitwise/leftShift.js'
import { rightArithShiftDocs } from './bitwise/rightArithShift.js'
import { rightLogShiftDocs } from './bitwise/rightLogShift.js'
import { bellNumbersDocs } from './combinatorics/bellNumbers.js'
import { catalanDocs } from './combinatorics/catalan.js'
import { compositionDocs } from './combinatorics/composition.js'
import { stirlingS2Docs } from './combinatorics/stirlingS2.js'
import { argDocs } from './complex/arg.js'
import { conjDocs } from './complex/conj.js'
import { imDocs } from './complex/im.js'
import { reDocs } from './complex/re.js'
import { evaluateDocs } from './expression/evaluate.js'
import { parserDocs } from './expression/parser.js'
import { parseDocs } from './expression/parse.js'
import { compileDocs } from './expression/compile.js'
import { helpDocs } from './expression/help.js'
import { distanceDocs } from './geometry/distance.js'
import { intersectDocs } from './geometry/intersect.js'
import { andDocs } from './logical/and.js'
import { notDocs } from './logical/not.js'
import { nullishDocs } from './logical/nullish.js'
import { orDocs } from './logical/or.js'
import { xorDocs } from './logical/xor.js'
import { mapSlicesDocs } from './matrix/mapSlices.js'
import { columnDocs } from './matrix/column.js'
import { concatDocs } from './matrix/concat.js'
import { countDocs } from './matrix/count.js'
import { crossDocs } from './matrix/cross.js'
import { ctransposeDocs } from './matrix/ctranspose.js'
import { detDocs } from './matrix/det.js'
import { diagDocs } from './matrix/diag.js'
import { diffDocs } from './matrix/diff.js'
import { dotDocs } from './matrix/dot.js'
import { eigsDocs } from './matrix/eigs.js'
import { filterDocs } from './matrix/filter.js'
import { flattenDocs } from './matrix/flatten.js'
import { forEachDocs } from './matrix/forEach.js'
import { getMatrixDataTypeDocs } from './matrix/getMatrixDataType.js'
import { identityDocs } from './matrix/identity.js'
import { invDocs } from './matrix/inv.js'
import { pinvDocs } from './matrix/pinv.js'
import { kronDocs } from './matrix/kron.js'
import { mapDocs } from './matrix/map.js'
import { matrixFromColumnsDocs } from './matrix/matrixFromColumns.js'
import { matrixFromFunctionDocs } from './matrix/matrixFromFunction.js'
import { matrixFromRowsDocs } from './matrix/matrixFromRows.js'
import { onesDocs } from './matrix/ones.js'
import { partitionSelectDocs } from './matrix/partitionSelect.js'
import { rangeDocs } from './matrix/range.js'
import { reshapeDocs } from './matrix/reshape.js'
import { resizeDocs } from './matrix/resize.js'
import { rotateDocs } from './matrix/rotate.js'
import { rotationMatrixDocs } from './matrix/rotationMatrix.js'
import { rowDocs } from './matrix/row.js'
import { sizeDocs } from './matrix/size.js'
import { sortDocs } from './matrix/sort.js'
import { squeezeDocs } from './matrix/squeeze.js'
import { subsetDocs } from './matrix/subset.js'
import { traceDocs } from './matrix/trace.js'
import { transposeDocs } from './matrix/transpose.js'
import { zerosDocs } from './matrix/zeros.js'
import { fftDocs } from './matrix/fft.js'
import { ifftDocs } from './matrix/ifft.js'
import { bernoulliDocs } from './probability/bernoulli.js'
import { combinationsDocs } from './probability/combinations.js'
import { combinationsWithRepDocs } from './probability/combinationsWithRep.js'
import { factorialDocs } from './probability/factorial.js'
import { gammaDocs } from './probability/gamma.js'
import { lgammaDocs } from './probability/lgamma.js'
import { kldivergenceDocs } from './probability/kldivergence.js'
import { multinomialDocs } from './probability/multinomial.js'
import { permutationsDocs } from './probability/permutations.js'
import { pickRandomDocs } from './probability/pickRandom.js'
import { randomDocs } from './probability/random.js'
import { randomIntDocs } from './probability/randomInt.js'
import { compareDocs } from './relational/compare.js'
import { compareNaturalDocs } from './relational/compareNatural.js'
import { compareTextDocs } from './relational/compareText.js'
import { deepEqualDocs } from './relational/deepEqual.js'
import { equalDocs } from './relational/equal.js'
import { equalTextDocs } from './relational/equalText.js'
import { largerDocs } from './relational/larger.js'
import { largerEqDocs } from './relational/largerEq.js'
import { smallerDocs } from './relational/smaller.js'
import { smallerEqDocs } from './relational/smallerEq.js'
import { unequalDocs } from './relational/unequal.js'
import { setCartesianDocs } from './set/setCartesian.js'
import { setDifferenceDocs } from './set/setDifference.js'
import { setDistinctDocs } from './set/setDistinct.js'
import { setIntersectDocs } from './set/setIntersect.js'
import { setIsSubsetDocs } from './set/setIsSubset.js'
import { setMultiplicityDocs } from './set/setMultiplicity.js'
import { setPowersetDocs } from './set/setPowerset.js'
import { setSizeDocs } from './set/setSize.js'
import { setSymDifferenceDocs } from './set/setSymDifference.js'
import { setUnionDocs } from './set/setUnion.js'
import { zpk2tfDocs } from './signal/zpk2tf.js'
import { freqzDocs } from './signal/freqz.js'
import { erfDocs } from './special/erf.js'
import { zetaDocs } from './special/zeta.js'
import { madDocs } from './statistics/mad.js'
import { maxDocs } from './statistics/max.js'
import { meanDocs } from './statistics/mean.js'
import { medianDocs } from './statistics/median.js'
import { minDocs } from './statistics/min.js'
import { modeDocs } from './statistics/mode.js'
import { prodDocs } from './statistics/prod.js'
import { quantileSeqDocs } from './statistics/quantileSeq.js'
import { stdDocs } from './statistics/std.js'
import { cumSumDocs } from './statistics/cumsum.js'
import { sumDocs } from './statistics/sum.js'
import { varianceDocs } from './statistics/variance.js'
import { corrDocs } from './statistics/corr.js'
import { acosDocs } from './trigonometry/acos.js'
import { acoshDocs } from './trigonometry/acosh.js'
import { acotDocs } from './trigonometry/acot.js'
import { acothDocs } from './trigonometry/acoth.js'
import { acscDocs } from './trigonometry/acsc.js'
import { acschDocs } from './trigonometry/acsch.js'
import { asecDocs } from './trigonometry/asec.js'
import { asechDocs } from './trigonometry/asech.js'
import { asinDocs } from './trigonometry/asin.js'
import { asinhDocs } from './trigonometry/asinh.js'
import { atanDocs } from './trigonometry/atan.js'
import { atan2Docs } from './trigonometry/atan2.js'
import { atanhDocs } from './trigonometry/atanh.js'
import { cosDocs } from './trigonometry/cos.js'
import { coshDocs } from './trigonometry/cosh.js'
import { cotDocs } from './trigonometry/cot.js'
import { cothDocs } from './trigonometry/coth.js'
import { cscDocs } from './trigonometry/csc.js'
import { cschDocs } from './trigonometry/csch.js'
import { secDocs } from './trigonometry/sec.js'
import { sechDocs } from './trigonometry/sech.js'
import { sinDocs } from './trigonometry/sin.js'
import { sinhDocs } from './trigonometry/sinh.js'
import { tanDocs } from './trigonometry/tan.js'
import { tanhDocs } from './trigonometry/tanh.js'
import { toDocs } from './units/to.js'
import { toBestDocs } from './units/toBest.js'
import { binDocs } from './utils/bin.js'
import { cloneDocs } from './utils/clone.js'
import { formatDocs } from './utils/format.js'
import { hasNumericValueDocs } from './utils/hasNumericValue.js'
import { hexDocs } from './utils/hex.js'
import { isIntegerDocs } from './utils/isInteger.js'
import { isNaNDocs } from './utils/isNaN.js'
import { isBoundedDocs } from './utils/isBounded.js'
import { isFiniteDocs } from './utils/isFinite.js'
import { isNegativeDocs } from './utils/isNegative.js'
import { isNumericDocs } from './utils/isNumeric.js'
import { isPositiveDocs } from './utils/isPositive.js'
import { isPrimeDocs } from './utils/isPrime.js'
import { isZeroDocs } from './utils/isZero.js'
import { numericDocs } from './utils/numeric.js'
import { octDocs } from './utils/oct.js'
import { printDocs } from './utils/print.js'
import { typeOfDocs } from './utils/typeOf.js'
import { solveODEDocs } from './numeric/solveODE.js'

export const embeddedDocs = {
  // construction functions
  bignumber: bignumberDocs,
  bigint: bigintDocs,
  boolean: booleanDocs,
  complex: complexDocs,
  createUnit: createUnitDocs,
  fraction: fractionDocs,
  index: indexDocs,
  matrix: matrixDocs,
  number: numberDocs,
  sparse: sparseDocs,
  splitUnit: splitUnitDocs,
  string: stringDocs,
  unit: unitDocs,

  // constants
  e: eDocs,
  E: eDocs,
  false: falseDocs,
  i: iDocs,
  Infinity: InfinityDocs,
  LN2: LN2Docs,
  LN10: LN10Docs,
  LOG2E: LOG2EDocs,
  LOG10E: LOG10EDocs,
  NaN: NaNDocs,
  null: nullDocs,
  pi: piDocs,
  PI: piDocs,
  phi: phiDocs,
  SQRT1_2: SQRT12Docs,
  SQRT2: SQRT2Docs,
  tau: tauDocs,
  true: trueDocs,
  version: versionDocs,

  // physical constants
  // TODO: more detailed docs for physical constants
  speedOfLight: {
    description: 'Speed of light in vacuum',
    examples: ['speedOfLight']
  },
  gravitationConstant: {
    description: 'Newtonian constant of gravitation',
    examples: ['gravitationConstant']
  },
  planckConstant: {
    description: 'Planck constant',
    examples: ['planckConstant']
  },
  reducedPlanckConstant: {
    description: 'Reduced Planck constant',
    examples: ['reducedPlanckConstant']
  },

  magneticConstant: {
    description: 'Magnetic constant (vacuum permeability)',
    examples: ['magneticConstant']
  },
  electricConstant: {
    description: 'Electric constant (vacuum permeability)',
    examples: ['electricConstant']
  },
  vacuumImpedance: {
    description: 'Characteristic impedance of vacuum',
    examples: ['vacuumImpedance']
  },
  coulomb: {
    description: "Coulomb's constant. Deprecated in favor of coulombConstant",
    examples: ['coulombConstant']
  },
  coulombConstant: {
    description: "Coulomb's constant",
    examples: ['coulombConstant']
  },
  elementaryCharge: {
    description: 'Elementary charge',
    examples: ['elementaryCharge']
  },
  bohrMagneton: { description: 'Bohr magneton', examples: ['bohrMagneton'] },
  conductanceQuantum: {
    description: 'Conductance quantum',
    examples: ['conductanceQuantum']
  },
  inverseConductanceQuantum: {
    description: 'Inverse conductance quantum',
    examples: ['inverseConductanceQuantum']
  },
  // josephson: {description: 'Josephson constant', examples: ['josephson']},
  magneticFluxQuantum: {
    description: 'Magnetic flux quantum',
    examples: ['magneticFluxQuantum']
  },
  nuclearMagneton: {
    description: 'Nuclear magneton',
    examples: ['nuclearMagneton']
  },
  klitzing: { description: 'Von Klitzing constant', examples: ['klitzing'] },

  bohrRadius: { description: 'Bohr radius', examples: ['bohrRadius'] },
  classicalElectronRadius: {
    description: 'Classical electron radius',
    examples: ['classicalElectronRadius']
  },
  electronMass: { description: 'Electron mass', examples: ['electronMass'] },
  fermiCoupling: {
    description: 'Fermi coupling constant',
    examples: ['fermiCoupling']
  },
  fineStructure: {
    description: 'Fine-structure constant',
    examples: ['fineStructure']
  },
  hartreeEnergy: { description: 'Hartree energy', examples: ['hartreeEnergy'] },
  protonMass: { description: 'Proton mass', examples: ['protonMass'] },
  deuteronMass: { description: 'Deuteron Mass', examples: ['deuteronMass'] },
  neutronMass: { description: 'Neutron mass', examples: ['neutronMass'] },
  quantumOfCirculation: {
    description: 'Quantum of circulation',
    examples: ['quantumOfCirculation']
  },
  rydberg: { description: 'Rydberg constant', examples: ['rydberg'] },
  thomsonCrossSection: {
    description: 'Thomson cross section',
    examples: ['thomsonCrossSection']
  },
  weakMixingAngle: {
    description: 'Weak mixing angle',
    examples: ['weakMixingAngle']
  },
  efimovFactor: { description: 'Efimov factor', examples: ['efimovFactor'] },

  atomicMass: { description: 'Atomic mass constant', examples: ['atomicMass'] },
  avogadro: { description: "Avogadro's number", examples: ['avogadro'] },
  boltzmann: { description: 'Boltzmann constant', examples: ['boltzmann'] },
  faraday: { description: 'Faraday constant', examples: ['faraday'] },
  firstRadiation: {
    description: 'First radiation constant',
    examples: ['firstRadiation']
  },
  loschmidt: {
    description: 'Loschmidt constant at T=273.15 K and p=101.325 kPa',
    examples: ['loschmidt']
  },
  gasConstant: { description: 'Gas constant', examples: ['gasConstant'] },
  molarPlanckConstant: {
    description: 'Molar Planck constant',
    examples: ['molarPlanckConstant']
  },
  molarVolume: {
    description: 'Molar volume of an ideal gas at T=273.15 K and p=101.325 kPa',
    examples: ['molarVolume']
  },
  sackurTetrode: {
    description: 'Sackur-Tetrode constant at T=1 K and p=101.325 kPa',
    examples: ['sackurTetrode']
  },
  secondRadiation: {
    description: 'Second radiation constant',
    examples: ['secondRadiation']
  },
  stefanBoltzmann: {
    description: 'Stefan-Boltzmann constant',
    examples: ['stefanBoltzmann']
  },
  wienDisplacement: {
    description: 'Wien displacement law constant',
    examples: ['wienDisplacement']
  },
  // spectralRadiance: {description: 'First radiation constant for spectral radiance', examples: ['spectralRadiance']},

  molarMass: { description: 'Molar mass constant', examples: ['molarMass'] },
  molarMassC12: {
    description: 'Molar mass constant of carbon-12',
    examples: ['molarMassC12']
  },
  gravity: {
    description:
      'Standard acceleration of gravity (standard acceleration of free-fall on Earth)',
    examples: ['gravity']
  },

  planckLength: { description: 'Planck length', examples: ['planckLength'] },
  planckMass: { description: 'Planck mass', examples: ['planckMass'] },
  planckTime: { description: 'Planck time', examples: ['planckTime'] },
  planckCharge: { description: 'Planck charge', examples: ['planckCharge'] },
  planckTemperature: {
    description: 'Planck temperature',
    examples: ['planckTemperature']
  },

  // functions - algebra
  derivative: derivativeDocs,
  lsolve: lsolveDocs,
  lsolveAll: lsolveAllDocs,
  lup: lupDocs,
  lusolve: lusolveDocs,
  leafCount: leafCountDocs,
  polynomialRoot: polynomialRootDocs,
  resolve: resolveDocs,
  simplify: simplifyDocs,
  simplifyConstant: simplifyConstantDocs,
  simplifyCore: simplifyCoreDocs,
  symbolicEqual: symbolicEqualDocs,
  rationalize: rationalizeDocs,
  slu: sluDocs,
  usolve: usolveDocs,
  usolveAll: usolveAllDocs,
  qr: qrDocs,

  // functions - arithmetic
  abs: absDocs,
  add: addDocs,
  cbrt: cbrtDocs,
  ceil: ceilDocs,
  cube: cubeDocs,
  divide: divideDocs,
  dotDivide: dotDivideDocs,
  dotMultiply: dotMultiplyDocs,
  dotPow: dotPowDocs,
  exp: expDocs,
  expm: expmDocs,
  expm1: expm1Docs,
  fix: fixDocs,
  floor: floorDocs,
  gcd: gcdDocs,
  hypot: hypotDocs,
  lcm: lcmDocs,
  log: logDocs,
  log2: log2Docs,
  log1p: log1pDocs,
  log10: log10Docs,
  mod: modDocs,
  multiply: multiplyDocs,
  norm: normDocs,
  nthRoot: nthRootDocs,
  nthRoots: nthRootsDocs,
  pow: powDocs,
  round: roundDocs,
  sign: signDocs,
  sqrt: sqrtDocs,
  sqrtm: sqrtmDocs,
  square: squareDocs,
  subtract: subtractDocs,
  unaryMinus: unaryMinusDocs,
  unaryPlus: unaryPlusDocs,
  xgcd: xgcdDocs,
  invmod: invmodDocs,

  // functions - bitwise
  bitAnd: bitAndDocs,
  bitNot: bitNotDocs,
  bitOr: bitOrDocs,
  bitXor: bitXorDocs,
  leftShift: leftShiftDocs,
  rightArithShift: rightArithShiftDocs,
  rightLogShift: rightLogShiftDocs,

  // functions - combinatorics
  bellNumbers: bellNumbersDocs,
  catalan: catalanDocs,
  composition: compositionDocs,
  stirlingS2: stirlingS2Docs,

  // functions - core
  config: configDocs,
  import: importDocs,
  typed: typedDocs,

  // functions - complex
  arg: argDocs,
  conj: conjDocs,
  re: reDocs,
  im: imDocs,

  // functions - expression
  evaluate: evaluateDocs,
  help: helpDocs,
  parse: parseDocs,
  parser: parserDocs,
  compile: compileDocs,

  // functions - geometry
  distance: distanceDocs,
  intersect: intersectDocs,

  // functions - logical
  and: andDocs,
  not: notDocs,
  nullish: nullishDocs,
  or: orDocs,
  xor: xorDocs,

  // functions - matrix
  mapSlices: mapSlicesDocs,
  concat: concatDocs,
  count: countDocs,
  cross: crossDocs,
  column: columnDocs,
  ctranspose: ctransposeDocs,
  det: detDocs,
  diag: diagDocs,
  diff: diffDocs,
  dot: dotDocs,
  getMatrixDataType: getMatrixDataTypeDocs,
  identity: identityDocs,
  filter: filterDocs,
  flatten: flattenDocs,
  forEach: forEachDocs,
  inv: invDocs,
  pinv: pinvDocs,
  eigs: eigsDocs,
  kron: kronDocs,
  matrixFromFunction: matrixFromFunctionDocs,
  matrixFromRows: matrixFromRowsDocs,
  matrixFromColumns: matrixFromColumnsDocs,
  map: mapDocs,
  ones: onesDocs,
  partitionSelect: partitionSelectDocs,
  range: rangeDocs,
  resize: resizeDocs,
  reshape: reshapeDocs,
  rotate: rotateDocs,
  rotationMatrix: rotationMatrixDocs,
  row: rowDocs,
  size: sizeDocs,
  sort: sortDocs,
  squeeze: squeezeDocs,
  subset: subsetDocs,
  trace: traceDocs,
  transpose: transposeDocs,
  zeros: zerosDocs,
  fft: fftDocs,
  ifft: ifftDocs,
  sylvester: sylvesterDocs,
  schur: schurDocs,
  lyap: lyapDocs,

  // functions - numeric
  solveODE: solveODEDocs,

  // functions - probability
  bernoulli: bernoulliDocs,
  combinations: combinationsDocs,
  combinationsWithRep: combinationsWithRepDocs,
  // distribution: distributionDocs,
  factorial: factorialDocs,
  gamma: gammaDocs,
  kldivergence: kldivergenceDocs,
  lgamma: lgammaDocs,
  multinomial: multinomialDocs,
  permutations: permutationsDocs,
  pickRandom: pickRandomDocs,
  random: randomDocs,
  randomInt: randomIntDocs,

  // functions - relational
  compare: compareDocs,
  compareNatural: compareNaturalDocs,
  compareText: compareTextDocs,
  deepEqual: deepEqualDocs,
  equal: equalDocs,
  equalText: equalTextDocs,
  larger: largerDocs,
  largerEq: largerEqDocs,
  smaller: smallerDocs,
  smallerEq: smallerEqDocs,
  unequal: unequalDocs,

  // functions - set
  setCartesian: setCartesianDocs,
  setDifference: setDifferenceDocs,
  setDistinct: setDistinctDocs,
  setIntersect: setIntersectDocs,
  setIsSubset: setIsSubsetDocs,
  setMultiplicity: setMultiplicityDocs,
  setPowerset: setPowersetDocs,
  setSize: setSizeDocs,
  setSymDifference: setSymDifferenceDocs,
  setUnion: setUnionDocs,

  // functions - signal
  zpk2tf: zpk2tfDocs,
  freqz: freqzDocs,

  // functions - special
  erf: erfDocs,
  zeta: zetaDocs,

  // functions - statistics
  cumsum: cumSumDocs,
  mad: madDocs,
  max: maxDocs,
  mean: meanDocs,
  median: medianDocs,
  min: minDocs,
  mode: modeDocs,
  prod: prodDocs,
  quantileSeq: quantileSeqDocs,
  std: stdDocs,
  sum: sumDocs,
  variance: varianceDocs,
  corr: corrDocs,

  // functions - trigonometry
  acos: acosDocs,
  acosh: acoshDocs,
  acot: acotDocs,
  acoth: acothDocs,
  acsc: acscDocs,
  acsch: acschDocs,
  asec: asecDocs,
  asech: asechDocs,
  asin: asinDocs,
  asinh: asinhDocs,
  atan: atanDocs,
  atanh: atanhDocs,
  atan2: atan2Docs,
  cos: cosDocs,
  cosh: coshDocs,
  cot: cotDocs,
  coth: cothDocs,
  csc: cscDocs,
  csch: cschDocs,
  sec: secDocs,
  sech: sechDocs,
  sin: sinDocs,
  sinh: sinhDocs,
  tan: tanDocs,
  tanh: tanhDocs,

  // functions - units
  to: toDocs,
  toBest: toBestDocs,

  // functions - utils
  clone: cloneDocs,
  format: formatDocs,
  bin: binDocs,
  oct: octDocs,
  hex: hexDocs,
  isNaN: isNaNDocs,
  isBounded: isBoundedDocs,
  isFinite: isFiniteDocs,
  isInteger: isIntegerDocs,
  isNegative: isNegativeDocs,
  isNumeric: isNumericDocs,
  hasNumericValue: hasNumericValueDocs,
  isPositive: isPositiveDocs,
  isPrime: isPrimeDocs,
  isZero: isZeroDocs,
  print: printDocs,
  typeOf: typeOfDocs,
  numeric: numericDocs
}
