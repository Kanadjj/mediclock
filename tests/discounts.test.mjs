import assert from 'node:assert/strict';
import * as L from '../src/lib/logic.js';
import { DEFAULT_DISCOUNT_CONFIG, calculateBatchDiscount, validateDiscountTiers } from '../src/lib/discounts.js';
import { seedData } from '../src/lib/seed.js';
import { withHistoricalDemoData } from '../src/lib/historical.js';
import { summarizeHistoricalPurchasesAndTransfers } from '../src/lib/reporting.js';

const today = '2026-11-04';
const testBatch = (days) => ({ expiry: L.addDays(today, days) });
const user = (state, role, clinicId) => state.users.find((item) => item.role === role && (!clinicId || item.clinicId === clinicId));
const run = (result) => { assert.ok(!result.error, result.error); return result.state; };
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log(`  ok  ${name}`); };

console.log('MediClock expiry discount tests');

test('default discount boundaries are inclusive at 90, 60, 30 and 1 day', () => {
  assert.equal(calculateBatchDiscount(testBatch(90), 100, today).discountPercent, 5);
  assert.equal(calculateBatchDiscount(testBatch(60), 100, today).discountPercent, 10);
  assert.equal(calculateBatchDiscount(testBatch(30), 100, today).discountPercent, 15);
  assert.equal(calculateBatchDiscount(testBatch(1), 100, today).discountPercent, 15);
  assert.equal(calculateBatchDiscount(testBatch(91), 100, today).discountPercent, 0);
});

test('expired stock is ineligible; same medicine batches use their own expiry', () => {
  const expired = calculateBatchDiscount(testBatch(-1), 10, today);
  assert.equal(expired.eligible, false);
  assert.equal(expired.discountPercent, 0);
  const batchNear = calculateBatchDiscount(testBatch(30), 10, today);
  const batchFar = calculateBatchDiscount(testBatch(120), 10, today);
  assert.equal(batchNear.discountPercent, 15);
  assert.equal(batchFar.discountPercent, 0);
  assert.throws(() => calculateBatchDiscount(testBatch(1), -0.01, today), /price/);
});

test('administrator tier changes validate and persist; non-admins cannot change rules', () => {
  const state = seedData(today);
  const admin = user(state, 'Administrator'), pharmacist = user(state, 'Pharmacist', 'A');
  const valid = [{ id: 'all', minDays: 1, maxDays: null, percent: 12.5 }];
  assert.equal(validateDiscountTiers(valid), null);
  assert.match(validateDiscountTiers([{ minDays: 1, maxDays: 10, percent: 5 }, { minDays: 10, maxDays: 20, percent: 10 }]), /overlap/);
  assert.match(validateDiscountTiers([{ minDays: 1, maxDays: null, percent: 101 }]), /between 0 and 100/);
  assert.ok(L.configureDiscounts(state, valid, pharmacist).error);
  const configured = run(L.configureDiscounts(state, valid, admin));
  assert.equal(configured.discountConfig.tiers[0].percent, 12.5);
  assert.equal(L.migrateStateData(JSON.parse(JSON.stringify(configured))).discountConfig.tiers[0].percent, 12.5);
  assert.deepEqual(run(L.resetDiscounts(configured, admin)).discountConfig, DEFAULT_DISCOUNT_CONFIG);
});

test('purchase requests snapshot rules and partial deliveries charge only discounted received quantities', () => {
  let state = seedData(today);
  const pharmacist = user(state, 'Pharmacist', 'A'), officer = user(state, 'Medical Officer'), admin = user(state, 'Administrator');
  const source = state.batches.find((batch) => batch.batchNo === 'ORS-A-2611');
  source.qty = 100;
  state = run(L.configureReorder(state, { clinicId: 'A', medicineId: source.medicineId, threshold: 50, reorderQuantity: 1000, unitPrice: 5, supplier: 'Demo supplier' }, pharmacist, today));
  state = run(L.adjustQuantity(state, source.id, 50, pharmacist));
  const purchaseId = state.purchases[0].id;
  const requestRules = structuredClone(state.purchases[0].discountConfigSnapshot);
  state = run(L.configureDiscounts(state, [{ id: 'all', minDays: 1, maxDays: null, percent: 50 }], admin));
  assert.deepEqual(state.purchases[0].discountConfigSnapshot, requestRules);
  state = run(L.purchaseAction(state, purchaseId, 'approve', officer, today));
  state = run(L.purchaseAction(state, purchaseId, 'place', pharmacist, today));
  assert.equal(state.batches.find((batch) => batch.id === source.id).qty, 50);
  state = run(L.purchaseAction(state, purchaseId, 'receive', pharmacist, today, { quantity: 400, batchNo: 'PUR-DISC-1', expiry: L.addDays(today, 30) }));
  assert.equal(state.purchases[0].actualExpense, 1700);
  assert.equal(state.purchases[0].deliveries[0].discountTotal, 300);
  state = run(L.purchaseAction(state, purchaseId, 'receive', pharmacist, today, { quantity: 600, batchNo: 'PUR-DISC-2', expiry: L.addDays(today, 60) }));
  const purchase = state.purchases[0];
  assert.equal(purchase.status, 'Received');
  assert.equal(purchase.receivedQty, 1000);
  assert.equal(purchase.discountAmount, 600);
  assert.equal(purchase.actualExpense, 4400);
  assert.equal(purchase.deliveries[1].actualExpense, 2700);
  assert.equal(state.batches.find((batch) => batch.batchNo === 'PUR-DISC-1').qty, 400);
  assert.equal(state.batches.find((batch) => batch.batchNo === 'PUR-DISC-2').qty, 600);
});

test('transfer price is batch-specific and stays unchanged after administrator edits tiers', () => {
  let state = seedData(today);
  const source = state.batches.find((batch) => batch.batchNo === 'ORS-A-2611');
  source.expiry = L.addDays(today, 30);
  const rec = L.buildRecommendations(state, today).find((item) => item.fromClinic === 'A' && item.toClinic === 'B' && item.medicineId === 'MED-ORS');
  assert.ok(rec);
  const pharmacist = user(state, 'Pharmacist', 'A'), admin = user(state, 'Administrator');
  const created = L.createTransfer(state, rec, pharmacist, today);
  assert.ok(!created.error, created.error);
  state = created.state;
  const transfer = created.transfer;
  assert.equal(transfer.pricing.discountPercent, 15);
  assert.equal(transfer.pricing.remainingDays, 30);
  assert.equal(transfer.discountTotal, transfer.qty * transfer.pricing.discountAmount);
  state = run(L.configureDiscounts(state, [{ id: 'all', minDays: 1, maxDays: null, percent: 90 }], admin));
  assert.equal(state.transfers[0].pricing.discountPercent, 15);
  assert.equal(state.transfers[0].discountedValue, transfer.discountedValue);
});

test('historical discounts persist as transaction snapshots and reporting does not mutate live stock', () => {
  const state = seedData(today);
  const liveInventory = structuredClone(state.batches);
  const before = structuredClone(state.historicalDemo);
  const report = summarizeHistoricalPurchasesAndTransfers(before);
  assert.ok(report.discountTotals.purchaseDiscount > 0);
  assert.ok(report.discountTotals.transferDiscount >= 0);
  assert.equal(report.months.reduce((sum, month) => sum + month.purchaseDiscount, 0), report.discountTotals.purchaseDiscount);
  assert.equal(report.months.reduce((sum, month) => sum + month.transferDiscount, 0), report.discountTotals.transferDiscount);
  assert.equal(report.purchaseRecords.flatMap((purchase) => purchase.deliveries).reduce((sum, delivery) => sum + delivery.quantity, 0), report.months.reduce((sum, month) => sum + month.quantityReceived, 0));
  state.discountConfig = { tiers: [{ id: 'all', minDays: 1, maxDays: null, percent: 99 }] };
  assert.deepEqual(withHistoricalDemoData(state).historicalDemo, before);
  assert.deepEqual(state.batches, liveInventory);
});

console.log(`\n${pass} expiry discount tests passed`);
