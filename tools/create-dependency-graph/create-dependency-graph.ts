#!/usr/bin/env npx tsx

/**
 * Generic Dependency Graph Generator
 *
 * Scans a TypeScript codebase and generates:
 * - docs/Architecture/DEPENDENCY_GRAPH.md (human-readable)
 * - docs/Architecture/dependency-graph.json (machine-readable)
 * - docs/Architecture/dependency-graph.yaml (compact, ~40% smaller than JSON)
 *
 * Usage: npx tsx tools/create-dependency-graph.ts
 *
 * This tool is generic and does not depend on any codebase-specific functions.
 * It dynamically discovers the project structure from the filesystem.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import { basename, dirname, join, relative } from 'path';

// Types
interface Dependency {
  file: string;
  imports: string[];
  reExport?: boolean;
  typeOnly?: boolean; // Track type-only imports
}

interface ExternalDependency {
  package: string;
  imports: string[];
}

interface NodeDependency {
  module: string;
  imports: string[];
}

interface FileExports {
  named: string[];
  default: string | null;
  types: string[];
  interfaces: string[];
  enums: string[];
  classes: string[];
  functions: string[];
  constants: string[];
  reExported: string[]; // Track re-exported symbols
}

interface ParsedFile {
  path: string;
  name: string;
  externalDependencies: ExternalDependency[];
  nodeDependencies: NodeDependency[];
  internalDependencies: Dependency[];
  workspaceDependencies: WorkspaceDependency[];
  packageName: string | null;
  exports: FileExports;
  description: string | null;
}

interface DependencyMatrix {
  [path: string]: {
    importsFrom: string[];
    exportsTo: string[];
  };
}

interface Statistics {
  totalTypeScriptFiles: number;
  totalModules: number;
  totalLinesOfCode: number;
  totalExports: number;
  totalClasses: number;
  totalInterfaces: number;
  totalFunctions: number;
  totalTypeGuards: number;
  totalEnums: number;
  totalConstants: number;
  totalReExports: number;
  totalTypeOnlyImports: number;
  runtimeCircularDeps: number; // Excludes type-only cycles
  typeOnlyCircularDeps: number; // Type-only cycles (not runtime issues)
  unusedFilesCount: number;
  unusedExportsCount: number;
}

interface UnusedExport {
  file: string;
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'constant' | 'enum' | 'other';
}

interface UnusedAnalysis {
  unusedFiles: string[];
  unusedExports: UnusedExport[];
}

interface ModuleMap {
  [moduleName: string]: {
    [filePath: string]: ParsedFile;
  };
}

interface PackageJson {
  name: string;
  version: string;
}

interface WorkspacePackage {
  name: string; // npm name, e.g., "@danielsimonjr/mathts-core"
  directory: string; // relative dir, e.g., "core"
  srcDir: string; // relative src dir, e.g., "core/src"
}

interface WorkspaceDependency {
  package: string; // workspace package name
  directory: string; // workspace package directory
  imports: string[]; // imported symbols
}

// CLI options interface
interface CLIOptions {
  root: string;
  includeTests: boolean;
  all: boolean;
}

// Constants - support CLI argument or current working directory for portability
function parseCliOptions(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    root: process.cwd(),
    includeTests: false,
    all: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--root=')) {
      options.root = arg.slice(7);
    } else if (arg === '--include-tests' || arg === '-t') {
      options.includeTests = true;
    } else if (arg === '--all' || arg === '-a') {
      options.all = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Dependency Graph Generator

Usage:
  create-dependency-graph [options] [project-root]

Options:
  --root=<path>      Project root directory (default: current directory)
  --include-tests    Include test files in dependency analysis
  -t                 Short form of --include-tests
  --all, -a          Include dormant/unreachable files (monorepo mode)
  --help, -h         Show this help

Monorepo Support:
  When run from a monorepo root with workspaces in package.json,
  automatically scans all workspace packages and builds a unified graph.
  By default, only files reachable from each package src/index.ts are
  included. Use --all to include dormant code too.

Examples:
  create-dependency-graph                         # Use current directory
  create-dependency-graph ./my-project            # Specify project path
  create-dependency-graph --include-tests         # Include test file analysis
  create-dependency-graph --all                   # Include dormant code
  create-dependency-graph --root=C:/projects/my-app -t
`);
      process.exit(0);
    } else if (!arg.startsWith('-') && existsSync(arg)) {
      // First non-flag argument is the project root
      options.root = arg;
    }
  }

  return options;
}

function getProjectRoot(): string {
  return parseCliOptions().root;
}

const ROOT_DIR = getProjectRoot();
const SRC_DIR = join(ROOT_DIR, 'src');
const OUTPUT_DIR = join(ROOT_DIR, 'docs', 'Architecture');

// Read package.json for version and name
let packageJson: PackageJson = { name: 'unknown', version: '0.0.0' };
try {
  packageJson = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf-8')) as PackageJson;
} catch {
  console.warn('Warning: Could not read package.json, using defaults');
}

// Module-level workspace map (set in main() for monorepo mode)
let workspaceMap: Map<string, WorkspacePackage> = new Map();

/**
 * Detect workspace packages from a monorepo root.
 * Returns a Map keyed by npm package name.
 * Returns empty map if no workspaces field (backward compat with single packages).
 */
function detectWorkspaces(rootDir: string): Map<string, WorkspacePackage> {
  const workspaces = new Map<string, WorkspacePackage>();

  try {
    const rootPkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
    const wsPatterns: string[] = rootPkg.workspaces || [];
    if (wsPatterns.length === 0) return workspaces;

    for (const pattern of wsPatterns) {
      if (pattern.endsWith('/*')) {
        // Glob pattern like "packages/*"
        const parentDir = pattern.slice(0, -2);
        const fullParent = join(rootDir, parentDir);
        if (!existsSync(fullParent)) continue;

        const entries = readdirSync(fullParent);
        for (const entry of entries) {
          const pkgDir = join(parentDir, entry);
          const pkgJsonPath = join(rootDir, pkgDir, 'package.json');
          if (existsSync(pkgJsonPath)) {
            try {
              const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
              if (pkg.name) {
                const srcDir = join(pkgDir, 'src');
                workspaces.set(pkg.name, {
                  name: pkg.name,
                  directory: pkgDir.replace(/\\/g, '/'),
                  srcDir: srcDir.replace(/\\/g, '/'),
                });
              }
            } catch {
              /* skip invalid package.json */
            }
          }
        }
      } else {
        // Direct path like "core", "matrix"
        const pkgJsonPath = join(rootDir, pattern, 'package.json');
        if (existsSync(pkgJsonPath)) {
          try {
            const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
            if (pkg.name) {
              const srcDir = join(pattern, 'src');
              workspaces.set(pkg.name, {
                name: pkg.name,
                directory: pattern.replace(/\\/g, '/'),
                srcDir: srcDir.replace(/\\/g, '/'),
              });
            }
          } catch {
            /* skip invalid package.json */
          }
        }
      }
    }
  } catch {
    /* no package.json or no workspaces field */
  }

  return workspaces;
}

/**
 * Recursively get all TypeScript files in a directory
 */
function getAllTsFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) {
    return files;
  }

  const entries = readdirSync(dir);

  for (const entry of entries) {
    // Skip node_modules directories
    if (entry === 'node_modules') {
      continue;
    }

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      getAllTsFiles(fullPath, files);
    } else if (
      entry.endsWith('.ts') &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.spec.ts')
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Recursively get all test files (.test.ts, .spec.ts) in a directory
 */
function getAllTestFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) {
    return files;
  }

  const entries = readdirSync(dir);

  for (const entry of entries) {
    // Skip node_modules directories
    if (entry === 'node_modules') {
      continue;
    }

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      getAllTestFiles(fullPath, files);
    } else if (entry.endsWith('.test.ts') || entry.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Test coverage analysis interfaces
interface TestCoverageAnalysis {
  sourceFiles: string[];
  testFiles: ParsedFile[];
  coverageMap: Map<string, string[]>; // source file -> test files that import it
  testedFiles: string[];
  untestedFiles: string[];
  testToSourceMap: Map<string, string[]>; // test file -> source files it imports
  policy: CoveragePolicy | null;
  policyBreakdown: CategoryBreakdown;
}

// Coverage-policy support (loaded from docs/Architecture/coverage-policy.json
// if present). Categorises untested files into "intentionally indirect"
// buckets so the headline metric can carry an "effective coverage" companion
// number alongside the raw direct-import figure. See
// docs/Architecture/COVERAGE_POLICY.md for the policy.

interface CoveragePolicyCategory {
  label: string;
  rationale: string;
  pathPrefixes?: string[];
  exactPaths?: string[];
}

interface CoveragePolicy {
  description?: string;
  updated?: string;
  categories: Record<string, CoveragePolicyCategory>;
}

// Per-untested-file classification result. `null` category = active gap (real).
type ClassifiedUntested = { file: string; category: string | null };

// Aggregate breakdown returned alongside the raw counts.
interface CategoryBreakdown {
  // count by category id; key 'active_untested' covers files that match NO policy category.
  byCategory: Record<string, number>;
  // total source files matched by any policy category — these are excluded from the "active" count.
  excludedTotal: number;
  // active reachable file count (sourceFiles.length - excludedTotal).
  activeFiles: number;
  // tested active files (active files - active_untested).
  testedActive: number;
  // effective coverage percent of active code, 1 decimal place.
  effectivePercent: string;
  // per-file classification list (for the JSON output; the markdown summarises).
  classifiedUntested: ClassifiedUntested[];
}

/**
 * Load coverage-policy.json from the project's docs/Architecture/ if present.
 * Returns null when the file is missing — the tool stays backwards-compatible
 * (the breakdown collapses to "active_untested = untestedCount" with no other
 * categories).
 */
function loadCoveragePolicy(rootDir: string): CoveragePolicy | null {
  const policyPath = join(rootDir, 'docs', 'Architecture', 'coverage-policy.json');
  if (!existsSync(policyPath)) return null;
  try {
    const raw = readFileSync(policyPath, 'utf8');
    const parsed = JSON.parse(raw) as CoveragePolicy;
    if (!parsed.categories || typeof parsed.categories !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Classify one path against the policy. Returns the category id (e.g.
 * 'synced_mathjs_functions') if it matches any, or null otherwise.
 * `exactPaths` wins over `pathPrefixes` — a file listed by name doesn't
 * get reclassified because some directory it happens to live under is
 * also covered by a prefix.
 */
function classifyAgainstPolicy(filePath: string, policy: CoveragePolicy | null): string | null {
  if (!policy) return null;
  for (const [categoryId, cat] of Object.entries(policy.categories)) {
    if (cat.exactPaths?.includes(filePath)) return categoryId;
  }
  for (const [categoryId, cat] of Object.entries(policy.categories)) {
    if (cat.pathPrefixes) {
      for (const prefix of cat.pathPrefixes) {
        if (filePath.startsWith(prefix)) return categoryId;
      }
    }
  }
  return null;
}

/**
 * Build the per-untested-file classification and aggregate counts.
 * Note: the policy applies to ALL source files (so we can compute how many
 * synced files are also tested, e.g. via the typed/ layer), but the
 * effective-coverage metric is computed over the active (non-excluded) set
 * only.
 */
function buildCategoryBreakdown(
  sourceFiles: string[],
  testedFiles: string[],
  untestedFiles: string[],
  policy: CoveragePolicy | null
): CategoryBreakdown {
  const byCategory: Record<string, number> = {};
  if (policy) {
    for (const id of Object.keys(policy.categories)) byCategory[id] = 0;
  }
  byCategory.active_untested = 0;

  const classifiedUntested: ClassifiedUntested[] = [];
  for (const f of untestedFiles) {
    const cat = classifyAgainstPolicy(f, policy);
    if (cat) {
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    } else {
      byCategory.active_untested = (byCategory.active_untested ?? 0) + 1;
    }
    classifiedUntested.push({ file: f, category: cat });
  }

  // The "excluded" denominator is every SOURCE file (tested or not) that
  // matches a policy category. For the active-tested calculation we also
  // need to know how many tested files fall inside excluded categories —
  // they shouldn't count toward the active-tested numerator.
  let excludedTotal = 0;
  let testedExcluded = 0;
  const testedSet = new Set(testedFiles);
  for (const f of sourceFiles) {
    const cat = classifyAgainstPolicy(f, policy);
    if (cat) {
      excludedTotal++;
      if (testedSet.has(f)) testedExcluded++;
    }
  }
  const activeFiles = sourceFiles.length - excludedTotal;
  const testedActive = testedFiles.length - testedExcluded;
  const effectivePercent = activeFiles > 0 ? ((testedActive / activeFiles) * 100).toFixed(1) : '0';

  return {
    byCategory,
    excludedTotal,
    activeFiles,
    testedActive,
    effectivePercent,
    classifiedUntested,
  };
}

// Re-export map: barrel file -> source files it re-exports from
type ReExportMap = Map<string, Set<string>>;

/**
 * Build a map of barrel files to the source files they re-export from.
 * This allows tracing imports through barrel files (index.ts) to find
 * the actual source files being tested.
 */
function buildReExportMap(sourceFiles: ParsedFile[]): ReExportMap {
  const reExportMap: ReExportMap = new Map();
  const sourceFilePaths = new Set(sourceFiles.map((f) => f.path));

  // Find all barrel files (files with re-exports)
  for (const file of sourceFiles) {
    const reExportedSources = new Set<string>();

    for (const dep of file.internalDependencies) {
      if (dep.reExport) {
        // This file re-exports from another file
        const resolved = resolvePath(file.path, dep.file);
        if (sourceFilePaths.has(resolved)) {
          reExportedSources.add(resolved);
        }
      }
    }

    if (reExportedSources.size > 0) {
      reExportMap.set(file.path, reExportedSources);
    }
  }

  // Recursively expand re-exports (handle chains like types/index.ts -> types/types.ts)
  let changed = true;
  while (changed) {
    changed = false;
    for (const [barrelPath, sources] of reExportMap) {
      const expanded = new Set(sources);
      for (const source of sources) {
        // If a source is itself a barrel, add its sources too
        const nestedSources = reExportMap.get(source);
        if (nestedSources) {
          for (const nested of nestedSources) {
            if (!expanded.has(nested)) {
              expanded.add(nested);
              changed = true;
            }
          }
        }
      }
      reExportMap.set(barrelPath, expanded);
    }
  }

  return reExportMap;
}

/**
 * Get all source files that are ultimately imported through a barrel file chain.
 * Given an import to a barrel file, returns all source files it re-exports.
 */
function traceReExports(importedPath: string, reExportMap: ReExportMap): Set<string> {
  const result = new Set<string>();
  result.add(importedPath); // Always include the directly imported file

  const sources = reExportMap.get(importedPath);
  if (sources) {
    for (const source of sources) {
      result.add(source);
    }
  }

  return result;
}

/**
 * Analyze test coverage by mapping source files to test files.
 * Traces imports through barrel files (index.ts) to find all source files
 * that are indirectly tested through re-exports.
 */
function analyzeTestCoverage(
  sourceFiles: ParsedFile[],
  testFiles: ParsedFile[]
): TestCoverageAnalysis {
  const sourceFilePaths = new Set(sourceFiles.map((f) => f.path));
  const coverageMap = new Map<string, string[]>();
  const testToSourceMap = new Map<string, string[]>();

  // Build re-export map to trace imports through barrel files
  const reExportMap = buildReExportMap(sourceFiles);

  // Initialize coverage map with empty arrays
  for (const source of sourceFiles) {
    coverageMap.set(source.path, []);
  }

  // Helper to add test coverage for a source file
  const addCoverage = (sourcePath: string, testPath: string, importedSources: string[]) => {
    if (!importedSources.includes(sourcePath)) {
      importedSources.push(sourcePath);
    }
    const tests = coverageMap.get(sourcePath) || [];
    if (!tests.includes(testPath)) {
      tests.push(testPath);
      coverageMap.set(sourcePath, tests);
    }
  };

  // Analyze each test file to see which source files it imports
  for (const testFile of testFiles) {
    const importedSources: string[] = [];

    for (const dep of testFile.internalDependencies) {
      // Resolve the import path relative to the test file
      const resolvedPath = resolvePath(testFile.path, dep.file);

      // Check if it's a source file (in src/)
      if (sourceFilePaths.has(resolvedPath)) {
        // Add the directly imported file
        addCoverage(resolvedPath, testFile.path, importedSources);

        // Trace through barrel re-exports to find underlying source files
        const reExportedSources = traceReExports(resolvedPath, reExportMap);
        for (const reExportedPath of reExportedSources) {
          if (sourceFilePaths.has(reExportedPath)) {
            addCoverage(reExportedPath, testFile.path, importedSources);
          }
        }
      }

      // Also check without .ts extension variations
      const withoutTs = resolvedPath.replace(/\.ts$/, '');
      const withTs = withoutTs + '.ts';
      if (sourceFilePaths.has(withTs)) {
        addCoverage(withTs, testFile.path, importedSources);

        // Trace through barrel re-exports
        const reExportedSources = traceReExports(withTs, reExportMap);
        for (const reExportedPath of reExportedSources) {
          if (sourceFilePaths.has(reExportedPath)) {
            addCoverage(reExportedPath, testFile.path, importedSources);
          }
        }
      }
    }

    testToSourceMap.set(testFile.path, importedSources);
  }

  // Determine tested and untested files
  const testedFiles: string[] = [];
  const untestedFiles: string[] = [];

  for (const [sourcePath, tests] of coverageMap) {
    if (tests.length > 0) {
      testedFiles.push(sourcePath);
    } else {
      untestedFiles.push(sourcePath);
    }
  }

  const policy = loadCoveragePolicy(ROOT_DIR);
  const sourcePaths = sourceFiles.map((f) => f.path);
  const policyBreakdown = buildCategoryBreakdown(sourcePaths, testedFiles, untestedFiles, policy);

  return {
    sourceFiles: sourcePaths,
    testFiles,
    coverageMap,
    testedFiles,
    untestedFiles,
    testToSourceMap,
    policy,
    policyBreakdown,
  };
}

/**
 * Parse a TypeScript file for imports and exports
 */
function parseFile(filePath: string): ParsedFile {
  const content = readFileSync(filePath, 'utf-8');
  const relativePath = relative(ROOT_DIR, filePath).replace(/\\/g, '/');

  // Determine which workspace package this file belongs to
  let detectedPackageName: string | null = null;
  for (const [name, ws] of workspaceMap) {
    if (relativePath.startsWith(ws.directory + '/')) {
      detectedPackageName = name;
      break;
    }
  }

  // Strip comments for import/export parsing (prevents picking up imports in JSDoc examples)
  const code = content
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments (/** ... */ and /* ... */)
    .replace(/\/\/.*$/gm, ''); // Remove single-line comments

  const result: ParsedFile = {
    path: relativePath,
    name: basename(filePath, '.ts'),
    externalDependencies: [],
    nodeDependencies: [],
    internalDependencies: [],
    workspaceDependencies: [],
    packageName: detectedPackageName,
    exports: {
      named: [],
      default: null,
      types: [],
      interfaces: [],
      enums: [],
      classes: [],
      functions: [],
      constants: [],
      reExported: [],
    },
    description: extractDescription(content),
  };

  // Parse imports - enhanced to detect type-only imports
  // Matches: import type { ... }, import { type X, Y }, import X from, import * as X from
  const importRegex =
    /import\s+(type\s+)?(?:(?:{([^}]+)}|(\w+)|\*\s+as\s+(\w+))(?:\s*,\s*(?:{([^}]+)}|(\w+)))?)\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  const nodeBuiltins = [
    'fs',
    'path',
    'url',
    'crypto',
    'util',
    'stream',
    'events',
    'buffer',
    'os',
    'child_process',
    'http',
    'https',
    'net',
    'dns',
    'tls',
    'zlib',
    'readline',
    'assert',
    'cluster',
    'dgram',
    'domain',
    'inspector',
    'module',
    'perf_hooks',
    'process',
    'punycode',
    'querystring',
    'repl',
    'string_decoder',
    'timers',
    'tty',
    'v8',
    'vm',
    'worker_threads',
  ];

  while ((match = importRegex.exec(code)) !== null) {
    const isTypeOnlyImport = !!match[1]; // "import type" prefix
    const namedImports = match[2] || match[5] || '';
    const defaultImport = match[3] || match[6] || '';
    const namespaceImport = match[4] || '';
    const source = match[7];

    const imports: string[] = [];
    let hasRuntimeImport = !isTypeOnlyImport;

    if (namedImports) {
      const importItems = namedImports.split(',').map((s) => s.trim());
      for (const item of importItems) {
        // Check for inline type imports: import { type Foo, Bar }
        const isInlineType = item.startsWith('type ');
        const name = item
          .replace(/^type\s+/, '')
          .split(' as ')[0]
          .trim();
        if (name) {
          imports.push(name);
          // If any import is NOT a type, it's a runtime import
          if (!isInlineType && !isTypeOnlyImport) {
            hasRuntimeImport = true;
          }
        }
      }
    }
    if (defaultImport) imports.push(defaultImport);
    if (namespaceImport) imports.push(`* as ${namespaceImport}`);

    const typeOnly = isTypeOnlyImport || !hasRuntimeImport;

    // Check if source is a workspace package import
    const wsPackage = workspaceMap.get(source);

    if (source.startsWith('.')) {
      result.internalDependencies.push({
        file: source,
        imports: imports,
        typeOnly: typeOnly,
      });
    } else if (wsPackage) {
      result.workspaceDependencies.push({
        package: wsPackage.name,
        directory: wsPackage.directory,
        imports: imports,
      });
    } else if (source.startsWith('node:') || nodeBuiltins.includes(source.split('/')[0])) {
      result.nodeDependencies.push({
        module: source.replace('node:', ''),
        imports: imports,
      });
    } else {
      result.externalDependencies.push({
        package: source,
        imports: imports,
      });
    }
  }

  // Parse exports
  // Named exports: export { foo, bar }
  const namedExportRegex = /export\s*{\s*([^}]+)\s*}/g;
  while ((match = namedExportRegex.exec(code)) !== null) {
    const exports = match[1]
      .split(',')
      .map((s) => cleanExportName(s.split(' as ')[0]))
      .filter(Boolean);
    result.exports.named.push(...exports);
  }

  // Export declarations
  // export const/let/var
  const constExportRegex = /export\s+(?:const|let|var)\s+(\w+)/g;
  while ((match = constExportRegex.exec(code)) !== null) {
    result.exports.constants.push(match[1]);
    result.exports.named.push(match[1]);
  }

  // export function
  const funcExportRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
  while ((match = funcExportRegex.exec(code)) !== null) {
    result.exports.functions.push(match[1]);
    result.exports.named.push(match[1]);
  }

  // export class
  const classExportRegex = /export\s+class\s+(\w+)/g;
  while ((match = classExportRegex.exec(code)) !== null) {
    result.exports.classes.push(match[1]);
    result.exports.named.push(match[1]);
  }

  // export interface
  const interfaceExportRegex = /export\s+interface\s+(\w+)/g;
  while ((match = interfaceExportRegex.exec(code)) !== null) {
    result.exports.interfaces.push(match[1]);
    result.exports.types.push(match[1]);
  }

  // export type
  const typeExportRegex = /export\s+type\s+(\w+)/g;
  while ((match = typeExportRegex.exec(code)) !== null) {
    result.exports.types.push(match[1]);
  }

  // export enum
  const enumExportRegex = /export\s+enum\s+(\w+)/g;
  while ((match = enumExportRegex.exec(code)) !== null) {
    result.exports.enums.push(match[1]);
    result.exports.named.push(match[1]);
  }

  // export default
  const defaultExportRegex = /export\s+default\s+(?:class|function|const|let|var)?\s*(\w+)?/;
  const defaultMatch = code.match(defaultExportRegex);
  if (defaultMatch) {
    result.exports.default = defaultMatch[1] || 'default';
  }

  // Re-exports: export * from
  const reExportAllRegex = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = reExportAllRegex.exec(code)) !== null) {
    const reSource = match[1];
    const reWs = workspaceMap.get(reSource);
    if (reWs) {
      result.workspaceDependencies.push({
        package: reWs.name,
        directory: reWs.directory,
        imports: ['*'],
      });
    } else {
      result.internalDependencies.push({
        file: reSource,
        imports: ['*'],
        reExport: true,
      });
    }
    result.exports.reExported.push(`* from ${reSource}`);
  }

  // Re-exports: export { foo } from
  const reExportNamedRegex = /export\s*{\s*([^}]+)\s*}\s*from\s+['"]([^'"]+)['"]/g;
  while ((match = reExportNamedRegex.exec(code)) !== null) {
    const exports = match[1]
      .split(',')
      .map((s) => cleanExportName(s.split(' as ')[0]))
      .filter(Boolean);
    const reSource = match[2];
    const reWs = workspaceMap.get(reSource);
    if (reWs) {
      result.workspaceDependencies.push({
        package: reWs.name,
        directory: reWs.directory,
        imports: exports,
      });
    } else {
      result.internalDependencies.push({
        file: reSource,
        imports: exports,
        reExport: true,
      });
    }
    result.exports.named.push(...exports);
    result.exports.reExported.push(...exports);
  }

  // Re-exports: export type * from (type-only re-exports)
  const reExportTypeAllRegex = /export\s+type\s+\*\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = reExportTypeAllRegex.exec(code)) !== null) {
    const reSource = match[1];
    const reWs = workspaceMap.get(reSource);
    if (reWs) {
      result.workspaceDependencies.push({
        package: reWs.name,
        directory: reWs.directory,
        imports: ['*'],
      });
    } else {
      result.internalDependencies.push({
        file: reSource,
        imports: ['*'],
        reExport: true,
        typeOnly: true,
      });
    }
    result.exports.reExported.push(`type * from ${match[1]}`);
  }

  // Dedupe exports
  result.exports.named = [...new Set(result.exports.named)];
  result.exports.types = [...new Set(result.exports.types)];
  result.exports.reExported = [...new Set(result.exports.reExported)];

  return result;
}

/**
 * Extract file description from comments
 */

/**
 * Generate a meaningful fallback description from file metadata
 */
function generateFallbackDescription(file: ParsedFile): string {
  const fileName = basename(file.path, '.ts');

  // For index files, describe what they re-export
  if (fileName === 'index') {
    if (file.exports.reExported.length > 0) {
      const pkgName = file.packageName || dirname(file.path).split('/').pop() || '';
      return `Package entry point for ${pkgName || 'module'} (re-exports ${file.exports.reExported.length} symbols)`;
    }
    if (file.exports.named.length > 0) {
      return `Entry point exporting ${file.exports.named.length} symbols`;
    }
    return `Package entry point`;
  }

  // For type-only files
  const hasOnlyTypes =
    file.exports.named.length === 0 &&
    !file.exports.default &&
    (file.exports.interfaces.length > 0 || file.exports.types.length > 0);
  if (hasOnlyTypes) {
    return `Type definitions (${file.exports.interfaces.length} interfaces, ${file.exports.types.filter((t) => !file.exports.interfaces.includes(t)).length} type aliases)`;
  }

  return `${fileName} module`;
}

function extractDescription(content: string): string | null {
  // Try to find JSDoc comment at the top
  const jsdocMatch = content.match(/\/\*\*\s*\n([^*]*(?:\*(?!\/)[^*]*)*)\*\//);
  if (jsdocMatch) {
    const lines = jsdocMatch[1]
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, '').trim())
      .map((line) => {
        // Extract description from @scope/package - description lines
        if (line.startsWith('@') && line.includes(' - ')) {
          return line.split(' - ').slice(1).join(' - ').trim();
        }
        return line;
      })
      .filter((line) => !line.startsWith('@') && line.length > 0)
      .filter((line) => !/^[=\-*~#_]{3,}$/.test(line));
    if (lines.length > 0) {
      return lines[0].slice(0, 120);
    }
  }

  // Try single-line comment
  const singleLineMatch = content.match(/^\/\/\s*(.+)$/m);
  if (singleLineMatch) {
    const desc = singleLineMatch[1].trim();
    if (/^[=\-*~#_]{3,}$/.test(desc)) return null;
    return desc.slice(0, 120);
  }

  return null;
}

/**
 * Clean export name by stripping inline comments and whitespace
 */
function cleanExportName(name: string): string {
  // Remove single-line comments
  let cleaned = name.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  // Collapse whitespace to single space, then trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  // Strip leading type keyword for non-type exports
  if (cleaned.startsWith('type ') && !cleaned.includes('{')) {
    cleaned = cleaned.slice(5).trim();
  }
  return cleaned;
}

/**
 * Dynamically discover and categorize files into modules based on directory structure
 */
function categorizeFiles(files: ParsedFile[], isMonorepo: boolean = false): ModuleMap {
  const modules: ModuleMap = {};

  if (isMonorepo) {
    // Monorepo mode: first level = workspace package directory, second = submodule
    for (const file of files) {
      // Determine package key from path
      let pkgKey = 'unknown';
      for (const [, ws] of workspaceMap) {
        if (file.path.startsWith(ws.directory + '/')) {
          pkgKey = ws.directory;
          break;
        }
      }

      // Determine submodule within the package
      const pkgParts = pkgKey.split('/');
      const parts = file.path.split('/');
      const afterPkg = parts.slice(pkgParts.length); // e.g., ['src', 'types', 'Complex.ts']

      if (afterPkg.length >= 2 && afterPkg[0] === 'src') {
        if (afterPkg.length === 2) {
          // File directly in src/ (e.g., core/src/index.ts)
          if (!modules[pkgKey]) modules[pkgKey] = {};
          modules[pkgKey][file.path] = file;
        } else {
          // File in subdirectory (e.g., core/src/types/Complex.ts)
          const subModule = `${pkgKey}/${afterPkg[1]}`;
          if (!modules[subModule]) modules[subModule] = {};
          modules[subModule][file.path] = file;
        }
      } else {
        if (!modules[pkgKey]) modules[pkgKey] = {};
        modules[pkgKey][file.path] = file;
      }
    }
  } else {
    // Single-package mode: original behavior
    for (const file of files) {
      const relativePath = file.path;

      // Handle entry point (src/index.ts)
      if (relativePath === 'src/index.ts') {
        if (!modules.entry) modules.entry = {};
        modules.entry[relativePath] = file;
        continue;
      }

      // Extract the module name from path (first directory after src/)
      const parts = relativePath.split('/');
      if (parts.length >= 2 && parts[0] === 'src') {
        const moduleName = parts[1].replace('.ts', '');

        // If it's a file directly in src/, categorize by filename
        if (parts.length === 2) {
          if (!modules.root) modules.root = {};
          modules.root[relativePath] = file;
        } else {
          // It's in a subdirectory
          if (!modules[moduleName]) modules[moduleName] = {};
          modules[moduleName][relativePath] = file;
        }
      }
    }
  }

  // Remove empty modules
  for (const key of Object.keys(modules)) {
    if (Object.keys(modules[key]).length === 0) {
      delete modules[key];
    }
  }
  return modules;
}

/**
 * Build dependency matrix
 */
function buildDependencyMatrix(files: ParsedFile[]): DependencyMatrix {
  const matrix: DependencyMatrix = {};

  for (const file of files) {
    const importedFrom = new Set<string>();
    const exportsTo = new Set<string>();

    // Find what this file imports from
    for (const dep of file.internalDependencies) {
      importedFrom.add(dep.file);
    }

    // Find what files export to this file
    for (const other of files) {
      if (other.path === file.path) continue;
      for (const dep of other.internalDependencies) {
        const resolvedPath = resolvePath(other.path, dep.file);
        if (resolvedPath === file.path || resolvedPath === file.path.replace('.ts', '')) {
          exportsTo.add(other.path);
        }
      }
    }

    matrix[file.path] = {
      importsFrom: [...importedFrom],
      exportsTo: [...exportsTo],
    };
  }

  return matrix;
}

/**
 * Resolve relative path
 */
function resolvePath(fromPath: string, relativePath: string): string {
  const dir = dirname(fromPath);
  let resolved = join(dir, relativePath);

  // Remove .js extension if present
  resolved = resolved.replace(/\.js$/, '');

  // Add .ts extension if not present
  if (!resolved.endsWith('.ts')) {
    resolved = resolved + '.ts';
  }

  // Normalize path separators
  resolved = resolved.replace(/\\/g, '/');

  return resolved;
}

/**
 * Find all files reachable from entry points via internal dependencies (BFS).
 * Used in monorepo mode to distinguish active from dormant code.
 */
function findReachableFiles(entryPoints: string[], allFiles: ParsedFile[]): Set<string> {
  const fileMap = new Map<string, ParsedFile>();
  for (const f of allFiles) fileMap.set(f.path, f);

  const reachable = new Set<string>();
  const queue = [...entryPoints];

  while (queue.length > 0) {
    const current = queue.pop()!;
    if (reachable.has(current)) continue;
    reachable.add(current);

    const file = fileMap.get(current);
    if (!file) continue;

    for (const dep of file.internalDependencies) {
      const resolved = resolvePath(current, dep.file);
      if (fileMap.has(resolved) && !reachable.has(resolved)) {
        queue.push(resolved);
      }
    }

    // Workspace (cross-package, scoped-name) imports also reach into
    // the imported package's entry-point file. Without this edge,
    // packages consumed only via their npm-scoped name (e.g.
    // `@danielsimonjr/mathts-workerpool` from `parallel/`) get
    // false-flagged as unused/dormant.
    for (const ws of file.workspaceDependencies) {
      const target = workspaceEntryPath(ws.package);
      if (target && fileMap.has(target) && !reachable.has(target)) {
        queue.push(target);
      }
    }
  }

  return reachable;
}

/**
 * Resolve a workspace package name to its entry-point file path
 * (`<srcDir>/index.ts`). Returns undefined if the package isn't a
 * known workspace member.
 */
function workspaceEntryPath(packageName: string): string | undefined {
  const ws = workspaceMap.get(packageName);
  if (!ws) return undefined;
  return `${ws.srcDir}/index.ts`;
}

interface CircularDependencyResult {
  all: string[][];
  runtime: string[][]; // Non-type-only cycles (real runtime issues)
  typeOnly: string[][]; // Type-only cycles (safe, no runtime impact)
}

/**
 * Detect circular dependencies, distinguishing runtime from type-only cycles
 */
function detectCircularDependencies(files: ParsedFile[]): CircularDependencyResult {
  const filePaths = new Set(files.map((f) => f.path));

  // Build both runtime-only and all-dependencies graphs
  const runtimeGraph = new Map<string, string[]>();
  const allGraph = new Map<string, string[]>();

  for (const file of files) {
    const runtimeDeps: string[] = [];
    const allDeps: string[] = [];

    for (const d of file.internalDependencies) {
      const resolved = resolvePath(file.path, d.file);
      if (filePaths.has(resolved)) {
        allDeps.push(resolved);
        // Only add to runtime graph if NOT type-only
        if (!d.typeOnly) {
          runtimeDeps.push(resolved);
        }
      }
    }
    runtimeGraph.set(file.path, runtimeDeps);
    allGraph.set(file.path, allDeps);
  }

  function findCycles(graph: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();

    function dfs(node: string, path: string[]): void {
      if (inStack.has(node)) {
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart);
          cycle.push(node);
          const cycleKey = [...cycle].sort().join('->');
          if (!cycles.some((c) => [...c].sort().join('->') === cycleKey)) {
            cycles.push(cycle);
          }
        }
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      inStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        dfs(neighbor, path);
      }

      path.pop();
      inStack.delete(node);
    }

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  const allCycles = findCycles(allGraph);
  const runtimeCycles = findCycles(runtimeGraph);

  // Type-only cycles = cycles in all but not in runtime
  const runtimeCycleKeys = new Set(runtimeCycles.map((c) => [...c].sort().join('->')));
  const typeOnlyCycles = allCycles.filter((c) => !runtimeCycleKeys.has([...c].sort().join('->')));

  return {
    all: allCycles,
    runtime: runtimeCycles,
    typeOnly: typeOnlyCycles,
  };
}

/**
 * Detect unused files and exports
 */
function detectUnused(files: ParsedFile[], testFiles: ParsedFile[] = []): UnusedAnalysis {
  const filePaths = new Set(files.map((f) => f.path));

  // Build a set of all imported files
  const importedFiles = new Set<string>();
  // Build a map of all imported symbols per file
  const importedSymbols = new Map<string, Set<string>>();

  // Walk source files + test files (when supplied) so that test-only
  // imports (e.g. `resetPolyWasm`, `WASM_TRIDIAG_THRESHOLD`) register as
  // legitimate consumers and don't false-flag exported test helpers.
  for (const file of [...files, ...testFiles]) {
    for (const dep of file.internalDependencies) {
      const resolved = resolvePath(file.path, dep.file);
      if (filePaths.has(resolved)) {
        importedFiles.add(resolved);

        // Track which symbols are imported
        if (!importedSymbols.has(resolved)) {
          importedSymbols.set(resolved, new Set());
        }
        const symbols = importedSymbols.get(resolved)!;
        for (const imp of dep.imports) {
          if (imp === '*') {
            // Wildcard import - mark all exports as used
            symbols.add('*');
          } else {
            symbols.add(imp.replace(/^\* as /, ''));
          }
        }
      }
    }

    // Cross-package workspace imports count as use of the imported
    // package's entry-point file (and the symbols listed in the
    // import). Without this, every workspace-only consumer looks like
    // dead code to the unused-export detector.
    for (const ws of file.workspaceDependencies) {
      const target = workspaceEntryPath(ws.package);
      if (!target || !filePaths.has(target)) continue;
      importedFiles.add(target);
      if (!importedSymbols.has(target)) importedSymbols.set(target, new Set());
      const symbols = importedSymbols.get(target)!;
      for (const imp of ws.imports) {
        if (imp === '*') {
          symbols.add('*');
        } else {
          symbols.add(imp.replace(/^\* as /, ''));
        }
      }
    }
  }

  // Find unused files (excluding entry point and index files which are re-export hubs)
  const unusedFiles: string[] = [];
  for (const file of files) {
    if (file.path === 'src/index.ts') continue; // Entry point is always "used"
    if (file.name === 'index' && file.exports.reExported.length > 0) continue; // Re-export hubs
    if (!importedFiles.has(file.path)) {
      unusedFiles.push(file.path);
    }
  }

  // Find unused exports
  const unusedExports: UnusedExport[] = [];
  for (const file of files) {
    const usedSymbols = importedSymbols.get(file.path);
    const isWildcardImported = usedSymbols?.has('*');

    // Skip if file is not imported at all (already reported as unused file)
    // or if it's wildcard imported (all exports considered used)
    if (!usedSymbols || isWildcardImported) continue;

    // Check each export
    for (const fn of file.exports.functions) {
      if (!usedSymbols.has(fn)) {
        unusedExports.push({ file: file.path, name: fn, type: 'function' });
      }
    }
    for (const cls of file.exports.classes) {
      if (!usedSymbols.has(cls)) {
        unusedExports.push({ file: file.path, name: cls, type: 'class' });
      }
    }
    for (const iface of file.exports.interfaces) {
      if (!usedSymbols.has(iface)) {
        unusedExports.push({ file: file.path, name: iface, type: 'interface' });
      }
    }
    for (const type of file.exports.types) {
      if (!usedSymbols.has(type) && !file.exports.interfaces.includes(type)) {
        unusedExports.push({ file: file.path, name: type, type: 'type' });
      }
    }
    for (const en of file.exports.enums) {
      if (!usedSymbols.has(en)) {
        unusedExports.push({ file: file.path, name: en, type: 'enum' });
      }
    }
    for (const constant of file.exports.constants) {
      if (!usedSymbols.has(constant)) {
        unusedExports.push({ file: file.path, name: constant, type: 'constant' });
      }
    }
  }

  return { unusedFiles, unusedExports };
}

/**
 * Generate statistics from parsed files
 */
function generateStatistics(
  files: ParsedFile[],
  modules: ModuleMap,
  circularDeps: CircularDependencyResult,
  unusedAnalysis: UnusedAnalysis
): Statistics {
  let totalExports = 0;
  let totalClasses = 0;
  let totalInterfaces = 0;
  let totalFunctions = 0;
  let totalTypeGuards = 0;
  let totalEnums = 0;
  let totalConstants = 0;
  let totalLines = 0;
  let totalReExports = 0;
  let totalTypeOnlyImports = 0;

  for (const file of files) {
    totalExports += file.exports.named.length;
    totalClasses += file.exports.classes.length;
    totalInterfaces += file.exports.interfaces.length;
    totalFunctions += file.exports.functions.length;
    totalEnums += file.exports.enums.length;
    totalConstants += file.exports.constants.length;
    totalReExports += file.exports.reExported.length;

    // Count type-only imports
    totalTypeOnlyImports += file.internalDependencies.filter((d) => d.typeOnly).length;

    // Count type guards (functions starting with 'is')
    totalTypeGuards += file.exports.functions.filter((f) => f.startsWith('is')).length;

    // Count lines
    try {
      const content = readFileSync(join(ROOT_DIR, file.path), 'utf-8');
      totalLines += content.split('\n').length;
    } catch {
      // Ignore
    }
  }

  return {
    totalTypeScriptFiles: files.length,
    totalModules: Object.keys(modules).length,
    totalLinesOfCode: totalLines,
    totalExports,
    totalClasses,
    totalInterfaces,
    totalFunctions,
    totalTypeGuards,
    totalEnums,
    totalConstants,
    totalReExports,
    totalTypeOnlyImports,
    runtimeCircularDeps: circularDeps.runtime.length,
    typeOnlyCircularDeps: circularDeps.typeOnly.length,
    unusedFilesCount: unusedAnalysis.unusedFiles.length,
    unusedExportsCount: unusedAnalysis.unusedExports.length,
  };
}

/**
 * Generate JSON output
 */
function generateJSON(
  files: ParsedFile[],
  modules: ModuleMap,
  stats: Statistics,
  circularDeps: CircularDependencyResult
): object {
  const today = new Date().toISOString().split('T')[0];

  // Convert modules to JSON-friendly format
  const modulesJson: Record<string, Record<string, object>> = {};
  for (const [category, categoryFiles] of Object.entries(modules)) {
    modulesJson[category] = {};
    for (const [path, file] of Object.entries(categoryFiles)) {
      const fileData: Record<string, unknown> = {
        description: file.description || generateFallbackDescription(file),
        externalDependencies: file.externalDependencies,
        nodeDependencies: file.nodeDependencies,
        internalDependencies: file.internalDependencies.map((d) => ({
          file: d.file,
          imports: d.imports,
          ...(d.reExport ? { reExport: true } : {}),
          ...(d.typeOnly ? { typeOnly: true } : {}),
        })),
        exports: file.exports.named,
        reExported: file.exports.reExported.length > 0 ? file.exports.reExported : undefined,
        classes: file.exports.classes.length > 0 ? file.exports.classes : undefined,
        interfaces: file.exports.interfaces.length > 0 ? file.exports.interfaces : undefined,
        functions: file.exports.functions.length > 0 ? file.exports.functions : undefined,
        enums: file.exports.enums.length > 0 ? file.exports.enums : undefined,
        constants: file.exports.constants.length > 0 ? file.exports.constants : undefined,
      };

      // Clean up undefined values
      Object.keys(fileData).forEach((key) => {
        if (fileData[key] === undefined) {
          delete fileData[key];
        }
      });

      modulesJson[category][path] = fileData;
    }
  }

  // Build layers from modules
  const layers = Object.keys(modules)
    .map((name) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      files: Object.keys(modules[name]),
    }))
    .filter((l) => l.files.length > 0);

  return {
    metadata: {
      name: packageJson.name,
      version: packageJson.version,
      lastUpdated: today,
      totalFiles: stats.totalTypeScriptFiles,
      totalModules: stats.totalModules,
      totalExports: stats.totalExports,
    },
    entryPoints: files
      .filter((f) => f.path.endsWith('src/index.ts'))
      .map((f) => ({
        file: f.path,
        type: 'main',
        description: f.description || 'Entry Point',
      })),
    modules: modulesJson,
    dependencyGraph: {
      circularDependencies: {
        runtime: circularDeps.runtime,
        typeOnly: circularDeps.typeOnly,
        total: circularDeps.all.length,
        runtimeCount: circularDeps.runtime.length,
        typeOnlyCount: circularDeps.typeOnly.length,
      },
      layers,
    },
    statistics: stats,
  };
}

/**
 * Generate a dynamic Mermaid diagram from actual dependencies
 */
function generateMermaidDiagram(modules: ModuleMap, files: ParsedFile[]): string {
  const lines: string[] = [];
  lines.push('```mermaid');
  lines.push('graph TD');

  // Create subgraphs for each module
  const moduleNames = Object.keys(modules);
  const nodeIds = new Map<string, string>();
  let nodeCounter = 0;

  for (const moduleName of moduleNames) {
    const title = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
    lines.push(`    subgraph ${title}`);

    const moduleFiles = Object.keys(modules[moduleName]);
    for (const filePath of moduleFiles.slice(0, 10)) {
      // Limit to 10 files per module
      const name = basename(filePath, '.ts');
      const nodeId = `N${nodeCounter++}`;
      nodeIds.set(filePath, nodeId);
      lines.push(`        ${nodeId}[${name}]`);
    }

    if (moduleFiles.length > 10) {
      const nodeId = `N${nodeCounter++}`;
      lines.push(`        ${nodeId}[...${moduleFiles.length - 10} more]`);
    }

    lines.push('    end');
    lines.push('');
  }

  // Add edges for dependencies (limited for readability)
  const addedEdges = new Set<string>();
  let edgeCount = 0;
  const maxEdges = 75;

  for (const file of files) {
    const sourceId = nodeIds.get(file.path);
    if (!sourceId) continue;

    for (const dep of file.internalDependencies) {
      if (edgeCount >= maxEdges) break;

      const resolved = resolvePath(file.path, dep.file);
      const targetId = nodeIds.get(resolved);

      if (targetId && sourceId !== targetId) {
        const edgeKey = `${sourceId}-${targetId}`;
        if (!addedEdges.has(edgeKey)) {
          lines.push(`    ${sourceId} --> ${targetId}`);
          addedEdges.add(edgeKey);
          edgeCount++;
        }
      }
    }
  }

  lines.push('```');
  return lines.join('\n');
}

/**
 * Generate Markdown output
 */
function generateMarkdown(
  files: ParsedFile[],
  modules: ModuleMap,
  stats: Statistics,
  circularDeps: CircularDependencyResult,
  matrix: DependencyMatrix
): string {
  const today = new Date().toISOString().split('T')[0];
  const lines: string[] = [];
  const projectName = packageJson.name || 'Project';

  lines.push(`# ${projectName} - Dependency Graph`);
  lines.push('');
  lines.push(`**Version**: ${packageJson.version} | **Last Updated**: ${today}`);
  lines.push('');
  lines.push(
    'This document provides a comprehensive dependency graph of all files, components, imports, functions, and variables in the codebase.'
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  // Table of Contents
  lines.push('## Table of Contents');
  lines.push('');
  lines.push('1. [Overview](#overview)');
  lines.push('2. [Package Dependencies](#package-dependencies)');
  let tocIndex = 3;
  for (const category of Object.keys(modules)) {
    const title = category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' ');
    const slug = category
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    lines.push(`${tocIndex}. [${title} Dependencies](#${slug}-dependencies)`);
    tocIndex++;
  }
  lines.push(`${tocIndex}. [Dependency Matrix](#dependency-matrix)`);
  lines.push(`${tocIndex + 1}. [Circular Dependency Analysis](#circular-dependency-analysis)`);
  lines.push(`${tocIndex + 2}. [Visual Dependency Graph](#visual-dependency-graph)`);
  lines.push(`${tocIndex + 3}. [Summary Statistics](#summary-statistics)`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Overview
  lines.push('<a id="overview"></a>');
  lines.push('## Overview');
  lines.push('');
  lines.push('The codebase is organized into the following modules:');
  lines.push('');
  for (const [moduleName, moduleFiles] of Object.entries(modules)) {
    const fileCount = Object.keys(moduleFiles).length;
    lines.push(`- **${moduleName}**: ${fileCount} file${fileCount !== 1 ? 's' : ''}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Generate sections for each module category
  for (const [category, categoryFiles] of Object.entries(modules)) {
    const title = category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' ');
    const sectionSlug = category
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    lines.push(`<a id="${sectionSlug}-dependencies"></a>`);
    lines.push('');
    lines.push(`## ${title} Dependencies`);
    lines.push('');

    for (const [path, file] of Object.entries(categoryFiles)) {
      lines.push(`### \`${path}\` - ${file.description || generateFallbackDescription(file)}`);
      lines.push('');

      // External dependencies
      if (file.externalDependencies.length > 0) {
        lines.push('**External Dependencies:**');
        lines.push('| Package | Import |');
        lines.push('|---------|--------|');
        for (const dep of file.externalDependencies) {
          lines.push(`| \`${dep.package}\` | \`${dep.imports.join(', ')}\` |`);
        }
        lines.push('');
      }

      // Node dependencies
      if (file.nodeDependencies.length > 0) {
        lines.push('**Node.js Built-in Dependencies:**');
        lines.push('| Module | Import |');
        lines.push('|--------|--------|');
        for (const dep of file.nodeDependencies) {
          lines.push(`| \`${dep.module}\` | \`${dep.imports.join(', ')}\` |`);
        }
        lines.push('');
      }

      // Internal dependencies
      if (file.internalDependencies.length > 0) {
        lines.push('**Internal Dependencies:**');
        lines.push('| File | Imports | Type |');
        lines.push('|------|---------|------|');
        for (const dep of file.internalDependencies) {
          let usage = dep.reExport ? 'Re-export' : 'Import';
          if (dep.typeOnly) usage += ' (type-only)';
          lines.push(`| \`${dep.file}\` | \`${dep.imports.join(', ')}\` | ${usage} |`);
        }
        lines.push('');
      }

      // Exports
      if (
        file.exports.named.length > 0 ||
        file.exports.default ||
        file.exports.reExported.length > 0 ||
        file.exports.interfaces.length > 0 ||
        file.exports.types.length > 0
      ) {
        lines.push('**Exports:**');
        if (file.exports.classes.length > 0) {
          lines.push(`- Classes: \`${file.exports.classes.join('`, `')}\``);
        }
        if (file.exports.interfaces.length > 0) {
          lines.push(`- Interfaces: \`${file.exports.interfaces.join('`, `')}\``);
        }
        const typeAliases = file.exports.types.filter((t) => !file.exports.interfaces.includes(t));
        if (typeAliases.length > 0) {
          lines.push(`- Types: \`${typeAliases.join('`, `')}\``);
        }
        if (file.exports.enums.length > 0) {
          lines.push(`- Enums: \`${file.exports.enums.join('`, `')}\``);
        }
        if (file.exports.functions.length > 0) {
          lines.push(`- Functions: \`${file.exports.functions.join('`, `')}\``);
        }
        if (file.exports.constants.length > 0) {
          lines.push(`- Constants: \`${file.exports.constants.join('`, `')}\``);
        }
        if (file.exports.reExported.length > 0) {
          lines.push(`- Re-exports: \`${file.exports.reExported.join('`, `')}\``);
        }
        if (file.exports.default) {
          lines.push(`- Default: \`${file.exports.default}\``);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  // Dependency Matrix
  lines.push('<a id="dependency-matrix"></a>');
  lines.push('## Dependency Matrix');
  lines.push('');
  lines.push('### File Import/Export Matrix');
  lines.push('');
  lines.push('| File | Imports From | Exports To |');
  lines.push('|------|--------------|------------|');

  const matrixEntries = Object.entries(matrix)
    .sort(
      (a, b) =>
        b[1].importsFrom.length +
        b[1].exportsTo.length -
        (a[1].importsFrom.length + a[1].exportsTo.length)
    )
    .slice(0, 40); // Top 40 by connectivity
  for (const [filePath, deps] of matrixEntries) {
    // Use relative path (e.g., "core/src/typed/mathts-typed") instead of just basename
    const shortPath = filePath.replace(/\.ts$/, '');
    const importsCount = deps.importsFrom.length;
    const exportsCount = deps.exportsTo.length;
    lines.push(
      `| \`${shortPath}\` | ${importsCount} file${importsCount !== 1 ? 's' : ''} | ${exportsCount} file${exportsCount !== 1 ? 's' : ''} |`
    );
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Circular Dependencies
  lines.push('<a id="circular-dependency-analysis"></a>');
  lines.push('## Circular Dependency Analysis');
  lines.push('');
  if (circularDeps.all.length === 0) {
    lines.push('**No circular dependencies detected.**');
  } else {
    lines.push(`**${circularDeps.all.length} circular dependencies detected:**`);
    lines.push('');
    lines.push(`- **Runtime cycles**: ${circularDeps.runtime.length} (require attention)`);
    lines.push(`- **Type-only cycles**: ${circularDeps.typeOnly.length} (safe, no runtime impact)`);
    lines.push('');

    if (circularDeps.runtime.length > 0) {
      lines.push('### Runtime Circular Dependencies');
      lines.push('');
      lines.push('These cycles involve runtime imports and may cause issues:');
      lines.push('');
      for (const cycle of circularDeps.runtime.slice(0, 10)) {
        lines.push(`- ${cycle.join(' -> ')}`);
      }
      if (circularDeps.runtime.length > 10) {
        lines.push(`- ... and ${circularDeps.runtime.length - 10} more`);
      }
      lines.push('');
    }

    if (circularDeps.typeOnly.length > 0) {
      lines.push('### Type-Only Circular Dependencies');
      lines.push('');
      lines.push('These cycles only involve type imports and are safe (erased at runtime):');
      lines.push('');
      for (const cycle of circularDeps.typeOnly.slice(0, 10)) {
        lines.push(`- ${cycle.join(' -> ')}`);
      }
      if (circularDeps.typeOnly.length > 10) {
        lines.push(`- ... and ${circularDeps.typeOnly.length - 10} more`);
      }
      lines.push('');
    }
  }
  lines.push('---');
  lines.push('');

  // Visual Dependency Graph
  lines.push('<a id="visual-dependency-graph"></a>');
  lines.push('## Visual Dependency Graph');
  lines.push('');
  lines.push(generateMermaidDiagram(modules, files));
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary Statistics
  lines.push('<a id="summary-statistics"></a>');
  lines.push('## Summary Statistics');
  lines.push('');
  lines.push('| Category | Count |');
  lines.push('|----------|-------|');
  lines.push(`| Total TypeScript Files | ${stats.totalTypeScriptFiles} |`);
  lines.push(`| Total Modules | ${stats.totalModules} |`);
  lines.push(`| Total Lines of Code | ${stats.totalLinesOfCode} |`);
  lines.push(`| Total Exports | ${stats.totalExports} |`);
  lines.push(`| Total Re-exports | ${stats.totalReExports} |`);
  lines.push(`| Total Classes | ${stats.totalClasses} |`);
  lines.push(`| Total Interfaces | ${stats.totalInterfaces} |`);
  lines.push(`| Total Functions | ${stats.totalFunctions} |`);
  lines.push(`| Total Type Guards | ${stats.totalTypeGuards} |`);
  lines.push(`| Total Enums | ${stats.totalEnums} |`);
  lines.push(`| Type-only Imports | ${stats.totalTypeOnlyImports} |`);
  lines.push(`| Runtime Circular Deps | ${stats.runtimeCircularDeps} |`);
  lines.push(`| Type-only Circular Deps | ${stats.typeOnlyCircularDeps} |`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`*Last Updated*: ${today}`);
  lines.push(`*Version*: ${packageJson.version}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate compact summary for LLM consumption (~10KB target)
 * Uses CTON-style compression: no whitespace, abbreviated keys
 */
function generateCompactSummary(
  files: ParsedFile[],
  modules: ModuleMap,
  stats: Statistics,
  circularDeps: CircularDependencyResult
): string {
  // Abbreviate module names and create compact structure
  const summary = {
    m: {
      // metadata
      n: packageJson.name,
      v: packageJson.version,
      d: new Date().toISOString().split('T')[0],
      f: stats.totalTypeScriptFiles,
      e: stats.totalExports,
      re: stats.totalReExports,
    },
    s: {
      // statistics
      loc: stats.totalLinesOfCode,
      cls: stats.totalClasses,
      int: stats.totalInterfaces,
      fn: stats.totalFunctions,
      tg: stats.totalTypeGuards,
      en: stats.totalEnums,
      co: stats.totalConstants,
      toi: stats.totalTypeOnlyImports,
    },
    c: {
      // circular deps
      rt: circularDeps.runtime.length,
      to: circularDeps.typeOnly.length,
      // Only include first 5 runtime cycles (if any) for context
      rtp: circularDeps.runtime
        .slice(0, 5)
        .map((c) => c.map((p) => p.split('/').pop()?.replace('.ts', '')).join('→')),
    },
    mod: {} as Record<string, { f: number; exp: string[]; cls?: string[]; int?: string[] }>,
    // Hot paths: files with most dependencies
    hp: [] as { p: string; i: number; o: number }[],
  };

  // Compact module summary
  for (const [modName, modFiles] of Object.entries(modules)) {
    const fileList = Object.values(modFiles);
    const exports = fileList
      .flatMap((f) => f.exports.named)
      .map(cleanExportName)
      .filter(Boolean)
      .slice(0, 20);
    const classes = fileList.flatMap((f) => f.exports.classes);
    const interfaces = fileList.flatMap((f) => f.exports.interfaces).slice(0, 10);

    summary.mod[modName] = {
      f: Object.keys(modFiles).length,
      exp: [...new Set(exports)],
    };
    if (classes.length > 0) summary.mod[modName].cls = [...new Set(classes)];
    if (interfaces.length > 0) summary.mod[modName].int = [...new Set(interfaces)];
  }

  // Find hot paths (files with highest connectivity)
  const connectivity = files
    .map((f) => ({
      p: f.path.split('/').slice(-2).join('/'),
      i: f.internalDependencies.length,
      o: files.filter((other) =>
        other.internalDependencies.some((d) => {
          const resolved = resolvePath(other.path, d.file);
          return resolved === f.path;
        })
      ).length,
    }))
    .sort((a, b) => b.i + b.o - (a.i + a.o));

  summary.hp = connectivity.slice(0, 15);

  // Output as minified JSON (CTON-style: no whitespace)
  return JSON.stringify(summary);
}

/**
 * Generate test coverage analysis markdown
 */
function generateTestCoverageMarkdown(coverage: TestCoverageAnalysis): string {
  const lines: string[] = [];
  const today = new Date().toISOString().split('T')[0];

  lines.push('# Test Coverage Analysis');
  lines.push('');
  lines.push(`**Generated**: ${today}`);
  lines.push('');

  // Summary statistics
  const totalSource = coverage.sourceFiles.length;
  const totalTested = coverage.testedFiles.length;
  const totalUntested = coverage.untestedFiles.length;
  const coveragePercent = totalSource > 0 ? ((totalTested / totalSource) * 100).toFixed(1) : '0';

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Total Source Files | ${totalSource} |`);
  lines.push(`| Total Test Files | ${coverage.testFiles.length} |`);
  lines.push(`| Source Files with Tests | ${totalTested} |`);
  lines.push(`| Source Files without Tests | ${totalUntested} |`);
  lines.push(`| Coverage (raw, direct-import) | **${coveragePercent}%** |`);

  // Effective-coverage companion metric — only emitted when a
  // coverage-policy.json was loaded successfully.
  const b = coverage.policyBreakdown;
  if (coverage.policy) {
    lines.push(
      `| Coverage (effective, active code only) | **${b.effectivePercent}%** (${b.testedActive} / ${b.activeFiles}) |`
    );
    lines.push('');
    lines.push(
      '> The raw figure counts every source file the CDG tool finds, including code that is intentionally not direct-imported by a vitest `*.test.ts` (synced mathjs categories, AssemblyScript sources, type-only barrels, …). The **effective** figure excludes those per `docs/Architecture/coverage-policy.json` so the number reflects the genuinely-active hand-written code only. See [`COVERAGE_POLICY.md`](./COVERAGE_POLICY.md) for the policy.'
    );
    lines.push('');

    // Category breakdown table
    lines.push('### Untested-file breakdown by category');
    lines.push('');
    lines.push('| Category | Count | Why it is intentionally untested |');
    lines.push('|---|---:|---|');
    for (const [id, cat] of Object.entries(coverage.policy.categories)) {
      const count = b.byCategory[id] ?? 0;
      if (count === 0) continue;
      lines.push(`| **${cat.label}** | ${count} | ${cat.rationale.split('.')[0]}. |`);
    }
    const activeUntested = b.byCategory.active_untested ?? 0;
    lines.push(
      `| **Active (real gap — needs a test)** | ${activeUntested} | These are the files that should grow a direct-import test. |`
    );
    lines.push('');
  }
  lines.push('---');
  lines.push('');

  // Untested files (the main deliverable)
  lines.push('## Source Files Without Test Coverage');
  lines.push('');
  if (coverage.untestedFiles.length === 0) {
    lines.push('**All source files have test coverage!** 🎉');
  } else {
    lines.push(
      `The following ${coverage.untestedFiles.length} source files are not directly imported by any test file:`
    );
    lines.push('');

    // Group by module
    const byModule = new Map<string, string[]>();
    for (const file of coverage.untestedFiles) {
      const parts = file.split('/');
      const module = parts.length >= 3 ? parts[1] : 'root';
      if (!byModule.has(module)) byModule.set(module, []);
      byModule.get(module)!.push(file);
    }

    for (const [module, files] of byModule) {
      lines.push(`### ${module}/`);
      lines.push('');
      for (const file of files.sort()) {
        const fileName = basename(file, '.ts');
        lines.push(`- \`${file}\` → Expected test: \`tests/unit/${module}/${fileName}.test.ts\``);
      }
      lines.push('');
    }
  }
  lines.push('---');
  lines.push('');

  // Files with tests
  lines.push('## Source Files With Test Coverage');
  lines.push('');
  lines.push('| Source File | Test Files |');
  lines.push('|-------------|------------|');

  const sortedTested = [...coverage.testedFiles].sort();
  for (const sourcePath of sortedTested) {
    const tests = coverage.coverageMap.get(sourcePath) || [];
    const shortSource = sourcePath.split('/').slice(-2).join('/');
    const shortTests = tests.map((t) => `\`${basename(t)}\``).join(', ');
    lines.push(`| \`${shortSource}\` | ${shortTests} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Test file details
  lines.push('## Test File Details');
  lines.push('');
  lines.push('| Test File | Imports from Source |');
  lines.push('|-----------|---------------------|');

  for (const [testPath, sources] of coverage.testToSourceMap) {
    const shortTest = testPath.split('/').slice(-2).join('/');
    const sourceCount = sources.length;
    lines.push(`| \`${shortTest}\` | ${sourceCount} files |`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate test coverage JSON
 */
function generateTestCoverageJson(coverage: TestCoverageAnalysis): object {
  const coverageMapObj: Record<string, string[]> = {};
  for (const [source, tests] of coverage.coverageMap) {
    coverageMapObj[source] = tests;
  }

  const testToSourceObj: Record<string, string[]> = {};
  for (const [test, sources] of coverage.testToSourceMap) {
    testToSourceObj[test] = sources;
  }

  const b = coverage.policyBreakdown;
  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalSourceFiles: coverage.sourceFiles.length,
      totalTestFiles: coverage.testFiles.length,
      testedCount: coverage.testedFiles.length,
      untestedCount: coverage.untestedFiles.length,
      coveragePercent:
        coverage.sourceFiles.length > 0
          ? ((coverage.testedFiles.length / coverage.sourceFiles.length) * 100).toFixed(1)
          : '0',
      // Companion 'effective' coverage — the same direct-import metric but
      // computed over the active (non-policy-excluded) file set only. When
      // no coverage-policy.json is present, this collapses to the raw figure.
      effectiveCoverage: {
        policyLoaded: coverage.policy !== null,
        activeFiles: b.activeFiles,
        testedActive: b.testedActive,
        activeUntested: b.byCategory.active_untested ?? 0,
        excludedTotal: b.excludedTotal,
        percent: b.effectivePercent,
        breakdown: b.byCategory,
      },
    },
    untestedFiles: coverage.untestedFiles.sort(),
    testedFiles: coverage.testedFiles.sort(),
    coverageMap: coverageMapObj,
    testToSourceMap: testToSourceObj,
    // Per-file classification of every untested file. category=null means
    // the file is a genuine gap (not matched by any policy category).
    classifiedUntested: b.classifiedUntested.slice().sort((a, c) => a.file.localeCompare(c.file)),
  };
}

/**
 * Generate package-level dependency markdown section for monorepo mode.
 */
function generatePackageDependencySection(
  parsedFiles: ParsedFile[],
  workspaces: Map<string, WorkspacePackage>,
  reachableFiles?: Set<string>,
  dormantFiles?: Set<string>
): string {
  const lines: string[] = [];

  lines.push('<a id="package-dependencies"></a>');
  lines.push('## Package Dependencies');
  lines.push('');

  // Build package-level dependency map from workspace deps
  const pkgDeps = new Map<string, Set<string>>();
  for (const [name] of workspaces) pkgDeps.set(name, new Set());

  for (const file of parsedFiles) {
    if (!file.packageName) continue;
    // Only count deps from reachable (active) files, not dormant ones
    if (reachableFiles && !reachableFiles.has(file.path)) continue;
    for (const wsDep of file.workspaceDependencies) {
      // Skip self-references (package importing itself by npm name)
      if (wsDep.package !== file.packageName) {
        pkgDeps.get(file.packageName)?.add(wsDep.package);
      }
    }
  }

  // Package dependency table
  lines.push('| Package | Depends On | Files (Active) | Files (Dormant) |');
  lines.push('|---------|------------|----------------|-----------------|');

  for (const [name, ws] of workspaces) {
    const deps = pkgDeps.get(name);
    const depStr = deps && deps.size > 0 ? [...deps].map((d) => `\`${d}\``).join(', ') : '(none)';

    const pkgFiles = parsedFiles.filter((f) => f.packageName === name);
    const activeCount = reachableFiles
      ? pkgFiles.filter((f) => reachableFiles.has(f.path)).length
      : pkgFiles.length;
    const dormantCount = dormantFiles ? pkgFiles.filter((f) => dormantFiles.has(f.path)).length : 0;

    lines.push(
      `| \`${name}\` (\`${ws.directory}/\`) | ${depStr} | ${activeCount} | ${dormantCount} |`
    );
  }

  lines.push('');

  // Mermaid package-level diagram
  lines.push('### Package Dependency Diagram');
  lines.push('');
  lines.push('```mermaid');
  lines.push('graph LR');

  // Create short IDs for packages
  const pkgIds = new Map<string, string>();
  let idx = 0;
  for (const [name, ws] of workspaces) {
    const id = `P${idx++}`;
    pkgIds.set(name, id);
    const shortName = ws.directory;
    lines.push(`    ${id}[${shortName}]`);
  }

  // Add edges
  for (const [name, deps] of pkgDeps) {
    const sourceId = pkgIds.get(name);
    if (!sourceId || !deps) continue;
    for (const dep of deps) {
      const targetId = pkgIds.get(dep);
      if (targetId) {
        lines.push(`    ${sourceId} --> ${targetId}`);
      }
    }
  }

  lines.push('```');
  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

/**
 * WASM-accelerator ↔ function pairing analysis.
 *
 * Scans the `functions` package's public typed API (`functions/src/typed/*.ts`)
 * and determines, per `mathTyped` export, whether it routes to a WASM bridge
 * (a `*Dispatch` call inside its definition) or runs pure-JS. This makes the
 * "which functions are WASM-accelerated" map a generated artifact instead of a
 * hand-maintained doc (see docs/Architecture/WASM_ACCELERATION.md).
 */
type Routing = 'wasm' | 'parallel' | 'wasm+parallel' | 'js-only';
/** Whether a wasm-routed function actually executes wasm on the *bundled* binary
 * (the AssemblyScript `mathts-as.wasm` the functions package loads by default),
 * or its dispatch bridge falls back to JS (it has no AS-managed execution path —
 * e.g. the poly-fit / Airy / argsort+rank kernels deliberately kept on JS pending
 * AS kernel-stabilization fixes). `unknown` when the bundled wasm or the
 * dispatch's bridge couldn't be resolved (e.g. dist not built). */
type EffectiveBackend = 'wasm' | 'js-fallback' | 'unknown';
interface WasmPairingEntry {
  name: string;
  file: string;
  routing: Routing;
  dispatch: string[];
  effectiveBackend: EffectiveBackend;
}
interface WasmPairing {
  generated: string;
  total: number;
  acceleratedCount: number; // routes to wasm (wasm or wasm+parallel)
  parallelOnlyCount: number; // worker-parallel, no wasm
  jsOnlyCount: number;
  /** Of acceleratedCount, how many actually run wasm vs fall back to JS on the
   * bundled binary (runtime probe of functions/dist/wasm/mathts-as.wasm — the AS
   * binary the functions package loads; AssemblyScript is the sole WASM backend). */
  bundledBackend: 'assemblyscript' | 'unknown';
  wasmEffectiveCount: number;
  jsFallbackCount: number;
  /** Detection is per-mathTyped-block direct references; routing reached only
   * through helper functions outside the block is not traced (under-reports). */
  accelerated: WasmPairingEntry[];
  parallelOnly: WasmPairingEntry[];
  jsOnly: string[];
  byFile: Record<string, { wasm: number; parallel: number; jsOnly: number }>;
}

/**
 * Runtime-effectiveness probe (the dynamic complement to the static routing scan).
 * A function may *route* to a `*Dispatch` yet still run JS at runtime, because the
 * dispatch's bridge has no AS-managed execution path (post Phase 5 functions
 * cutover the bridges dispatch AS→JS only; several `*Dispatch` deliberately stay
 * on JS — poly fits, Airy, argsort/rank — pending the Phase 6 AS-kernel fixes).
 * Determines, per `*Dispatch`, whether it actually executes wasm on the *bundled*
 * binary, by combining:
 *   (a) the bundled AS wasm's export list — does it have `__new`? (read
 *       synchronously via WebAssembly.Module.exports, no instantiation), and
 *   (b) whether each `*Dispatch`'s own body invokes a real AS execution helper
 *       (`withAsF64`/`withAsI32`/`runUnaryPtr`/`runChainPtr`/`makeUnaryArrayDispatch`,
 *       directly or via another in-file `*Dispatch` it delegates to).
 */
/**
 * Read a `.wasm` module's export-name table without instantiating it
 * (`WebAssembly.Module.exports` is a parse-only static read — no memory, no
 * imports, no start function). Returns the set of exported names, or `null` if
 * the file is missing or can't be parsed (e.g. dist not built). Used by the
 * runtime-effectiveness probe.
 */
function readWasmExports(path: string): Set<string> | null {
  // Reference the WebAssembly global via a typed shim — the tool's tsconfig
  // doesn't include the DOM lib, so the global `WebAssembly` name isn't in scope.
  interface WasmModuleCtor {
    new (bytes: Uint8Array): object;
    exports(m: object): Array<{ name: string }>;
  }
  const WAModule = (globalThis as unknown as { WebAssembly?: { Module: WasmModuleCtor } })
    .WebAssembly?.Module;
  if (!WAModule || !existsSync(path)) return null;
  try {
    const mod = new WAModule(readFileSync(path));
    return new Set(WAModule.exports(mod).map((e) => e.name));
  } catch {
    return null;
  }
}

function analyzeWasmRuntime(rootDir: string): {
  bundledBackend: 'assemblyscript' | 'unknown';
  dispatchWasm: Map<string, boolean | null>;
} {
  const dispatchWasm = new Map<string, boolean | null>();

  // AssemblyScript is the sole WASM backend; the functions package loads
  // mathts-as.wasm. The probe confirms the managed runtime (`__new`) is present.
  const wasmPath = join(rootDir, 'functions', 'dist', 'wasm', 'mathts-as.wasm');
  const exports = readWasmExports(wasmPath);
  const bundledHasNew: boolean | null = exports === null ? null : exports.has('__new');
  const bundledBackend: 'assemblyscript' | 'unknown' =
    bundledHasNew === true ? 'assemblyscript' : 'unknown';

  const wasmDir = join(rootDir, 'functions', 'src', 'wasm');
  if (!existsSync(wasmDir)) return { bundledBackend, dispatchWasm };
  // A `*Dispatch` actually executes wasm iff its own body invokes one of the AS
  // execution helpers (directly or via another in-file `*Dispatch` it delegates
  // to). The bridges are AS→JS only post Phase 5, so this single marker set
  // captures the genuine wasm path; dispatches with no marker (poly fits, Airy,
  // argsort/rank) are honest js-fallback.
  const asExecRe = /\b(?:withAsF64|withAsI32|runUnaryPtr|runChainPtr|makeUnaryArrayDispatch)\b/;
  const defRe = /\b(?:function|const)\s+(\w+Dispatch)\b/g;
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts')) {
        const src = readFileSync(p, 'utf-8');
        // Slice the file into per-`*Dispatch` segments (def start → next def start).
        const segs: { name: string; body: string }[] = [];
        let dm: RegExpExecArray | null;
        defRe.lastIndex = 0;
        const marks: { name: string; idx: number }[] = [];
        while ((dm = defRe.exec(src)) !== null) marks.push({ name: dm[1], idx: dm.index });
        for (let i = 0; i < marks.length; i++) {
          const end = i + 1 < marks.length ? marks[i + 1].idx : src.length;
          segs.push({ name: marks[i].name, body: src.slice(marks[i].idx, end) });
        }
        // Initial: does the segment invoke an AS execution helper directly?
        const usesAs = new Map<string, boolean>();
        for (const s of segs) usesAs.set(s.name, asExecRe.test(s.body));
        // Propagate through in-file delegation (e.g. besselJDispatch →
        // besselOrderDispatch). Fixpoint; depth here is ≤ 2, 3 passes is safe.
        for (let pass = 0; pass < 3; pass++) {
          for (const s of segs) {
            if (usesAs.get(s.name)) continue;
            for (const other of segs) {
              if (other.name !== s.name && usesAs.get(other.name) && s.body.includes(other.name)) {
                usesAs.set(s.name, true);
                break;
              }
            }
          }
        }
        for (const s of segs) {
          // Unknown when we couldn't read the bundled binary; otherwise the AS
          // binary has __new, so wasm runs iff the dispatch has an AS exec path.
          const runsWasm = bundledHasNew === null ? null : bundledHasNew && usesAs.get(s.name)!;
          dispatchWasm.set(s.name, runsWasm);
        }
      }
    }
  };
  walk(wasmDir);
  return { bundledBackend, dispatchWasm };
}

function analyzeWasmPairing(rootDir: string): WasmPairing | null {
  const candidates = [join(rootDir, 'functions', 'src', 'typed'), join(rootDir, 'src', 'typed')];
  const typedDir = candidates.find((d) => existsSync(d));
  if (!typedDir) return null;

  const { bundledBackend, dispatchWasm } = analyzeWasmRuntime(rootDir);
  const effectiveOf = (isWasm: boolean, dispatch: string[]): EffectiveBackend => {
    if (!isWasm) return 'unknown';
    const vals = dispatch.map((d) => dispatchWasm.get(d));
    if (vals.some((v) => v === undefined || v === null)) return 'unknown';
    return vals.every((v) => v === true) ? 'wasm' : 'js-fallback';
  };

  const accelerated: WasmPairingEntry[] = [];
  const parallelOnly: WasmPairingEntry[] = [];
  const jsOnly: string[] = [];
  const byFile: Record<string, { wasm: number; parallel: number; jsOnly: number }> = {};

  for (const fname of readdirSync(typedDir)) {
    if (!fname.endsWith('.ts')) continue;
    const src = readFileSync(join(typedDir, fname), 'utf-8');
    const re = /export const (\w+) = mathTyped\(\s*'\w+'\s*,\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const name = m[1];
      // Brace-match the mathTyped({...}) object literal starting at its `{`.
      let depth = 0;
      const start = m.index + m[0].length - 1;
      let end = start;
      for (let i = start; i < src.length; i++) {
        const c = src[i];
        if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      const block = src.slice(start, end + 1);
      const dispatch = Array.from(new Set(block.match(/\b\w+Dispatch\b/g) ?? [])).sort();
      const isWasm = dispatch.length > 0;
      const isParallel = /\b(computePool|shouldParallelize)\b/.test(block);
      const routing: Routing = isWasm
        ? isParallel
          ? 'wasm+parallel'
          : 'wasm'
        : isParallel
          ? 'parallel'
          : 'js-only';
      if (!byFile[fname]) byFile[fname] = { wasm: 0, parallel: 0, jsOnly: 0 };
      const entry: WasmPairingEntry = {
        name,
        file: fname,
        routing,
        dispatch,
        effectiveBackend: effectiveOf(isWasm, dispatch),
      };
      if (isWasm) {
        accelerated.push(entry);
        byFile[fname].wasm++;
      } else if (isParallel) {
        parallelOnly.push(entry);
        byFile[fname].parallel++;
      } else {
        jsOnly.push(name);
        byFile[fname].jsOnly++;
      }
    }
  }

  accelerated.sort((a, b) => a.name.localeCompare(b.name));
  parallelOnly.sort((a, b) => a.name.localeCompare(b.name));
  jsOnly.sort();
  return {
    generated: new Date().toISOString().split('T')[0],
    total: accelerated.length + parallelOnly.length + jsOnly.length,
    acceleratedCount: accelerated.length,
    parallelOnlyCount: parallelOnly.length,
    jsOnlyCount: jsOnly.length,
    bundledBackend,
    wasmEffectiveCount: accelerated.filter((e) => e.effectiveBackend === 'wasm').length,
    jsFallbackCount: accelerated.filter((e) => e.effectiveBackend === 'js-fallback').length,
    accelerated,
    parallelOnly,
    jsOnly,
    byFile,
  };
}

function generateWasmPairingMarkdown(p: WasmPairing): string {
  let md = '# WASM Accelerator ↔ Function Pairing\n\n';
  md += `**Generated**: ${p.generated} (by tools/create-dependency-graph)\n\n`;
  md += `Per public \`mathTyped\` function in \`functions/src/typed/\`, its acceleration `;
  md += `routing: **wasm** (a \`*Dispatch\` bridge), **parallel** (worker pool via `;
  md += `\`computePool\`/\`shouldParallelize\`), or **js-only**. WASM engages for `;
  md += `\`Float64Array\` inputs above threshold; the functions dispatch is AS → JS.\n\n`;
  md += `> Detection is per-\`mathTyped\`-block direct references; routing reached only via `;
  md += `helper functions outside the block is not traced, so this can under-report.\n\n`;
  md += `| Routing (static) | Count |\n| --- | --: |\n`;
  md += `| WASM (incl. wasm+parallel) | ${p.acceleratedCount} |\n`;
  md += `| Parallel only (worker pool) | ${p.parallelOnlyCount} |\n`;
  md += `| JS-only | ${p.jsOnlyCount} |\n`;
  md += `| **Total** | **${p.total}** |\n\n`;
  md += `**Runtime effectiveness** (probe of the bundled \`functions/dist/wasm/mathts-as.wasm\`, `;
  md += `backend: **${p.bundledBackend}**): of the ${p.acceleratedCount} wasm-routed functions, `;
  md += `**${p.wasmEffectiveCount} actually execute wasm**, **${p.jsFallbackCount} fall back to JS** `;
  md += `(their \`*Dispatch\` has no AS-managed execution path — the poly-fit / Airy / argsort+rank `;
  md += `kernels are deliberately kept on JS pending AS kernel-stabilization fixes).\n\n`;
  md += `## WASM-accelerated functions\n\n| Function | Routing | Effective | Bridge dispatch | Module |\n| --- | --- | --- | --- | --- |\n`;
  for (const e of p.accelerated) {
    md += `| \`${e.name}\` | ${e.routing} | ${e.effectiveBackend} | \`${e.dispatch.join('`, `')}\` | ${e.file.replace(/\.ts$/, '')} |\n`;
  }
  md += `\n## Parallel-only functions (worker pool, not WASM)\n\n| Function | Module |\n| --- | --- |\n`;
  for (const e of p.parallelOnly) {
    md += `| \`${e.name}\` | ${e.file.replace(/\.ts$/, '')} |\n`;
  }
  md += `\n## Per-module counts\n\n| Module | WASM | Parallel | JS-only |\n| --- | --: | --: | --: |\n`;
  for (const f of Object.keys(p.byFile).sort()) {
    md += `| ${f.replace(/\.ts$/, '')} | ${p.byFile[f].wasm} | ${p.byFile[f].parallel} | ${p.byFile[f].jsOnly} |\n`;
  }
  md += `\n> Notes: matrix linear-algebra ops are WASM-accelerated separately via the `;
  md += `\`matrix\` package backend (not the typed-API dispatch counted here), which runs the `;
  md += `AssemblyScript binary for fft/eig/svd/decomposition. The elementwise transcendentals `;
  md += `(abs/sin/cos/tan/exp/log) plus the AS `;
  md += `special/poly/sort/signal/interp kernels are the wasm-effective set. The js-fallback `;
  md += `functions (poly fits, Airy, argsort/rank) are on JS because their AS kernels are broken `;
  md += `or unstable — tracked follow-ups.\n`;
  return md;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const cliOptions = parseCliOptions();

  console.log('Scanning codebase for dependencies...');
  if (cliOptions.includeTests) {
    console.log('Test file analysis enabled');
  }

  // Detect workspace packages
  workspaceMap = detectWorkspaces(ROOT_DIR);
  const isMonorepo = workspaceMap.size > 0;

  if (isMonorepo) {
    console.log(`Monorepo detected: ${workspaceMap.size} workspace packages`);
    for (const [name, ws] of workspaceMap) {
      console.log(`  - ${name} (${ws.directory}/)`);
    }
    if (cliOptions.all) {
      console.log('Including dormant/unreachable files (--all)');
    }
  }

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
  }

  // Get all TypeScript files
  let tsFiles: string[];
  if (isMonorepo) {
    // Scan each workspace package's src/ directory
    tsFiles = [];
    for (const [, ws] of workspaceMap) {
      const srcDir = join(ROOT_DIR, ws.srcDir);
      const pkgFiles = getAllTsFiles(srcDir);
      tsFiles.push(...pkgFiles);
      console.log(`  ${ws.directory}/src: ${pkgFiles.length} files`);
    }
  } else {
    tsFiles = getAllTsFiles(SRC_DIR);
  }
  console.log(`Found ${tsFiles.length} TypeScript files total`);

  if (tsFiles.length === 0) {
    console.error('No TypeScript files found');
    process.exit(1);
  }

  // Parse all files
  const parsedFiles = tsFiles.map(parseFile);
  console.log('Parsed all files');

  // Reachability analysis (monorepo only)
  let reachableSet: Set<string> | undefined;
  let dormantSet: Set<string> | undefined;
  let activeParsedFiles = parsedFiles;

  if (isMonorepo) {
    // Find entry points: each package's src/index.ts
    const entryPoints: string[] = [];
    for (const [, ws] of workspaceMap) {
      const entryPath = `${ws.srcDir}/index.ts`.replace(/\\/g, '/');
      const found = parsedFiles.find((f) => f.path === entryPath);
      if (found) {
        entryPoints.push(found.path);
      }
    }

    console.log(`Entry points: ${entryPoints.length}`);
    reachableSet = findReachableFiles(entryPoints, parsedFiles);
    dormantSet = new Set(parsedFiles.filter((f) => !reachableSet!.has(f.path)).map((f) => f.path));
    console.log(`Reachable files: ${reachableSet.size}`);
    console.log(`Dormant files: ${dormantSet.size}`);

    if (!cliOptions.all) {
      activeParsedFiles = parsedFiles.filter((f) => reachableSet!.has(f.path));
      console.log(
        `Analyzing ${activeParsedFiles.length} reachable files (use --all to include dormant)`
      );
    } else {
      activeParsedFiles = parsedFiles;
      console.log(`Analyzing all ${activeParsedFiles.length} files (including dormant)`);
    }
  }

  // Categorize into modules
  const modules = categorizeFiles(activeParsedFiles, isMonorepo);
  console.log(`Categorized into ${Object.keys(modules).length} modules`);

  // Detect circular dependencies
  const circularDeps = detectCircularDependencies(activeParsedFiles);
  console.log(
    `Found ${circularDeps.all.length} circular dependencies (${circularDeps.runtime.length} runtime, ${circularDeps.typeOnly.length} type-only)`
  );

  // Parse test files up-front when --include-tests is set so they can
  // also be fed into the unused-analysis (test-only imports of helpers
  // like `resetPolyWasm` would otherwise false-flag those helpers).
  let parsedTestFiles: ParsedFile[] = [];
  let testFilePaths: string[] = [];
  if (cliOptions.includeTests) {
    if (isMonorepo) {
      for (const [, ws] of workspaceMap) {
        const testDir = join(ROOT_DIR, ws.directory, 'tests');
        const srcDir = join(ROOT_DIR, ws.srcDir);
        testFilePaths.push(...getAllTestFiles(testDir));
        testFilePaths.push(...getAllTestFiles(srcDir));
      }
      const rootTestDir = join(ROOT_DIR, 'tests');
      testFilePaths.push(...getAllTestFiles(rootTestDir));
    } else {
      const testDir = join(ROOT_DIR, 'tests');
      testFilePaths = [...getAllTestFiles(testDir), ...getAllTestFiles(SRC_DIR)];
    }
    parsedTestFiles = testFilePaths.map(parseFile);
  }

  // Detect unused files and exports
  const unusedAnalysis = detectUnused(activeParsedFiles, parsedTestFiles);

  // Generate statistics
  const stats = generateStatistics(activeParsedFiles, modules, circularDeps, unusedAnalysis);
  console.log('Generated statistics');

  // Build dependency matrix
  const matrix = buildDependencyMatrix(activeParsedFiles);
  console.log('Built dependency matrix');

  // Generate outputs
  const json = generateJSON(activeParsedFiles, modules, stats, circularDeps);
  let markdown = generateMarkdown(activeParsedFiles, modules, stats, circularDeps, matrix);

  // Insert package-level section for monorepo mode
  if (isMonorepo) {
    const pkgSection = generatePackageDependencySection(
      parsedFiles,
      workspaceMap,
      reachableSet,
      dormantSet
    );
    // Insert after the Overview section
    const overviewMarker = '## Overview';
    const overviewIdx = markdown.indexOf(overviewMarker);
    if (overviewIdx !== -1) {
      // Find the '---' separator after Overview
      const sepIdx = markdown.indexOf('\n---\n', overviewIdx + overviewMarker.length);
      if (sepIdx !== -1) {
        const insertPoint = sepIdx + 5; // after '\n---\n'
        markdown = markdown.slice(0, insertPoint) + '\n' + pkgSection + markdown.slice(insertPoint);
      }
    }
  }

  // Write outputs
  writeFileSync(join(OUTPUT_DIR, 'dependency-graph.json'), JSON.stringify(json, null, 2));
  console.log('Written: docs/Architecture/dependency-graph.json');

  // Write YAML output (more compact, ~40% smaller than JSON)
  const yamlOutput = yaml.dump(json, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });
  writeFileSync(join(OUTPUT_DIR, 'dependency-graph.yaml'), yamlOutput);
  console.log('Written: docs/Architecture/dependency-graph.yaml');

  writeFileSync(join(OUTPUT_DIR, 'DEPENDENCY_GRAPH.md'), markdown);
  console.log('Written: docs/Architecture/DEPENDENCY_GRAPH.md');

  // Write compact summary for LLM consumption (CTON-style, ~10KB)
  const compactSummary = generateCompactSummary(activeParsedFiles, modules, stats, circularDeps);
  writeFileSync(join(OUTPUT_DIR, 'dependency-summary.compact.json'), compactSummary);
  const compactSize = Buffer.byteLength(compactSummary, 'utf8');
  console.log(
    `Written: docs/Architecture/dependency-summary.compact.json (${(compactSize / 1024).toFixed(1)}KB)`
  );

  // Test coverage analysis (when --include-tests is specified)
  let testCoverage: TestCoverageAnalysis | null = null;
  if (cliOptions.includeTests) {
    console.log('\nAnalyzing test coverage...');
    // Test files were parsed up-front so the unused-analysis could
    // also see them; reuse those parses here.
    console.log(`Found ${testFilePaths.length} test files`);

    // Analyze test coverage
    testCoverage = analyzeTestCoverage(activeParsedFiles, parsedTestFiles);

    // Generate test coverage outputs
    const testCoverageMarkdown = generateTestCoverageMarkdown(testCoverage);
    const testCoverageJson = generateTestCoverageJson(testCoverage);

    // Write test coverage outputs
    writeFileSync(join(OUTPUT_DIR, 'TEST_COVERAGE.md'), testCoverageMarkdown);
    console.log('Written: docs/Architecture/TEST_COVERAGE.md');

    writeFileSync(
      join(OUTPUT_DIR, 'test-coverage.json'),
      JSON.stringify(testCoverageJson, null, 2)
    );
    console.log('Written: docs/Architecture/test-coverage.json');
  }

  console.log('\nDependency graph generation complete!');
  if (isMonorepo) {
    console.log(`  - ${workspaceMap.size} workspace packages scanned`);
    if (reachableSet) {
      console.log(
        `  - ${reachableSet.size} reachable files, ${dormantSet?.size || 0} dormant files`
      );
    }
  }
  console.log(`  - ${stats.totalTypeScriptFiles} files analyzed`);
  console.log(`  - ${stats.totalExports} exports found (${stats.totalReExports} re-exports)`);
  console.log(`  - ${stats.totalTypeOnlyImports} type-only imports detected`);
  console.log(`  - ${circularDeps.all.length} circular dependencies:`);
  console.log(`      ${circularDeps.runtime.length} runtime (require attention)`);
  console.log(`      ${circularDeps.typeOnly.length} type-only (safe)`);
  console.log(`  - ${unusedAnalysis.unusedFiles.length} potentially unused files`);
  console.log(`  - ${unusedAnalysis.unusedExports.length} potentially unused exports`);

  // Print unused files if any
  if (unusedAnalysis.unusedFiles.length > 0) {
    console.log('\nPotentially unused files:');
    for (const file of unusedAnalysis.unusedFiles.slice(0, 20)) {
      console.log(`  - ${file}`);
    }
    if (unusedAnalysis.unusedFiles.length > 20) {
      console.log(`  ... and ${unusedAnalysis.unusedFiles.length - 20} more`);
    }
  }

  // Print unused exports if any (grouped by file)
  if (unusedAnalysis.unusedExports.length > 0) {
    console.log('\nPotentially unused exports:');
    const byFile = new Map<string, UnusedExport[]>();
    for (const exp of unusedAnalysis.unusedExports) {
      if (!byFile.has(exp.file)) byFile.set(exp.file, []);
      byFile.get(exp.file)!.push(exp);
    }
    let shown = 0;
    for (const [file, exports] of byFile) {
      if (shown >= 10) {
        console.log(`  ... and ${byFile.size - 10} more files with unused exports`);
        break;
      }
      console.log(`  ${file}:`);
      for (const exp of exports.slice(0, 5)) {
        console.log(`    - ${exp.name} (${exp.type})`);
      }
      if (exports.length > 5) {
        console.log(`    ... and ${exports.length - 5} more`);
      }
      shown++;
    }
  }

  // Write full unused analysis to a separate file
  const unusedReportPath = join(OUTPUT_DIR, 'unused-analysis.md');
  let unusedReport = '# Unused Files and Exports Analysis\n\n';
  unusedReport += `**Generated**: ${new Date().toISOString().split('T')[0]}\n\n`;
  unusedReport += `## Summary\n\n`;
  unusedReport += `- **Potentially unused files**: ${unusedAnalysis.unusedFiles.length}\n`;
  unusedReport += `- **Potentially unused exports**: ${unusedAnalysis.unusedExports.length}\n\n`;

  unusedReport += `## Potentially Unused Files\n\n`;
  unusedReport += `These files are not imported by any other file in the codebase:\n\n`;
  for (const file of unusedAnalysis.unusedFiles) {
    unusedReport += `- \`${file}\`\n`;
  }

  unusedReport += `\n## Potentially Unused Exports\n\n`;
  unusedReport += `These exports are not imported by any other file in the codebase:\n\n`;
  const byFileForReport = new Map<string, UnusedExport[]>();
  for (const exp of unusedAnalysis.unusedExports) {
    if (!byFileForReport.has(exp.file)) byFileForReport.set(exp.file, []);
    byFileForReport.get(exp.file)!.push(exp);
  }
  for (const [file, exports] of byFileForReport) {
    unusedReport += `### \`${file}\`\n\n`;
    for (const exp of exports) {
      unusedReport += `- \`${exp.name}\` (${exp.type})\n`;
    }
    unusedReport += '\n';
  }

  writeFileSync(unusedReportPath, unusedReport);
  console.log(`\nWritten: ${unusedReportPath}`);

  // WASM accelerator <-> function pairing (generated artifact; replaces the
  // formerly hand-maintained docs/Architecture/WASM_ACCELERATION.md map).
  const wasmPairing = analyzeWasmPairing(ROOT_DIR);
  if (wasmPairing) {
    writeFileSync(join(OUTPUT_DIR, 'wasm-pairing.json'), JSON.stringify(wasmPairing, null, 2));
    writeFileSync(join(OUTPUT_DIR, 'wasm-pairing.md'), generateWasmPairingMarkdown(wasmPairing));
    console.log(
      `Written: ${join(OUTPUT_DIR, 'wasm-pairing.md')} ` +
        `(${wasmPairing.acceleratedCount}/${wasmPairing.total} WASM-accelerated)`
    );
  }

  // Print test coverage summary if enabled
  if (testCoverage) {
    const coveragePercent =
      testCoverage.sourceFiles.length > 0
        ? ((testCoverage.testedFiles.length / testCoverage.sourceFiles.length) * 100).toFixed(1)
        : '0';

    console.log('\n=== Test Coverage Analysis ===');
    console.log(`  - ${testCoverage.testFiles.length} test files analyzed`);
    console.log(
      `  - ${testCoverage.testedFiles.length}/${testCoverage.sourceFiles.length} source files have tests (${coveragePercent}%)`
    );
    console.log(`  - ${testCoverage.untestedFiles.length} source files without tests`);

    if (testCoverage.untestedFiles.length > 0) {
      console.log('\nSource files without test coverage:');
      for (const file of testCoverage.untestedFiles.slice(0, 15)) {
        console.log(`  - ${file}`);
      }
      if (testCoverage.untestedFiles.length > 15) {
        console.log(
          `  ... and ${testCoverage.untestedFiles.length - 15} more (see TEST_COVERAGE.md for full list)`
        );
      }
    }
  }
}

// Only run the generator when executed directly (e.g. `npx tsx … .ts` or the
// compiled `dist/…js`). When imported by another module this guard keeps the
// heavy codebase scan from running.
if (require.main === module) {
  main().catch(console.error);
}
