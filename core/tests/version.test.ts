import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../src/index.js';

// The exported VERSION is injected at build time (tsup `define`) from this
// package's package.json, so it can never drift. Pin the test to that same
// source of truth (package.json) rather than a hardcoded literal — a hardcoded
// literal here is exactly what let the old VERSION silently drift to '0.1.0'
// while package.json advanced to 0.13.0.
const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')
) as { version: string };

describe('VERSION', () => {
  it('should be a string', () => {
    expect(typeof VERSION).toBe('string');
  });

  it('should match package.json version', () => {
    expect(VERSION).toBe(version);
  });
});
