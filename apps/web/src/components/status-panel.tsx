import React from 'react';
import { Button } from '@crm/ui';

export function StatusPanel() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">CRM Bootstrap</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
          Frontend operational
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The Next.js application is running and ready for Sprint 0 validation.
        </p>
        <div className="mt-6">
          <Button asChild variant="outline">
            <a href="/health">Health check</a>
          </Button>
        </div>
      </section>
    </main>
  );
}
