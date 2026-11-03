const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LEFT_MARGIN = 48;
const LINE_HEIGHT = 14;
const MAX_LINES_PER_PAGE = 51;

const pdfText = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/₹/g, 'INR ')
  .replace(/[–—]/g, '-')
  .replace(/→/g, '->')
  .replace(/[^\x20-\x7E]/g, '?');

const escapePdfText = (value) => pdfText(value).replace(/[\\()]/g, '\\$&');
const money = (value) => (Number(value) || 0).toFixed(2);

function wrapLine(value, maxLength = 88) {
  const words = pdfText(value).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && `${line} ${word}`.length > maxLength) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function buildDocumentLines({ invoiceNumber, period, clinicScope, generatedAt, items }) {
  const lines = [
    'MediClock',
    'HISTORICAL PURCHASE INVOICE SUMMARY',
    `Invoice: ${invoiceNumber}`,
    `Period: ${period}`,
    `Clinic scope: ${clinicScope}`,
    `Generated: ${generatedAt}`,
    'DEMO DATA ONLY - NOT A LEGAL INVOICE OR PROOF OF PAYMENT',
    'Supplier and payment records are simulated; no supplier invoices or payments are tracked.',
    '',
    'DELIVERED ITEMS',
    '',
  ];

  items.forEach((item, index) => {
    const quantity = Number(item.quantity) || 0;
    const gross = Number(item.gross) || 0;
    const discount = Number(item.discount) || 0;
    const net = Number(item.net) || 0;
    lines.push(
      `${index + 1}. ${item.medicineName} (${item.medicineId})`,
      `Supplier: ${item.supplier} | Clinic: ${item.clinic}`,
      `Delivery date: ${item.date} | Purchase ID: ${item.purchaseId}`,
      `Quantity: ${quantity} ${item.unit} | Unit price: INR ${money(item.unitPrice)}`,
      `Gross: INR ${money(gross)} | Simulated discount: INR ${money(discount)} | Net: INR ${money(net)}`,
      '',
    );
  });

  const totals = items.reduce((sum, item) => ({
    gross: sum.gross + (Number(item.gross) || 0),
    discount: sum.discount + (Number(item.discount) || 0),
    net: sum.net + (Number(item.net) || 0),
  }), { gross: 0, discount: 0, net: 0 });
  lines.push(
    'TOTALS',
    `Delivered line items: ${items.length}`,
    `Gross value: INR ${money(totals.gross)}`,
    `Simulated discounts: INR ${money(totals.discount)}`,
    `Modeled purchase expenditure: INR ${money(totals.net)}`,
    '',
    'This summary is generated from simulated historical demo records.',
  );

  return lines.flatMap((line) => wrapLine(line));
}

function buildPageContent(lines) {
  return [
    'BT',
    '/F1 9 Tf',
    ...lines.map((line, index) => `1 0 0 1 ${LEFT_MARGIN} ${PAGE_HEIGHT - 48 - index * LINE_HEIGHT} Tm (${escapePdfText(line)}) Tj`),
    'ET',
  ].join('\n');
}

export function createInvoicePdf({ invoiceNumber, period, clinicScope, generatedAt, items }) {
  if (!items.length) throw new Error('An invoice summary requires at least one delivered purchase item.');

  const documentLines = buildDocumentLines({ invoiceNumber, period, clinicScope, generatedAt, items });
  const pages = [];
  for (let index = 0; index < documentLines.length; index += MAX_LINES_PER_PAGE) {
    const pageLines = documentLines.slice(index, index + MAX_LINES_PER_PAGE);
    if (index > 0) pageLines.unshift('MediClock - Historical Purchase Invoice Summary (continued)');
    pages.push(buildPageContent(pageLines));
  }

  const pageIds = pages.map((_, index) => 4 + index * 2);
  const objects = [
    null,
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  pages.forEach((content, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let pdf = '%PDF-1.4\n%MediClock\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < offsets.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
