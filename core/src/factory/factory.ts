/**
 * MathTS Function Factory
 *
 * Provides a factory pattern for creating MathTS functions with:
 * - Typed function dispatch via typed-function
 * - Dependency injection for inter-function references
 * - Backend selection integration
 * - Lazy loading support
 *
 * @packageDocumentation
 */

import type { TypedFunction, TypedInstance, SignatureFunction, ReferTo, ReferToSelf } from 'typed-function';
import { mathTyped } from '../typed/mathts-typed.js';

/**
 * Configuration for MathTS instance
 */
export interface MathTSConfig {
  /** Numeric precision (for BigNumber) */
  precision: number;
  /** Default matrix type */
  matrix: 'Matrix' | 'Array';
  /** Number type for parsing */
  number: 'number' | 'BigNumber' | 'Fraction';
  /** Enable predictable randomness */
  randomSeed: string | null;
  /** Epsilon for floating point comparison */
  epsilon: number;
  /** Preferred backend for matrix operations */
  preferredBackend: 'auto' | 'js' | 'wasm' | 'gpu';
  /** Minimum elements to use WASM backend */
  wasmThreshold: number;
  /** Minimum elements to use GPU backend */
  gpuThreshold: number;
  /** Enable parallel processing */
  parallelEnabled: boolean;
  /** Minimum elements to parallelize */
  parallelThreshold: number;
}

/**
 * Default MathTS configuration
 */
export const DEFAULT_CONFIG: MathTSConfig = {
  precision: 64,
  matrix: 'Matrix',
  number: 'number',
  randomSeed: null,
  epsilon: 1e-12,
  preferredBackend: 'auto',
  wasmThreshold: 1000,
  gpuThreshold: 100000,
  parallelEnabled: true,
  parallelThreshold: 50000,
};

/**
 * Factory function definition
 */
export interface FactoryFunction<T = TypedFunction> {
  /** Name of the function */
  name: string;
  /** Dependencies required by this function */
  dependencies: string[];
  /** Factory that creates the function given dependencies */
  factory: (deps: FactoryDependencies) => T;
}

/**
 * Dependencies passed to factory functions
 */
export interface FactoryDependencies {
  /** MathTS configuration */
  config: MathTSConfig;
  /** typed-function instance */
  typed: TypedInstance;
  /** Registered functions (for cross-references) */
  [key: string]: unknown;
}

/**
 * Import definition for a factory function
 */
export type FactoryImport = FactoryFunction | (() => Promise<FactoryFunction>);

/**
 * MathTS function registry
 */
export class FunctionRegistry {
  private factories = new Map<string, FactoryFunction>();
  private instances = new Map<string, TypedFunction>();
  private dependencies: FactoryDependencies;
  private creating = new Set<string>();

  constructor(config: Partial<MathTSConfig> = {}, typed: TypedInstance = mathTyped) {
    this.dependencies = {
      config: { ...DEFAULT_CONFIG, ...config },
      typed,
    };
  }

  /**
   * Register a factory function
   */
  register(factory: FactoryFunction): void {
    this.factories.set(factory.name, factory);
  }

  /**
   * Register multiple factory functions
   */
  registerAll(factories: FactoryFunction[]): void {
    for (const factory of factories) {
      this.register(factory);
    }
  }

  /**
   * Get or create a function by name
   */
  get(name: string): TypedFunction {
    // Check if already created
    const existing = this.instances.get(name);
    if (existing) return existing;

    // Check for circular dependencies
    if (this.creating.has(name)) {
      throw new Error(`Circular dependency detected: ${name}`);
    }

    // Get factory
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Unknown function: ${name}`);
    }

    // Mark as creating (for circular detection)
    this.creating.add(name);

    try {
      // Resolve dependencies
      const deps: FactoryDependencies = { ...this.dependencies };
      for (const depName of factory.dependencies) {
        if (depName === 'config' || depName === 'typed') continue;
        deps[depName] = this.get(depName);
      }

      // Create the function
      const fn = factory.factory(deps);
      this.instances.set(name, fn);
      this.dependencies[name] = fn;

      return fn;
    } finally {
      this.creating.delete(name);
    }
  }

  /**
   * Check if a function is registered
   */
  has(name: string): boolean {
    return this.factories.has(name);
  }

  /**
   * Get all registered function names
   */
  names(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MathTSConfig>): void {
    this.dependencies.config = { ...this.dependencies.config, ...config };
    // Clear instances to force recreation with new config
    this.instances.clear();
  }

  /**
   * Get current configuration
   */
  getConfig(): MathTSConfig {
    return { ...this.dependencies.config };
  }
}

/**
 * Create a factory function definition
 *
 * @example
 * ```typescript
 * export const addFactory = createFactory('add', ['typed'], ({ typed }) =>
 *   typed('add', {
 *     'number, number': (a, b) => a + b,
 *     'Complex, Complex': (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
 *   })
 * );
 * ```
 */
export function createFactory<T = TypedFunction>(
  name: string,
  dependencies: string[],
  factory: (deps: FactoryDependencies) => T
): FactoryFunction<T> {
  return { name, dependencies, factory };
}

/**
 * Create a typed function using the factory pattern
 *
 * This is a convenience wrapper that creates a factory and immediately
 * invokes it with the default dependencies.
 *
 * @example
 * ```typescript
 * export const add = createTypedFunction('add', {
 *   'number, number': (a, b) => a + b,
 *   'string, string': (a, b) => a + b,
 * });
 * ```
 */
export function createTypedFunction(
  name: string,
  signatures: Record<string, SignatureFunction | ReferTo | ReferToSelf>
): TypedFunction {
  return mathTyped(name, signatures);
}

// Global registry instance
export const registry = new FunctionRegistry();

// Export convenience function
export const math = {
  /**
   * Get a registered function
   */
  get: (name: string) => registry.get(name),

  /**
   * Register a factory function
   */
  register: (factory: FactoryFunction) => registry.register(factory),

  /**
   * Get configuration
   */
  config: () => registry.getConfig(),

  /**
   * Update configuration
   */
  configure: (config: Partial<MathTSConfig>) => registry.updateConfig(config),
};
