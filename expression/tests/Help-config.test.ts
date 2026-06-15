import { describe, it, expect } from 'vitest';
import { createHelpClass } from '../src/Help.js';

/**
 * Covers the example-evaluation branch of Help.toString() where an example
 * mutates the config (the `configChanged` path, lines ~80-106 of Help.ts).
 *
 * The injected `evaluate` is what runs each example string. We make the
 * 'doConfig' example actually invoke `scope.config(...)`, which flips
 * `configChanged` to true and triggers the config-restore evaluate() call.
 */
describe('Help.toString - config-changing examples', () => {
  const calls: string[] = [];

  function evaluate(expr: string, scope?: Record<string, any>): any {
    calls.push(expr);
    if (expr === 'config()') return { number: 'number' };
    if (expr === 'doConfig') {
      // simulate an example that changes config via the provided scope.config
      return scope!.config({ number: 'BigNumber' });
    }
    if (expr === 'config(newConfig)') return scope?.newConfig;
    if (expr === 'config(originalConfig)') return scope?.originalConfig;
    if (expr === 'plain') return 7;
    if (expr === '') return undefined;
    return undefined;
  }

  const Help = createHelpClass({ evaluate }) as any;

  it('restores config after a config-changing example', () => {
    calls.length = 0;
    const h = new Help({
      name: 'demo',
      category: 'demo',
      description: 'demo description',
      syntax: ['demo(x)'],
      examples: ['plain', 'doConfig', ''],
      mayThrow: ['Error'],
      seealso: ['other'],
    });
    const str = h.toString();
    expect(str).toContain('Name: demo');
    expect(str).toContain('Category: demo');
    expect(str).toContain('Description:');
    expect(str).toContain('Syntax:');
    expect(str).toContain('Examples:');
    expect(str).toContain('Throws: Error');
    expect(str).toContain('See also: other');
    // plain example evaluated and rendered
    expect(str).toContain('plain');
    expect(str).toContain('7');
    // config-restore evaluate was invoked because configChanged became true
    expect(calls).toContain('config(originalConfig)');
  });

  it('does not restore config when no example changes config', () => {
    calls.length = 0;
    const h = new Help({ name: 'noconf', examples: ['plain'] });
    h.toString();
    expect(calls).not.toContain('config(originalConfig)');
  });
});
