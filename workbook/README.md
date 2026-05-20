# @danielsimonjr/mathts-workbook

Scientific workbook runtime for MathTS with reactive YAML-based notebooks (`.mtsw` format).

## Installation

```bash
npm install @danielsimonjr/mathts-workbook
```

## Usage

### CLI

```bash
# Run a workbook
mtsw run example.mtsw

# Run specific cell
mtsw run example.mtsw -c compute

# Validate structure
mtsw validate example.mtsw

# Show dependency graph
mtsw graph example.mtsw

# Create from template (basic | tensor-physics | data-science)
mtsw new my-workbook -t tensor-physics
```

> Note: `mtsw watch` and `mtsw export` appear in the CLI help text but are not yet implemented.

### Programmatic API

```typescript
import { parseWorkbook, createExecutor } from '@danielsimonjr/mathts-workbook';

const content = `
version: "1.0"
metadata:
  title: "My Workbook"
runtime:
  engine: mathts
  execution: reactive
cells:
  - code: |
      const x = 42;
      export { x };
    id: compute
`;

const result = parseWorkbook(content);
if (result.success && result.workbook) {
  const executor = createExecutor(result.workbook);

  executor.on((event) => {
    console.log(event.type, event.cellId);
  });

  await executor.runAll();
}
```

## Workbook Format (.mtsw)

```yaml
version: "1.0"
metadata:
  title: "Matrix Analysis"
  author: "Your Name"

runtime:
  engine: mathts
  execution: reactive  # reactive | sequential | manual

cells:
  - markdown: |
      # Introduction
    id: intro

  - code: |
      import { Matrix } from '@danielsimonjr/mathts-matrix';
      const A = Matrix.random(3, 3);
      export { A };
    id: create-matrix

  - code: |
      import { A } from '#create-matrix';
      const det = A.determinant();
      console.log('Determinant:', det);
    id: compute
    depends_on: [create-matrix]
```

## Cell Types

| Type | Description |
|------|-------------|
| `markdown` | Documentation with LaTeX math |
| `code` | TypeScript/JavaScript execution |
| `tensor` | Einstein notation for tensor math |
| `equation` | LaTeX equations with labels |
| `visualization` | Three.js/D3/Plotly rendering |
| `data` | YAML/JSON/CSV data |
| `test` | Assertions with timeout |
| `export` | Publication output |

## Execution Modes

- **reactive** - Auto-rerun when dependencies change
- **sequential** - Top-to-bottom execution
- **manual** - Explicit trigger only

## License

MIT
