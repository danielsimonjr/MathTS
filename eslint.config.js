import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // ---------------------------------------------------------------------------
  // Synced mathjs code (mirrors `strict: false` policy in functions/tsconfig.json
  // and the equivalent in expression). These files are mechanically ported from
  // upstream mathjs and preserve its `any`-heavy, factory-style patterns; we
  // surface stylistic findings as warnings rather than errors so the active
  // typed-function layer can stay strict.
  // ---------------------------------------------------------------------------
  {
    files: [
      // Synced category dirs in functions/
      'functions/src/arithmetic/**/*.ts',
      'functions/src/algebra/**/*.ts',
      'functions/src/bitwise/**/*.ts',
      'functions/src/logical/**/*.ts',
      'functions/src/relational/**/*.ts',
      'functions/src/trigonometry/**/*.ts',
      'functions/src/statistics/**/*.ts',
      'functions/src/set/**/*.ts',
      'functions/src/special/**/*.ts',
      'functions/src/matrix/**/*.ts',
      'functions/src/signal/**/*.ts',
      'functions/src/combinatorics/**/*.ts',
      'functions/src/complex/**/*.ts',
      'functions/src/probability/**/*.ts',
      'functions/src/string/**/*.ts',
      'functions/src/utils/**/*.ts',
      'functions/src/plain/**/*.ts',
      'functions/src/type/**/*.ts',
      'functions/src/expression/**/*.ts',
      'functions/src/error/**/*.ts',
      'functions/src/numeric/**/*.ts',
      // Synced support / core helpers in functions/src/core/ (the active
      // bridge file functions/src/core/create.ts is the only file in this
      // tree that lives outside this glob).
      'functions/src/core/function/**/*.ts',
      // Synced WASM bindings under functions/src/wasm/{plain,matrix,...}/.
      // The active hand-written files at functions/src/wasm/*.ts
      // (WasmLoader.ts, integrity.ts, MatrixWasmBridge.ts) and the active
      // dispatch bridge functions/src/wasm/bitwise/wasm-bridge.ts are not
      // matched here and stay strict.
      'functions/src/wasm/plain/**/*.ts',
      'functions/src/wasm/matrix/**/*.ts',
      'functions/src/wasm/algebra/**/*.ts',
      'functions/src/wasm/arithmetic/**/*.ts',
      'functions/src/wasm/trigonometry/**/*.ts',
      'functions/src/wasm/statistics/**/*.ts',
      'functions/src/wasm/set/**/*.ts',
      'functions/src/wasm/numeric/**/*.ts',
      'functions/src/wasm/special/**/*.ts',
      'functions/src/wasm/simd/**/*.ts',
      'functions/src/wasm/logical/**/*.ts',
      'functions/src/wasm/probability/**/*.ts',
      'functions/src/wasm/string/**/*.ts',
      'functions/src/wasm/relational/**/*.ts',
      'functions/src/wasm/combinatorics/**/*.ts',
      'functions/src/wasm/complex/**/*.ts',
      'functions/src/wasm/expression/**/*.ts',
      'functions/src/wasm/unit/**/*.ts',
      'functions/src/wasm/signal/**/*.ts',
      'functions/src/wasm/bitwise/**/*.ts',
      // Expression's synced utility helpers (mirrors mathjs/src/utils/).
      'expression/src/utils/**/*.ts',
      // Core's synced mathjs helpers at the root (the active hand-written
      // code lives under core/src/numeric/, core/src/typed/, core/src/factory/,
      // core/src/error/, core/src/index.ts).
      'core/src/array.ts',
      'core/src/customs.ts',
      'core/src/customs.d.ts',
      'core/src/emitter.ts',
      'core/src/factory.ts',
      'core/src/function.ts',
      'core/src/is.ts',
      'core/src/latex.ts',
      'core/src/map.ts',
      'core/src/number.ts',
      'core/src/object.ts',
      'core/src/optimizeCallback.ts',
      'core/src/scope.ts',
      'core/src/string.ts',
      'core/src/create.ts',
      'core/src/bignumber/**/*.ts',
      'core/src/function/**/*.ts',
      'core/src/types/bigint.ts',
      'core/src/types/bignumber.ts',
      'core/src/types/fraction.ts',
      'core/src/types/matrix/**/*.ts',
      'core/src/types/number.ts',
      'core/src/types/unit/**/*.ts',
      // Expression's synced transforms (mathjs's per-function transformer
      // adapters for argument-zero-based-index conversion etc.).
      'expression/src/transform/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-misused-new': 'warn',
      '@typescript-eslint/prefer-as-const': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      'no-loss-of-precision': 'warn',
      'no-case-declarations': 'warn',
      'prefer-spread': 'warn',
      'prefer-const': 'warn',
      'prefer-rest-params': 'warn',
      'no-useless-escape': 'warn',
      'no-self-assign': 'warn',
      'no-undef': 'warn',
      'no-empty': 'warn',
      'no-prototype-builtins': 'warn',
      'no-control-regex': 'warn',
      'no-fallthrough': 'warn',
      'no-unsafe-finally': 'warn',
      'no-cond-assign': 'warn',
    },
  }
);
