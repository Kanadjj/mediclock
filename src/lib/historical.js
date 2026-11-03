// Deterministic simulated history for the July-October 2026 demo period.
const MONTHS = [
  { month: '2026-07', days: 31, consumptionFactor: 0.62 },
  { month: '2026-08', days: 31, consumptionFactor: 0.74 },
  { month: '2026-09', days: 30, consumptionFactor: 0.88 },
  { month: '2026-10', days: 31, consumptionFactor: 0.69 },
];

const PURCHASE_PLANS = [
  { month: 0, clinicId: 'D', medicineId: 'MED-PCM', quantity: 120, receivedQty: 120, status: 'Received', unitPrice: 1.1, requestDay: 3, approvalDay: 5, placedDay: 7, deliveryDay: 16 },
  { month: 0, clinicId: 'A', medicineId: 'MED-ORS', quantity: 100, receivedQty: 0, status: 'Rejected', unitPrice: 11.5, requestDay: 12, approvalDay: 15 },
  { month: 1, clinicId: 'B', medicineId: 'MED-ORS', quantity: 160, receivedQty: 100, status: 'Partially Received', unitPrice: 5, requestDay: 2, approvalDay: 4, placedDay: 6, deliveryDay: 18 },
  { month: 1, clinicId: 'C', medicineId: 'MED-ZN', quantity: 120, receivedQty: 0, status: 'Approved', unitPrice: 2.8, requestDay: 10, approvalDay: 12 },
  { month: 2, clinicId: 'E', medicineId: 'MED-FE', quantity: 300, receivedQty: 0, status: 'Order Placed', unitPrice: 1.9, requestDay: 4, approvalDay: 6, placedDay: 8 },
  { month: 2, clinicId: 'A', medicineId: 'MED-AMX', quantity: 90, receivedQty: 90, status: 'Received', unitPrice: 6.4, requestDay: 14, approvalDay: 16, placedDay: 18, deliveryDay: 24 },
  { month: 3, clinicId: 'B', medicineId: 'MED-FE', quantity: 200, receivedQty: 0, status: 'Pending Approval', unitPrice: 2, requestDay: 8 },
  { month: 3, clinicId: 'D', medicineId: 'MED-AMX', quantity: 160, receivedQty: 60, status: 'Partially Received', unitPrice: 6.2, requestDay: 2, approvalDay: 4, placedDay: 6, deliveryDay: 20 },
];

const WASTE_PLANS = [
  ['D', 'MED-PCM'], ['E', 'MED-FE'], ['B', 'MED-ZN'], ['C', 'MED-ORS'],
];
const TRANSFER_PLANS = [
  [{ fromClinic: 'A', toClinic: 'B', medicineId: 'MED-ORS', batchNo: 'ORS-A-2611', quantity: 16 }],
  [
    { fromClinic: 'A', toClinic: 'B', medicineId: 'MED-ORS', batchNo: 'ORS-A-2611', quantity: 22 },
    { fromClinic: 'B', toClinic: 'E', medicineId: 'MED-FE', batchNo: 'FE-B-2604', quantity: 18 },
  ],
  [{ fromClinic: 'A', toClinic: 'B', medicineId: 'MED-ORS', batchNo: 'ORS-A-2611', quantity: 14 }],
  [
    { fromClinic: 'A', toClinic: 'B', medicineId: 'MED-ORS', batchNo: 'ORS-A-2611', quantity: 20 },
    { fromClinic: 'B', toClinic: 'E', medicineId: 'MED-FE', batchNo: 'FE-B-2604', quantity: 25 },
  ],
];
const ADDITION_PLANS = [
  [['C', 'MED-ORS'], ['A', 'MED-FE'], ['D', 'MED-ZN']],
  [['E', 'MED-PCM'], ['C', 'MED-AMX'], ['A', 'MED-ZN']],
  [['B', 'MED-FE'], ['D', 'MED-ORS'], ['E', 'MED-AMX']],
  [['A', 'MED-PCM'], ['C', 'MED-FE'], ['E', 'MED-ZN']],
];
const ADJUSTMENT_PLANS = [
  [['A', 'MED-ORS', -7], ['D', 'MED-FE', 5], ['E', 'MED-ZN', -3]],
  [['B', 'MED-PCM', -9], ['C', 'MED-ZN', 6], ['A', 'MED-AMX', -4]],
  [['E', 'MED-ORS', -5], ['D', 'MED-PCM', 8], ['B', 'MED-AMX', -6]],
  [['C', 'MED-FE', -8], ['A', 'MED-ZN', 4], ['E', 'MED-PCM', -5]],
];
const priceFor = (medicineId) => ({
  'MED-ORS': 5, 'MED-PCM': 1, 'MED-FE': 2, 'MED-AMX': 6, 'MED-ZN': 3,
}[medicineId] || 1);
const makeId = (prefix, monthIndex, index) => `${prefix}-${MONTHS[monthIndex].month.replace('-', '')}-${String(index + 1).padStart(3, '0')}`;

export function createHistoricalDemoData(state) {
  const grouped = new Map();
  for (const batch of state.batches || []) {
    const key = `${batch.clinicId}:${batch.medicineId}`;
    if (!grouped.has(key)) grouped.set(key, { clinicId: batch.clinicId, medicineId: batch.medicineId, medicineName: batch.name, unit: batch.unit, minStock: 0, daily: 0, closingStock: 0 });
    const group = grouped.get(key);
    group.minStock = Math.max(group.minStock, Number(batch.minStock) || 0);
    group.daily += Number(batch.daily) || 0;
    group.closingStock += Number(batch.qty) || 0;
  }
  const transactions = [];
  const consumption = [];
  const wastage = [];
  const stockAdditions = [];
  const stockAdjustments = [];
  const transfers = [];
  const purchases = [];
  const monthlyStock = [];
  const notifications = [];
  const activity = [];
  const groupList = [...grouped.values()];
  const groupFor = (clinicId, medicineId) => grouped.get(`${clinicId}:${medicineId}`);
  const addTransaction = (transaction) => {
    transactions.push({ simulated: true, ...transaction });
  };

  MONTHS.forEach((period, monthIndex) => {
    const [year, monthNum] = period.month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
    groupList.forEach((group, groupIndex) => {
      if (group.daily <= 0) return;
      const quantity = Math.max(1, Math.round(group.daily * daysInMonth * period.consumptionFactor));
      const day = 10 + ((groupIndex * 7 + monthIndex * 3) % 15);
      const record = {
        id: makeId('HC', monthIndex, groupIndex), type: 'consumption', date: `${period.month}-${String(day).padStart(2, '0')}`,
        clinicId: group.clinicId, medicineId: group.medicineId, medicineName: group.medicineName, quantity, unit: group.unit,
        note: 'Simulated routine medicine use.',
      };
      consumption.push(record);
      addTransaction(record);
    });

    WASTE_PLANS.forEach(([clinicId, medicineId], wasteIndex) => {
      const group = groupFor(clinicId, medicineId);
      if (!group) return;
      const day = 26 + (wasteIndex % 4);
      const date = `${period.month}-${String(Math.min(day, daysInMonth)).padStart(2, '0')}`;
      const quantity = 3 + ((monthIndex * 5 + wasteIndex * 3) % 12);
      const record = {
        id: makeId('HW', monthIndex, wasteIndex), type: 'wastage', date, wastageDate: date,
        clinicId, medicineId, medicineName: group.medicineName, quantity, unit: group.unit,
        batchId: `HIST-${clinicId}-${medicineId.slice(-3)}-${period.month.replace('-', '')}`,
        batchNo: `DEMO-${clinicId}-${period.month.replace('-', '')}-${wasteIndex + 1}`,
        batchExpiry: date, reason: 'Simulated expiry / damaged-stock write-off; historical lot.',
      };
      wastage.push(record);
      addTransaction(record);
    });

    ADDITION_PLANS[monthIndex].forEach(([clinicId, medicineId], additionIndex) => {
      const group = groupFor(clinicId, medicineId);
      if (!group) return;
      const quantity = Math.max(10, Math.round(group.daily * daysInMonth * (0.12 + additionIndex * 0.025)));
      const date = `${period.month}-04`;
      const record = {
        id: makeId('HAI', monthIndex, additionIndex), type: 'stock_addition', date, clinicId, medicineId,
        medicineName: group.medicineName, quantity, unit: group.unit, reason: 'Simulated routine replenishment.',
      };
      stockAdditions.push(record);
      addTransaction(record);
    });

    ADJUSTMENT_PLANS[monthIndex].forEach(([clinicId, medicineId, quantity], adjustmentIndex) => {
      const group = groupFor(clinicId, medicineId);
      if (!group) return;
      const date = `${period.month}-07`;
      const record = {
        id: makeId('HADJ', monthIndex, adjustmentIndex), type: 'stock_adjustment', date, clinicId, medicineId,
        medicineName: group.medicineName, quantity, unit: group.unit,
        reason: quantity < 0 ? 'Simulated cycle-count variance.' : 'Simulated recovered count variance.',
      };
      stockAdjustments.push(record);
      addTransaction(record);
    });

    const transferDate = `${period.month}-08`;
    TRANSFER_PLANS[monthIndex].forEach((plan, transferIndex) => {
      const source = state.batches.find((batch) => batch.batchNo === plan.batchNo && batch.clinicId === plan.fromClinic && batch.medicineId === plan.medicineId);
      const sender = groupFor(plan.fromClinic, plan.medicineId), receiver = groupFor(plan.toClinic, plan.medicineId);
      if (!source || !sender || !receiver || source.expiry < `${period.month}-11`) return;
      const transfer = {
        id: makeId('HT', monthIndex, transferIndex), date: transferDate, requestDate: transferDate,
        fromClinic: plan.fromClinic, toClinic: plan.toClinic, medicineId: plan.medicineId, medicineName: sender.medicineName,
        batchId: source.id, batchNo: source.batchNo, quantity: plan.quantity, qty: plan.quantity,
        unit: sender.unit, status: 'Completed',
        approvalDate: `${period.month}-09`, dispatchDate: `${period.month}-10`, receiptDate: `${period.month}-11`,
        completedAt: `${period.month}-11T12:00:00.000Z`, simulated: true,
      };
      transfers.push(transfer);
      const transferIn = { ...transfer, id: `${transfer.id}-IN`, type: 'transfer_in', date: transfer.receiptDate, clinicId: transfer.toClinic };
      const transferOut = { ...transfer, id: `${transfer.id}-OUT`, type: 'transfer_out', date: transfer.dispatchDate, clinicId: transfer.fromClinic };
      addTransaction(transferOut);
      addTransaction(transferIn);
    });

    PURCHASE_PLANS.filter((plan) => plan.month === monthIndex).forEach((plan, planIndex) => {
      const group = groupFor(plan.clinicId, plan.medicineId);
      if (!group) return;
      const id = makeId('HPO', monthIndex, planIndex);
      const requestedAt = `${period.month}-${String(plan.requestDay).padStart(2, '0')}`;
      const receiptDate = plan.deliveryDay ? `${period.month}-${String(plan.deliveryDay).padStart(2, '0')}` : null;
      const approvedAt = plan.approvalDay ? `${period.month}-${String(plan.approvalDay).padStart(2, '0')}` : null;
      const placedAt = plan.placedDay ? `${period.month}-${String(plan.placedDay).padStart(2, '0')}` : null;
      const statusHistory = [{ status: 'Pending Approval', date: requestedAt, by: 'MediClock (simulated)' }];
      if (approvedAt) statusHistory.push({ status: plan.status === 'Rejected' ? 'Rejected' : 'Approved', date: approvedAt, by: 'Demo reviewer' });
      if (placedAt) statusHistory.push({ status: 'Order Placed', date: placedAt, by: 'Demo pharmacist' });
      if (receiptDate) statusHistory.push({ status: plan.status, date: receiptDate, by: 'Demo pharmacist', receivedQty: plan.receivedQty });
      const purchase = {
        id, date: requestedAt, requestedAt, clinicId: plan.clinicId, medicineId: plan.medicineId,
        medicineName: group.medicineName, unit: group.unit, quantity: plan.quantity, requestedQty: plan.quantity,
        receivedQty: plan.receivedQty, unitPrice: plan.unitPrice, estimatedCost: plan.quantity * plan.unitPrice,
        actualExpense: plan.receivedQty * plan.unitPrice, supplier: `${plan.clinicId} Community Medical Supplier`,
        supplierContact: 'Demo contact only', status: plan.status, simulated: true,
        approvedAt, placedAt, completedAt: plan.receivedQty === plan.quantity ? receiptDate : null,
        rejectedAt: plan.status === 'Rejected' ? approvedAt : null, statusHistory,
        deliveries: receiptDate ? [{ date: receiptDate, quantity: plan.receivedQty, confirmedAt: `${receiptDate}T12:00:00.000Z`, batchNo: `HDEL-${id}` }] : [],
        rejectionReason: plan.status === 'Rejected' ? 'Simulated supplier availability issue.' : '',
      };
      purchases.push(purchase);
      addTransaction({ id: `${id}-REQUEST`, type: 'purchase_request', date: requestedAt, purchaseId: id, clinicId: plan.clinicId, medicineId: plan.medicineId, medicineName: group.medicineName, quantity: plan.quantity, status: plan.status, simulated: true });
      if (receiptDate && plan.receivedQty > 0) {
        const receipt = {
          id: `${id}-DELIVERY`, type: 'purchase_delivery', date: receiptDate, purchaseId: id,
          clinicId: plan.clinicId, medicineId: plan.medicineId, medicineName: group.medicineName,
          quantity: plan.receivedQty, unit: group.unit, unitPrice: plan.unitPrice,
          actualExpense: plan.receivedQty * plan.unitPrice, batchNo: `HDEL-${id}`, simulated: true,
        };
        addTransaction(receipt);
      }
    });
  });

  const movementTypes = new Set(['consumption', 'wastage', 'stock_addition', 'stock_adjustment', 'transfer_in', 'transfer_out', 'purchase_delivery']);
  const signedMovement = (transaction) => {
    if (transaction.type === 'stock_adjustment') return transaction.quantity;
    if (transaction.type === 'consumption' || transaction.type === 'wastage' || transaction.type === 'transfer_out') return -transaction.quantity;
    if (['stock_addition', 'transfer_in', 'purchase_delivery'].includes(transaction.type)) return transaction.quantity;
    return 0;
  };

  for (const group of groupList) {
    const key = `${group.clinicId}:${group.medicineId}`;
    const closingByMonth = new Array(MONTHS.length);
    const openingByMonth = new Array(MONTHS.length);
    const monthNet = MONTHS.map((period) => transactions.filter((t) => t.date.startsWith(period.month) && t.clinicId === group.clinicId && t.medicineId === group.medicineId && movementTypes.has(t.type))
      .reduce((sum, t) => sum + signedMovement(t), 0));
    let closing = group.closingStock;
    for (let monthIndex = MONTHS.length - 1; monthIndex >= 0; monthIndex--) {
      closingByMonth[monthIndex] = closing;
      openingByMonth[monthIndex] = closing - monthNet[monthIndex];
      closing = openingByMonth[monthIndex];
    }
    if (openingByMonth[0] < 0) {
      const correction = -openingByMonth[0];
      const date = '2026-10-29';
      const adjustment = {
        id: `HADJ-202610-RECON-${group.clinicId}-${group.medicineId}`, type: 'stock_adjustment', date,
        clinicId: group.clinicId, medicineId: group.medicineId, medicineName: group.medicineName,
        quantity: -correction, unit: group.unit, reason: 'Simulated opening count reconciliation to preserve a non-negative ledger.',
      };
      stockAdjustments.push(adjustment);
      addTransaction(adjustment);
      for (let monthIndex = 0; monthIndex < MONTHS.length; monthIndex++) monthNet[monthIndex] += monthIndex === 3 ? -correction : 0;
      closing = group.closingStock;
      for (let monthIndex = MONTHS.length - 1; monthIndex >= 0; monthIndex--) {
        closingByMonth[monthIndex] = closing;
        openingByMonth[monthIndex] = closing - monthNet[monthIndex];
        closing = openingByMonth[monthIndex];
      }
    }
    for (let monthIndex = 0; monthIndex < MONTHS.length; monthIndex++) {
      const openingStock = openingByMonth[monthIndex];
      const closingStock = closingByMonth[monthIndex];
      const requiredStock = Math.max(group.minStock, Math.ceil(group.daily * 14));
      const row = {
        id: `HSL-${MONTHS[monthIndex].month}-${group.clinicId}-${group.medicineId}`,
        month: MONTHS[monthIndex].month, clinicId: group.clinicId, medicineId: group.medicineId,
        medicineName: group.medicineName, unit: group.unit, openingStock, closingStock,
        consumed: consumption.filter((r) => r.clinicId === group.clinicId && r.medicineId === group.medicineId && r.date.startsWith(MONTHS[monthIndex].month)).reduce((sum, r) => sum + r.quantity, 0),
        wasted: wastage.filter((r) => r.clinicId === group.clinicId && r.medicineId === group.medicineId && r.date.startsWith(MONTHS[monthIndex].month)).reduce((sum, r) => sum + r.quantity, 0),
        requiredStock,
      };
      const movementSum = transactions.filter((t) => t.date.startsWith(MONTHS[monthIndex].month) && t.clinicId === group.clinicId && t.medicineId === group.medicineId && movementTypes.has(t.type))
        .reduce((sum, t) => sum + signedMovement(t), 0);
      row.netMovement = movementSum;
      monthlyStock.push(row);
      if (closingStock < requiredStock) {
        const record = {
          id: `HSH-${row.month}-${group.clinicId}-${group.medicineId}`, type: 'shortage_detected',
          date: `${row.month}-${String(MONTHS[monthIndex].days).padStart(2, '0')}`, clinicId: group.clinicId,
          medicineId: group.medicineId, medicineName: group.medicineName, quantity: requiredStock - closingStock,
          unit: group.unit, stock: closingStock, requiredStock, simulated: true,
        };
        addTransaction(record);
      } else if (closingStock > requiredStock) {
        const record = {
          id: `HSU-${row.month}-${group.clinicId}-${group.medicineId}`, type: 'surplus_detected',
          date: `${row.month}-${String(MONTHS[monthIndex].days).padStart(2, '0')}`, clinicId: group.clinicId,
          medicineId: group.medicineId, medicineName: group.medicineName, quantity: closingStock - requiredStock,
          unit: group.unit, stock: closingStock, requiredStock, simulated: true,
        };
        addTransaction(record);
      }
    }
    if (monthlyStock.filter((row) => row.clinicId === group.clinicId && row.medicineId === group.medicineId).at(-1).closingStock !== group.closingStock) {
      throw new Error(`Historical closing stock does not reconcile for ${key}.`);
    }
  }

  for (const purchase of purchases) {
    const date = purchase.deliveries[0]?.date || purchase.placedAt || purchase.approvedAt || purchase.requestedAt;
    notifications.push({ id: `HN-${purchase.id}`, date, clinicId: purchase.clinicId, purchaseId: purchase.id, type: 'purchase', status: purchase.status, text: `${purchase.id}: simulated historical request status ${purchase.status}.` });
  }
  activity.push(...transactions.filter((t) => movementTypes.has(t.type) || t.type === 'purchase_request')
    .map((t) => ({ id: `HA-${t.id}`, date: t.date, clinicId: t.clinicId, type: t.type, text: `${t.type.replaceAll('_', ' ')}: ${t.quantity ?? 0} ${t.unit || ''} ${t.medicineName || t.medicineId || ''} (simulated).`.trim() })));
  transactions.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  monthlyStock.sort((a, b) => a.month.localeCompare(b.month) || a.clinicId.localeCompare(b.clinicId) || a.medicineId.localeCompare(b.medicineId));
  const monthlyCounts = Object.fromEntries(MONTHS.map((period) => [period.month, transactions.filter((t) => t.date.startsWith(period.month)).length]));

  return {
    label: 'Simulated historical demo data; not actual clinic records.',
    range: { from: '2026-07-01', to: '2026-10-31' },
    months: MONTHS.map(({ month }) => month),
    transactions, consumption, wastage, stockAdditions, stockAdjustments, transfers, purchases,
    monthlyStock, notifications, activity, monthlyCounts,
  };
}

export function withHistoricalDemoData(state) {
  if (state.historicalDemo && Array.isArray(state.historicalDemo.transactions)) return state;
  return { ...state, historicalDemo: createHistoricalDemoData(state) };
}
