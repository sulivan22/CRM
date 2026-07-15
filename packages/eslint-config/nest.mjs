import { baseConfig } from './base.mjs';

export const nestConfig = [
  ...baseConfig,
  {
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
];
