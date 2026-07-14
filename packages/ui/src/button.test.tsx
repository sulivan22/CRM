import { describe, expect, it } from 'vitest';
import { buttonVariants } from './button.js';

describe('buttonVariants', () => {
  it('returns base button classes', () => {
    expect(buttonVariants()).toContain('inline-flex');
  });
});
