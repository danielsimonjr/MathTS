# DeepThinking MCP Tools

This directory contains utility scripts for maintaining the DeepThinking MCP codebase.

## Available Tools

### create-dependency-graph.ts

Scans the codebase and generates comprehensive dependency documentation.

**Usage:**

```bash
# Run via npm script (recommended)
npm run docs:deps

# Or run directly with tsx
npx tsx tools/create-dependency-graph.ts
```

**Output:**

- `docs/Architecture/DEPENDENCY_GRAPH.md` - Markdown documentation
- `docs/Architecture/dependency-graph.json` - JSON data structure
- `docs/Architecture/wasm-pairing.md` / `wasm-pairing.json` - WASM accelerator ↔
  function pairing: which public `mathTyped` functions route to a WASM bridge
  (`*Dispatch`) vs run pure-JS (generated only when `functions/src/typed/` is in scope)

**Features:**

- Scans all TypeScript files in `src/`
- Parses imports and exports
- Categorizes files into logical modules
- Detects circular dependencies
- Generates statistics (file count, export count, etc.)
- Produces both human-readable Markdown and machine-readable JSON
- Fully typed TypeScript for type safety

**Generated Documentation Includes:**

- External dependencies (npm packages)
- Node.js built-in dependencies
- Internal dependencies (relative imports)
- Exported classes, interfaces, functions, constants
- Circular dependency analysis
- Visual dependency graph (Mermaid diagram)
- Summary statistics

## Adding New Tools

1. Create a new `.ts` file in this directory
2. Add a corresponding npm script in `package.json`
3. Document the tool in this README
4. Run typecheck before committing: `npm run typecheck`
