// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn'
    },
  },
  {
    // Jest mocks (`jest.Mocked<T>`) are plain objects with jest.fn()
    // properties, so `expect(service.method).toHaveBeenCalledWith(...)` is
    // always safe — nothing ever invokes the reference with a detached
    // `this`. @typescript-eslint/unbound-method can't see that and flags
    // every such assertion; every occurrence in this codebase is this exact
    // pattern (verified 2026-09-17: 0 hits outside spec/test files), so it's
    // switched off for tests rather than sprinkled with disable comments.
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      // @types/jest's own `jest.Expect` interface (not the `expect` package's,
      // which IS precisely typed) declares `any(classType: any): any`,
      // `objectContaining(...): any`, `stringContaining(...): any`, etc. —
      // every asymmetric matcher used inside `.toEqual()`/`.toHaveBeenCalledWith()`
      // is `any` by the third-party type definition itself, not because of
      // anything this codebase does. That makes @typescript-eslint/no-unsafe-*
      // fire on essentially every `expect.any(...)`/`expect.objectContaining(...)`
      // in the test suite — a well-known @types/jest limitation, not a real
      // type-safety gap, so it's switched off for tests only; production code
      // keeps full unsafe-* enforcement.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
);