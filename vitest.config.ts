import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/*/test/**/*.test.ts',
      'packages/*/tests/**/*.test.ts',
      'core/tests/**/*.test.ts',
      'matrix/tests/**/*.test.ts',
      'functions/tests/**/*.test.ts',
      'parallel/tests/**/*.test.ts',
      'expression/tests/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
      ],
    },
  },
});
