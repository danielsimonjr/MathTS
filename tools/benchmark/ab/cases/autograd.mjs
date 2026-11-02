import { Tensor } from '@danielsimonjr/mathts-tensor';
import { mulberry32 } from '../util.mjs';

export const entry = '@danielsimonjr/mathts-autograd';

function randTensor(shape, seed) {
  const r = mulberry32(seed);
  /** @param {number[]} dims */
  function build(dims) {
    if (dims.length === 1) {
      const row = new Array(dims[0]);
      for (let i = 0; i < dims[0]; i++) row[i] = r() * 2 - 1;
      return row;
    }
    return Array.from({ length: dims[0] }, () => build(dims.slice(1)));
  }
  return Tensor.fromNested(build(shape), shape);
}

function matmulCase(batch, m, k, n, seedA, seedB, kind) {
  return {
    name: `batched matmul ${batch}×${m}×${k}×${n}`,
    kind,
    pr: 'P7-10',
    make: (Ns) => {
      const { Tape, TapedTensor } = Ns;
      const a = randTensor([batch, m, k], seedA);
      const b = randTensor([batch, k, n], seedB);
      const tape = new Tape();
      const A = TapedTensor.fromTensorAsInput(a, tape);
      const B = TapedTensor.fromTensorAsInput(b, tape);
      return () => A.matmul(B).toPrimalTensor();
    },
  };
}

export const cases = [
  matmulCase(8, 2, 3, 4, 0xad0802, 0xad0803, 'neutral'),
  matmulCase(8, 8, 8, 8, 0xad0808, 0xad0809, 'neutral'),
  matmulCase(4, 32, 16, 24, 0xad0432, 0xad0433, 'neutral'),
  matmulCase(2, 64, 64, 64, 0xad0264, 0xad0265, 'neutral'),
  matmulCase(1, 128, 96, 112, 0xad0001, 0xad0002, 'neutral'),
];
