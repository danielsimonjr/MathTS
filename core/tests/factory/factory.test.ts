/**
 * Factory pattern tests
 * @module @mathts/core/tests/factory/factory
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FunctionRegistry,
  createFactory,
  createTypedFunction,
  registry,
  math,
  DEFAULT_CONFIG,
} from '../../src/factory/index';
import type { MathTSConfig, FactoryFunction } from '../../src/factory/index';

describe('Factory Pattern', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_CONFIG.precision).toBe(64);
      expect(DEFAULT_CONFIG.matrix).toBe('Matrix');
      expect(DEFAULT_CONFIG.number).toBe('number');
      expect(DEFAULT_CONFIG.epsilon).toBe(1e-12);
      expect(DEFAULT_CONFIG.parallelEnabled).toBe(true);
    });
  });

  describe('FunctionRegistry', () => {
    let reg: FunctionRegistry;

    beforeEach(() => {
      reg = new FunctionRegistry();
    });

    it('should create with default config', () => {
      const config = reg.getConfig();
      expect(config.precision).toBe(DEFAULT_CONFIG.precision);
      expect(config.matrix).toBe(DEFAULT_CONFIG.matrix);
    });

    it('should create with custom config', () => {
      const custom = new FunctionRegistry({ precision: 128, matrix: 'Array' });
      const config = custom.getConfig();
      expect(config.precision).toBe(128);
      expect(config.matrix).toBe('Array');
    });

    it('should register a factory function', () => {
      const addFactory = createFactory('add', ['typed'], ({ typed }) =>
        typed('add', {
          'number, number': (a: number, b: number) => a + b,
        })
      );

      reg.register(addFactory);
      expect(reg.has('add')).toBe(true);
      expect(reg.names()).toContain('add');
    });

    it('should register multiple factories', () => {
      const addFactory = createFactory('add', ['typed'], ({ typed }) =>
        typed('add', { 'number, number': (a: number, b: number) => a + b })
      );
      const subFactory = createFactory('subtract', ['typed'], ({ typed }) =>
        typed('subtract', { 'number, number': (a: number, b: number) => a - b })
      );

      reg.registerAll([addFactory, subFactory]);
      expect(reg.has('add')).toBe(true);
      expect(reg.has('subtract')).toBe(true);
    });

    it('should get a registered function', () => {
      const addFactory = createFactory('add', ['typed'], ({ typed }) =>
        typed('add', {
          'number, number': (a: number, b: number) => a + b,
        })
      );

      reg.register(addFactory);
      const add = reg.get('add');
      expect(add(2, 3)).toBe(5);
    });

    it('should throw on unknown function', () => {
      expect(() => reg.get('unknown')).toThrow('Unknown function: unknown');
    });

    it('should detect circular dependencies', () => {
      const aFactory = createFactory('a', ['typed', 'b'], ({ typed, b }) =>
        typed('a', { 'number': (n: number) => (b as any)(n) })
      );
      const bFactory = createFactory('b', ['typed', 'a'], ({ typed, a }) =>
        typed('b', { 'number': (n: number) => (a as any)(n) })
      );

      reg.registerAll([aFactory, bFactory]);
      expect(() => reg.get('a')).toThrow(/Circular dependency/);
    });

    it('should resolve dependencies correctly', () => {
      const addFactory = createFactory('add', ['typed'], ({ typed }) =>
        typed('add', { 'number, number': (a: number, b: number) => a + b })
      );
      const doubleFactory = createFactory('double', ['typed', 'add'], ({ typed, add }) =>
        typed('double', { 'number': (n: number) => (add as any)(n, n) })
      );

      reg.registerAll([addFactory, doubleFactory]);
      const double = reg.get('double');
      expect(double(5)).toBe(10);
    });

    it('should cache function instances', () => {
      const addFactory = createFactory('add', ['typed'], ({ typed }) =>
        typed('add', { 'number, number': (a: number, b: number) => a + b })
      );

      reg.register(addFactory);
      const add1 = reg.get('add');
      const add2 = reg.get('add');
      expect(add1).toBe(add2); // Same instance
    });

    it('should update configuration', () => {
      reg.updateConfig({ precision: 256 });
      expect(reg.getConfig().precision).toBe(256);
    });

    it('should clear cache on config update', () => {
      let callCount = 0;
      const factory = createFactory('counter', ['typed', 'config'], ({ typed, config }) => {
        callCount++;
        return typed('counter', { '': () => (config as MathTSConfig).precision });
      });

      reg.register(factory);

      // First call
      reg.get('counter');
      expect(callCount).toBe(1);

      // Second call - should use cache
      reg.get('counter');
      expect(callCount).toBe(1);

      // Update config - clears cache
      reg.updateConfig({ precision: 128 });

      // Third call - should recreate
      reg.get('counter');
      expect(callCount).toBe(2);
    });
  });

  describe('createFactory', () => {
    it('should create a factory function definition', () => {
      const factory = createFactory('test', ['typed', 'config'], ({ typed }) =>
        typed('test', { 'number': (n: number) => n * 2 })
      );

      expect(factory.name).toBe('test');
      expect(factory.dependencies).toEqual(['typed', 'config']);
      expect(typeof factory.factory).toBe('function');
    });
  });

  describe('createTypedFunction', () => {
    it('should create a typed function directly', () => {
      const add = createTypedFunction('add', {
        'number, number': (a: number, b: number) => a + b,
        'string, string': (a: string, b: string) => a + b,
      });

      expect(add(2, 3)).toBe(5);
      expect(add('hello', ' world')).toBe('hello world');
    });

    it('should throw on type mismatch', () => {
      const add = createTypedFunction('add', {
        'number, number': (a: number, b: number) => a + b,
      });

      expect(() => add('a', 'b')).toThrow();
    });
  });

  describe('math convenience object', () => {
    beforeEach(() => {
      // Clear any previously registered functions
      // Note: In a real implementation, we'd want a clear() method
    });

    it('should expose config', () => {
      const config = math.config();
      expect(config.precision).toBeDefined();
    });

    it('should allow configuration updates', () => {
      const oldConfig = math.config();
      math.configure({ precision: 100 });
      expect(math.config().precision).toBe(100);
      // Restore
      math.configure({ precision: oldConfig.precision });
    });
  });
});
