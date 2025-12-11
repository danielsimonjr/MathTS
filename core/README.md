# @mathts/core

Core types, utilities, and configuration for MathTS.

## Installation

```bash
npm install @mathts/core
```

## Usage

```typescript
import { createConfig, isNumeric, isMatrix, VERSION } from '@mathts/core';

// Create custom configuration
const config = createConfig({
  backend: 'wasm',
  autoBackend: true,
});

// Type guards
console.log(isNumeric(42));        // true
console.log(isMatrix([[1, 2], [3, 4]])); // true
```

## API

### Types

- `BackendType` - Available backends: `'js' | 'wasm' | 'gpu'`
- `NumericType` - Numeric precision types
- `MathTSConfig` - Configuration interface

### Functions

- `createConfig(overrides?)` - Create configuration with defaults
- `isNumeric(value)` - Type guard for numbers
- `isComplex(value)` - Type guard for complex numbers
- `isMatrix(value)` - Type guard for matrices

## License

MIT
