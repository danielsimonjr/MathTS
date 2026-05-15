import { describe, it, expect } from 'vitest';
import * as autograd from '../src/index';

describe('@danielsimonjr/mathts-autograd scaffold', () => {
  it('package imports cleanly (empty surface for now — Tasks 6/7 populate)', () => {
    expect(autograd).toBeDefined();
    expect(Object.keys(autograd).length).toBeGreaterThanOrEqual(0);
  });
});
