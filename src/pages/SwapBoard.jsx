import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { Badge, Empty, Field, Modal, fmtDate, inrPrecise } from '../components/ui.jsx';
import { clinicMedSummary, createTransfer, explainRecommendation, projection, SAFETY_MARGIN_DAYS } from '../lib/logic.js';
import { calculateBatchDiscount } from '../lib/discounts.js';

function Row({ k, v }) { return <div><div className="text-xs text-black">{k}</div><div className="text-sm font-medium text-slate-800">{v}</div></div>; }

function RequestModal({ rec, onClose }) {
  const { user, today, run } = useStore();
  const [qty, setQty] = useState(rec.qty);
  const [err, setErr] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const n = Number(qty);
    if (!Number.isInteger(n) || n <= 0) return setErr('Enter a whole number above 0');
    if (n > rec.qty) return setErr(`Maximum is ${rec.qty} ${rec.unit} (lower of eligible surplus and shortage)`);
    const r = run((s) => createTransfer(s, { ...rec, qty: n }, user, today), 'Transfer request raised. It now awaits sending approval.');
    if (r.error) setErr(r.error); else onClose();
  };
  return (
    <Modal title="Raise transfer request" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-black">{rec.medicineName}, batch {rec.batchNo}. Stock stays where it is until receipt is confirmed.</p>
        <div className="rounded-md bg-teal-50 p-3 text-sm text-slate-800">
          <div>Expires {fmtDate(rec.expiry)} · {rec.days} days remaining</div>
          <div>Original {inrPrecise(rec.unitCost)}/unit · {rec.discountPercent}% expiry discount · Transfer unit value {inrPrecise(rec.finalUnitPrice)}</div>
          <div>Estimated value for {qty} {rec.unit}: {inrPrecise(Number(qty) * rec.finalUnitPrice)}</div>
        </div>
        <Field label={`Quantity (${rec.unit})`} error={err} hint={`Recommended ${rec.qty}`}><input autoFocus className="input" type="number" min="1" max={rec.qty} value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-teal">Send for approval</button></div>
      </form>
    </Modal>
  );
}

export default function SwapBoard() {
  const { state, user, today, recs, scope } = useStore();
  const [f, setF] = useState({ med: 'all', urgency: 'all', status: 'all' });
  const [why, setWhy] = useState(null);
  const [req, setReq] = useState(null);
  const cname = (id) => state.clinics.find((c) => c.id === id)?.name || id;
  const meds = useMemo(() => [...new Map(state.batches.map((b) => [b.medicineId, b.name])).entries()], [state.batches]);
  const list = recs.map((r) => {
    const batch = state.batches.find((b) => b.id === r.batchId);
    const saved = r.transferId ? state.transfers.find((t) => t.id === r.transferId)?.pricing : null;
    const pricing = saved || (batch ? calculateBatchDiscount(batch, batch.unitCost, today, state.discountConfig) : null);
    return { ...r, unitCost: pricing?.originalUnitPrice ?? batch?.unitCost ?? 0, discountPercent: pricing?.discountPercent || 0, finalUnitPrice: pricing?.finalUnitPrice ?? batch?.unitCost ?? 0 };
  }).filter((r) => (scope === 'all' || r.fromClinic === scope || r.toClinic === scope) && (f.med === 'all' || r.medicineId === f.med)
    && (f.urgency === 'all' || r.urgency === f.urgency) && (f.status === 'all' || r.status === f.status));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const a = state.batches.find((b) => b.batchNo === 'ORS-A-2611' && b.clinicId === 'A');
  const bSum = clinicMedSummary(state, 'B', 'MED-ORS', today);
  const demo = a && state.clinics.some((c) => c.id === 'B') ? { p: projection(a, today), b: bSum, a } : null;

  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold text-navy-900">Smart Swap Board</h1><p className="text-sm text-black">Matches projected surplus at one clinic with a shortage at another, before the stock expires. Rule-based, no AI.</p></div>
      {demo && (
        <div className="card border-[#cfe0f5] bg-brand-50 p-4 text-sm">
          <div className="font-semibold text-navy-900">Headline scenario: ORS, Clinic A to Clinic B</div>
          <div className="mt-1 grid gap-1 text-slate-700 sm:grid-cols-2">
            <div>Clinic A: {demo.a.qty} sachets, {demo.a.daily}/day, {demo.p.days} days left. Expected use {demo.p.expected}, buffer {demo.a.buffer}. <b>Projected surplus: {demo.p.surplus}.</b></div>
            <div>Clinic B: {demo.b.stock} sachets in stock, {demo.b.required} required. <b>Shortage: {demo.b.shortage}.</b> {demo.b.inbound > 0 && `(${demo.b.inbound} already inbound.)`}</div>
          </div>
        </div>
      )}
      <div className="card grid gap-2 p-3 sm:grid-cols-3">
        <select className="input" value={f.med} onChange={set('med')} aria-label="Medicine"><option value="all">All medicines</option>{meds.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        <select className="input" value={f.urgency} onChange={set('urgency')} aria-label="Urgency"><option value="all">All urgencies</option>{['High', 'Medium', 'Low'].map((u) => <option key={u}>{u}</option>)}</select>
        <select className="input" value={f.status} onChange={set('status')} aria-label="Status"><option value="all">All statuses</option>{['Suggested', 'Awaiting sending approval', 'Awaiting receiving approval', 'Awaiting medical officer approval', 'Approved', 'Dispatched'].map((u) => <option key={u}>{u}</option>)}</select>
      </div>
      {list.length === 0 ? <div className="card"><Empty title="No matches found" hint="Matches appear when one clinic has projected surplus and another has a shortage of the same medicine, with enough time before expiry." /></div> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((r) => {
            const confirmed = ['Approved', 'Dispatched'].includes(r.status) ? r.qty : 0;
            const canRaise = r.status === 'Suggested' && user.role === 'Pharmacist' && [r.fromClinic, r.toClinic].includes(user.clinicId);
            return (
              <article key={r.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><h3 className="font-semibold text-navy-900">{r.medicineName}</h3><div className="text-xs text-black">Batch {r.batchNo}</div></div>
                  <div className="flex gap-1.5"><Badge tone={r.urgency}>{r.urgency} urgency</Badge><Badge>{r.status}</Badge></div>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-800">{cname(r.fromClinic)} → {cname(r.toClinic)}</p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Row k="Projected surplus (estimate)" v={`${r.projectedSurplus} ${r.unit}`} />
                  <Row k="Available to transfer" v={`${r.available} ${r.unit}`} />
                  <Row k="Requested (shortage)" v={`${r.requested} ${r.unit}`} />
                  <Row k="Recommended quantity" v={<span className="text-brand-700">{r.qty} {r.unit}</span>} />
                  <Row k="Confirmed transferable" v={confirmed ? `${confirmed} ${r.unit}` : 'None until approved'} />
                  <Row k="Batch expiry" v={`${fmtDate(r.expiry)} (${r.days} d)`} />
                  <Row k="Discounted transfer value" v={`${inrPrecise(r.finalUnitPrice)}/unit · ${r.discountPercent}%`} />
                  <Row k="Distance" v={`${r.distanceKm} km`} />
                  <Row k="Est. travel time" v={`${r.travelMin} min`} />
                  <Row k="Transfer deadline" v={fmtDate(r.deadline)} />
                </div>
                <p className="mt-3 text-xs text-black">{r.reason}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-ghost" onClick={() => setWhy(r)}>Why this match?</button>
                  {canRaise && <button className="btn-teal" onClick={() => setReq(r)}>Raise transfer request</button>}
                  {r.transferId && <Link className="btn-ghost" to="/transfers">View transfer {r.transferId}</Link>}
                  {r.status === 'Suggested' && !canRaise && <span className="self-center text-xs text-black">Raised by a pharmacist at {cname(r.fromClinic)} or {cname(r.toClinic)}.</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {why && <Modal title="Why this match?" onClose={() => setWhy(null)} wide><p className="mb-3 text-sm font-medium text-navy-900">{why.medicineName}: {cname(why.fromClinic)} → {cname(why.toClinic)}</p><ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">{explainRecommendation(why, state).map((l, i) => <li key={i}>{l}</li>)}</ol><p className="mt-3 text-xs text-black">Rules used: expired stock is never recommended; transfers must arrive at least {SAFETY_MARGIN_DAYS} days before expiry; quantity never exceeds eligible surplus or the receiver's shortage.</p></Modal>}
      {req && <RequestModal rec={req} onClose={() => setReq(null)} />}
    </div>
  );
}
