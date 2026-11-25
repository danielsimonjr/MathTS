#!/usr/bin/env node
/**
 * One-shot builder: proposals.json + adjudication overrides → classification.json
 */
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('.', import.meta.url);
const proposals = JSON.parse(
  readFileSync(new URL('proposals.json', root), 'utf8'),
);

const OVERRIDE = {
  1597: {
    secondary_families: ['functions.cas-transforms'],
    rationale:
      'casSimplify/collect/fullSimplify in typed/cas.ts and typed/algebra.ts; zTransform placeholder is transforms family (typed/cas.ts).',
  },
  1599: {
    secondary_families: [
      'functions.array-sorting',
      'functions.polynomials',
      'functions.numbertheory',
      'functions.optimization',
    ],
    rationale:
      'Cross-family bug batch: pchip (interpolation), sort-NaN (array-sorting), polyval arrays (polynomials), continuedFraction (numbertheory/extra.ts), minimizeConstrained (optimization).',
  },
  1601: {
    secondary_families: [],
    rationale:
      'All five bugs are in functions matrix-ops/numeric (jordanForm, funm, matrixRank, eigsh, solveBanded); matrix/src decompositions are not implicated.',
  },
  1606: {
    secondary_families: ['functions.geometry'],
    rationale:
      'Degree/pi-scaled trig variants are new trigonometry code; haversine rows belong with geometry-extra.ts (secondary).',
  },
  1607: {
    family: 'numbers.machine-limits',
    secondary_families: ['numbers.intervals', 'numbers.precision-metadata'],
    rationale:
      'NUMBERS-1 spans machine constants (core/BigNumber), interval arithmetic (functions/numeric/interval.ts), and proposed Precision/Accuracy metadata.',
  },
  1649: {
    secondary_families: [],
    rationale:
      'Throughput rows target scalar-search/scalar-compile parallelism and tape cache, not general optimization routines.',
  },
  1693: {
    secondary_families: ['statistics.regression-models'],
    rationale:
      'P0 fitlm row overlaps #1688; DOE/industrial plus regression-models for LinearModel parity.',
  },
  1708: {
    secondary_families: ['tensor.dtypes'],
    rationale:
      'Tensor ndarray methods and einsum in tensor/src; astype/dtype overlap with #1707 (secondary tensor.dtypes).',
  },
  1713: {
    secondary_families: ['functions.geometry'],
    rationale:
      'Row 1 plot helpers in plot/src; mesh/coordinate converter rows use typed/geometry coordinateTransform and matrix mesh builders.',
  },
};

const PKG_TO_LABEL = {
  '@danielsimonjr/mathts-statistics': 'statistics',
  '@danielsimonjr/mathts-signal': 'signal',
  '@danielsimonjr/mathts-functions': 'functions',
  '@danielsimonjr/mathts-linalg': 'linalg',
  '@danielsimonjr/mathts-tensor': 'tensor',
  '@danielsimonjr/mathts-units': 'units',
  '@danielsimonjr/mathts-numbers': 'numbers',
  '@danielsimonjr/mathts-arithmetic': 'arithmetic',
  '@danielsimonjr/mathts-trigonometry': 'trigonometry',
  '@danielsimonjr/mathts-matrix': 'matrix',
  '@danielsimonjr/mathts-expression': 'expression',
  '@danielsimonjr/mathts-compat': 'compat',
  '@danielsimonjr/mathts-plot': 'plot',
};

const entries = proposals.proposals.map((p) => {
  const o = OVERRIDE[p.issue] ?? {};
  const family = o.family ?? p.family;
  const secondary_families =
    o.secondary_families ?? p.secondary_families ?? [];
  const rationale = o.rationale ?? p.rationale;
  const pkgLabel = PKG_TO_LABEL[p.package] ?? p.package;
  return {
    issue: p.issue,
    title: p.title,
    type: p.type,
    package: p.package,
    package_label: `pkg:${pkgLabel}`,
    primary_family: family,
    secondary_families,
    confidence: p.confidence,
    implementation_location: p.implementation_location,
    rationale,
    batch: p.batch,
  };
});

entries.sort((a, b) => a.issue - b.issue);

const out = {
  generatedFor: 'issues #1592-#1713 (tracker #1714)',
  adjudicatedFrom: 'proposals.json (worker PR #1717) with challenger overrides (PR #1718)',
  familyCount: 63,
  issueCount: entries.length,
  classifications: entries,
};

writeFileSync(new URL('classification.json', root), `${JSON.stringify(out, null, 2)}\n`);