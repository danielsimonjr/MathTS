import { describe, it, expect } from 'vitest';
import { ShaderManager } from '../src/ShaderManager.js';
import type { GPUContext } from '../src/GPUContext.js';

// Registration bookkeeping needs no GPU device — a stub context suffices.
const stubContext = {} as GPUContext;

describe('ShaderManager registration (headless)', () => {
  it('registers and reports a shader source', () => {
    const sm = new ShaderManager(stubContext);
    sm.registerShader('foo', 'CODE_FOO');
    expect(sm.hasRegisteredShader('foo')).toBe(true);
    expect(sm.getRegisteredShaderSource('foo')).toBe('CODE_FOO');
  });

  it('reports unregistered shaders as absent', () => {
    const sm = new ShaderManager(stubContext);
    expect(sm.hasRegisteredShader('bar')).toBe(false);
  });

  it('throws when requesting an unregistered shader source', () => {
    const sm = new ShaderManager(stubContext);
    expect(() => sm.getRegisteredShaderSource('bar')).toThrow(/Unknown registered shader/);
  });

  it('ships no domain kernels (empty registry on construction)', () => {
    const sm = new ShaderManager(stubContext);
    expect(sm.hasRegisteredShader('matmul')).toBe(false);
  });
});
