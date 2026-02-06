# @mathts/workbook - Dependency Graph

**Version**: 0.1.0 | **Last Updated**: 2026-02-06

This document provides a comprehensive dependency graph of all files, components, imports, functions, and variables in the codebase.

---

## Table of Contents

1. [Overview](#overview)
2. [Root Dependencies](#root-dependencies)
3. [Entry Dependencies](#entry-dependencies)
4. [Dependency Matrix](#dependency-matrix)
5. [Circular Dependency Analysis](#circular-dependency-analysis)
6. [Visual Dependency Graph](#visual-dependency-graph)
7. [Summary Statistics](#summary-statistics)

---

## Overview

The codebase is organized into the following modules:

- **root**: 5 files
- **entry**: 1 file

---

## Root Dependencies

### `src/cli.ts` - MathTS Workbook CLI

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./index` | `parseWorkbook, createExecutor` | Import |

---

### `src/executor.ts` - Workbook executor

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./types` | `Workbook, Cell, WorkbookEvent, DependencyGraph` | Import (type-only) |
| `./graph` | `buildDependencyGraph, getDependents` | Import |

**Exports:**
- Classes: `WorkbookExecutor`
- Functions: `createExecutor`

---

### `src/graph.ts` - Dependency graph management

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./types` | `Cell, DependencyGraph, DependencyNode` | Import (type-only) |

**Exports:**
- Functions: `buildDependencyGraph`, `topologicalSort`, `getDependents`, `detectCycles`

---

### `src/parser.ts` - Workbook YAML parser

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./types` | `Workbook, ParseResult, CellType` | Import (type-only) |

**Exports:**
- Functions: `parseWorkbook`, `serializeWorkbook`, `stripOutputs`

---

### `src/types.ts` - Workbook type definitions

---

## Entry Dependencies

### `src/index.ts` - Types

**Internal Dependencies:**
| File | Imports | Type |
|------|---------|------|
| `./parser` | `parseWorkbook, serializeWorkbook, stripOutputs` | Re-export |
| `./graph` | `buildDependencyGraph, topologicalSort, getDependents` | Re-export |
| `./executor` | `WorkbookExecutor, createExecutor` | Re-export |

**Exports:**
- Constants: `VERSION`
- Re-exports: `parseWorkbook`, `serializeWorkbook`, `stripOutputs`, `buildDependencyGraph`, `topologicalSort`, `getDependents`, `WorkbookExecutor`, `createExecutor`

---

## Dependency Matrix

### File Import/Export Matrix

| File | Imports From | Exports To |
|------|--------------|------------|
| `cli` | 1 files | 0 files |
| `executor` | 2 files | 1 files |
| `graph` | 1 files | 2 files |
| `index` | 3 files | 1 files |
| `parser` | 1 files | 1 files |
| `types` | 0 files | 3 files |

---

## Circular Dependency Analysis

**No circular dependencies detected.**
---

## Visual Dependency Graph

```mermaid
graph TD
    subgraph Root
        N0[cli]
        N1[executor]
        N2[graph]
        N3[parser]
        N4[types]
    end

    subgraph Entry
        N5[index]
    end

    N0 --> N5
    N1 --> N4
    N1 --> N2
    N2 --> N4
    N5 --> N3
    N5 --> N2
    N5 --> N1
    N3 --> N4
```

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Total TypeScript Files | 6 |
| Total Modules | 2 |
| Total Lines of Code | 663 |
| Total Exports | 19 |
| Total Re-exports | 8 |
| Total Classes | 1 |
| Total Interfaces | 8 |
| Total Functions | 8 |
| Total Type Guards | 0 |
| Total Enums | 0 |
| Type-only Imports | 3 |
| Runtime Circular Deps | 0 |
| Type-only Circular Deps | 0 |

---

*Last Updated*: 2026-02-06
*Version*: 0.1.0
