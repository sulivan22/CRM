'use client';

import React from 'react';
import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { apiRequest } from '@/lib/api';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Create account</h1>
        <div className="mt-6">
          <AuthForm
            mode="register"
            onSubmit={async (values) => {
              await apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(values) });
              window.location.href = '/app';
            }}
          />
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Already registered? <Link href="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}
