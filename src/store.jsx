import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { seedData } from './lib/seed.js';
import { todayISO, buildRecommendations, allSummaries, buildAlerts, migrateStateData } from './lib/logic.js';
import { withHistoricalDemoData } from './lib/historical.js';

const DATA_KEY = 'mediclock.data.v1';
const SESSION_KEY = 'mediclock.session.v1';
const SCOPE_KEY = 'mediclock.scope.v1';
const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

function load() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) { const d = migrateStateData(JSON.parse(raw)); if (d) return withHistoricalDemoData(d); }
  } catch { /* corrupted storage: fall through to seed */ }
  return seedData(todayISO());
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);
  const [userId, setUserId] = useState(() => { try { return localStorage.getItem(SESSION_KEY); } catch { return null; } });
  const [scopeId, setScopeId] = useState(() => { try { return localStorage.getItem(SCOPE_KEY) || ''; } catch { return ''; } });
  const [toast, setToast] = useState(null);
  const [storageError, setStorageError] = useState(false);
  const today = todayISO();

  useEffect(() => {
    try { localStorage.setItem(DATA_KEY, JSON.stringify(state)); setStorageError(false); } catch { setStorageError(true); }
  }, [state]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const user = state.users.find((u) => u.id === userId) || null;
  const scope = scopeId || user?.clinicId || 'all';
  const setScope = useCallback((id) => {
    setScopeId(id);
    try { if (id) localStorage.setItem(SCOPE_KEY, id); else localStorage.removeItem(SCOPE_KEY); } catch { /* ignore */ }
  }, []);
  const notify = useCallback((text, kind = 'ok') => setToast({ text, kind, id: Date.now() }), []);

  const run = useCallback((fn, success) => {
    let r;
    try { r = fn(state); } catch (e) { r = { error: 'Something went wrong: ' + e.message }; }
    if (r.error) { notify(r.error, 'error'); return r; }
    setState(r.state);
    if (success) notify(success, 'ok');
    return r;
  }, [state, notify]);

  const login = (id) => {
    try { localStorage.setItem(SESSION_KEY, id); } catch { /* ignore */ }
    setUserId(id);
    const next = state.users.find((u) => u.id === id);
    setScope(next?.clinicId || 'all');
  };
  const logout = () => { try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } setUserId(null); };
  const reset = () => { setState(seedData(todayISO())); setScope(user?.clinicId || 'all'); notify('Demo data restored to the original dataset.'); };

  const derived = useMemo(() => ({
    recs: buildRecommendations(state, today),
    summaries: allSummaries(state, today),
    alerts: buildAlerts(state, today, user),
  }), [state, today, user]);

  const value = { state, user, today, scope, setScope, login, logout, reset, run, notify, toast, storageError, ...derived };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
