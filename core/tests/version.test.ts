import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/index.js';

describe('VERSION', () => {
  it('should be a string', () => {
    expect(typeof VERSION).toBe('string');
  });

  it('should be 0.1.0', () => {
    expect(VERSION).toBe('0.1.0');
  });
});
