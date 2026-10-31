export const entry = '@danielsimonjr/mathts-autograd';

export const cases = [
  {
    name: 'batched matmul 1×128×96×112',
    kind: 'neutral',
    make: (Ns) => {
      const { Tensor, enableGrad } = Ns;
      const a = Tensor.randn([1, 128, 96]);
      const b = Tensor.randn([1, 96, 112]);
      enableGrad(a);
      enableGrad(b);
      return () => a.matmul(b);
    },
  },
];
