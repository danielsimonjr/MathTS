import { describe, it, expect } from 'vitest';
import { project } from '../src/three/project.js';

describe('project', () => {
  it('origin projects to the 2D origin', () => {
    const [x, y] = project([0, 0, 0], { azim: 30, elev: 20 });
    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(0, 9);
  });
  it('is deterministic for a fixed camera (oracle: unit-x at azim=0,elev=0)', () => {
    // azim 0, elev 0: x-axis maps to screen +x, z-axis maps to screen +y
    const [x, y] = project([1, 0, 0], { azim: 0, elev: 0 });
    expect(x).toBeCloseTo(1, 9);
    expect(y).toBeCloseTo(0, 9);
    const [, yz] = project([0, 0, 1], { azim: 0, elev: 0 });
    expect(yz).toBeCloseTo(1, 9);
  });
});
