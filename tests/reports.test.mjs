import assert from 'node:assert/strict';
import { seedData } from '../src/lib/seed.js';
import { summarizeHistoricalPurchasesAndTransfers } from '../src/lib/reporting.js';

const state = seedData('2026-11-04');
const archive = state.historicalDemo;
const inventoryBefore = structuredClone(state.batches);
const report = summarizeHistoricalPurchasesAndTransfers(archive);
const expected = [
  { month: '2026-07', requests: 2, quantityOrdered: 220, quantityReceived: 120, actualExpense: 132, completedTransfers: 1, quantityTransferred: 16 },
  { month: '2026-08', requests: 2, quantityOrdered: 280, quantityReceived: 100, actualExpense: 475, completedTransfers: 2, quantityTransferred: 40 },
  { month: '2026-09', requests: 2, quantityOrdered: 390, quantityReceived: 90, actualExpense: 576, completedTransfers: 1, quantityTransferred: 14 },
  { month: '2026-10', requests: 2, quantityOrdered: 360, quantityReceived: 60, actualExpense: 334.8, completedTransfers: 2, quantityTransferred: 45 },
];

for (const row of expected) {
  const actual = report.months.find((month) => month.month === row.month);
  for (const [key, value] of Object.entries(row)) assert.equal(actual[key], value, `${row.month} ${key}`);
  const deliveries = archive.purchases.flatMap((purchase) => purchase.deliveries)
    .filter((delivery) => delivery.date.startsWith(row.month));
  const transfers = archive.transfers.filter((transfer) => transfer.status === 'Completed' && transfer.receiptDate.startsWith(row.month));
  assert.equal(actual.purchaseDiscount, deliveries.reduce((sum, delivery) => sum + delivery.discountTotal, 0));
  assert.equal(actual.purchaseOriginalValue, deliveries.reduce((sum, delivery) => sum + delivery.originalValue, 0));
  assert.equal(actual.purchaseDiscountedValue, deliveries.reduce((sum, delivery) => sum + delivery.actualExpense, 0));
  assert.equal(actual.transferDiscount, transfers.reduce((sum, transfer) => sum + transfer.discountTotal, 0));
  assert.equal(actual.transferOriginalValue, transfers.reduce((sum, transfer) => sum + transfer.originalValue, 0));
  assert.equal(actual.transferDiscountedValue, transfers.reduce((sum, transfer) => sum + transfer.discountedValue, 0));
  assert.deepEqual(actual.statuses, archive.purchases.filter((purchase) => purchase.requestedAt.startsWith(row.month))
    .reduce((statuses, purchase) => { statuses[purchase.status] = (statuses[purchase.status] || 0) + 1; return statuses; }, {}));
}
assert.equal(report.transfers.length, archive.transfers.filter((transfer) => transfer.status === 'Completed').length);
assert.equal(report.transfers.reduce((sum, transfer) => sum + transfer.quantity, 0), 115);

const august = report.months.find((row) => row.month === '2026-08');
assert.equal(august.quantityReceived, archive.purchases
  .flatMap((purchase) => purchase.deliveries.map((delivery) => ({ purchase, delivery })))
  .filter(({ delivery }) => delivery.date.startsWith('2026-08'))
  .reduce((sum, { delivery }) => sum + delivery.quantity, 0));
assert.equal(august.actualExpense, 475); // 100 received units at ₹5 less the saved expiry discount.
assert.equal(august.purchaseDiscount, 25);
assert.equal(august.purchaseOriginalValue, 500);
assert.equal(august.purchaseDiscountedValue, 475);

const clinicA = summarizeHistoricalPurchasesAndTransfers(archive, 'A');
assert.equal(clinicA.months.reduce((sum, row) => sum + row.requests, 0), archive.purchases.filter((purchase) => purchase.clinicId === 'A').length);
assert.equal(clinicA.transfers.length, archive.transfers.filter((transfer) => transfer.status === 'Completed' && (transfer.fromClinic === 'A' || transfer.toClinic === 'A')).length);
assert.deepEqual(state.batches, inventoryBefore); // Historical report aggregation must not affect live stock.

console.log('  ok  monthly report totals match archive; deliveries and transfers counted correctly');
console.log('  ok  clinic scope filters report records without changing inventory');
