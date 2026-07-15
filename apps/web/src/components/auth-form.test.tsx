import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthForm } from './auth-form';

describe('AuthForm', () => {
  it('validates login email before submit', async () => {
    const submit = vi.fn();
    render(<AuthForm mode="login" onSubmit={submit} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'invalid' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'ChangeMe12345!' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it('validates registration password length', async () => {
    const submit = vi.fn();
    render(<AuthForm mode="register" onSubmit={submit} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'dev@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/at least 12/i)).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });
});
