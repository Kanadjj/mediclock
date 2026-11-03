// Aggregates the existing historical archive; does not mutate live inventory or history.
export function summarizeHistoricalPurchasesAndTransfers(history, clinicScope = 'all') {
  const months = history?.months || [];
  const byMonth = new Map(months.map((month) => [month, {
    month, requests: 0, quantityOrdered: 0, quantityReceived: 0, actualExpense: 0,
    completedTransfers: 0, quantityTransferred: 0, statuses: {},
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
        monthSummary.quantityReceived += quantity;
        monthSummary.actualExpense += quantity * (Number(purchase.unitPrice) || 0);
      }
    } else if (Number(purchase.receivedQty) > 0) {
      const deliveryDate = purchase.deliveryDate || purchase.completedAt || purchase.requestedAt || purchase.date;
      const monthSummary = byMonth.get((deliveryDate || '').slice(0, 7));
      if (monthSummary) {
        const quantity = Number(purchase.receivedQty) || 0;
        monthSummary.quantityReceived += quantity;
        monthSummary.actualExpense += Number(purchase.actualExpense) || quantity * (Number(purchase.unitPrice) || 0);
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

  return {
    months: months.map((month) => byMonth.get(month)),
    transfers,
    medicineTotals: [...medicineTotals.values()].sort((a, b) => a.medicineName.localeCompare(b.medicineName)),
    purchaseRecords: purchases,
  };
}
