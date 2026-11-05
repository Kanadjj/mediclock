import React from 'react';
import { Badge } from '../components/ui.jsx';

export default function MediWasteManagement() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-navy-900">MediWaste Management</h1>
        <Badge tone="Monitor">In Development</Badge>
      </div>
      <p className="max-w-3xl text-sm leading-relaxed text-black">
        A dedicated module for identifying, tracking and responsibly managing expired, damaged and unusable medicines across clinics.
      </p>
      <section className="card flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
        <svg
          className="h-10 w-10 text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m14.5 6.5 3 3" />
          <path d="m5 21 3.5-.8L20 8.7a2.1 2.1 0 0 0-3-3L5.5 17.2 5 21Z" />
          <path d="M3 5h6M5 3v2M4 5l1 5h4" />
        </svg>
        <p className="mt-4 text-sm font-medium text-slate-700">This module is currently under development.</p>
      </section>
    </div>
  );
}
