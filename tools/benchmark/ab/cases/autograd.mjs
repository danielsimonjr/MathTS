import { Tensor } from '@danielsimonjr/mathts-tensor';
import { mulberry32 } from '../util.mjs';

export const entry = '@danielsimonjr/mathts-autograd';

function randTensor(shape, seed) {
  const r = mulberry32(seed);
  let n = 1;
  for (const d of shape) n *= d;
  const data = new Float64Array(n);
  for (let i = 0; i < n; i++) data[i] = r() * 2 - 1;
  return Tensor.fromNested(data, shape);
}

export const cases = [
  {
    name: 'batched matmul 1×128×96×112',
    kind: 'neutral',
    make: (Ns) => {
      const { Tape, TapedTensor } = Ns;
      const a = randTensor([1, 128, 96], 0xad0001);
      const b = randTensor([1, 96, 112], 0xad0002);
      const tape = new Tape();
      const A = TapedTensor.fromTensorAsInput(a, tape);
      const B = TapedTensor.fromTensorAsInput(b, tape);
      return () => A.matmul(B).toTensor();
    },
  },
];
