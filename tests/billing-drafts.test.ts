import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { syncProjectDrafts } from "../src/lib/invoice-draft-sync";
import { buildInvoiceLineData } from "../src/lib/invoices";

const databaseUrl = process.env.BILLING_TEST_DATABASE_URL;

test("drafts follow source edits and deletions without changing issued invoices or another owner", { skip: !databaseUrl }, async () => {
  const url = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "Integration tests require a local database");
  assert.equal(url.pathname, "/invoice_qa", "Integration tests require the isolated invoice_qa database");
  process.env.DATABASE_URL = databaseUrl;
  const { prisma } = await import("../src/lib/prisma");
  const { billingTransaction } = await import("../src/lib/billing-transaction");
  const ownerId = `qa-billing-${randomUUID()}`;
  const date = new Date("2026-09-21T00:00:00Z");
  try {
    await prisma.businessProfile.create({ data: { ownerId, tradingName: "Billing QA", gstRegistered: true, gstRate: 10 } });
    const client = await prisma.client.create({ data: { ownerId, businessName: "QA Client" } });
    const project = await prisma.project.create({ data: { ownerId, clientId: client.id, title: "Billing QA", currentHourlyRateCents: 9500 } });
    const entry = await prisma.timeEntry.create({ data: { ownerId, projectId: project.id, date, durationMinutes: 480, hourlyRateCentsSnapshot: 9500 } });
    const item = await prisma.expenseItem.create({ data: { ownerId, projectId: project.id, datePurchased: date, description: "Materials", quantity: 1, unitCostCents: 5000, totalCostCents: 5000 } });
    const data = {
      ownerId, projectId: project.id, clientId: client.id, invoiceDate: date, dateRangeStart: date, dateRangeEnd: date,
      grandTotalCents: 89100,
      lineItems: { create: buildInvoiceLineData([entry], [item]).map((line) => ({ ...line, ownerId })) }
    };
    const draft = await prisma.invoice.create({ data: { ...data, invoiceNumber: "QA-DRAFT" } });
    const issued = await prisma.invoice.create({ data: { ...data, invoiceNumber: "QA-SENT", status: "SENT" } });

    await billingTransaction(async (tx) => {
      await tx.timeEntry.update({ where: { id: entry.id }, data: { durationMinutes: 120, notes: "Corrected hours", date: new Date("2026-09-22T00:00:00Z") } });
      await syncProjectDrafts(tx, ownerId, project.id);
    });
    const updated = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id }, include: { lineItems: true } });
    assert.equal(updated.totalDurationMinutes, 120);
    assert.equal(updated.subtotalCents, 24000);
    assert.equal(updated.gstCents, 2400);
    assert.equal(updated.grandTotalCents, 26400);
    assert.equal(updated.dateRangeEnd.toISOString(), "2026-09-22T00:00:00.000Z");
    assert.equal(updated.lineItems.find((line) => line.timeEntryId === entry.id)?.notes, "Corrected hours");
    assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: issued.id } })).grandTotalCents, 89100);

    // A mismatched owner cannot change the draft even when given a valid project id.
    await billingTransaction(async (tx) => {
      await tx.invoice.update({ where: { id: draft.id }, data: { summary: "Tenant boundary" } });
      await syncProjectDrafts(tx, `${ownerId}-other`, project.id);
    });
    assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id } })).summary, "Tenant boundary");

    await billingTransaction(async (tx) => {
      await tx.expenseItem.delete({ where: { id: item.id } });
      await syncProjectDrafts(tx, ownerId, project.id);
    });
    const afterDelete = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id }, include: { lineItems: true } });
    assert.equal(afterDelete.lineItems.length, 1);
    assert.equal(afterDelete.grandTotalCents, 20900);

    await billingTransaction(async (tx) => {
      await tx.timeEntry.delete({ where: { id: entry.id } });
      await syncProjectDrafts(tx, ownerId, project.id);
    });
    const empty = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id }, include: { lineItems: true } });
    assert.equal(empty.lineItems.length, 0);
    assert.equal(empty.grandTotalCents, 0);
    assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: issued.id } })).grandTotalCents, 89100);
  } finally {
    await prisma.invoice.deleteMany({ where: { ownerId } });
    await prisma.timeEntry.deleteMany({ where: { ownerId } });
    await prisma.expenseItem.deleteMany({ where: { ownerId } });
    await prisma.project.deleteMany({ where: { ownerId } });
    await prisma.client.deleteMany({ where: { ownerId } });
    await prisma.businessProfile.deleteMany({ where: { ownerId } });
    await prisma.$disconnect();
  }
});
