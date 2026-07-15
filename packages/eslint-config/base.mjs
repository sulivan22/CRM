import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export const baseConfig = [
  {
    ignores: [
      'dist/**',
      '.next/**',
      'coverage/**',
      'node_modules/**',
      'generated/**',
      'prisma/**',
      '**/*.config.mjs',
      '**/*.config.ts',
      '**/next.config.ts',
      '**/postcss.config.mjs',
      '**/tailwind.config.ts',
      '**/eslint.config.mjs',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
];
