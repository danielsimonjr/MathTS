# Contributing to MathTS

Thank you for your interest in contributing to MathTS! This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm (recommended) or npm
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/danielsimonjr/mathts.git
cd mathts

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring
- `perf/description` - Performance improvements
- `test/description` - Test additions/changes

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

Examples:
```
feat(matrix): add sparse matrix CSR format support
fix(workbook): resolve circular dependency detection
perf(wasm): optimize matmul with SIMD instructions
docs(readme): add WebGPU backend examples
```

### Pull Request Process

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Ensure all tests pass: `pnpm test`
5. Ensure linting passes: `pnpm lint`
6. Ensure type checking passes: `pnpm typecheck`
7. Submit a pull request

### PR Checklist

- [ ] Tests added/updated for changes
- [ ] Documentation updated if needed
- [ ] TypeScript types are correct
- [ ] No console.log statements (except in CLI)
- [ ] Follows existing code style

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer explicit types over `any`
- Use interfaces for object shapes
- Use `readonly` where appropriate

```typescript
// Good
interface MatrixConfig {
  readonly rows: number;
  readonly cols: number;
  backend?: 'js' | 'wasm' | 'gpu';
}

// Avoid
const config: any = { rows: 3, cols: 3 };
```

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `dense-matrix.ts`)
- **Classes**: `PascalCase` (e.g., `DenseMatrix`)
- **Functions/Variables**: `camelCase` (e.g., `computeEigenvalues`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_EPSILON`)
- **Types/Interfaces**: `PascalCase` (e.g., `MatrixBackend`)

### File Structure

```typescript
/**
 * Module description
 * @module @mathts/package/file
 */

// 1. External imports
import { something } from 'external-package';

// 2. Internal imports
import { internal } from './internal';
import type { SomeType } from '../types';

// 3. Types/Interfaces
export interface MyInterface {
  // ...
}

// 4. Constants
const DEFAULT_VALUE = 42;

// 5. Main implementation
export class MyClass {
  // ...
}

// 6. Helper functions (private)
function helperFunction() {
  // ...
}
```

## Testing

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @mathts/matrix test

# Watch mode
pnpm test -- --watch

# Coverage
pnpm test -- --coverage
```

### Writing Tests

Use Vitest with descriptive test names:

```typescript
import { describe, it, expect } from 'vitest';
import { Matrix } from '../src/matrix';

describe('Matrix', () => {
  describe('determinant', () => {
    it('should return 0 for singular matrix', () => {
      const m = Matrix.from([[1, 2], [2, 4]]);
      expect(m.determinant()).toBe(0);
    });

    it('should compute determinant for 3x3 matrix', () => {
      const m = Matrix.from([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 10]
      ]);
      expect(m.determinant()).toBeCloseTo(-3, 10);
    });
  });
});
```

### Numerical Accuracy Tests

For numerical computations, use appropriate tolerances:

```typescript
expect(result).toBeCloseTo(expected, 10);  // 10 decimal places

// Or with explicit epsilon
const EPSILON = 1e-10;
expect(Math.abs(result - expected)).toBeLessThan(EPSILON);
```

## Package Structure

When adding new functionality, place it in the appropriate package:

| Package | Purpose |
|---------|---------|
| `@mathts/core` | Base types, config, typed-function integration |
| `@mathts/matrix` | Matrix types and operations |
| `@mathts/functions` | Mathematical functions |
| `@mathts/parallel` | Worker pool and parallelization |
| `@mathts/workbook` | Scientific workbook runtime |

## Performance Considerations

- Profile before optimizing
- Add benchmarks for performance-critical code
- Consider memory allocation patterns
- Document complexity (Big O) for algorithms

```typescript
/**
 * Compute matrix multiplication
 * @complexity O(n³) for n×n matrices
 */
function matmul(a: Matrix, b: Matrix): Matrix {
  // ...
}
```

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas
- Check existing issues before creating new ones

Thank you for contributing!
