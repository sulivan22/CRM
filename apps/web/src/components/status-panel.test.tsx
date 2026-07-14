import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusPanel } from './status-panel';

describe('StatusPanel', () => {
  it('renders the bootstrap operational message', () => {
    render(<StatusPanel />);

    expect(screen.getByRole('heading', { name: /frontend operational/i })).toBeInTheDocument();
  });
});
