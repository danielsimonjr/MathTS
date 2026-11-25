import { expect, it } from 'vitest';
import * as mathjs from 'mathjs';
import { all, create, det, size, transpose } from '../src/index.js';

it('uses mathjs scalar and array semantics for matrix operations', () => {
  const math = create(all);
  for (const api of [{ det, size, transpose }, math]) {
    expect(api.det(-3)).toBe(-3);
    expect(api.det([4])).toBe(mathjs.det([4]));
    expect(api.size(-3)).toEqual(mathjs.size(-3));
    expect(api.size('abc')).toEqual(mathjs.size('abc'));
    expect(api.size([[[2]]])).toEqual(mathjs.size([[[2]]]));
    expect(api.transpose(true)).toBe(true);
    expect(api.transpose([1, 2])).toEqual(mathjs.transpose([1, 2]));
    expect(String(api.det([[math.fraction(1, 3)]]))).toBe('0.(3)');
  }
});
