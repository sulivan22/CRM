import { describe, expect, it } from 'vitest';
import { prisma } from './index.js';

describe('database client', () => {
  it('exports a reusable prisma client', () => {
    expect(prisma).toHaveProperty('$connect');
  });
});
