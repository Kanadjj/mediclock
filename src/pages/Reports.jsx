import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../store.jsx';
import { Empty, Modal, Section, Stat, downloadCSV, inr, num } from '../components/ui.jsx';
import { addDays, allSummaries, daysLeft, projection } from '../lib/logic.js';

const STATUS_COLOR = { Normal: '#16a34a', Monitor: '#0ea5e9', Warning: '#d97706', Critical: '#dc2626', Expired: '#7f1d1d' };

export default function Reports() {
  const { state, today, scope } = useStore();
  const [from, setFrom] = useState(addDays(today, -90));
  const [to, setTo] = useState(addDays(today, 0));
  const [statusView, setStatusView] = useState(null);
  const cname = (id) => state.clinics.find((c) => c.id === id)?.name || id;
  const r = useMemo(() => {
    const inScope = (id) => scope === 'all' || id === scope;
    const batches = state.batches.filter((b) => inScope(b.clinicId));
    const withP = batches.map((b) => ({ b, p: projection(b, today) }));
    const byStatus = ['Normal', 'Monitor', 'Warning', 'Critical', 'Expired'].map((s) => ({ name: s, units: withP.filter((x) => x.p.status === s).reduce((a, x) => a + x.b.qty, 0) }));
    const statusDetail = {};
    withP.forEach(({ b, p }) => {
      if (b.qty <= 0) return;
      const list = statusDetail[p.status] || (statusDetail[p.status] = []);
      const row = list.find((x) => x.name === b.name);
      if (row) {
        row.units += b.qty;
        row.batches += 1;
        row.value += b.qty * b.unitCost;
      } else {
        list.push({ name: b.name, units: b.qty, batches: 1, value: b.qty * b.unitCost });
      }
    });
    Object.values(statusDetail).forEach((list) => list.sort((a, b) => b.units - a.units));
    const near = withP.filter((x) => x.p.days >= 0 && x.p.days <= 90);
    const expired = withP.filter((x) => x.p.days < 0);
    const surplusBy = {};
    withP.forEach(({ b, p }) => { if (p.surplus > 0) surplusBy[b.name] = (surplusBy[b.name] || 0) + p.surplus; });
    const surplusData = Object.entries(surplusBy).map(([name, units]) => ({ name: name.split(' ')[0], units }));
    const done = state.transfers.filter((t) => t.status === 'Completed' && (inScope(t.fromClinic) || inScope(t.toClinic)) && t.completedAt.slice(0, 10) >= from && t.completedAt.slice(0, 10) <= to);
    const movedBy = {};
    done.forEach((t) => { movedBy[t.medicineName] = (movedBy[t.medicineName] || 0) + t.qty; });
    const movedData = Object.entries(movedBy).map(([name, units]) => ({ name: name.split(' ')[0], units }));
    const shortages = allSummaries(state, today).filter((s) => inScope(s.clinicId) && s.shortage > 0);
    const cost = (b) => b.unitCost;
    return {
      near: near.reduce((s, x) => s + x.b.qty, 0), nearBatches: near.length,
      expiredUnits: expired.reduce((s, x) => s + x.b.qty, 0), expiredValue: expired.reduce((s, x) => s + x.b.qty * cost(x.b), 0),
      projUnits: withP.reduce((s, x) => s + x.p.surplus, 0), projValue: withP.reduce((s, x) => s + x.p.surplus * cost(x.b), 0),
      done, moved: done.reduce((s, t) => s + t.qty, 0), saved: done.reduce((s, t) => s + t.qty * t.unitCost, 0),
      shortages, byStatus, statusDetail, surplusData, movedData, withP,
    };
  }, [state, today, scope, from, to]);

  const exportBatches = () => downloadCSV('mediclock_batches.csv', [['Clinic', 'Medicine', 'Batch', 'Quantity', 'Unit', 'Expiry', 'Days left', 'Status', 'Daily use', 'Projected surplus (estimate)', 'Unit cost (illustrative INR)'],
    ...r.withP.map(({ b, p }) => [cname(b.clinicId), b.name, b.batchNo, b.qty, b.unit, b.expiry, p.days, p.status, b.daily, p.surplus, b.unitCost])]);
  const exportTransfers = () => downloadCSV('mediclock_transfers.csv', [['ID', 'Status', 'From', 'To', 'Medicine', 'Batch', 'Quantity', 'Unit', 'Created', 'Completed', 'Estimated value (illustrative INR)'],
    ...state.transfers.map((t) => [t.id, t.status, cname(t.fromClinic), cname(t.toClinic), t.medicineName, t.batchNo, t.qty, t.unit, t.createdAt, t.completedAt || '', t.qty * t.unitCost])]);
  const exportShort = () => downloadCSV('mediclock_shortages.csv', [['Clinic', 'Medicine', 'Stock', 'Required', 'Shortage', 'Days of stock'], ...r.shortages.map((s) => [cname(s.clinicId), s.name, s.stock, s.required, s.shortage, s.daysOfStock ?? ''])]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-xl font-semibold text-navy-900">Reports and impact</h1><p className="text-sm text-black">Expiry risk, shortages and redistribution results.</p></div>
        <div className="flex flex-wrap gap-2"><button className="btn-ghost" onClick={exportBatches}>Export batches CSV</button><button className="btn-ghost" onClick={exportTransfers}>Export transfers CSV</button><button className="btn-ghost" onClick={exportShort}>Export shortages CSV</button></div>
      </div>
      <div className="card grid gap-2 p-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-xs text-black">From<input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-xs text-black">To<input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">Simulated demo data. Projected wastage, wastage avoided and inventory value saved are estimates using illustrative unit costs. They are not measured results. The date range applies to completed transfers only.</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Near-expiry stock (90 days)" value={`${num(r.near)} units`} sub={`${r.nearBatches} batches`} tone="amber" />
        <Stat label="Expired stock" value={`${num(r.expiredUnits)} units`} sub={inr(r.expiredValue)} tone="red" />
        <Stat label="Projected wastage (estimate)" value={`${num(r.projUnits)} units`} sub={inr(r.projValue)} tone="amber" />
        <Stat label="Shortage incidents (current)" value={r.shortages.length} tone="red" />
        <Stat label="Completed transfers" value={r.done.length} tone="green" />
        <Stat label="Quantity redistributed" value={`${num(r.moved)} units`} tone="teal" />
        <Stat label="Wastage avoided (estimate)" value={`${num(r.moved)} units`} sub="Units redistributed from at-risk stock" tone="green" />
        <Stat label="Inventory value saved (estimate)" value={inr(r.saved)} tone="green" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Stock by expiry status (units)"><div className="h-64 p-3"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={r.byStatus} dataKey="units" nameKey="name" cx="50%" cy="50%" outerRadius={90} paddingAngle={2} className="cursor-pointer" onClick={(entry) => setStatusView(entry?.payload?.name || entry?.name)}>{r.byStatus.map((d) => <Cell key={d.name} fill={STATUS_COLOR[d.name]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div><p className="border-t border-slate-100 px-4 py-2 text-xs text-black">Click a slice to see which medicines are in that expiry state.</p></Section>
        <Section title="Projected surplus at risk by medicine (units, estimate)">{r.surplusData.length === 0 ? <Empty title="No projected surplus" hint="No batch is expected to outlast its consumption." /> : <div className="h-64 p-3"><ResponsiveContainer width="100%" height="100%"><BarChart data={r.surplusData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Bar dataKey="units" name="Units" fill="#d97706" /></BarChart></ResponsiveContainer></div>}</Section>
        <Section title="Quantity redistributed by medicine (completed transfers)">{r.movedData.length === 0 ? <Empty title="No completed transfers in this range" hint="Complete a transfer on the Transfers page and it will appear here." /> : <div className="h-64 p-3"><ResponsiveContainer width="100%" height="100%"><BarChart data={r.movedData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Legend /><Bar dataKey="units" name="Units moved" fill="#0f8b8d" /></BarChart></ResponsiveContainer></div>}</Section>
        <Section title="Current shortages">{r.shortages.length === 0 ? <Empty title="No shortages" /> : <div className="overflow-x-auto"><table className="w-full"><thead className="border-b bg-slate-50"><tr>{['Clinic', 'Medicine', 'Stock', 'Required', 'Short'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead><tbody className="divide-y">{r.shortages.map((s) => <tr key={s.clinicId + s.medicineId}><td className="td">{cname(s.clinicId)}</td><td className="td">{s.name}</td><td className="td tabular-nums">{s.stock}</td><td className="td tabular-nums">{s.required}</td><td className="td tabular-nums font-medium text-red-600">{s.shortage}</td></tr>)}</tbody></table></div>}</Section>
      </div>
      {statusView && (() => {
        const rows = r.statusDetail[statusView] || [];
        const total = rows.reduce((s, m) => s + m.units, 0);
        const totalBatches = rows.reduce((s, m) => s + m.batches, 0);
        const totalValue = rows.reduce((s, m) => s + m.value, 0);
        return (
          <Modal title={`${statusView} stock`} onClose={() => setStatusView(null)} wide>
            <p className="text-sm text-black">Batches currently in the <span className="font-medium">{statusView}</span> expiry state{scope === 'all' ? ' across all clinics' : ` at ${cname(scope)}`}.</p>
            {rows.length === 0 ? <Empty title="No stock in this state" /> : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-slate-50"><tr>{['Medicine', 'Units', 'Batches', 'Price'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
                  <tbody className="divide-y">
                    {rows.map((m) => <tr key={m.name}><td className="td">{m.name}</td><td className="td tabular-nums">{num(m.units)}</td><td className="td tabular-nums">{m.batches}</td><td className="td tabular-nums">{inr(m.value)}</td></tr>)}
                  </tbody>
                  <tfoot><tr className="border-t"><td className="td font-medium">Total</td><td className="td tabular-nums font-medium">{num(total)}</td><td className="td tabular-nums font-medium">{totalBatches}</td><td className="td tabular-nums font-medium">{inr(totalValue)}</td></tr></tfoot>
                </table>
              </div>
            )}
          </Modal>
        );
      })()}
    </div>
  );
}
