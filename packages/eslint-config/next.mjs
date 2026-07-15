import nextPlugin from '@next/eslint-plugin-next';
import { reactConfig } from './react.mjs';

export const nextConfig = [
  ...reactConfig,
  {
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
];
