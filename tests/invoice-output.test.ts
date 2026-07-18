import assert from "node:assert/strict";
import test from "node:test";
import type { InvoiceBusinessDetails, InvoiceClientDetails, InvoiceDocumentData } from "../src/lib/invoice-documents";
import { buildPreparedInvoiceEmailBody } from "../src/lib/invoice-documents";
import { renderInvoicePdf } from "../src/lib/invoice-pdf";

const invoice: InvoiceDocumentData = {
  id: "invoice-test",
  invoiceNumber: "INV-2026-0042",
  status: "SENT",
  mode: "DETAILED",
  invoiceDate: new Date("2026-07-16T00:00:00.000Z"),
  dueDate: new Date("2026-07-30T00:00:00.000Z"),
  paymentTermsDays: 14,
  dateRangeStart: new Date("2026-07-13T00:00:00.000Z"),
  dateRangeEnd: new Date("2026-07-16T00:00:00.000Z"),
  labourTotalCents: 152000,
  itemTotalCents: 8500,
  expensesSubtotalCents: 8500,
  subtotalCents: 160500,
  gstCents: 16050,
  grandTotalCents: 176550,
  totalHours: 16,
  totalDurationMinutes: 960,
  project: { title: "Workshop fit-out" },
  lineItems: [
    {
      id: "line-labour",
      type: "LABOUR",
      description: "Labour - Workshop fit-out",
      date: new Date("2026-07-15T00:00:00.000Z"),
      quantity: 16,
      hoursMinutes: 960,
      unitAmountCents: 9500,
      totalAmountCents: 152000,
      notes: "Framing and installation",
      workerNameSnapshot: "Alex Morgan",
      teamMemberId: null,
      payRateCentsSnapshot: null
    },
    {
      id: "line-expense",
      type: "EXPENSE",
      description: "Fixings",
      date: new Date("2026-07-15T00:00:00.000Z"),
      quantity: 1,
      hoursMinutes: null,
      unitAmountCents: 8500,
      totalAmountCents: 8500,
      notes: null
    }
  ]
};

const business: InvoiceBusinessDetails = {
  name: "Example Trade Co",
  legalName: "Example Trade Co Pty Ltd",
  contactName: "Alex Morgan",
  abn: "12345678901",
  email: "accounts@example.com",
  phone: "0400000000",
  address: "Perth WA",
  website: null,
  bankAccountName: "Example Trade Co",
  bsb: "123456",
  accountNumber: "12345678",
  gstRegistered: true,
  gstRate: 10,
  logoPath: null,
  defaultInvoiceNotes: "Thank you for your business.",
  defaultInvoiceEmailMessage: null,
  signatureFooter: null
};

const client: InvoiceClientDetails = {
  businessName: "Coastal Homes WA",
  contactName: "Jordan",
  email: "jordan@example.com",
  phone: "0411111111",
  address: "Fremantle WA",
  abn: "16652787418"
};

test("prepared invoice email stays concise and resolves merge tags once", () => {
  const body = buildPreparedInvoiceEmailBody({
    invoice,
    business,
    client,
    greeting: "Hi {{clientName}},",
    intro: "I hope you're well.\n\nPlease find invoice {{invoiceNumber}} for {{projectName}}.",
    paymentLine: "Payment can be made using the invoice number as the reference.",
    signOff: "Kind regards,\n{{senderName}}\n{{businessName}}"
  });

  assert.equal(body.match(/Hi Jordan,/g)?.length, 1);
  assert.equal(body.includes("{{"), false);
  assert.match(body, /Amount due: \$1,765\.50/);
  assert.match(body, /Due date: 30 July 2026/);
  assert.ok(body.split("\n").length <= 16);
});

test("invoice PDF renderer produces a non-empty A4 PDF document", async () => {
  const pdf = await renderInvoicePdf({ invoice, business, client, logo: null });
  const documentText = pdf.toString("latin1");

  assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(pdf.length > 4_000);
  assert.match(documentText, /\/Type \/Page\b/);
  assert.match(documentText, /%%EOF/);
});
