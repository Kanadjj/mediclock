import React, { useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from './store.jsx';
import { Badge, Confirm, Logo, fmtLongDate } from './components/ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Inventory from './pages/Inventory.jsx';
import SwapBoard from './pages/SwapBoard.jsx';
import Transfers from './pages/Transfers.jsx';
import NetworkMap from './pages/NetworkMap.jsx';
import Reports from './pages/Reports.jsx';
import Admin from './pages/Admin.jsx';
import PurchaseManagement from './pages/PurchaseManagement.jsx';
import MediWasteManagement from './pages/MediWasteManagement.jsx';
import Login from './pages/Login.jsx';
import { markNotificationRead } from './lib/logic.js';

const PRIMARY = [
  { to: '/inventory', label: 'My shelf' },
  { to: '/swap', label: 'Swap board'},
  { label: 'Add stock', action: 'add' },
];

const SECONDARY = [
  { to: '/', label: 'Home page', end: true },
  { to: '/transfers', label: 'Transfers' },
  { to: '/purchases', label: 'Purchases' },
  { to: '/map', label: 'Clinic map' },
  { to: '/reports', label: 'Reports' },
  { to: '/medi-waste', label: 'MediWaste Management' },
  { to: '/admin', label: 'Administration', roles: ['Administrator'] },
];

function Notifications() {
  const { alerts, state, scope, run } = useStore();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const stored = (state.notifications || []).filter((n) => scope === 'all' || n.clinicId === scope)
    .map((n) => ({ kind: 'purchase', level: n.read ? 'Normal' : 'Action', text: n.text, notificationId: n.id }));
  const items = [...stored, ...alerts.work, ...alerts.shortage.filter((a) => a.level === 'Critical'), ...alerts.expiry.filter((a) => ['Critical', 'Expired'].includes(a.level))];
  const unread = stored.filter((n) => n.level === 'Action').length;
  return (
    <div className="relative">
      <button className="btn-ghost !px-2.5" onClick={() => setOpen(!open)} aria-label="Notifications" aria-expanded={open}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0" /></svg>
        {items.length > 0 && <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[11px] font-semibold text-white">{unread + items.length - stored.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[92vw] rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b px-3 py-2 text-sm font-semibold text-navy-900">Notifications</div>
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.length === 0 && <li className="p-4 text-center text-sm text-black">No urgent alerts.</li>}
            {items.slice(0, 20).map((a, i) => (
              <li key={a.notificationId || i}><button className="flex w-full gap-2 px-3 py-2 text-left hover:bg-slate-50" onClick={() => { if (a.notificationId) run((s) => markNotificationRead(s, a.notificationId)); setOpen(false); nav(a.kind === 'purchase' ? '/purchases' : a.kind === 'workflow' ? '/transfers' : a.kind === 'shortage' ? '/swap' : '/inventory'); }}>
                <Badge tone={a.level}>{a.level}</Badge><span className="text-xs text-slate-700">{a.text}</span></button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DemoBanner({ today }) {
  return (
    <div className="rounded-md border border-[#f0c36d] bg-[#fff9e8] px-4 py-3 text-sm leading-relaxed text-[#6b4e00]">
      <span className="font-semibold uppercase tracking-wide">Synthetic demo data.</span>{' '}
      Clinics, medicines, quantities and prices are invented to show how the tools work. They are not real stock and not research results. Today in the demo: <span className="font-medium">{fmtLongDate(today)}</span>. Approvals are simulations, not legal authorisations.
    </div>
  );
}

function Shell({ children }) {
  const { user, state, logout, reset, scope, setScope, notify, today } = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  const [confirmReset, setConfirmReset] = useState(false);
  const links = SECONDARY.filter((n) => !n.roles || n.roles.includes(user.role));
  const addActive = loc.pathname === '/inventory' && new URLSearchParams(loc.search).has('add');
  const addStock = () => {
    if (user.role !== 'Pharmacist') { notify('Stock changes are made by clinic pharmacists.', 'error'); return; }
    nav('/inventory?add=' + Date.now());
  };
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <div className="min-w-[15rem] flex-1">
              <Logo />
              <p className="mt-1 text-xs text-slate-900">Use the earliest-expiring stock first, and move spare stock to a nearby clinic before it expires.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="input !w-auto max-w-[15rem]" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Dispensary">
                <option value="all">All clinics</option>
                {state.clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="btn-primary" onClick={() => setConfirmReset(true)}>Reset demo</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-3">
            <nav className="flex flex-wrap items-center gap-2" aria-label="Main">
              {PRIMARY.map((n) => {
                if (n.action && user.role !== 'Pharmacist') return null;
                return n.action ? (
                  <button key={n.label} onClick={addStock} className={`pill ${addActive ? 'pill-active' : ''}`}> {n.label}</button>
                ) : (
                  <NavLink key={n.to} to={n.to} className={({ isActive }) => `pill ${isActive && !addActive ? 'pill-active' : ''}`}> {n.label}</NavLink>
                );
              })}
              <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" aria-hidden="true" />
              {links.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `px-1.5 text-xs font-medium transition-colors 'text-navy-900'`}>{n.label}</NavLink>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <span className="max-w-[13rem] truncate text-xs font-medium text-navy-900">{user.name} · {user.role}</span>
              <Notifications />
              <button className="btn-ghost" onClick={logout}>Log out</button>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4">
        <div className="mt-4">{children}</div>
      </main>
      {confirmReset && <Confirm title="Reset demo data?" message="This restores the original dataset and removes all changes, transfers and audit history." confirmLabel="Reset" danger onConfirm={reset} onClose={() => setConfirmReset(false)} />}
    </div>
  );
}

function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return <div role="status" className={`fixed bottom-4 left-1/2 z-[60] w-[92vw] max-w-md -translate-x-1/2 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${toast.kind === 'error' ? 'bg-red-600' : 'bg-navy-900'}`}>{toast.text}</div>;
}

export default function App() {
  const { user, storageError } = useStore();
  const loc = useLocation();
  if (!user) return <><Routes><Route path="/login" element={<Login />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes><Toast /></>;
  return (
    <Shell>
      {storageError && <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">Browser storage is unavailable or full, so changes will not survive a refresh.</div>}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory key={loc.search} />} />
        <Route path="/swap" element={<SwapBoard />} />
        <Route path="/transfers" element={<Transfers />} />
        <Route path="/purchases" element={<PurchaseManagement />} />
        <Route path="/map" element={<NetworkMap />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/medi-waste" element={<MediWasteManagement />} />
        <Route path="/admin" element={user.role === 'Administrator' ? <Admin /> : <Navigate to="/" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
    </Shell>
  );
}
