import { defineConfig } from 'tsup';

// Mirrors matrix/'s inline build command:
//   tsup src/index.ts --format esm --dts --clean
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
});
