// Aggregates the existing historical archive; does not mutate live inventory or history.
export function summarizeHistoricalPurchasesAndTransfers(history, clinicScope = 'all') {
  const months = history?.months || [];
  const byMonth = new Map(months.map((month) => [month, {
    month, requests: 0, quantityOrdered: 0, quantityReceived: 0, actualExpense: 0,
    completedTransfers: 0, quantityTransferred: 0, statuses: {},
    purchaseDiscount: 0, transferDiscount: 0, purchaseOriginalValue: 0, purchaseDiscountedValue: 0,
    transferOriginalValue: 0, transferDiscountedValue: 0,
  }]));
  const inScope = (clinicId) => clinicScope === 'all' || clinicId === clinicScope;
  const purchases = (history?.purchases || []).filter((p) => inScope(p.clinicId));

  for (const purchase of purchases) {
    const requestMonth = (purchase.requestedAt || purchase.date || '').slice(0, 7);
    const requestSummary = byMonth.get(requestMonth);
    if (requestSummary) {
      requestSummary.requests += 1;
      requestSummary.quantityOrdered += Number(purchase.quantity ?? purchase.requestedQty) || 0;
      const status = purchase.status || 'Unknown';
      requestSummary.statuses[status] = (requestSummary.statuses[status] || 0) + 1;
    }

    const deliveries = Array.isArray(purchase.deliveries) ? purchase.deliveries : [];
    if (deliveries.length) {
      for (const delivery of deliveries) {
        const monthSummary = byMonth.get((delivery.date || '').slice(0, 7));
        if (!monthSummary) continue;
        const quantity = Number(delivery.quantity) || 0;
        const originalValue = Number(delivery.originalValue ?? (quantity * (Number(delivery.originalUnitPrice ?? purchase.unitPrice) || 0)));
        const discount = Number(delivery.discountTotal ?? (quantity * (Number(delivery.discountAmount) || 0)));
        const actualExpense = Number(delivery.actualExpense ?? (quantity * (Number(delivery.finalUnitPrice ?? purchase.unitPrice) || 0)));
        monthSummary.quantityReceived += quantity;
        monthSummary.actualExpense += actualExpense;
        monthSummary.purchaseDiscount += discount;
        monthSummary.purchaseOriginalValue += originalValue;
        monthSummary.purchaseDiscountedValue += actualExpense;
      }
    } else if (Number(purchase.receivedQty) > 0) {
      const deliveryDate = purchase.deliveryDate || purchase.completedAt || purchase.requestedAt || purchase.date;
      const monthSummary = byMonth.get((deliveryDate || '').slice(0, 7));
      if (monthSummary) {
        const quantity = Number(purchase.receivedQty) || 0;
        monthSummary.quantityReceived += quantity;
        const actualExpense = Number(purchase.actualExpense) || quantity * (Number(purchase.unitPrice) || 0);
        monthSummary.actualExpense += actualExpense;
        monthSummary.purchaseOriginalValue += quantity * (Number(purchase.unitPrice) || 0);
        monthSummary.purchaseDiscountedValue += actualExpense;
      }
    }
  }

  const transfers = [];
  const seenTransferIds = new Set();
  for (const transfer of history?.transfers || []) {
    if (transfer.status !== 'Completed' || (!inScope(transfer.fromClinic) && !inScope(transfer.toClinic))) continue;
    if (seenTransferIds.has(transfer.id)) continue;
    seenTransferIds.add(transfer.id);
    const date = transfer.receiptDate || transfer.completedAt?.slice(0, 10) || transfer.date;
    const monthSummary = byMonth.get((date || '').slice(0, 7));
    if (!monthSummary) continue;
    const quantity = Number(transfer.quantity ?? transfer.qty) || 0;
    monthSummary.completedTransfers += 1;
    monthSummary.quantityTransferred += quantity;
    monthSummary.transferDiscount += Number(transfer.discountTotal ?? 0);
    monthSummary.transferOriginalValue += Number(transfer.originalValue ?? (quantity * (Number(transfer.pricing?.originalUnitPrice ?? transfer.unitCost) || 0)));
    monthSummary.transferDiscountedValue += Number(transfer.discountedValue
      ?? (quantity * (Number(transfer.pricing?.finalUnitPrice ?? transfer.unitCost) || 0)));
    transfers.push({ ...transfer, reportDate: date, quantity });
  }

  const medicineTotals = new Map();
  for (const transfer of transfers) {
    const key = transfer.medicineId || transfer.medicineName;
    const item = medicineTotals.get(key) || {
      medicineId: transfer.medicineId, medicineName: transfer.medicineName,
      unit: transfer.unit, transfers: 0, quantitySent: 0, quantityReceived: 0,
    };
    item.transfers += 1;
    item.quantitySent += transfer.quantity;
    item.quantityReceived += transfer.quantity;
    medicineTotals.set(key, item);
  }

  const medicineDiscounts = new Map();
  const discountRow = (id, name) => {
    const key = id || name;
    if (!medicineDiscounts.has(key)) medicineDiscounts.set(key, { medicineId: id, medicineName: name, purchaseDiscount: 0, transferDiscount: 0 });
    return medicineDiscounts.get(key);
  };
  for (const purchase of purchases) for (const delivery of purchase.deliveries || []) {
    const row = discountRow(purchase.medicineId, purchase.medicineName);
    row.purchaseDiscount += Number(delivery.discountTotal) || 0;
  }
  for (const transfer of transfers) {
    const row = discountRow(transfer.medicineId, transfer.medicineName);
    row.transferDiscount += Number(transfer.discountTotal) || 0;
  }
  const totals = [...byMonth.values()].reduce((sum, row) => {
    sum.purchaseDiscount += row.purchaseDiscount; sum.transferDiscount += row.transferDiscount;
    sum.purchaseOriginalValue += row.purchaseOriginalValue; sum.purchaseDiscountedValue += row.purchaseDiscountedValue;
    sum.transferOriginalValue += row.transferOriginalValue; sum.transferDiscountedValue += row.transferDiscountedValue;
    return sum;
  }, { purchaseDiscount: 0, transferDiscount: 0, purchaseOriginalValue: 0, purchaseDiscountedValue: 0, transferOriginalValue: 0, transferDiscountedValue: 0 });
  return {
    months: months.map((month) => byMonth.get(month)),
    transfers,
    medicineTotals: [...medicineTotals.values()].sort((a, b) => a.medicineName.localeCompare(b.medicineName)),
    medicineDiscounts: [...medicineDiscounts.values()].sort((a, b) => a.medicineName.localeCompare(b.medicineName)),
    discountTotals: totals,
    purchaseRecords: purchases,
  };
}
