import type { InvoiceMode, InvoiceStatus, LineItemType } from "@prisma/client";
import { addDays, formatDateAU } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { formatHours } from "@/lib/time";

export type InvoiceDocumentLine = {
  id: string;
  type: LineItemType;
  description: string;
  date: Date | null;
  quantity: unknown;
  hoursMinutes: number | null;
  unitAmountCents: number;
  totalAmountCents: number;
  notes: string | null;
};

export type InvoiceDocumentData = {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  mode: InvoiceMode;
  invoiceDate: Date;
  dueDate: Date | null;
  paymentTermsDays: number;
  dateRangeStart: Date;
  dateRangeEnd: Date;
  labourTotalCents: number;
  itemTotalCents: number;
  expensesSubtotalCents: number;
  subtotalCents: number;
  gstCents: number;
  grandTotalCents: number;
  totalHours: unknown;
  totalDurationMinutes: number;
  project: { title: string };
  lineItems: InvoiceDocumentLine[];
};

export type InvoiceBusinessDetails = {
  name: string;
  legalName: string | null;
  contactName: string | null;
  abn: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  bankAccountName: string | null;
  bsb: string | null;
  accountNumber: string | null;
  gstRegistered: boolean;
  gstRate: number;
  logoPath: string | null;
  defaultInvoiceNotes: string | null;
  defaultInvoiceEmailMessage: string | null;
  signatureFooter: string | null;
};

export type InvoiceClientDetails = {
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  abn: string | null;
};

export function invoiceDueDate(invoice: Pick<InvoiceDocumentData, "dueDate" | "invoiceDate" | "paymentTermsDays">) {
  return invoice.dueDate ?? addDays(invoice.invoiceDate, invoice.paymentTermsDays);
}

export function invoiceSubtotals(invoice: InvoiceDocumentData) {
  const labourSubtotalCents = invoice.labourTotalCents;
  const expensesSubtotalCents = invoice.expensesSubtotalCents || invoice.itemTotalCents;
  const subtotalCents = invoice.subtotalCents || labourSubtotalCents + expensesSubtotalCents;
  const totalDurationMinutes = invoice.totalDurationMinutes || Math.round(Number(invoice.totalHours) * 60);

  return {
    labourSubtotalCents,
    expensesSubtotalCents,
    subtotalCents,
    totalDurationMinutes
  };
}

export function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] ?? "");
}

export function defaultInvoiceEmailSubject(invoice: InvoiceDocumentData, business: InvoiceBusinessDetails) {
  return `Invoice ${invoice.invoiceNumber} – ${business.name}`;
}

export function defaultInvoiceEmailBody(invoice: InvoiceDocumentData, business: InvoiceBusinessDetails, client: InvoiceClientDetails) {
  const dueDate = invoiceDueDate(invoice);
  return [
    `Hi ${client.contactName || client.businessName},`,
    "",
    `Please find invoice ${invoice.invoiceNumber} for ${invoice.project.title}.`,
    "",
    `Total due: ${formatMoney(invoice.grandTotalCents)}`,
    `Due date: ${formatDateAU(dueDate)}`,
    "",
    "Thanks,",
    business.contactName || business.name
  ].join("\n");
}

export function buildPreparedInvoiceEmailBody({
  invoice,
  business,
  client,
  publicUrl,
  greeting,
  intro,
  signOff,
  footer
}: {
  invoice: InvoiceDocumentData;
  business: InvoiceBusinessDetails;
  client: InvoiceClientDetails;
  publicUrl?: string | null;
  greeting?: string | null;
  intro?: string | null;
  signOff?: string | null;
  footer?: string | null;
}) {
  const dueDate = invoiceDueDate(invoice);
  const { labourSubtotalCents, expensesSubtotalCents, subtotalCents } = invoiceSubtotals(invoice);
  const opening = greeting?.trim() || `Hi ${client.contactName || client.businessName},\n\nI hope you're well.`;
  const introText = intro?.trim() || `Please find invoice ${invoice.invoiceNumber} for ${invoice.project.title}.`;
  const lines = [
    ...opening.split("\n"),
    "",
    ...introText.split("\n"),
    "",
    "Invoice Details",
    "",
    "Invoice Number:",
    invoice.invoiceNumber,
    "",
    "Project:",
    invoice.project.title,
    "",
    "Amount Due:",
    formatMoney(invoice.grandTotalCents),
    "",
    "Due Date:",
    formatEmailDate(dueDate),
    "",
    "Payment Reference:",
    invoice.invoiceNumber,
    "",
    "Payment Details",
    ""
  ];

  if (business.bankAccountName) lines.push("Account Name:", business.bankAccountName, "");
  if (business.bsb) lines.push("BSB:", business.bsb, "");
  if (business.accountNumber) lines.push("Account Number:", business.accountNumber, "");

  if (publicUrl) {
    lines.push("View Invoice Online:", publicUrl, "");
  } else {
    lines.push(
      "Invoice Summary",
      "",
      "Labour:",
      formatMoney(labourSubtotalCents),
      "",
      ...(expensesSubtotalCents > 0 ? ["Expenses / Materials:", formatMoney(expensesSubtotalCents), ""] : []),
      "Subtotal:",
      formatMoney(subtotalCents),
      "",
      ...(invoice.gstCents > 0 ? ["GST:", formatMoney(invoice.gstCents), ""] : []),
      "Total Due:",
      formatMoney(invoice.grandTotalCents),
      ""
    );
  }

  lines.push(
    "If you have any questions regarding this invoice, please feel free to contact us.",
    "",
    ...(signOff?.trim() || "Kind regards,").split("\n"),
    "",
    business.contactName || business.name
  );

  const footerText = footer?.trim();
  lines.push(...(footerText || business.name).split("\n"));

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function formatEmailDate(date: Date | string | number) {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(value);
}

export function buildInvoicePlainText({
  invoice,
  business,
  client,
  publicUrl
}: {
  invoice: InvoiceDocumentData;
  business: InvoiceBusinessDetails;
  client: InvoiceClientDetails;
  publicUrl?: string | null;
}) {
  const dueDate = invoiceDueDate(invoice);
  const { labourSubtotalCents, expensesSubtotalCents, subtotalCents } = invoiceSubtotals(invoice);
  const title = business.gstRegistered ? "Tax Invoice" : "Invoice";
  const lines = [
    `${title} ${invoice.invoiceNumber}`,
    `Business: ${business.name}`,
    business.abn ? `ABN: ${business.abn}` : "",
    `Client: ${client.businessName}`,
    `Project: ${invoice.project.title}`,
    `Date range: ${formatDateAU(invoice.dateRangeStart)} - ${formatDateAU(invoice.dateRangeEnd)}`,
    `Issue date: ${formatDateAU(invoice.invoiceDate)}`,
    `Due date: ${formatDateAU(dueDate)}`,
    "",
    "Line items"
  ];

  if (invoice.mode === "SIMPLE") {
    if (labourSubtotalCents > 0) {
      lines.push(`- Labour for ${invoice.project.title}: ${formatMoney(labourSubtotalCents)}`);
    }
  } else {
    for (const line of invoice.lineItems.filter((item) => item.type === "LABOUR")) {
      lines.push(
        `- ${line.date ? formatDateAU(line.date) : line.description}: ${formatHours(line.hoursMinutes ?? 0)} hrs at ${formatMoney(line.unitAmountCents)}/h - ${formatMoney(line.totalAmountCents)}`
      );
      if (line.notes) lines.push(`  ${line.notes}`);
    }
  }

  for (const line of invoice.lineItems.filter((item) => item.type === "EXPENSE")) {
    lines.push(`- ${line.description}: Qty ${Number(line.quantity ?? 0)} at ${formatMoney(line.unitAmountCents)} - ${formatMoney(line.totalAmountCents)}`);
    if (line.notes) lines.push(`  ${line.notes}`);
  }

  lines.push("", `Labour: ${formatMoney(labourSubtotalCents)}`);
  if (expensesSubtotalCents > 0) lines.push(`Expenses/materials: ${formatMoney(expensesSubtotalCents)}`);
  lines.push(`Subtotal: ${formatMoney(subtotalCents)}`);
  if (invoice.gstCents > 0) lines.push(`GST: ${formatMoney(invoice.gstCents)}`);
  lines.push(`Total due: ${formatMoney(invoice.grandTotalCents)}`, `Payment reference: ${invoice.invoiceNumber}`);

  if (business.bankAccountName || business.bsb || business.accountNumber) {
    lines.push("", "Payment details");
    if (business.bankAccountName) lines.push(`Account name: ${business.bankAccountName}`);
    if (business.bsb) lines.push(`BSB: ${business.bsb}`);
    if (business.accountNumber) lines.push(`Account: ${business.accountNumber}`);
  }

  if (publicUrl) {
    lines.push("", `View invoice: ${publicUrl}`);
  }

  return lines.filter(Boolean).join("\n");
}

export function buildInvoiceEmailHtml({
  invoice,
  business,
  client,
  message,
  publicUrl
}: {
  invoice: InvoiceDocumentData;
  business: InvoiceBusinessDetails;
  client: InvoiceClientDetails;
  message: string;
  publicUrl?: string | null;
}) {
  const dueDate = invoiceDueDate(invoice);
  const { labourSubtotalCents, expensesSubtotalCents, subtotalCents } = invoiceSubtotals(invoice);
  const lineSummary =
    invoice.mode === "SIMPLE"
      ? `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e0d6;">Labour for ${escapeHtml(invoice.project.title)}</td><td style="padding:10px 0;border-bottom:1px solid #e5e0d6;text-align:right;font-weight:700;">${formatMoney(labourSubtotalCents)}</td></tr>`
      : invoice.lineItems
          .filter((line) => line.type === "LABOUR")
          .map(
            (line) =>
              `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e0d6;">${escapeHtml(line.date ? formatDateAU(line.date) : line.description)}<br><span style="color:#54745b;font-size:12px;">${formatHours(line.hoursMinutes ?? 0)}h at ${formatMoney(line.unitAmountCents)}/h</span></td><td style="padding:10px 0;border-bottom:1px solid #e5e0d6;text-align:right;font-weight:700;">${formatMoney(line.totalAmountCents)}</td></tr>`
          )
          .join("");
  const expenseRows = invoice.lineItems
    .filter((line) => line.type === "EXPENSE")
    .map(
      (line) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e0d6;">${escapeHtml(line.description)}<br><span style="color:#54745b;font-size:12px;">Qty ${Number(line.quantity ?? 0)} at ${formatMoney(line.unitAmountCents)}</span></td><td style="padding:10px 0;border-bottom:1px solid #e5e0d6;text-align:right;font-weight:700;">${formatMoney(line.totalAmountCents)}</td></tr>`
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f4ef;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#17211c;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e0d6;border-radius:12px;overflow:hidden;">
      <div style="padding:28px;border-bottom:3px solid #17211c;">
        <p style="margin:0;color:#54745b;text-transform:uppercase;font-size:12px;font-weight:700;letter-spacing:.12em;">${business.gstRegistered ? "Tax Invoice" : "Invoice"}</p>
        <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2;">${escapeHtml(invoice.invoiceNumber)}</h1>
        <p style="margin:8px 0 0;color:#54745b;font-weight:700;">${escapeHtml(business.name)}${business.abn ? ` · ABN ${escapeHtml(business.abn)}` : ""}</p>
      </div>
      <div style="padding:28px;">
        ${paragraphs(message)}
        <div style="margin:24px 0;padding:18px;border-radius:10px;background:#fbfaf6;border:1px solid #e5e0d6;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#54745b;font-size:13px;font-weight:700;">Client</td><td style="text-align:right;font-weight:700;">${escapeHtml(client.businessName)}</td></tr>
            <tr><td style="color:#54745b;font-size:13px;font-weight:700;padding-top:8px;">Project</td><td style="text-align:right;font-weight:700;padding-top:8px;">${escapeHtml(invoice.project.title)}</td></tr>
            <tr><td style="color:#54745b;font-size:13px;font-weight:700;padding-top:8px;">Due date</td><td style="text-align:right;font-weight:700;padding-top:8px;">${formatDateAU(dueDate)}</td></tr>
            <tr><td style="color:#54745b;font-size:13px;font-weight:700;padding-top:8px;">Total due</td><td style="text-align:right;font-size:24px;font-weight:800;padding-top:8px;">${formatMoney(invoice.grandTotalCents)}</td></tr>
          </table>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          ${lineSummary}
          ${expenseRows}
        </table>
        <table style="width:100%;border-collapse:collapse;margin-top:20px;">
          <tr><td style="padding:4px 0;color:#54745b;font-weight:700;">Labour</td><td style="padding:4px 0;text-align:right;font-weight:700;">${formatMoney(labourSubtotalCents)}</td></tr>
          <tr><td style="padding:4px 0;color:#54745b;font-weight:700;">Expenses/materials</td><td style="padding:4px 0;text-align:right;font-weight:700;">${formatMoney(expensesSubtotalCents)}</td></tr>
          <tr><td style="padding:4px 0;color:#54745b;font-weight:700;">Subtotal</td><td style="padding:4px 0;text-align:right;font-weight:700;">${formatMoney(subtotalCents)}</td></tr>
          ${invoice.gstCents > 0 ? `<tr><td style="padding:4px 0;color:#54745b;font-weight:700;">GST</td><td style="padding:4px 0;text-align:right;font-weight:700;">${formatMoney(invoice.gstCents)}</td></tr>` : ""}
          <tr><td style="padding-top:12px;border-top:2px solid #17211c;font-weight:800;">Total amount due</td><td style="padding-top:12px;border-top:2px solid #17211c;text-align:right;font-size:22px;font-weight:800;">${formatMoney(invoice.grandTotalCents)}</td></tr>
        </table>
        ${
          publicUrl
            ? `<p style="margin:28px 0;text-align:center;"><a href="${escapeHtml(publicUrl)}" style="display:inline-block;background:#17211c;color:#ffffff;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:700;">View invoice</a></p>`
            : ""
        }
        <div style="margin-top:24px;padding-top:18px;border-top:1px solid #e5e0d6;color:#17211c;font-size:14px;">
          <p style="margin:0 0 6px;font-weight:800;">Payment details</p>
          ${business.bankAccountName ? `<p style="margin:0 0 4px;">Account name: ${escapeHtml(business.bankAccountName)}</p>` : ""}
          ${business.bsb ? `<p style="margin:0 0 4px;">BSB: ${escapeHtml(business.bsb)}</p>` : ""}
          ${business.accountNumber ? `<p style="margin:0 0 4px;">Account: ${escapeHtml(business.accountNumber)}</p>` : ""}
          <p style="margin:0;">Payment reference: ${escapeHtml(invoice.invoiceNumber)}</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function paragraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 14px;line-height:1.55;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
