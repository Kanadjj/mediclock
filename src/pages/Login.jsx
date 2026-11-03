import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { Logo } from '../components/ui.jsx';

export default function Login() {
  const { login } = useStore();
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!loginId.trim() || !password) {
      setError('Enter your Login ID and password.');
      return;
    }
    setLoading(true);
    try {
      const result = await login(loginId, password);
      if (result.error) setError(result.error);
      else navigate('/', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex"><Logo /></div>
          <h1 className="mt-6 text-2xl font-semibold text-navy-900">Sign in to MediClock</h1>
          <p className="mt-2 text-sm text-black">Use your assigned Login ID and demo password.</p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-5 sm:p-7">
          <label className="block text-sm font-medium text-slate-800">
            Login ID
            <input autoComplete="username" autoFocus className="input mt-1" value={loginId} onChange={(event) => setLoginId(event.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            Password
            <span className="relative mt-1 block">
              <input autoComplete="current-password" className="input pr-20" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} />
              <button type="button" className="absolute inset-y-0 right-2 my-1 px-2 text-xs font-medium text-brand-700" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </span>
          </label>
          <label className="flex items-center gap-2 text-xs text-black">
            <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
            Show password
          </label>
          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full justify-center" disabled={loading}>
            {loading ? <><span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Checking credentials…</> : 'Log in'}
          </button>
        </form>
        <div className="mt-5 space-y-2 rounded-md border border-[#f0c36d] bg-[#fff9e8] p-3 text-xs leading-relaxed text-[#6b4e00]">
          <p><span className="font-semibold">Synthetic demo data.</span> MediClock credentials and records in this frontend-only demo are stored in this browser.</p>
          <p><span className="font-semibold">Security limitation:</span> LocalStorage authentication and role checks can be bypassed by someone who controls the browser. Do not use real or sensitive data.</p>
        </div>
      </div>
    </main>
  );
}
