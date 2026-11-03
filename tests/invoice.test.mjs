import assert from 'node:assert/strict';
import { createInvoicePdf } from '../src/lib/invoice.js';

const pdfBytes = createInvoicePdf({
  invoiceNumber: 'MC-HIST-2026-08-B',
  period: 'August 2026',
  clinicScope: 'Clinic B - Bandra',
  generatedAt: '2026-11-04',
  items: [{
    purchaseId: 'HPO-202608-001',
    medicineId: 'MED-ORS',
    medicineName: 'ORS (Oral Rehydration Salts)',
    supplier: 'B Community Medical Supplier',
    clinic: 'Clinic B - Bandra',
    date: '2026-08-18',
    quantity: 100,
    unit: 'sachet',
    unitPrice: 4.75,
    gross: 500,
    discount: 25,
    net: 475,
  }],
});

const pdf = new TextDecoder().decode(pdfBytes);
assert.ok(pdf.startsWith('%PDF-1.4'));
assert.ok(pdf.includes('HISTORICAL PURCHASE INVOICE SUMMARY'));
assert.ok(pdf.includes('NOT A LEGAL INVOICE OR PROOF OF PAYMENT'));
assert.ok(pdf.includes('ORS \\(Oral Rehydration Salts\\)'));
assert.ok(pdf.includes('Modeled purchase expenditure: INR 475.00'));
const xrefOffset = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
assert.equal(pdf.slice(xrefOffset, xrefOffset + 4), 'xref');
assert.throws(() => createInvoicePdf({
  invoiceNumber: 'EMPTY',
  period: 'August 2026',
  clinicScope: 'All clinics',
  generatedAt: '2026-11-04',
  items: [],
}), /at least one delivered purchase item/);

console.log('  ok  purchase invoice PDF contains reconciled totals and a valid cross-reference');
