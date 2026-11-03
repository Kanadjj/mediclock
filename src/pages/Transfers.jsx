import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { Badge, Confirm, Empty, Modal, Section, fmtDate, fmtTime, inrPrecise } from '../components/ui.jsx';
import { availableActions, transferAction, verifyAudit } from '../lib/logic.js';

const STEPS = ['Awaiting sending approval', 'Awaiting receiving approval', 'Awaiting medical officer approval', 'Approved', 'Dispatched', 'Completed'];
const LABEL = { approve: 'Approve', reject: 'Reject', dispatch: 'Mark dispatched', receive: 'Confirm receipt', cancel: 'Cancel' };
const DANGER = ['reject', 'cancel'];

function Stepper({ status }) {
  const idx = STEPS.indexOf(status);
  return (
    <ol className="flex flex-wrap gap-1 text-[11px]">
      {['Sending', 'Receiving', 'Officer', 'Approved', 'Dispatched', 'Received'].map((s, i) => (
        <li key={s} className={`rounded px-1.5 py-0.5 ${idx < 0 ? 'bg-slate-100 text-black' : i < idx || status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : i === idx ? 'bg-brand-600 text-white' : 'bg-slate-100 text-black'}`}>{s}</li>
      ))}
    </ol>
  );
}

export default function Transfers() {
  const { state, user, today, run } = useStore();
  const [filter, setFilter] = useState('all');
  const [ask, setAsk] = useState(null);
  const [detail, setDetail] = useState(null);
  const cname = (id) => state.clinics.find((c) => c.id === id)?.name || id;
  const list = state.transfers.filter((t) => filter === 'all' || (filter === 'mine' ? availableActions(t, user).length > 0 : t.status === filter));
  const doAction = (t, a) => run((s) => transferAction(s, t.id, a, user, today), `${t.id}: ${LABEL[a].toLowerCase()} done`);
  const chainOk = verifyAudit(state.audit);

  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold text-navy-900">Transfers</h1><p className="text-sm text-black">Sending pharmacist → receiving pharmacist → Medical Officer → dispatch → receipt. Stock moves only when receipt is confirmed.</p></div>
      <div className="flex flex-wrap gap-2">
        {[['all', 'All'], ['mine', 'Needs my action'], ['Completed', 'Completed'], ['Rejected', 'Rejected'], ['Cancelled', 'Cancelled']].map(([v, l]) => <button key={v} onClick={() => setFilter(v)} className={filter === v ? 'btn-primary' : 'btn-ghost'}>{l}</button>)}
      </div>
      {list.length === 0 ? <div className="card"><Empty title="No transfers to show" hint="Raise one from the Swap Board to start the workflow." /></div> : (
        <div className="space-y-3">
          {list.map((t) => {
            const acts = availableActions(t, user);
            return (
              <article key={t.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><div className="text-xs text-black">{t.id} · raised {fmtTime(t.createdAt)}</div><h3 className="font-semibold text-navy-900">{t.qty} {t.unit} {t.medicineName}</h3><div className="text-sm text-black">{cname(t.fromClinic)} → {cname(t.toClinic)} · batch {t.batchNo} · expires {fmtDate(t.expiry)}</div></div>
                  <Badge>{t.status}</Badge>
                </div>
                {t.pricing && <div className="mt-2 rounded-md bg-teal-50 p-2 text-sm text-slate-800">
                  {t.pricing.remainingDays} days remaining · Original {inrPrecise(t.pricing.originalUnitPrice)}/unit · {t.pricing.discountPercent}% discount · Discounted {inrPrecise(t.pricing.finalUnitPrice)}/unit
                  <div className="text-xs">Estimated transfer value {inrPrecise(t.discountedValue)} (illustrative, not a payment)</div>
                </div>}
                <div className="mt-3"><Stepper status={t.status} /></div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {acts.map((a) => <button key={a} className={a === 'approve' || a === 'dispatch' || a === 'receive' ? 'btn-teal' : DANGER.includes(a) ? 'btn-ghost text-red-700' : 'btn-ghost'} onClick={() => setAsk({ t, a })}>{LABEL[a]}</button>)}
                  <button className="btn-ghost" onClick={() => setDetail(t)}>History</button>
                  {acts.length === 0 && ['Awaiting sending approval', 'Awaiting receiving approval', 'Awaiting medical officer approval', 'Approved', 'Dispatched'].includes(t.status) && <span className="text-xs text-black">Waiting for: {t.status === 'Awaiting medical officer approval' ? 'Medical Officer' : t.status === 'Awaiting receiving approval' || t.status === 'Dispatched' ? `pharmacist at ${cname(t.toClinic)}` : `pharmacist at ${cname(t.fromClinic)}`}. Switch user (top right) to act.</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Section title="Audit trail" action={<Badge tone={chainOk ? 'Completed' : 'Rejected'}>{chainOk ? 'Hash chain verified' : 'Chain broken'}</Badge>}>
        {state.audit.length === 0 ? <Empty title="No audit records yet" hint="Every transfer event is recorded here and cannot be edited or deleted." /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[40rem]"><thead className="border-b bg-slate-50"><tr>{['Record', 'Time', 'Transfer', 'Event', 'By', 'Detail'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y">{[...state.audit].reverse().map((a) => <tr key={a.id}><td className="td">{a.id}</td><td className="td whitespace-nowrap">{fmtTime(a.ts)}</td><td className="td">{a.transferId}</td><td className="td">{a.to ? `${a.from} → ${a.to}` : a.action}</td><td className="td">{a.by} <span className="text-xs text-black">({a.role})</span></td><td className="td text-xs text-black">{a.detail}</td></tr>)}</tbody></table></div>
        )}
        <p className="border-t px-4 py-2 text-xs text-black">Demo audit records are append-only inside this app and hash-chained to reveal edits, but LocalStorage can still be altered by anyone with browser access. Production needs server-side enforcement.</p>
      </Section>
      {ask && <Confirm title={`${LABEL[ask.a]} ${ask.t.id}?`} message={`${LABEL[ask.a]}: ${ask.t.qty} ${ask.t.unit} ${ask.t.medicineName}, ${cname(ask.t.fromClinic)} → ${cname(ask.t.toClinic)}.` + (ask.a === 'receive' ? ' Both clinic inventories will be updated.' : '')} confirmLabel={LABEL[ask.a]} danger={DANGER.includes(ask.a)} onConfirm={() => doAction(ask.t, ask.a)} onClose={() => setAsk(null)} />}
      {detail && <Modal title={`${detail.id} history`} onClose={() => setDetail(null)}><ol className="space-y-2 text-sm">{(state.transfers.find((x) => x.id === detail.id) || detail).history.map((h, i) => <li key={i} className="border-l-2 border-brand-600 pl-3"><div className="font-medium">{h.status}</div><div className="text-xs text-black">{h.by} · {fmtTime(h.ts)}</div></li>)}</ol></Modal>}
    </div>
  );
}
