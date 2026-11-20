/**
 * #1024: `laplace` and `inverseLaplace` returned the text `L{...}(s)` and `L^-1{...}(t)` for an
 * input outside their rules. That text does not parse. The issue asks for the closed form or a
 * typed error, so each function now throws a `NoClosedFormError`.
 */
import { describe, it, expect } from 'vitest';
import { laplace, inverseLaplace, NoClosedFormError } from '../src/typed/cas.js';
import * as functions from '../src/index.js';

describe('#1024 laplace and inverseLaplace: a typed error, not a marker', () => {
  it('laplace(t*sin(t)) throws NoClosedFormError', () => {
    expect(() => laplace('t*sin(t)', 't', 's')).toThrow(NoClosedFormError);
    expect(() => laplace('t*sin(t)', 't', 's')).toThrow(/^laplace: no closed form for t\*sin\(t\)/);
  });

  it('inverseLaplace(1/(s^4+1)) throws NoClosedFormError', () => {
    expect(() => inverseLaplace('1/(s^4+1)', 's', 't')).toThrow(NoClosedFormError);
    expect(() => inverseLaplace('1/(s^4+1)', 's', 't')).toThrow(/^inverseLaplace: no closed form/);
  });

  it('inverseLaplace(5) throws: the delta function has no text form', () => {
    expect(() => inverseLaplace('5', 's', 't')).toThrow(NoClosedFormError);
  });

  it('the error is an Error with its own name, exported from the package', () => {
    const error = new NoClosedFormError('x');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('NoClosedFormError');
    expect(functions.NoClosedFormError).toBe(NoClosedFormError);
  });

  it('a supported input still gives its closed form', () => {
    expect(laplace('t*exp(-t)', 't', 's')).toBe('1/(s + 1)^2');
    expect(inverseLaplace('1/(s^2+1)', 's', 't')).toBe('sin(1*t)');
  });
});
