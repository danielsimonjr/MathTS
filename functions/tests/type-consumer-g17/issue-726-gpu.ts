/** Consumer without wiring @webgpu/types manually — package .d.ts should reference it. */
import { enableGpu } from '@danielsimonjr/mathts-gpu';

const on = enableGpu();

export { on };
