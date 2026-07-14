import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@crm/ui';

interface AuthFormProps {
  mode: 'login' | 'register';
  onSubmit: (values: {
    email: string;
    password: string;
    displayName?: string;
    workspaceName?: string;
  }) => Promise<void>;
}

export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({ email, password, displayName, workspaceName });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void submit(event)} noValidate>
      <label className="grid gap-1 text-sm font-medium">
        Email
        <input
          className="h-10 rounded-md border border-slate-300 px-3"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Password
        <input
          className="h-10 rounded-md border border-slate-300 px-3"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
        />
      </label>
      {mode === 'register' ? (
        <>
          <label className="grid gap-1 text-sm font-medium">
            Display name
            <input
              className="h-10 rounded-md border border-slate-300 px-3"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Initial workspace
            <input
              className="h-10 rounded-md border border-slate-300 px-3"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
            />
          </label>
        </>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? 'Please wait' : mode === 'login' ? 'Log in' : 'Create account'}
      </Button>
    </form>
  );
}
