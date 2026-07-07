#!/usr/bin/env node
/**
 * Generate (and CI-check) the complete export index for the MathTS API docs so the
 * reference docs cannot silently drift behind each package's export surface.
 *
 *   node tools/generate-functions-reference.mjs          # rewrite the indexes
 *   node tools/generate-functions-reference.mjs --check  # fail if any is stale (CI)
 *
 * Covered docs (each gets a generated "Complete export index" block; only the block
 * between the BEGIN/END markers is generated — the curated prose/tables above it are
 * left untouched):
 *   - functions: docs/reference/functions.md (+ functions.html mirror) AND docs/api/functions.md
 *   - compat / core / matrix / parallel: docs/api/<pkg>.md
 *
 * To cover a new package, add a row to TARGETS.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const BEGIN = '<!-- BEGIN GENERATED EXPORT INDEX (tools/generate-functions-reference.mjs) -->';
const END = '<!-- END GENERATED EXPORT INDEX -->';
// functions.html is a self-rendering page: it embeds the raw markdown in a
// <script id="md" type="text/markdown"> block and renders it client-side. Keep that
// embedded copy in sync (each non-blank line indented 6 spaces to match the
// surrounding HTML, as the page dedents before rendering).
const MD_OPEN = '<script id="md" type="text/markdown">';
const MD_CLOSE = '</script>';

/** Packages whose export index is generated into an API doc. `refDoc`/`html` are the
 *  functions-only canonical reference + its self-rendering html mirror. Paths are
 *  relative to the repo root; `pkg` names the workspace whose dist/index.js is read. */
const TARGETS = [
  {
    pkg: 'functions',
    apiDoc: 'docs/api/functions.md',
    refDoc: 'docs/reference/functions.md',
    html: 'docs/reference/functions.html',
  },
  { pkg: 'compat', apiDoc: 'docs/api/compat.md' },
  { pkg: 'core', apiDoc: 'docs/api/core.md' },
  { pkg: 'matrix', apiDoc: 'docs/api/matrix.md' },
  { pkg: 'parallel', apiDoc: 'docs/api/parallel.md' },
];

const norm = (s) => s.replace(/\r\n/g, '\n');
const fmt = (arr) => arr.slice().sort((a, b) => a.localeCompare(b));
const code = (arr) => fmt(arr).map((n) => `\`${n}\``).join(', ');
const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const OTHER = 'Other exports (uncategorized)';

/**
 * Domain map for functions NOT captured by a `##` section of the reference doc — the
 * gap-closure functions and newer factory extras. Keys must match the doc's `##`
 * headings exactly so they merge into the same domain groups. A new export missing
 * from both the doc and this map surfaces under "Other exports" and fails
 * `docs:functions:check`, so it can't silently land uncategorized.
 */
const DOMAIN_SUPPLEMENT = {
  Arithmetic: ['clamp', 'sigmoid'],
  'Special Functions': [
    'carlsonRC', 'carlsonRD', 'carlsonRF', 'carlsonRJ', 'ellipticEIncomplete',
    'ellipticF', 'ellipticPi', 'erfcScalar',
  ],
  Statistics: [
    'acf', 'bootstrapCI', 'corrcoef', 'cov', 'cummax', 'cummin', 'cumprod', 'cumtrapz',
    'describe', 'detrend', 'ewma', 'gmean', 'histogram', 'hmean', 'iqr', 'kendallTau',
    'kendalltau', 'kurtosis', 'kmeans', 'linregress', 'logsumexp', 'mahalanobis', 'meanCI',
    'moment', 'movingAverage', 'pearsonr', 'proportionCI', 'ptp', 'rankdata', 'sem',
    'skewness', 'softmax', 'spearmanr', 'spectralClustering', 'trimmedMean', 'variation',
    'zscore', 'linearRegression', 'parallelStatPercentile',
  ],
  'Probability Distributions': [
    'betaCDF', 'betaPDF', 'betaQuantile', 'cauchyCDF', 'cauchyPDF', 'cauchyQuantile',
    'chiSquaredCDF', 'chiSquaredQuantile', 'discreteUniformDist', 'fCDF', 'fQuantile',
    'gammaCDF', 'gammaPDF', 'gammaQuantile', 'gumbelDist', 'hypergeometricDist',
    'invGaussDist', 'laplaceCDF', 'laplacePDF', 'laplaceQuantile', 'logisticCDF',
    'logisticPDF', 'logisticQuantile', 'multivariateNormal', 'negativeBinomialDist',
    'noncentralChi2PDF', 'normalQuantile', 'paretoDist', 'rayleighDist', 'studentTCDF',
    'studentTPDF', 'studentTQuantile', 'studentizedRangeCDF', 'studentizedRangeQuantile',
    'seedProbabilityRng', 'triangularDist',
  ],
  'Hypothesis Tests': [
    'andersonDarlingTest', 'anova2', 'bartlettTest', 'binomialTest', 'dagostinoTest',
    'friedmanTest', 'fTest', 'fisherExact', 'hotellingT2', 'jarqueBera',
    'kolmogorovSmirnov2Test', 'kruskalWallis', 'leveneTest', 'multipleComparison',
    'permutationTest', 'proportionZTest', 'studentTTestPaired', 'tukeyHSD', 'wilcoxon',
  ],
  'Signal Processing': [
    'bartlettPSD', 'butter', 'chirpZTransform', 'filtfilt', 'firwin', 'goertzel',
    'lfilter', 'lfilterZi', 'multiTaperPSD', 'welchPSD',
  ],
  'Linear Algebra': [
    'circulant', 'companion', 'generalizedEig', 'laplacianMatrix', 'logdet',
    'lowRankApprox', 'matrixExpm', 'matrixLogm', 'matrixSqrtm', 'norm2', 'normFro',
    'qz', 'singularValues', 'toeplitz', 'tril', 'triu', 'vander',
  ],
  Geometry: [
    'convexHull3D', 'haversine', 'quaternionConjugate', 'quaternionFromAxisAngle',
    'quaternionMultiply', 'quaternionNormalize', 'quaternionRotate',
    'quaternionToRotationMatrix', 'slerp',
  ],
  'Graph Theory': ['betweennessCentrality', 'eigenvectorCentrality', 'pageRank'],
  'Computer Algebra System (CAS)': ['casDerivative', 'casExpand', 'casFactor', 'casSimplify', 'symbolicIntegral'],
  'Numerical Methods': [
    'derivativeAt', 'gradient', 'gradientAt', 'gradientDescent', 'hessian',
    'levenbergMarquardt', 'nelderMead', 'valueAndDerivativeAt',
  ],
  'Interpolation & Curve Fitting': ['chebyshevFit', 'legendreFit', 'newtonInterp'],
  'Numerical Integration': ['simpsonF64', 'trapzF64'],
  'Relational & Comparison': ['compareUnits'],
  'Matrix Construction & Manipulation': ['apply', 'index'],
  'Type Conversion': ['parseNumberWithConfig'],
  'Type Checking & Utilities': ['config', 'fuseUnaryChain', 'help', 'validateClosureSource'],
  'Parallel Execution Model': [
    'getComputePool', 'initializePool', 'initializeSignal', 'initializeStatistics',
    'shouldParallelize', 'terminatePool', 'terminateSignal', 'terminateStatistics',
  ],
};

/**
 * Derive a domain taxonomy from a doc's curated `## <Domain>` sections: assign each
 * export to the first section whose table/intro (before its `### Details`/`### Background`/
 * `### Examples` prose) lists it. Returns the section order (pedagogical) + name→domain
 * map. Merges DOMAIN_SUPPLEMENT on top so the map covers every export.
 */
function deriveDomains(docText, exportSet) {
  const curated = docText.split('## Complete export index')[0];
  const order = [];
  const map = new Map();
  let section = null;
  let collecting = false;
  let inCode = false;
  for (const l of curated.split('\n')) {
    if (l.trimStart().startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const h2 = l.match(/^## (.+)/);
    if (h2) {
      section = h2[1].trim();
      collecting = true;
      if (!order.includes(section)) order.push(section);
      continue;
    }
    // Stop collecting once we hit a section's prose subsections (names there are
    // cross-references, not the section's own listing). Other `###` (sub-tables) keep going.
    if (/^### (Details|Background|Examples)/.test(l)) collecting = false;
    if (!section || !collecting || l.startsWith('### ')) continue;
    for (const m of l.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)/g)) {
      const nm = m[1];
      if (exportSet.has(nm) && !map.has(nm)) map.set(nm, section);
    }
  }
  for (const [cat, names] of Object.entries(DOMAIN_SUPPLEMENT)) {
    if (!order.includes(cat)) order.push(cat);
    for (const nm of names) if (exportSet.has(nm)) map.set(nm, cat); // supplement overrides prose
  }
  return { order, map };
}

/** Build the generated BEGIN..END export-index block for one package's module object.
 *  `domains` (optional) = {order, map} to group callable functions by domain. */
function buildIndexBlock(mod, pkg, domains) {
  // Category membership from any exported `typed<Category>` namespace objects
  // (functions groups its dispatchers this way; other packages have none).
  const memberCategory = new Map();
  const CATEGORY_NS = Object.keys(mod)
    .filter((k) => /^typed[A-Z]/.test(k) && mod[k] && typeof mod[k] === 'object')
    .sort();
  for (const ns of CATEGORY_NS) {
    const label = ns.replace(/^typed/, '');
    for (const member of Object.keys(mod[ns])) {
      if (!memberCategory.has(member)) memberCategory.set(member, label);
    }
  }

  const classes = [];
  const constants = [];
  const factoryShadows = [];
  const byCategory = new Map(); // label -> string[]
  const uncategorizedFns = [];
  // When a domain taxonomy is supplied (the functions package), group callable
  // functions by mathematical/scientific DOMAIN (Linear Algebra, Statistics, Signal
  // Processing, …) instead of the coarse typed-dispatch namespace — the user-facing
  // organization. Otherwise fall back to the typed<Category> grouping.
  const useDomains = domains && domains.order.length > 0;

  for (const name of Object.keys(mod)) {
    if (/^typed[A-Z]/.test(name) && typeof mod[name] === 'object') continue; // namespace objects
    const val = mod[name];
    if (name.startsWith('factory_')) {
      factoryShadows.push(name);
      continue;
    }
    if (typeof val === 'function') {
      const isClass =
        PASCAL.test(name) && val.prototype && Object.getOwnPropertyNames(val.prototype).length > 1;
      if (isClass) {
        classes.push(name);
        continue;
      }
      const cat = useDomains ? (domains.map.get(name) ?? OTHER) : memberCategory.get(name);
      if (cat) {
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat).push(name);
      } else uncategorizedFns.push(name);
    } else {
      constants.push(name); // numbers, Units (physical constants), objects
    }
  }

  const total = Object.keys(mod).length;
  let out = `${BEGIN}\n\n`;
  out += `> **Generated** — do not edit by hand. Run \`npm run docs:functions\` after\n`;
  out += `> adding or removing a public export. Complete index of every public name in\n`;
  out += `> \`@danielsimonjr/mathts-${pkg}\` (${total} exports).\n\n`;

  if (byCategory.size) {
    out += `### Functions by category\n\n`;
    // Domain order follows the reference doc's sections (pedagogical); the typed
    // fallback is alphabetical. `OTHER` (should be empty) always sorts last.
    const cats = useDomains
      ? [...domains.order, OTHER].filter((c) => byCategory.has(c))
      : [...byCategory.keys()].sort();
    for (const cat of cats) {
      out += `**${cat}** (${byCategory.get(cat).length}): ${code(byCategory.get(cat))}\n\n`;
    }
    if (uncategorizedFns.length) {
      out += `**Factory / uncategorized** (${uncategorizedFns.length}): ${code(uncategorizedFns)}\n\n`;
    }
  } else if (uncategorizedFns.length) {
    out += `### Functions (${uncategorizedFns.length})\n\n${code(uncategorizedFns)}\n\n`;
  }
  if (constants.length) out += `### Constants & values (${constants.length})\n\n${code(constants)}\n\n`;
  if (classes.length) out += `### Classes & types (${classes.length})\n\n${code(classes)}\n\n`;
  if (factoryShadows.length) {
    out += `### Factory-shadowed (\`factory_*\`, ${factoryShadows.length})\n\n`;
    out += `These duplicate a typed export under a \`factory_\` prefix.\n\n${code(factoryShadows)}\n\n`;
  }
  if (CATEGORY_NS.length) {
    out += `### Namespace aggregates (${CATEGORY_NS.length})\n\n`;
    out += `Per-category objects bundling the functions above.\n\n${code(CATEGORY_NS)}\n\n`;
  }
  out += `${END}`;
  return { block: out, total };
}

/** Splice the block between BEGIN/END markers, or append it under a heading on first run. */
function spliceIndex(docText, block) {
  const bi = docText.indexOf(BEGIN);
  const ei = docText.indexOf(END);
  return bi === -1 || ei === -1
    ? `${docText.replace(/\s*$/, '')}\n\n## Complete export index\n\n${block}\n`
    : docText.slice(0, bi) + block + docText.slice(ei + END.length);
}

/** Replace the body of `<script id="md" …>…</script>` with `md` (6-space indented). */
function embedMarkdown(htmlRaw, md) {
  const h = norm(htmlRaw);
  const open = h.indexOf(MD_OPEN);
  if (open === -1) throw new Error(`functions.html: cannot find ${MD_OPEN}`);
  const bodyStart = open + MD_OPEN.length;
  const close = h.indexOf(MD_CLOSE, bodyStart);
  if (close === -1) throw new Error(`functions.html: cannot find ${MD_CLOSE} after the md block`);
  const indented = norm(md)
    .replace(/\s+$/, '')
    .split('\n')
    .map((l) => (l === '' ? '' : '      ' + l))
    .join('\n');
  return `${h.slice(0, bodyStart)}\n${indented}\n    ${h.slice(close)}`;
}

// --- Build the desired content for every tracked doc file ------------------------
const jobs = []; // { file, prev, next, label, isMd }
let functionsSurface = null; // runtime dist Object.keys of the functions package
for (const t of TARGETS) {
  const mod = await import(pathToFileURL(resolve(REPO, t.pkg, 'dist', 'index.js')).href);
  if (t.pkg === 'functions') functionsSurface = Object.keys(mod);
  // Packages with a curated reference doc (functions) group their index by
  // mathematical domain, derived from that doc's `##` sections + DOMAIN_SUPPLEMENT.
  const domains = t.refDoc
    ? deriveDomains(readFileSync(resolve(REPO, t.refDoc), 'utf8'), new Set(Object.keys(mod)))
    : null;
  const { block, total } = buildIndexBlock(mod, t.pkg, domains);
  const docPaths = [t.refDoc, t.apiDoc].filter(Boolean);
  let mdForHtml = null;
  for (const rel of docPaths) {
    const file = resolve(REPO, rel);
    const prev = readFileSync(file, 'utf8');
    const next = spliceIndex(prev, block);
    jobs.push({ file, prev, next, label: `${rel} export index (${total} exports)`, isMd: true });
    if (rel === t.refDoc) mdForHtml = next;
  }
  if (t.html && mdForHtml) {
    const file = resolve(REPO, t.html);
    const prev = readFileSync(file, 'utf8');
    jobs.push({ file, prev, next: embedMarkdown(prev, mdForHtml), label: `${t.html} embedded markdown`, isMd: false });
  }
}

// --- Cross-validate the shipped functions surface against the dep-graph's
// independent static-source inventory. A name in the runtime `dist` with no source
// origin is real drift (stale dist, an aliased re-export the dep-graph missed, or an
// accidental export). The surfaces file is produced by `npm run docs:deps`; if it is
// absent the reconciliation is skipped (not failed) so this check stays self-contained.
const SURFACES = resolve(REPO, 'docs', 'Architecture', 'package-export-surfaces.json');
let reconcile = { skipped: true, orphans: [] };
if (functionsSurface && existsSync(SURFACES)) {
  const { surfaces } = JSON.parse(readFileSync(SURFACES, 'utf8'));
  const source = new Set(surfaces?.functions ?? []);
  reconcile = {
    skipped: false,
    orphans: functionsSurface.filter((n) => !source.has(n)).sort((a, b) => a.localeCompare(b)),
  };
}
const reconcileMsg = reconcile.skipped
  ? 'functions surface reconciliation: SKIPPED (run `npm run docs:deps` to emit package-export-surfaces.json).'
  : reconcile.orphans.length
    ? `functions surface reconciliation: ${reconcile.orphans.length} shipped export(s) have no ` +
      `source origin in the dep-graph inventory — real drift, or run \`npm run docs:deps\` to ` +
      `refresh: ${reconcile.orphans.join(', ')}`
    : `functions surface reconciles: all ${functionsSurface?.length ?? 0} shipped exports have a source origin.`;

const check = process.argv.includes('--check');
const stale = jobs.filter((j) => norm(j.next) !== norm(j.prev));

if (check) {
  if (!stale.length && !reconcile.orphans.length) {
    console.log(`All ${jobs.length} generated doc blocks are up to date.`);
    console.log(reconcileMsg);
    process.exit(0);
  }
  for (const j of stale) {
    console.error(`${j.label} is STALE. Run \`npm run docs:functions\`.`);
    if (j.isMd) {
      const documented = new Set([...j.prev.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)].map((m) => m[1]));
      // undocumented names appear in the regenerated content but not the on-disk file
      const wanted = new Set([...j.next.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)].map((m) => m[1]));
      const missing = [...wanted].filter((n) => !documented.has(n));
      if (missing.length) console.error(`  Undocumented names (${missing.length}): ${missing.join(', ')}`);
    }
  }
  if (reconcile.orphans.length) console.error(reconcileMsg);
  process.exit(1);
}

for (const j of jobs) {
  if (norm(j.next) === norm(j.prev)) {
    console.log(`${j.label} is up to date.`);
    continue;
  }
  const eol = j.prev.includes('\r\n') ? '\r\n' : '\n';
  writeFileSync(j.file, eol === '\r\n' ? norm(j.next).replace(/\n/g, '\r\n') : norm(j.next));
  console.log(`Wrote ${j.label}.`);
}
console.log(reconcileMsg);
