"use server";

import type { ProjectStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { dollarsToCents } from "@/lib/money";
import { endOfDay, parseInputDate } from "@/lib/dates";
import { buildInvoiceLineData, invoiceTotals, summaryText } from "@/lib/invoices";
import { isQuarterHour, isQuarterHourClock, parseClockTime } from "@/lib/time";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function positive(value: number, message: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(message);
  }
}

function returnTo(formData: FormData) {
  const value = text(formData, "returnTo");
  return value.startsWith("/") ? value : "/";
}

export async function createTimeEntryAction(formData: FormData) {
  const projectId = text(formData, "projectId");
  const date = parseInputDate(formData.get("date"));
  const notes = text(formData, "notes") || null;
  const mode = text(formData, "entryMode");

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.status !== "ACTIVE") {
    throw new Error("Choose an active project.");
  }

  let durationMinutes = 0;
  let startTime: string | null = null;
  let endTime: string | null = null;

  if (mode === "range") {
    startTime = text(formData, "startTime");
    endTime = text(formData, "endTime");
    const start = parseClockTime(startTime);
    const end = parseClockTime(endTime);

    if (start === null || end === null || end <= start) {
      throw new Error("Enter a valid start and end time.");
    }

    if (!isQuarterHourClock(start) || !isQuarterHourClock(end)) {
      throw new Error("Start and end times must use 15-minute increments.");
    }

    durationMinutes = end - start;
  } else {
    const hours = Number.parseFloat(text(formData, "durationHours"));
    positive(hours, "Hours must be greater than zero.");
    durationMinutes = Math.round(hours * 60);

    if (!isQuarterHour(durationMinutes)) {
      throw new Error("Manual hours must be in 15-minute increments.");
    }
  }

  await prisma.timeEntry.create({
    data: {
      projectId,
      date,
      startTime,
      endTime,
      durationMinutes,
      notes,
      hourlyRateCentsSnapshot: project.currentHourlyRateCents
    }
  });

  revalidatePath("/");
  revalidatePath("/projects");
  redirect(returnTo(formData));
}

function timeEntryDataFromForm(formData: FormData) {
  const date = parseInputDate(formData.get("date"));
  const notes = text(formData, "notes") || null;
  const mode = text(formData, "entryMode");

  let durationMinutes = 0;
  let startTime: string | null = null;
  let endTime: string | null = null;

  if (mode === "range") {
    startTime = text(formData, "startTime");
    endTime = text(formData, "endTime");
    const start = parseClockTime(startTime);
    const end = parseClockTime(endTime);

    if (start === null || end === null || end <= start) {
      throw new Error("Enter a valid start and end time.");
    }

    if (!isQuarterHourClock(start) || !isQuarterHourClock(end)) {
      throw new Error("Start and end times must use 15-minute increments.");
    }

    durationMinutes = end - start;
  } else {
    const hours = Number.parseFloat(text(formData, "durationHours"));
    positive(hours, "Hours must be greater than zero.");
    durationMinutes = Math.round(hours * 60);

    if (!isQuarterHour(durationMinutes)) {
      throw new Error("Manual hours must be in 15-minute increments.");
    }
  }

  return { date, startTime, endTime, durationMinutes, notes };
}

export async function updateTimeEntryAction(formData: FormData) {
  const entryId = text(formData, "entryId");
  const projectId = text(formData, "projectId");
  const entry = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    select: { id: true, projectId: true, billingStatus: true }
  });

  if (!entry || entry.projectId !== projectId) throw new Error("Time entry not found.");
  if (entry.billingStatus !== "UNBILLED") throw new Error("Billed time entries cannot be edited.");

  await prisma.timeEntry.update({
    where: { id: entryId },
    data: timeEntryDataFromForm(formData)
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/hours-export");
  redirect(`/projects/${projectId}`);
}

export async function deleteTimeEntryAction(formData: FormData) {
  const entryId = text(formData, "entryId");
  const projectId = text(formData, "projectId");
  const entry = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    select: { id: true, projectId: true, billingStatus: true }
  });

  if (!entry || entry.projectId !== projectId) throw new Error("Time entry not found.");
  if (entry.billingStatus !== "UNBILLED") throw new Error("Billed time entries cannot be deleted.");

  await prisma.timeEntry.delete({ where: { id: entryId } });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/hours-export");
  redirect(returnTo(formData));
}

export async function createExpenseItemAction(formData: FormData) {
  const projectId = text(formData, "projectId");
  const datePurchased = parseInputDate(formData.get("datePurchased"));
  const description = text(formData, "description");
  const quantity = Number.parseFloat(text(formData, "quantity"));
  const unitCostCents = dollarsToCents(formData.get("unitCost"));
  const notes = text(formData, "itemNotes") || null;

  if (!description) throw new Error("Description is required.");
  positive(quantity, "Quantity must be greater than zero.");
  positive(unitCostCents, "Unit cost must be greater than zero.");

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.status !== "ACTIVE") {
    throw new Error("Choose an active project.");
  }

  await prisma.expenseItem.create({
    data: {
      projectId,
      datePurchased,
      description,
      quantity,
      unitCostCents,
      totalCostCents: Math.round(quantity * unitCostCents),
      notes
    }
  });

  revalidatePath("/");
  revalidatePath("/projects");
  redirect(returnTo(formData));
}

export async function createProjectAction(formData: FormData) {
  const title = text(formData, "title");
  const rateCents = dollarsToCents(formData.get("hourlyRate"));
  let clientId = text(formData, "clientId");
  const notes = text(formData, "notes") || null;

  if (!title) throw new Error("Project name is required.");
  positive(rateCents, "Hourly rate must be greater than zero.");

  if (clientId === "__new") {
    const businessName = text(formData, "newClientBusinessName");
    if (!businessName) throw new Error("New client business/name is required.");

    const client = await prisma.client.create({
      data: {
        businessName,
        contactName: text(formData, "newClientContactName") || null,
        email: text(formData, "newClientEmail") || null,
        phone: text(formData, "newClientPhone") || null,
        abn: text(formData, "newClientAbn") || null,
        address: text(formData, "newClientAddress") || null,
        notes: text(formData, "newClientNotes") || null
      }
    });
    clientId = client.id;
  }

  if (!clientId) throw new Error("Choose or add a client.");

  const project = await prisma.project.create({
    data: {
      title,
      clientId,
      currentHourlyRateCents: rateCents,
      notes,
      rateHistory: {
        create: {
          rateCents,
          notes: "Initial rate"
        }
      }
    }
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(formData: FormData) {
  const projectId = text(formData, "projectId");
  const title = text(formData, "title");
  const clientId = text(formData, "clientId");
  const rateCents = dollarsToCents(formData.get("hourlyRate"));
  const status = text(formData, "status") as ProjectStatus;
  const notes = text(formData, "notes") || null;

  if (!title) throw new Error("Project name is required.");
  if (!clientId) throw new Error("Choose a client.");
  positive(rateCents, "Hourly rate must be greater than zero.");

  const existing = await prisma.project.findUnique({ where: { id: projectId } });
  if (!existing) throw new Error("Project not found.");

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        title,
        clientId,
        currentHourlyRateCents: rateCents,
        status: status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
        notes
      }
    });

    if (existing.currentHourlyRateCents !== rateCents) {
      await tx.rateHistory.create({
        data: {
          projectId,
          rateCents,
          notes: "Rate changed from project edit"
        }
      });
    }
  });

  revalidatePath("/projects");
  redirect(`/projects/${projectId}`);
}

export async function archiveProjectAction(formData: FormData) {
  const projectId = text(formData, "projectId");

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "ARCHIVED" }
  });

  revalidatePath("/projects");
  redirect("/projects");
}

export async function unarchiveProjectAction(formData: FormData) {
  const projectId = text(formData, "projectId");

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "ACTIVE" }
  });

  revalidatePath("/");
  revalidatePath("/projects");
  redirect(`/projects/${projectId}`);
}

export async function deleteProjectAction(formData: FormData) {
  const projectId = text(formData, "projectId");
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });

  if (!project) throw new Error("Project not found.");

  await prisma.$transaction(async (tx) => {
    const [invoiceCount, billedTimeCount, billedExpenseCount] = await Promise.all([
      tx.invoice.count({ where: { projectId } }),
      tx.timeEntry.count({ where: { projectId, billingStatus: "BILLED" } }),
      tx.expenseItem.count({ where: { projectId, billingStatus: "BILLED" } })
    ]);

    if (invoiceCount || billedTimeCount || billedExpenseCount) {
      throw new Error("This project has invoice or billed history. Archive it instead of deleting it.");
    }

    await tx.timeEntry.deleteMany({ where: { projectId } });
    await tx.expenseItem.deleteMany({ where: { projectId } });
    await tx.rateHistory.deleteMany({ where: { projectId } });
    await tx.project.delete({ where: { id: projectId } });
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/invoices");
  redirect("/projects");
}

export async function deleteClientAction(formData: FormData) {
  const clientId = text(formData, "clientId");
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true }
  });

  if (!client) throw new Error("Client not found.");

  await prisma.$transaction(async (tx) => {
    const projects = await tx.project.findMany({
      where: { clientId },
      select: { id: true }
    });
    const projectIds = projects.map((project) => project.id);

    const [invoiceCount, billedTimeCount, billedExpenseCount] = await Promise.all([
      tx.invoice.count({
        where: {
          OR: [{ clientId }, { projectId: { in: projectIds } }]
        }
      }),
      tx.timeEntry.count({ where: { projectId: { in: projectIds }, billingStatus: "BILLED" } }),
      tx.expenseItem.count({ where: { projectId: { in: projectIds }, billingStatus: "BILLED" } })
    ]);

    if (invoiceCount || billedTimeCount || billedExpenseCount) {
      throw new Error("This client has invoice or billed history. Archive their projects instead of deleting the client.");
    }

    await tx.timeEntry.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    await tx.expenseItem.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    await tx.rateHistory.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    await tx.project.deleteMany({
      where: { id: { in: projectIds } }
    });
    await tx.client.delete({ where: { id: clientId } });
  });

  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/projects");
  revalidatePath("/invoices");
  revalidatePath("/hours-export");
  redirect("/clients");
}

async function nextInvoiceNumber() {
  const year = new Date().getUTCFullYear();
  const count = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: `INV-${year}-` } }
  });

  return `INV-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function createInvoiceDraftAction(formData: FormData) {
  const projectId = text(formData, "projectId");
  const start = parseInputDate(formData.get("dateRangeStart"));
  const end = endOfDay(parseInputDate(formData.get("dateRangeEnd")));

  if (end < start) {
    throw new Error("End date must be after start date.");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, clientId: true }
  });
  if (!project) throw new Error("Project not found.");

  const [entries, expenses] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        projectId,
        billingStatus: "UNBILLED",
        date: { gte: start, lte: end }
      },
      select: { id: true, date: true, durationMinutes: true, notes: true, hourlyRateCentsSnapshot: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }]
    }),
    prisma.expenseItem.findMany({
      where: {
        projectId,
        billingStatus: "UNBILLED",
        datePurchased: { gte: start, lte: end }
      },
      select: {
        id: true,
        datePurchased: true,
        description: true,
        quantity: true,
        unitCostCents: true,
        totalCostCents: true,
        notes: true
      },
      orderBy: [{ datePurchased: "asc" }, { createdAt: "asc" }]
    })
  ]);

  if (entries.length === 0 && expenses.length === 0) {
    throw new Error("There are no unbilled entries or items in this date range.");
  }

  const totals = invoiceTotals(entries, expenses);
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: await nextInvoiceNumber(),
      projectId,
      clientId: project.clientId,
      invoiceDate: new Date(),
      dateRangeStart: start,
      dateRangeEnd: parseInputDate(formData.get("dateRangeEnd")),
      status: "DRAFT",
      totalHours: totals.totalHours,
      labourTotalCents: totals.labourTotalCents,
      itemTotalCents: totals.itemTotalCents,
      grandTotalCents: totals.grandTotalCents,
      summary: summaryText(entries, expenses),
      lineItems: {
        create: buildInvoiceLineData(entries, expenses)
      }
    }
  });

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

async function finaliseInvoice(invoiceId: string, status: "SENT" | "PAID") {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true }
  });

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "VOID") throw new Error("Void invoices cannot be finalised.");

  const timeEntryIds = invoice.lineItems
    .map((line) => line.timeEntryId)
    .filter((id): id is string => Boolean(id));
  const expenseItemIds = invoice.lineItems
    .map((line) => line.expenseItemId)
    .filter((id): id is string => Boolean(id));

  const [blockedEntries, blockedExpenses] = await Promise.all([
    timeEntryIds.length
      ? prisma.timeEntry.count({
          where: {
            id: { in: timeEntryIds },
            billingStatus: "BILLED",
            invoiceId: { not: invoiceId }
          }
        })
      : 0,
    expenseItemIds.length
      ? prisma.expenseItem.count({
          where: {
            id: { in: expenseItemIds },
            billingStatus: "BILLED",
            invoiceId: { not: invoiceId }
          }
        })
      : 0
  ]);

  if (blockedEntries || blockedExpenses) {
    throw new Error("One or more invoice items have already been billed elsewhere.");
  }

  await prisma.$transaction([
    prisma.timeEntry.updateMany({
      where: { id: { in: timeEntryIds } },
      data: { billingStatus: "BILLED", invoiceId }
    }),
    prisma.expenseItem.updateMany({
      where: { id: { in: expenseItemIds } },
      data: { billingStatus: "BILLED", invoiceId }
    }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status,
        paymentDate: status === "PAID" ? new Date() : invoice.paymentDate
      }
    })
  ]);
}

export async function markInvoiceSentAction(formData: FormData) {
  const invoiceId = text(formData, "invoiceId");
  await finaliseInvoice(invoiceId, "SENT");
  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}

export async function markInvoicePaidAction(formData: FormData) {
  const invoiceId = text(formData, "invoiceId");
  await finaliseInvoice(invoiceId, "PAID");
  revalidatePath("/");
  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}

export async function voidInvoiceAction(formData: FormData) {
  const invoiceId = text(formData, "invoiceId");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true }
  });

  if (!invoice) throw new Error("Invoice not found.");

  const timeEntryIds = invoice.lineItems
    .map((line) => line.timeEntryId)
    .filter((id): id is string => Boolean(id));
  const expenseItemIds = invoice.lineItems
    .map((line) => line.expenseItemId)
    .filter((id): id is string => Boolean(id));

  await prisma.$transaction([
    prisma.timeEntry.updateMany({
      where: { id: { in: timeEntryIds }, invoiceId },
      data: { billingStatus: "UNBILLED", invoiceId: null }
    }),
    prisma.expenseItem.updateMany({
      where: { id: { in: expenseItemIds }, invoiceId },
      data: { billingStatus: "UNBILLED", invoiceId: null }
    }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "VOID", paymentDate: null }
    })
  ]);

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}

export async function unvoidInvoiceAction(formData: FormData) {
  const invoiceId = text(formData, "invoiceId");

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status !== "VOID") throw new Error("Only void invoices can be restored.");

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "DRAFT", paymentDate: null }
  });

  revalidatePath("/");
  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}

export async function deleteInvoiceAction(formData: FormData) {
  const invoiceId = text(formData, "invoiceId");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true }
  });

  if (!invoice) throw new Error("Invoice not found.");

  const timeEntryIds = invoice.lineItems
    .map((line) => line.timeEntryId)
    .filter((id): id is string => Boolean(id));
  const expenseItemIds = invoice.lineItems
    .map((line) => line.expenseItemId)
    .filter((id): id is string => Boolean(id));

  await prisma.$transaction([
    prisma.timeEntry.updateMany({
      where: { id: { in: timeEntryIds }, invoiceId },
      data: { billingStatus: "UNBILLED", invoiceId: null }
    }),
    prisma.expenseItem.updateMany({
      where: { id: { in: expenseItemIds }, invoiceId },
      data: { billingStatus: "UNBILLED", invoiceId: null }
    }),
    prisma.invoice.delete({ where: { id: invoiceId } })
  ]);

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/invoices");
  redirect("/invoices");
}
