import React, { useEffect } from 'react';

const TONE = {
  Normal: 'bg-[#e8f5ec] text-[#1e7b3c] ring-[#bfe5cc]',
  Monitor: 'bg-[#fef3c7] text-[#92400e] ring-[#fcd34d]',
  Warning: 'bg-[#fef3c7] text-[#92400e] ring-[#fcd34d]',
  Critical: 'bg-[#fdeceb] text-[#b42318] ring-[#f5c2c0]',
  Expired: 'bg-red-600 text-white ring-red-700',
  'Use / move now': 'bg-[#fdeceb] text-[#b42318] ring-[#f5c2c0]',
  Watch: 'bg-[#fef3c7] text-[#92400e] ring-[#fcd34d]',
  OK: 'bg-[#e8f5ec] text-[#1e7b3c] ring-[#bfe5cc]',
  High: 'bg-[#fdeceb] text-[#b42318] ring-[#f5c2c0]',
  Medium: 'bg-[#fef3c7] text-[#92400e] ring-[#fcd34d]',
  Low: 'bg-[#e8f5ec] text-[#1e7b3c] ring-[#bfe5cc]',
  Suggested: 'bg-brand-50 text-brand-700 ring-[#cfe0f5]',
  'Reorder Required': 'bg-[#fef3c7] text-[#92400e] ring-[#fcd34d]',
  'Pending Approval': 'bg-[#fef3c7] text-[#92400e] ring-[#fcd34d]',
  'Order Placed': 'bg-brand-50 text-brand-700 ring-[#cfe0f5]',
  'Partially Received': 'bg-[#fef3c7] text-[#92400e] ring-[#fcd34d]',
  Completed: 'bg-[#e8f5ec] text-[#1e7b3c] ring-[#bfe5cc]',
  Approved: 'bg-[#e8f5ec] text-[#1e7b3c] ring-[#bfe5cc]',
  Dispatched: 'bg-brand-50 text-brand-700 ring-[#cfe0f5]',
  Rejected: 'bg-[#fdeceb] text-[#b42318] ring-[#f5c2c0]',
  Cancelled: 'bg-slate-100 text-black ring-slate-200',
  Action: 'bg-navy-50 text-navy-800 ring-navy-100',
};
export function Badge({ children, tone }) {
  const cls = TONE[tone || children] || 'bg-[#fef3c7] text-[#92400e] ring-[#fcd34d]';
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>{children}</span>;
}

export const shelfAlert = (status) => status === 'Expired' ? 'Expired' : status === 'Critical' ? 'Use / move now' : status === 'Warning' || status === 'Monitor' ? 'Watch' : 'OK';

export function Logo() {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[22px] font-bold leading-none tracking-tight text-navy-900">Medi<span className="text-brand-600">Clock</span></span>
    </span>
  );
}

export function Stat({ label, value, sub, tone = 'navy', highlight = false }) {
  const c = { navy: 'text-navy-900', red: 'text-red-600', danger: 'text-[#b42318]', amber: 'text-amber-600', green: 'text-emerald-600', teal: 'text-brand-700' }[tone];
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'border-[#f0d9c0] bg-[#fdf3e8]' : 'border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]'}`}>
      <div className={`text-2xl font-semibold leading-tight tabular-nums ${c}`}>{value}</div>
      <div className="mt-1 text-xs leading-snug text-black">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-black">{sub}</div>}
    </div>
  );
}

export function Section({ title, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-navy-900">{title}</h2>{action}
      </div>
      {children}
    </section>
  );
}

export const Empty = ({ title, hint }) => (
  <div className="px-4 py-8 text-center">
    <div className="text-sm font-medium text-slate-700">{title}</div>
    {hint && <div className="mt-1 text-xs text-black">{hint}</div>}
  </div>
);

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-xl sm:rounded-xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h3 className="text-base font-semibold text-navy-900">{title}</h3>
          <button className="rounded p-1 text-black hover:bg-slate-100" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-black">{message}</p>
      <p className="mt-2 text-xs text-black">Demo mode: this is a simulated approval, not a legal authorisation.</p>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Back</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

export const Field = ({ label, error, children, hint }) => (
  <label className="block text-sm">
    <span className="mb-1 block text-xs font-medium text-black">{label}</span>
    {children}
    {hint && !error && <span className="mt-0.5 block text-xs text-black">{hint}</span>}
    {error && <span className="mt-0.5 block text-xs text-red-600">{error}</span>}
  </label>
);

export const fmtDate = (iso) => iso;
export const fmtLongDate = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const fmtTime = (ts) => new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
export const inrPrecise = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(n) || 0);
export const num = (n) => Math.round(n).toLocaleString('en-IN');

export function downloadCSV(filename, rows) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
