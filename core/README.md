# @danielsimonjr/mathts-core

Core types, utilities, and configuration for MathTS.

## Installation

```bash
npm install @danielsimonjr/mathts-core
```

## Usage

```typescript
import { DEFAULT_CONFIG, isNumber, isMatrix, VERSION } from '@danielsimonjr/mathts-core';

// Default configuration
const config = { ...DEFAULT_CONFIG, backend: 'wasm' };

// Type guards
console.log(isNumber(42));        // true
console.log(isMatrix([[1, 2], [3, 4]])); // true
```

## API

### Types

- `BackendType` - Available backends: `'js' | 'wasm' | 'gpu'`
- `NumericType` - Numeric precision types
- `MathTSConfig` - Configuration interface

### Functions

- `DEFAULT_CONFIG` - Default configuration object
- `isNumber(value)` - Type guard for numbers
- `isComplex(value)` - Type guard for complex numbers
- `isMatrix(value)` - Type guard for matrices

## License

MIT
