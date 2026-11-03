import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { Confirm, Field, Section } from '../components/ui.jsx';
import { addClinic, addUser, configureDiscounts, resetDiscounts } from '../lib/logic.js';
import { DEFAULT_DISCOUNT_CONFIG } from '../lib/discounts.js';

export default function Admin() {
  const { state, user, run, reset } = useStore();
  const [c, setC] = useState({ name: '', area: '', lat: '', lng: '' });
  const [u, setU] = useState({ name: '', role: 'Pharmacist', clinicId: state.clinics[0]?.id || '' });
  const [confirmReset, setConfirmReset] = useState(false);
  const [tiers, setTiers] = useState(() => structuredClone(state.discountConfig?.tiers || DEFAULT_DISCOUNT_CONFIG.tiers));
  const cname = (id) => state.clinics.find((x) => x.id === id)?.name || 'All clinics';
  const submitC = (e) => { e.preventDefault(); const r = run((s) => addClinic(s, c, user), 'Clinic added'); if (!r.error) setC({ name: '', area: '', lat: '', lng: '' }); };
  const submitU = (e) => { e.preventDefault(); const r = run((s) => addUser(s, u, user), 'User added'); if (!r.error) setU({ ...u, name: '' }); };
  const saveDiscounts = (e) => { e.preventDefault(); run((s) => configureDiscounts(s, tiers, user), 'Expiry discount rules saved'); };
  const restoreDiscounts = () => {
    const r = run((s) => resetDiscounts(s, user), 'Default expiry discount rules restored');
    if (!r.error) setTiers(structuredClone(DEFAULT_DISCOUNT_CONFIG.tiers));
  };
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold text-navy-900">Administration</h1><p className="text-sm text-black">Clinics, users and system data.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Clinics">
          <ul className="divide-y">{state.clinics.map((x) => <li key={x.id} className="px-4 py-2 text-sm">{x.name}<div className="text-xs text-black">{x.area} · {x.lat.toFixed(4)}, {x.lng.toFixed(4)}</div></li>)}</ul>
          <form onSubmit={submitC} className="grid gap-2 border-t p-4 sm:grid-cols-2">
            <Field label="Clinic name"><input className="input" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
            <Field label="Area"><input className="input" value={c.area} onChange={(e) => setC({ ...c, area: e.target.value })} /></Field>
            <Field label="Latitude"><input className="input" type="number" step="any" value={c.lat} onChange={(e) => setC({ ...c, lat: e.target.value })} /></Field>
            <Field label="Longitude"><input className="input" type="number" step="any" value={c.lng} onChange={(e) => setC({ ...c, lng: e.target.value })} /></Field>
            <div className="sm:col-span-2"><button className="btn-primary">Add clinic</button></div>
          </form>
        </Section>
        <Section title="Users">
          <ul className="divide-y">{state.users.map((x) => <li key={x.id} className="px-4 py-2 text-sm">{x.name}<div className="text-xs text-black">{x.role} · {cname(x.clinicId)}</div></li>)}</ul>
          <form onSubmit={submitU} className="grid gap-2 border-t p-4 sm:grid-cols-2">
            <Field label="Name"><input className="input" value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} /></Field>
            <Field label="Role"><select className="input" value={u.role} onChange={(e) => setU({ ...u, role: e.target.value })}>{['Pharmacist', 'Medical Officer', 'Administrator'].map((r) => <option key={r}>{r}</option>)}</select></Field>
            {u.role === 'Pharmacist' && <Field label="Clinic"><select className="input" value={u.clinicId} onChange={(e) => setU({ ...u, clinicId: e.target.value })}>{state.clinics.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>}
            <div className="sm:col-span-2"><button className="btn-primary">Add user</button></div>
          </form>
        </Section>
      </div>
      {user.role === 'Administrator' && <Section title="Expiry-based discount configuration">
        <form onSubmit={saveDiscounts} className="space-y-3 p-4">
          <p className="text-sm text-black">Discounts are calculated per batch on its transaction date. A saved transaction keeps its original discount even if these rules change.</p>
          <div className="space-y-2">
            {tiers.map((tier, index) => <div key={tier.id || index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Field label="From days"><input className="input" type="number" min="1" step="1" required value={tier.minDays} onChange={(e) => setTiers(tiers.map((x, i) => i === index ? { ...x, minDays: e.target.value } : x))} /></Field>
              <Field label="Through days (blank = no limit)"><input className="input" type="number" min="1" step="1" value={tier.maxDays ?? ''} onChange={(e) => setTiers(tiers.map((x, i) => i === index ? { ...x, maxDays: e.target.value === '' ? null : e.target.value } : x))} /></Field>
              <Field label="Discount (%)"><input className="input" type="number" min="0" max="100" step="0.01" required value={tier.percent} onChange={(e) => setTiers(tiers.map((x, i) => i === index ? { ...x, percent: e.target.value } : x))} /></Field>
              <button type="button" className="btn-ghost self-end text-red-700" onClick={() => setTiers(tiers.filter((_, i) => i !== index))}>Remove</button>
            </div>)}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => setTiers([...tiers, { id: `tier-${Date.now()}`, minDays: 1, maxDays: 30, percent: 0 }])}>Add tier</button>
            <button className="btn-primary">Save discount rules</button>
            <button type="button" className="btn-ghost" onClick={restoreDiscounts}>Restore defaults</button>
          </div>
        </form>
      </Section>}
      <Section title="System">
        <div className="space-y-2 p-4 text-sm text-black">
          <p>{state.batches.length} batches · {state.transfers.length} transfers · {(state.purchases || []).length} purchase requests · {(state.reorderSettings || []).length} reorder settings · {state.audit.length} audit records. Data lives in this browser's LocalStorage (demo mode).</p>
          <button className="btn-danger" onClick={() => setConfirmReset(true)}>Reset demo data</button>
        </div>
      </Section>
      {confirmReset && <Confirm title="Reset demo data?" message="This restores the original dataset and removes all changes." confirmLabel="Reset" danger onConfirm={reset} onClose={() => setConfirmReset(false)} />}
    </div>
  );
}
