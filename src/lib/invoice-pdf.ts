import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import { formatDateAU } from "@/lib/dates";
import { invoiceDueDate, invoiceSubtotals } from "@/lib/invoice-documents";
import type { InvoiceBusinessDetails, InvoiceClientDetails, InvoiceDocumentData } from "@/lib/invoice-documents";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";

const INK = "#17211c";
const MOSS = "#54745b";
const MINT = "#0f9f8f";
const PAPER = "#f7f4ee";
const LINE = "#ded7ca";
const WHITE = "#ffffff";

type DrawState = {
  doc: PDFKit.PDFDocument;
  y: number;
  margin: number;
  contentWidth: number;
};

type InvoicePdfInput = {
  invoice: InvoiceDocumentData;
  business: InvoiceBusinessDetails;
  client: InvoiceClientDetails;
  logo?: Buffer | null;
};

type TableRow = {
  description: string;
  detail: string;
  mutedDetail?: string | null;
  amount: string;
};

export function renderInvoicePdf({ invoice, business, client, logo }: InvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 42,
      info: {
        Title: `${invoice.invoiceNumber} - ${business.name}`,
        Author: business.name,
        Subject: `Invoice ${invoice.invoiceNumber}`
      }
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawInvoice(doc, invoice, business, client, logo);
    doc.end();
  });
}

function drawInvoice(
  doc: PDFKit.PDFDocument,
  invoice: InvoiceDocumentData,
  business: InvoiceBusinessDetails,
  client: InvoiceClientDetails,
  logo?: Buffer | null
) {
  const state: DrawState = {
    doc,
    y: doc.page.margins.top,
    margin: doc.page.margins.left,
    contentWidth: doc.page.width - doc.page.margins.left - doc.page.margins.right
  };
  const dueDate = invoiceDueDate(invoice);
  const { labourSubtotalCents, expensesSubtotalCents, subtotalCents } = invoiceSubtotals(invoice);
  const invoiceTitle = business.gstRegistered ? "Tax Invoice" : "Invoice";

  drawHeader(state, invoice, business, invoiceTitle, logo);
  state.y += 26;
  drawAddressBlocks(state, business, client);
  state.y += 20;
  drawMetaGrid(state, [
    ["Issue date", formatDateAU(invoice.invoiceDate)],
    ["Due date", formatDateAU(dueDate)],
    ["Project", invoice.project.title],
    ["Work period", `${formatDateAU(invoice.dateRangeStart)} - ${formatDateAU(invoice.dateRangeEnd)}`],
    ["Terms", `${invoice.paymentTermsDays} days`],
    ["Reference", invoice.invoiceNumber]
  ]);
  state.y += 24;
  drawLineItems(state, invoice, labourSubtotalCents);
  state.y += 22;
  drawTotals(state, invoice, business, labourSubtotalCents, expensesSubtotalCents, subtotalCents);
  state.y += 22;
  drawFooter(state, invoice, business, dueDate);
}

function drawHeader(
  state: DrawState,
  invoice: InvoiceDocumentData,
  business: InvoiceBusinessDetails,
  invoiceTitle: string,
  logo?: Buffer | null
) {
  const { doc, margin, contentWidth } = state;
  const rightWidth = 190;
  const leftWidth = contentWidth - rightWidth - 24;
  const top = state.y;
  const badgeSize = 50;

  doc.roundedRect(margin, top, badgeSize, badgeSize, 8).fillAndStroke(PAPER, LINE);
  if (logo) {
    try {
      doc.image(logo, margin + 6, top + 6, { fit: [badgeSize - 12, badgeSize - 12], align: "center", valign: "center" });
    } catch {
      drawInitialBadge(doc, business.name, margin, top, badgeSize);
    }
  } else {
    drawInitialBadge(doc, business.name, margin, top, badgeSize);
  }

  doc.fillColor(MINT).font("Helvetica-Bold").fontSize(8).text(invoiceTitle.toUpperCase(), margin + badgeSize + 14, top + 2, {
    width: leftWidth - badgeSize - 14,
    characterSpacing: 1.1
  });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(21).text(business.name, margin + badgeSize + 14, top + 17, {
    width: leftWidth - badgeSize - 14,
    lineGap: 2
  });
  const details: string[] = [];
  if (business.legalName) details.push(business.legalName);
  if (business.abn) details.push(`ABN ${business.abn}`);
  if (details.length) {
    doc.fillColor(MOSS).font("Helvetica-Bold").fontSize(9).text(details.join("  |  "), margin + badgeSize + 14, top + 44, {
      width: leftWidth - badgeSize - 14
    });
  }

  const rightX = margin + contentWidth - rightWidth;
  doc.fillColor(MOSS).font("Helvetica-Bold").fontSize(8).text("INVOICE NUMBER", rightX, top + 2, { width: rightWidth, align: "right" });
  const invoiceNumberFontSize = fittedFontSize(doc, invoice.invoiceNumber, rightWidth, 22, 13);
  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(invoiceNumberFontSize)
    .text(invoice.invoiceNumber, rightX, top + 18, { width: rightWidth, align: "right", lineBreak: false });
  doc.fillColor(MOSS).font("Helvetica-Bold").fontSize(9).text(`Issued ${formatDateAU(invoice.invoiceDate)}`, rightX, top + 48, {
    width: rightWidth,
    align: "right"
  });

  state.y = top + 70;
  doc.moveTo(margin, state.y).lineTo(margin + contentWidth, state.y).lineWidth(2).strokeColor(INK).stroke();
}

function drawInitialBadge(doc: PDFKit.PDFDocument, businessName: string, x: number, y: number, size: number) {
  doc.fillColor(MOSS).font("Helvetica-Bold").fontSize(22).text(businessName.slice(0, 1).toUpperCase(), x, y + 14, {
    width: size,
    align: "center"
  });
}

function fittedFontSize(doc: PDFKit.PDFDocument, text: string, width: number, maxSize: number, minSize: number) {
  for (let size = maxSize; size >= minSize; size -= 1) {
    doc.font("Helvetica-Bold").fontSize(size);
    if (doc.widthOfString(text) <= width) return size;
  }

  return minSize;
}

function drawAddressBlocks(state: DrawState, business: InvoiceBusinessDetails, client: InvoiceClientDetails) {
  const gap = 16;
  const width = (state.contentWidth - gap) / 2;
  const top = state.y;
  const fromLines = compact([
    business.name,
    business.contactName,
    business.address,
    business.email,
    business.phone,
    business.website
  ]);
  const toLines = compact([
    client.businessName,
    client.contactName,
    client.abn ? `ABN ${client.abn}` : "",
    client.address,
    client.email,
    client.phone
  ]);
  const leftHeight = infoBlockHeight(state.doc, width, fromLines);
  const rightHeight = infoBlockHeight(state.doc, width, toLines);
  const height = Math.max(leftHeight, rightHeight);

  drawInfoBlock(state, state.margin, top, width, height, "From", fromLines);
  drawInfoBlock(state, state.margin + width + gap, top, width, height, "Bill To", toLines);
  state.y = top + height;
}

function infoBlockHeight(doc: PDFKit.PDFDocument, width: number, lines: string[]) {
  const textHeight = lines.reduce((sum, line) => {
    doc.font(line === lines[0] ? "Helvetica-Bold" : "Helvetica").fontSize(9.5);
    return sum + doc.heightOfString(line, { width: width - 24 }) + 3;
  }, 0);
  return Math.max(94, 38 + textHeight);
}

function drawInfoBlock(state: DrawState, x: number, y: number, width: number, height: number, title: string, lines: string[]) {
  const { doc } = state;
  doc.roundedRect(x, y, width, height, 8).fillAndStroke(PAPER, LINE);
  doc.fillColor(MOSS).font("Helvetica-Bold").fontSize(8).text(title.toUpperCase(), x + 12, y + 12, {
    width: width - 24,
    characterSpacing: 1
  });
  let textY = y + 32;
  lines.forEach((line, index) => {
    doc.fillColor(index === 0 ? INK : MOSS).font(index === 0 ? "Helvetica-Bold" : "Helvetica-Bold").fontSize(9.5);
    doc.text(line, x + 12, textY, { width: width - 24, lineGap: 1 });
    textY += doc.heightOfString(line, { width: width - 24 }) + 3;
  });
}

function drawMetaGrid(state: DrawState, cells: [string, string][]) {
  const { doc, margin, contentWidth } = state;
  const columns = 3;
  const rows = 2;
  const gap = 8;
  const cellWidth = (contentWidth - gap * (columns - 1)) / columns;
  const cellHeight = 52;
  const top = state.y;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      const [label, value] = cells[index];
      const x = margin + column * (cellWidth + gap);
      const y = top + row * (cellHeight + gap);
      doc.roundedRect(x, y, cellWidth, cellHeight, 7).fillAndStroke(WHITE, LINE);
      doc.fillColor(MOSS).font("Helvetica-Bold").fontSize(7.5).text(label.toUpperCase(), x + 10, y + 10, {
        width: cellWidth - 20,
        characterSpacing: 0.8
      });
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(value, x + 10, y + 27, {
        width: cellWidth - 20,
        lineGap: 1
      });
    }
  }

  state.y = top + rows * cellHeight + gap;
}

function drawLineItems(state: DrawState, invoice: InvoiceDocumentData, labourSubtotalCents: number) {
  const { doc, margin, contentWidth } = state;
  const labourLines = invoice.lineItems.filter((line) => line.type === "LABOUR");
  const expenseLines = invoice.lineItems.filter((line) => line.type === "EXPENSE");
  const rows: TableRow[] = [];
  const simpleLabourGroups = labourLines.reduce((groups, line) => {
    const worker = line.workerNameSnapshot || "Owner";
    const current = groups.get(worker) || { minutes: 0, totalCents: 0 };
    current.minutes += line.hoursMinutes || 0;
    current.totalCents += line.totalAmountCents;
    groups.set(worker, current);
    return groups;
  }, new Map<string, { minutes: number; totalCents: number }>());

  if (invoice.mode === "SIMPLE" && labourSubtotalCents > 0) {
    rows.push(...[...simpleLabourGroups.entries()].map(([worker, summary]) => ({
      description: `${worker} - labour`,
      detail: `${formatHours(summary.minutes)}h for ${invoice.project.title}`,
      amount: formatMoney(summary.totalCents)
    })));
  }

  if (invoice.mode === "DETAILED") {
    rows.push(
      ...labourLines.map((line) => ({
        description: line.description,
        detail: `${line.date ? formatDateAU(line.date) : "No date"} - ${formatHours(line.hoursMinutes ?? 0)}h at ${formatMoney(line.unitAmountCents)}/h`,
        mutedDetail: line.notes,
        amount: formatMoney(line.totalAmountCents)
      }))
    );
  }

  const expenseRows = expenseLines.map((line) => ({
    description: line.description,
    detail: `${line.date ? formatDateAU(line.date) : "No date"} - Qty ${Number(line.quantity ?? 0)} at ${formatMoney(line.unitAmountCents)}`,
    mutedDetail: line.notes,
    amount: formatMoney(line.totalAmountCents)
  }));

  state.y = ensureSpace(state, 120);
  doc.fillColor(MOSS).font("Helvetica-Bold").fontSize(8).text("LINE ITEMS", margin, state.y, { characterSpacing: 1.2 });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(15).text(invoice.mode === "SIMPLE" ? "Invoice summary" : "Detailed work summary", margin, state.y + 14);
  state.y += 42;

  drawTableHeader(state);
  rows.forEach((row) => drawTableRow(state, row));

  if (expenseRows.length) {
    state.y = ensureSpace(state, 32);
    doc.rect(margin, state.y, contentWidth, 24).fill(PAPER);
    doc.fillColor(MOSS).font("Helvetica-Bold").fontSize(8).text("EXPENSES AND MATERIALS", margin + 10, state.y + 8, {
      width: contentWidth - 20,
      characterSpacing: 1
    });
    state.y += 24;
    expenseRows.forEach((row) => drawTableRow(state, row));
  }
}

function drawTableHeader(state: DrawState) {
  const { doc, margin, contentWidth } = state;
  state.y = ensureSpace(state, 28);
  doc.roundedRect(margin, state.y, contentWidth, 26, 6).fill(INK);
  const widths = tableWidths(contentWidth);
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(8);
  doc.text("Description", margin + 10, state.y + 9, { width: widths.description });
  doc.text("Details", margin + 10 + widths.description, state.y + 9, { width: widths.detail });
  doc.text("Amount", margin + 10 + widths.description + widths.detail, state.y + 9, { width: widths.amount - 20, align: "right" });
  state.y += 26;
}

function drawTableRow(state: DrawState, row: TableRow) {
  const { doc, margin, contentWidth } = state;
  const widths = tableWidths(contentWidth);
  const descWidth = widths.description - 12;
  const detailWidth = widths.detail - 12;
  const amountWidth = widths.amount - 20;

  doc.font("Helvetica-Bold").fontSize(9.5);
  const descHeight = doc.heightOfString(row.description, { width: descWidth });
  doc.font("Helvetica-Bold").fontSize(8.5);
  const mutedHeight = row.mutedDetail ? doc.heightOfString(row.mutedDetail, { width: descWidth }) + 4 : 0;
  const detailHeight = doc.heightOfString(row.detail, { width: detailWidth });
  const rowHeight = Math.max(38, descHeight + mutedHeight + 18, detailHeight + 18);
  state.y = ensureSpace(state, rowHeight + 4);

  doc.rect(margin, state.y, contentWidth, rowHeight).fill(WHITE);
  doc.moveTo(margin, state.y).lineTo(margin + contentWidth, state.y).strokeColor(LINE).lineWidth(1).stroke();
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(row.description, margin + 10, state.y + 10, {
    width: descWidth,
    lineGap: 1
  });
  if (row.mutedDetail) {
    doc.fillColor(MOSS).font("Helvetica-Bold").fontSize(8.5).text(row.mutedDetail, margin + 10, state.y + 10 + descHeight + 4, {
      width: descWidth,
      lineGap: 1
    });
  }
  doc.fillColor(MOSS).font("Helvetica-Bold").fontSize(8.8).text(row.detail, margin + 10 + widths.description, state.y + 10, {
    width: detailWidth,
    lineGap: 1
  });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(row.amount, margin + 10 + widths.description + widths.detail, state.y + 10, {
    width: amountWidth,
    align: "right"
  });
  state.y += rowHeight;
}

function tableWidths(contentWidth: number) {
  return {
    description: contentWidth * 0.44,
    detail: contentWidth * 0.36,
    amount: contentWidth * 0.2
  };
}

function drawTotals(
  state: DrawState,
  invoice: InvoiceDocumentData,
  business: InvoiceBusinessDetails,
  labourSubtotalCents: number,
  expensesSubtotalCents: number,
  subtotalCents: number
) {
  const { doc, margin, contentWidth } = state;
  const gap = 18;
  const noteWidth = contentWidth - 190 - gap;
  const totalsWidth = 190;
  const minHeight = 126;
  state.y = ensureSpace(state, minHeight);
  const top = state.y;

  doc.roundedRect(margin, top, noteWidth, minHeight, 8).fillAndStroke(WHITE, LINE);
  doc.fillColor(MOSS).font("Helvetica-Bold").fontSize(8).text("NOTES", margin + 12, top + 12, { characterSpacing: 1.2 });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(
    business.defaultInvoiceNotes || "Thank you for your business. Please use the invoice number as the payment reference.",
    margin + 12,
    top + 32,
    { width: noteWidth - 24, lineGap: 2 }
  );
  if (business.signatureFooter) {
    doc.fillColor(MOSS).font("Helvetica-Bold").fontSize(9).text(business.signatureFooter, margin + 12, top + 86, {
      width: noteWidth - 24,
      lineGap: 1
    });
  }

  const totalsX = margin + noteWidth + gap;
  doc.roundedRect(totalsX, top, totalsWidth, minHeight, 8).fillAndStroke(PAPER, INK);
  let y = top + 14;
  y = totalLine(doc, totalsX + 12, y, totalsWidth - 24, "Labour subtotal", formatMoney(labourSubtotalCents));
  y = totalLine(doc, totalsX + 12, y, totalsWidth - 24, "Expenses subtotal", formatMoney(expensesSubtotalCents));
  y = totalLine(doc, totalsX + 12, y, totalsWidth - 24, "Subtotal", formatMoney(subtotalCents));
  if (business.gstRegistered) y = totalLine(doc, totalsX + 12, y, totalsWidth - 24, `GST (${business.gstRate}%)`, formatMoney(invoice.gstCents));
  doc.moveTo(totalsX + 12, y + 4).lineTo(totalsX + totalsWidth - 12, y + 4).strokeColor(LINE).stroke();
  totalLine(doc, totalsX + 12, y + 13, totalsWidth - 24, "Total amount due", formatMoney(invoice.grandTotalCents), true);

  state.y = top + minHeight;
}

function totalLine(doc: PDFKit.PDFDocument, x: number, y: number, width: number, label: string, value: string, strong = false) {
  doc.fillColor(strong ? INK : MOSS).font("Helvetica-Bold").fontSize(strong ? 10 : 8.8).text(label, x, y, { width: width * 0.54 });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(strong ? 14 : 9).text(value, x + width * 0.44, y, {
    width: width * 0.56,
    align: "right"
  });
  return y + (strong ? 24 : 18);
}

function drawFooter(state: DrawState, invoice: InvoiceDocumentData, business: InvoiceBusinessDetails, dueDate: Date) {
  const { doc, margin, contentWidth } = state;
  state.y = ensureSpace(state, 94);
  const top = state.y;
  const gap = 18;
  const columnWidth = (contentWidth - gap) / 2;

  doc.moveTo(margin, top).lineTo(margin + contentWidth, top).strokeColor(INK).lineWidth(2).stroke();
  doc.fillColor(MOSS).font("Helvetica-Bold").fontSize(8).text("PAYMENT DETAILS", margin, top + 18, { characterSpacing: 1.2 });
  const paymentLines = compact([
    business.bankAccountName ? `Account name: ${business.bankAccountName}` : "",
    business.bsb ? `BSB: ${business.bsb}` : "",
    business.accountNumber ? `Account: ${business.accountNumber}` : "",
    `Payment reference: ${invoice.invoiceNumber}`
  ]);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(paymentLines.join("\n"), margin, top + 38, {
    width: columnWidth,
    lineGap: 3
  });

  doc.roundedRect(margin + columnWidth + gap, top + 18, columnWidth, 68, 8).fillAndStroke(PAPER, LINE);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(`Payment is due by ${formatDateAU(dueDate)}.`, margin + columnWidth + gap + 12, top + 34, {
    width: columnWidth - 24
  });
  doc.fillColor(MOSS).font("Helvetica-Bold").fontSize(9).text(`Thank you for choosing ${business.name}.`, margin + columnWidth + gap + 12, top + 53, {
    width: columnWidth - 24
  });
}

function ensureSpace(state: DrawState, requiredHeight: number) {
  const bottom = state.doc.page.height - state.doc.page.margins.bottom;
  if (state.y + requiredHeight <= bottom) return state.y;
  state.doc.addPage();
  return state.doc.page.margins.top;
}

function compact(values: Array<string | null | undefined>) {
  return values.flatMap((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
  });
}
