import { describe, it, expect } from 'vitest';
import { rationalize } from '../src/index.js';

// #1177 item 1: the exact reader of rationalize also answers a power of a sum whose expansion is 0.
// Before, an all-zero polynomial fell back to the rule engine, which expands both powers term by
// term and does not finish ((x+1)^5-(x+1)^5 ran for more than 40 s). No timer is used here: a
// regression ends at the test timeout of the runner. Expected texts are the mathjs 15.2.0 output.

const rat = (input: string): string => String(rationalize(input));

describe('#1177 item 1: a power of a sum that cancels to 0', () => {
  it('(x+1)^5-(x+1)^5 is 0', () => {
    expect(rat('(x+1)^5-(x+1)^5')).toBe('0');
  });
  it('(x+1)^6-(x+1)^6 is 0', () => {
    expect(rat('(x+1)^6-(x+1)^6')).toBe('0');
  });
  it('(x+1)^4-x^4-4*x^3-6*x^2-4*x-1 is 0', () => {
    expect(rat('(x+1)^4-x^4-4*x^3-6*x^2-4*x-1')).toBe('0');
  });
  it('the detailed form of the zero polynomial has the variable x', () => {
    const detailed = rationalize('(x+1)^5-(x+1)^5', {}, true) as unknown as {
      variables: string[];
      expression: { toString(): string };
    };
    expect(detailed.variables).toEqual(['x']);
    expect(detailed.expression.toString()).toBe('0');
  });
});
