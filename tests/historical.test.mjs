import assert from 'node:assert/strict';
import { seedData } from '../src/lib/seed.js';
import { createHistoricalDemoData, withHistoricalDemoData } from '../src/lib/historical.js';
import { isValidDate, migrateStateData } from '../src/lib/logic.js';

const state = seedData('2026-11-04');
const history = state.historicalDemo;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };
const allowedMonths = ['2026-07', '2026-08', '2026-09', '2026-10'];
console.log('MediClock historical demo tests');

test('seed has exactly four labelled historical months without changing live transactions', () => {
  const resetData = seedData('2026-11-04');
  assert.match(history.label, /Simulated historical demo data/);
  assert.deepEqual(resetData.historicalDemo, history);
  assert.deepEqual(history.months, allowedMonths);
  assert.deepEqual(history.range, { from: '2026-07-01', to: '2026-10-31' });
  assert.equal(state.transfers.length, 0);
  assert.equal(state.purchases.length, 0);
  assert.equal(state.notifications.length, 0);
  assert.ok(history.transactions.length > 200);
});

test('all generated transaction dates are valid and confined to July-October 2026', () => {
  assert.ok(history.transactions.every((t) => isValidDate(t.date) && allowedMonths.includes(t.date.slice(0, 7))));
  for (const purchase of history.purchases) {
    assert.ok(allowedMonths.includes(purchase.requestedAt.slice(0, 7)));
    if (purchase.approvedAt) assert.ok(allowedMonths.includes(purchase.approvedAt.slice(0, 7)));
    if (purchase.placedAt) assert.ok(allowedMonths.includes(purchase.placedAt.slice(0, 7)));
    for (const delivery of purchase.deliveries) assert.ok(allowedMonths.includes(delivery.date.slice(0, 7)));
  }
  for (const transfer of history.transfers) {
    for (const key of ['requestDate', 'approvalDate', 'dispatchDate', 'receiptDate']) assert.ok(allowedMonths.includes(transfer[key].slice(0, 7)));
  }
  assert.equal(new Set(history.transactions.map((t) => t.id)).size, history.transactions.length);
  assert.equal(new Set(history.activity.map((a) => a.id)).size, history.activity.length);
});

test('monthly stock ledgers reconcile all movements and match the current seeded closing stock', () => {
  const grouped = new Map();
  for (const batch of state.batches) {
    const key = `${batch.clinicId}:${batch.medicineId}`;
    grouped.set(key, (grouped.get(key) || 0) + batch.qty);
  }
  assert.equal(history.monthlyStock.length, grouped.size * 4);
  for (const [key, closing] of grouped) {
    const [clinicId, medicineId] = key.split(':');
    const months = history.monthlyStock.filter((x) => x.clinicId === clinicId && x.medicineId === medicineId);
    assert.equal(months.length, 4);
    months.forEach((row, i) => {
      assert.ok(row.openingStock >= 0);
      assert.ok(row.closingStock >= 0);
      assert.equal(row.openingStock + row.netMovement, row.closingStock);
      let running = row.openingStock;
      const movements = history.transactions.filter((t) => t.date.startsWith(row.month) && t.clinicId === clinicId && t.medicineId === medicineId
        && ['consumption', 'wastage', 'stock_addition', 'stock_adjustment', 'transfer_in', 'transfer_out', 'purchase_delivery'].includes(t.type))
        .sort((a, b) => a.date.localeCompare(b.date)
          || Number(!['stock_addition', 'transfer_in', 'purchase_delivery'].includes(a.type)) - Number(!['stock_addition', 'transfer_in', 'purchase_delivery'].includes(b.type))
          || a.id.localeCompare(b.id));
      for (const event of movements) {
        running += event.type === 'stock_adjustment' ? event.quantity
          : ['consumption', 'wastage', 'transfer_out'].includes(event.type) ? -event.quantity : event.quantity;
        assert.ok(running >= 0, `Stock became negative for ${key} in ${row.month} at ${event.id}`);
      }
      assert.equal(running, row.closingStock);
      if (i < months.length - 1) assert.equal(row.closingStock, months[i + 1].openingStock);
    });
    assert.equal(months[3].closingStock, closing);
  }
});

test('consumption, wastage, additions, adjustments and stock alerts vary by month', () => {
  assert.equal(history.consumption.length, 100);
  assert.equal(history.wastage.length, 16);
  assert.equal(history.stockAdditions.length, 12);
  assert.ok(history.stockAdjustments.length >= 12);
  assert.ok(history.transactions.some((t) => t.type === 'surplus_detected'));
  assert.ok(history.transactions.some((t) => t.type === 'shortage_detected'));
  for (const month of allowedMonths) {
    assert.ok(history.consumption.some((x) => x.date.startsWith(month)));
    assert.ok(history.wastage.some((x) => x.date.startsWith(month)));
    assert.ok(history.monthlyCounts[month] > 0);
  }
  assert.ok(new Set(Object.values(history.monthlyCounts)).size > 1);
  const consumptionByMonth = allowedMonths.map((month) => history.consumption.filter((x) => x.date.startsWith(month)).reduce((sum, x) => sum + x.quantity, 0));
  assert.equal(new Set(consumptionByMonth).size, 4);
});

test('completed historical transfers reconcile paired clinic movements and avoid expired lots', () => {
  assert.equal(history.transfers.length, 6);
  assert.deepEqual(allowedMonths.map((month) => history.transfers.filter((t) => t.requestDate.startsWith(month)).length), [1, 2, 1, 2]);
  for (const transfer of history.transfers) {
    assert.equal(transfer.status, 'Completed');
    const out = history.transactions.find((t) => t.id === `${transfer.id}-OUT`);
    const incoming = history.transactions.find((t) => t.id === `${transfer.id}-IN`);
    assert.equal(out.quantity, incoming.quantity);
    assert.equal(out.clinicId, transfer.fromClinic);
    assert.equal(incoming.clinicId, transfer.toClinic);
    assert.equal(incoming.date, transfer.receiptDate);
  }
  assert.ok(history.transfers.every((t) => state.batches.find((b) => b.batchNo === t.batchNo).expiry > t.receiptDate));
});

test('historical purchase statuses and actual expenses reflect confirmed deliveries only', () => {
  assert.deepEqual(new Set(history.purchases.map((p) => p.status)), new Set(['Received', 'Rejected', 'Partially Received', 'Approved', 'Order Placed', 'Pending Approval']));
  for (const purchase of history.purchases) {
    assert.equal(purchase.estimatedCost, purchase.quantity * purchase.unitPrice);
    assert.equal(purchase.actualExpense, purchase.deliveries.reduce((sum, delivery) => sum + delivery.actualExpense, 0));
    assert.equal(purchase.discountAmount || 0, purchase.deliveries.reduce((sum, delivery) => sum + delivery.discountTotal, 0));
    assert.ok(purchase.deliveries.every((delivery) => delivery.originalValue - delivery.discountTotal === delivery.actualExpense));
    assert.equal(purchase.deliveries.reduce((sum, d) => sum + d.quantity, 0), purchase.receivedQty);
    const delivery = history.transactions.find((t) => t.id === `${purchase.id}-DELIVERY`);
    assert.equal(delivery?.quantity || 0, purchase.receivedQty);
    assert.equal(delivery?.actualExpense || 0, purchase.actualExpense);
  }
  const monthlyExpenses = allowedMonths.map((month) => history.purchases.filter((p) => p.requestedAt.startsWith(month)).reduce((sum, p) => sum + p.actualExpense, 0));
  assert.ok(monthlyExpenses[0] > 0 && monthlyExpenses[1] > 0 && monthlyExpenses[2] > 0 && monthlyExpenses[3] > 0);
  assert.notEqual(monthlyExpenses[0], monthlyExpenses[1]);
  assert.equal(history.notifications.length, history.purchases.length);
  assert.ok(history.notifications.some((n) => n.status === 'Received'));
  assert.ok(history.notifications.some((n) => n.status === 'Pending Approval'));
});

test('history persists idempotently and legacy migration preserves user records', () => {
  const withData = withHistoricalDemoData(state);
  assert.equal(withHistoricalDemoData(withData), withData);
  const legacy = structuredClone(state);
  delete legacy.historicalDemo;
  legacy.batches[0].qty += 17;
  const userBatchQty = legacy.batches[0].qty;
  const migrated = withHistoricalDemoData(migrateStateData(legacy));
  assert.equal(migrated.batches[0].qty, userBatchQty);
  assert.ok(migrated.historicalDemo.transactions.length > 0);
  const serialized = JSON.parse(JSON.stringify(migrated));
  assert.equal(withHistoricalDemoData(serialized).historicalDemo.transactions.length, migrated.historicalDemo.transactions.length);
  assert.deepEqual(createHistoricalDemoData(state).transactions, history.transactions);
});

console.log(`\n${passed} historical data tests passed`);
