import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { Badge, Empty, Field, Section, Stat, inr, inrPrecise, num } from '../components/ui.jsx';
import { addDays, availableReorderStock, configureReorder, isValidDate, PURCHASE_ACTIVE, purchaseAction } from '../lib/logic.js';
import { calculateBatchDiscount, DEFAULT_DISCOUNT_CONFIG } from '../lib/discounts.js';

const blankSetting = (clinicId) => ({ clinicId, medicineId: '', threshold: '', reorderQuantity: '', unitPrice: '', supplier: '', supplierContact: '', active: true });

function ActionForm({ item, action, today, onClose }) {
  const { user, run } = useStore();
  const [values, setValues] = useState({ quantity: '', batchNo: '', expiry: addDays(today, 180), reason: '', note: '' });
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const r = run((s) => purchaseAction(s, item.id, action, user, today, values), {
      approve: 'Purchase request approved',
      reject: 'Purchase request rejected',
      place: 'Order marked as placed',
      receive: 'Delivery confirmed',
      cancel: 'Purchase request cancelled',
    }[action]);
    if (r.error) setError(r.error); else onClose();
  };
  const preview = action === 'receive' && isValidDate(values.expiry)
    ? calculateBatchDiscount({ expiry: values.expiry }, item.unitPrice, today, item.discountConfigSnapshot || DEFAULT_DISCOUNT_CONFIG) : null;
  const labels = { approve: 'Approve request', reject: 'Reject request', place: 'Mark order placed', receive: 'Confirm delivery', cancel: 'Cancel request' };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-0 sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={labels[action]} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-xl bg-white shadow-xl sm:rounded-xl">
        <div className="flex items-center justify-between border-b px-4 py-3"><h3 className="font-semibold text-navy-900">{labels[action]} · {item.id}</h3><button className="btn-ghost !px-2" onClick={onClose}>Close</button></div>
        <form onSubmit={submit} className="space-y-3 p-4">
          <p className="text-sm text-black">{item.medicineName} · {item.quantity - item.receivedQty} {item.unit} remaining · {item.supplier}</p>
          {action === 'receive' && <>
            <Field label={`Quantity received (${item.unit})`}><input className="input" type="number" min="1" max={item.quantity - item.receivedQty} step="1" required value={values.quantity} onChange={(e) => setValues({ ...values, quantity: e.target.value })} /></Field>
            <Field label="Supplier batch number"><input className="input" required value={values.batchNo} onChange={(e) => setValues({ ...values, batchNo: e.target.value })} /></Field>
            <Field label="Expiry date"><input className="input" type="date" min={today} required value={values.expiry} onChange={(e) => setValues({ ...values, expiry: e.target.value })} /></Field>
            {preview ? <div className="rounded-md bg-teal-50 p-3 text-sm text-slate-800 sm:col-span-2">
              <div>{preview.eligible ? `${preview.remainingDays} days remaining · ${preview.discountPercent}% expiry discount` : 'Expired batch — not eligible for discount'}</div>
              <div className="mt-1">Original {inrPrecise(preview.originalUnitPrice)}/unit · Discount {inrPrecise(preview.discountAmount)}/unit · Final {inrPrecise(preview.finalUnitPrice)}/unit</div>
              <div className="font-medium">Estimated receipt value: {inr(Number(values.quantity || 0) * preview.finalUnitPrice)}</div>
            </div> : <p className="text-sm text-amber-700">Enter a valid expiry date to preview discount pricing.</p>}
          </>}
          {['reject', 'cancel'].includes(action) && <Field label="Reason"><textarea className="input" rows="3" required value={values.reason} onChange={(e) => setValues({ ...values, reason: e.target.value })} /></Field>}
          {action === 'approve' && <Field label="Approval note (optional)"><textarea className="input" rows="2" value={values.note} onChange={(e) => setValues({ ...values, note: e.target.value })} /></Field>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Back</button><button className={['reject', 'cancel'].includes(action) ? 'btn-danger' : 'btn-primary'}>{labels[action]}</button></div>
        </form>
      </div>
    </div>
  );
}

export default function PurchaseManagement() {
  const { state, user, today, scope, run } = useStore();
  const ownClinic = user.role === 'Pharmacist' ? user.clinicId : null;
  const [clinicId, setClinicId] = useState(ownClinic || state.clinics[0]?.id || '');
  const [setting, setSetting] = useState(() => blankSetting(ownClinic || state.clinics[0]?.id || ''));
  const [error, setError] = useState('');
  const [action, setAction] = useState(null);
  const clinicName = (id) => state.clinics.find((c) => c.id === id)?.name || id;
  const inScope = (id) => (ownClinic ? ownClinic === id : scope === 'all' || scope === id);
  const choices = [...new Map(state.batches.filter((b) => b.clinicId === clinicId).map((b) => [b.medicineId, b])).values()];
  const settings = (state.reorderSettings || []).filter((x) => inScope(x.clinicId));
  const purchases = (state.purchases || []).filter((x) => inScope(x.clinicId));
  const active = purchases.filter((p) => PURCHASE_ACTIVE.includes(p.status));
  const below = settings.filter((x) => x.active && availableReorderStock(state, x.clinicId, x.medicineId, today).available <= x.threshold);
  const metrics = {
    below: below.length,
    approvals: active.filter((p) => p.status === 'Pending Approval').length,
    delivery: active.filter((p) => ['Order Placed', 'Partially Received'].includes(p.status)).length,
    estimated: active.reduce((sum, p) => sum + Math.max(0, p.quantity - (p.receivedQty || 0)) * p.unitPrice, 0),
    actual: purchases.reduce((sum, p) => sum + (p.actualExpense || 0), 0),
  };
  const medicineChange = (medicineId) => {
    const selected = choices.find((b) => b.medicineId === medicineId);
    const saved = (state.reorderSettings || []).find((x) => x.clinicId === clinicId && x.medicineId === medicineId);
    setSetting(saved ? { ...saved } : { ...blankSetting(clinicId), medicineId, ...(selected ? { medicineName: selected.name } : {}) });
  };
  const saveSetting = (e) => {
    e.preventDefault();
    const r = run((s) => configureReorder(s, setting, user, today), 'Reorder settings saved');
    if (r.error) setError(r.error); else { setError(''); setSetting(blankSetting(clinicId)); }
  };
  const canConfigure = ['Pharmacist', 'Administrator'].includes(user.role);
  const canApprove = ['Medical Officer', 'Administrator'].includes(user.role);
  const canManageOrders = ['Pharmacist', 'Administrator'].includes(user.role);
  const actionFor = (p) => {
    const list = [];
    if (canApprove && p.status === 'Pending Approval') list.push(['approve', 'Approve'], ['reject', 'Reject']);
    if (canManageOrders && p.clinicId === (ownClinic || p.clinicId)) {
      if (p.status === 'Approved') list.push(['place', 'Mark placed']);
      if (['Order Placed', 'Partially Received'].includes(p.status)) list.push(['receive', 'Confirm delivery']);
      if (PURCHASE_ACTIVE.includes(p.status)) list.push(['cancel', 'Cancel']);
    }
    return list;
  };

  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold text-navy-900">Purchase management</h1><p className="text-sm text-black">Automated reorder requests and delivery tracking. Available stock is unexpired on-hand stock minus active outgoing transfers, plus active incoming transfers and unreceived active purchase quantities. MediClock does not place supplier orders.</p></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Medicines below threshold" value={metrics.below} tone="red" />
        <Stat label="Pending approvals" value={metrics.approvals} tone="amber" />
        <Stat label="Orders awaiting delivery" value={metrics.delivery} tone="teal" />
        <Stat label="Estimated pending value" value={inr(metrics.estimated)} sub="Outstanding quantities; not paid" tone="amber" />
        <Stat label="Actual purchase expenses" value={inr(metrics.actual)} sub="Modeled from confirmed receipts" tone="green" />
      </div>

      {canConfigure && <Section title="Medicine reorder settings">
        <form onSubmit={saveSetting} className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {user.role === 'Administrator' && <Field label="Clinic"><select className="input" value={clinicId} onChange={(e) => { setClinicId(e.target.value); setSetting(blankSetting(e.target.value)); }}><option value="">Choose clinic</option>{state.clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
          <Field label="Medicine"><select className="input" required value={setting.medicineId} onChange={(e) => medicineChange(e.target.value)}><option value="">Choose medicine</option>{choices.map((m) => <option key={m.medicineId} value={m.medicineId}>{m.name}</option>)}</select></Field>
          <Field label="Minimum stock threshold"><input className="input" type="number" min="0" step="1" required value={setting.threshold} onChange={(e) => setSetting({ ...setting, threshold: e.target.value })} /></Field>
          <Field label="Reorder quantity"><input className="input" type="number" min="1" step="1" required value={setting.reorderQuantity} onChange={(e) => setSetting({ ...setting, reorderQuantity: e.target.value })} /></Field>
          <Field label="Unit purchase price (₹)"><input className="input" type="number" min="0" step="0.01" required value={setting.unitPrice} onChange={(e) => setSetting({ ...setting, unitPrice: e.target.value })} /></Field>
          <Field label="Preferred supplier"><input className="input" required value={setting.supplier} onChange={(e) => setSetting({ ...setting, supplier: e.target.value })} /></Field>
          <Field label="Supplier contact (optional)"><input className="input" value={setting.supplierContact || ''} onChange={(e) => setSetting({ ...setting, supplierContact: e.target.value })} /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={setting.active !== false} onChange={(e) => setSetting({ ...setting, active: e.target.checked })} /> Reordering active</label>
          <div className="flex items-end"><button className="btn-primary">Save reorder settings</button></div>
          {error && <p role="alert" className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        </form>
        <div className="overflow-x-auto border-t"><table className="w-full min-w-[42rem]"><thead className="border-b bg-slate-50"><tr>{['Clinic', 'Medicine', 'Threshold', 'Reorder qty', 'Unit price', 'Supplier', 'Status'].map((h) => <th className="th" key={h}>{h}</th>)}</tr></thead>
          <tbody className="divide-y">{settings.map((x) => <tr key={x.clinicId + x.medicineId}><td className="td">{clinicName(x.clinicId)}</td><td className="td">{x.medicineName}</td><td className="td">{num(x.threshold)} {x.unit}</td><td className="td">{num(x.reorderQuantity)}</td><td className="td">{inr(x.unitPrice)}</td><td className="td">{x.supplier}</td><td className="td"><Badge tone={x.active ? 'Approved' : 'Cancelled'}>{x.active ? 'Active' : 'Inactive'}</Badge><button className="ml-2 text-xs text-brand-700 hover:underline" onClick={() => { setClinicId(x.clinicId); setSetting({ ...x }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button></td></tr>)}</tbody>
        </table>{settings.length === 0 && <Empty title="No reorder settings" hint="Choose a stocked medicine to configure automatic reorder requests." />}</div>
      </Section>}

      <Section title="Purchase requests and orders">
        <div className="overflow-x-auto"><table className="w-full min-w-[70rem]"><thead className="border-b bg-slate-50"><tr>{['Request', 'Medicine / clinic', 'Requested', 'Supplier', 'Estimated', 'Actual expense', 'Requested date', 'Status', 'Actions'].map((h) => <th className="th" key={h}>{h}</th>)}</tr></thead>
          <tbody className="divide-y">{purchases.map((p) => <tr key={p.id} className="align-top">
            <td className="td"><span className="font-medium">{p.id}</span><details className="mt-1 text-xs text-black"><summary className="cursor-pointer">History / delivery</summary><ul className="mt-2 space-y-1">{(p.history || []).map((h, i) => <li key={i}>{h.status} · {h.by} · {new Date(h.at).toLocaleString('en-IN')}{h.note ? ` — ${h.note}` : ''}</li>)}{(p.deliveries || []).map((d, i) => <li key={`d-${i}`}>Delivery: {d.quantity} {p.unit}, batch {d.batchNo}, expiry {d.expiry}, {d.date} · {d.confirmedBy}. Original {inrPrecise(d.originalUnitPrice ?? p.unitPrice)}/unit, {d.discountPercent ?? 0}% discount ({inrPrecise(d.discountAmount || 0)}/unit), final {inrPrecise(d.finalUnitPrice ?? p.unitPrice)}/unit; total {inrPrecise(d.actualExpense ?? d.quantity * p.unitPrice)}, saved {inrPrecise(d.discountTotal || 0)}.</li>)}</ul>{p.rejectionReason && <p>Rejection: {p.rejectionReason}</p>}{p.cancellationReason && <p>Cancellation: {p.cancellationReason}</p>}</details></td>
            <td className="td">{p.medicineName}<div className="text-xs text-black">{clinicName(p.clinicId)}</div></td>
            <td className="td">{num(p.quantity)} {p.unit}<div className="text-xs text-black">{num(p.receivedQty || 0)} received</div></td>
            <td className="td">{p.supplier}{p.supplierContact && <div className="text-xs text-black">{p.supplierContact}</div>}</td>
            <td className="td">{inr(p.estimatedCost)}<div className="text-xs text-black">Before batch discount</div></td><td className="td">{inr(p.actualExpense || 0)}{p.discountAmount > 0 && <div className="text-xs text-teal-700">{inr(p.discountAmount)} saved</div>}</td>
            <td className="td whitespace-nowrap">{new Date(p.requestedAt).toLocaleDateString('en-IN')}</td>
            <td className="td"><Badge tone={p.status}>{p.status}</Badge>{p.approvedBy && <div className="mt-1 text-xs text-black">Approved by {p.approvedBy}</div>}{p.placedAt && <div className="mt-1 text-xs text-black">Placed {new Date(p.placedAt).toLocaleDateString('en-IN')}</div>}</td>
            <td className="td"><div className="flex flex-wrap gap-1">{actionFor(p).map(([a, label]) => <button key={a} className={['reject', 'cancel'].includes(a) ? 'btn-ghost !px-2 !py-1 text-red-700' : 'btn-teal !px-2 !py-1'} onClick={() => a === 'place' ? run((s) => purchaseAction(s, p.id, a, user, today), 'Order marked as placed') : setAction({ item: p, action: a })}>{label}</button>)}</div></td>
          </tr>)}</tbody>
        </table></div>
        {purchases.length === 0 && <Empty title="No purchase requests yet" hint="An automatic request appears here when configured available stock reaches its threshold." />}
        <div className="border-t px-4 py-2 text-xs text-black">Estimated value uses the agreed unit price before batch discounts. The modeled expense uses only confirmed received quantities at their saved discounted batch prices. Discounts are finalized when delivery batch and expiry are recorded; no supplier payments are processed.</div>
      </Section>
      {action && <ActionForm item={action.item} action={action.action} today={today} onClose={() => setAction(null)} />}
    </div>
  );
}
