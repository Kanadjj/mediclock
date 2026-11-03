import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { seedData } from './lib/seed.js';
import { todayISO, buildRecommendations, allSummaries, buildAlerts, migrateStateData } from './lib/logic.js';
import { withHistoricalDemoData } from './lib/historical.js';
import { authenticateDemoUser } from './lib/auth.js';

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

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.userId || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    return null;
  }
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);
  const [session, setSession] = useState(loadSession);
  const [scopeId, setScopeId] = useState(() => { try { return localStorage.getItem(SCOPE_KEY) || ''; } catch { return ''; } });
  const [toast, setToast] = useState(null);
  const [storageError, setStorageError] = useState(false);
  const today = todayISO();

  useEffect(() => {
    try { localStorage.setItem(DATA_KEY, JSON.stringify(state)); setStorageError(false); } catch { setStorageError(true); }
  }, [state]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const user = session?.expiresAt > Date.now()
    ? state.users.find((u) => u.id === session.userId && u.auth?.active && u.auth?.hash) || null
    : null;
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

  const runAsync = useCallback(async (fn, success) => {
    let result;
    try { result = await fn(state); } catch (error) { result = { error: 'Something went wrong: ' + error.message }; }
    if (result.error) { notify(result.error, 'error'); return result; }
    setState(result.state);
    if (success) notify(success, 'ok');
    return result;
  }, [state, notify]);

  const login = useCallback(async (loginId, password) => {
    try {
      const result = await authenticateDemoUser(state, loginId, password);
      setState(result.state);
      if (result.error) return result;
      const next = result.state.users.find((u) => u.id === result.userId);
      const nextSession = { userId: result.userId, expiresAt: Date.now() + 12 * 60 * 60 * 1000 };
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setScope(next?.clinicId || 'all');
      return result;
    } catch (error) {
      return { error: 'Unable to verify credentials in this browser. Check browser cryptography support and try again.' };
    }
  }, [state, setScope]);
  const logout = useCallback(() => {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    setSession(null);
  }, []);
  useEffect(() => {
    if (!session) return undefined;
    const timer = setTimeout(logout, Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [session, logout]);
  useEffect(() => { if (session && !user) logout(); }, [session, user, logout]);
  const reset = () => { setState(seedData(todayISO())); setScope(user?.clinicId || 'all'); notify('Demo data restored to the original dataset.'); };

  const derived = useMemo(() => ({
    recs: buildRecommendations(state, today),
    summaries: allSummaries(state, today),
    alerts: buildAlerts(state, today, user),
  }), [state, today, user]);

  const value = { state, user, today, scope, setScope, login, logout, reset, run, runAsync, notify, toast, storageError, ...derived };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
