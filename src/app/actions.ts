"use server";

import crypto from "node:crypto";
import type { InvoiceMode, ProjectStatus } from "@prisma/client";
import { Resend } from "resend";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/app-data";
import { dollarsToCents, formatMoney } from "@/lib/money";
import { addDays, endOfDay, formatDateAU, parseInputDate } from "@/lib/dates";
import {
  buildInvoiceEmailHtml,
  buildInvoicePlainText,
  defaultInvoiceEmailBody,
  defaultInvoiceEmailSubject,
  invoiceDueDate,
  renderTemplate
} from "@/lib/invoice-documents";
import type { InvoiceBusinessDetails, InvoiceClientDetails, InvoiceDocumentData } from "@/lib/invoice-documents";
import { buildInvoiceLineData, invoiceTotals, summaryText } from "@/lib/invoices";
import { isQuarterHour, isQuarterHourClock, parseClockTime } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function positive(value: number, message: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(message);
  }
}

function optionalPositiveCents(formData: FormData, key: string) {
  const raw = text(formData, key);
  return raw ? dollarsToCents(raw) : null;
}

function optionalInt(formData: FormData, key: string, fallback: number) {
  const raw = text(formData, key);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${key} must be a valid number.`);
  return value;
}

function optionalDecimal(formData: FormData, key: string, fallback: number) {
  const raw = text(formData, key);
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${key} must be a valid number.`);
  return value;
}

function returnTo(formData: FormData) {
  const value = text(formData, "returnTo");
  return value.startsWith("/") ? value : "/";
}

function revalidateAppData() {
  for (const tag of Object.values(CACHE_TAGS)) {
    revalidateTag(tag);
  }
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function logAudit(
  ownerId: string,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Record<string, string | number | boolean | null>
) {
  await prisma.auditLog.create({
    data: {
      ownerId,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata: metadata ?? undefined
    }
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appBaseUrl() {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const vercelUrl = process.env.VERCEL_URL?.trim();
  return vercelUrl ? `https://${vercelUrl.replace(/\/$/, "")}` : null;
}

function invoicePublicUrl(token: string) {
  const baseUrl = appBaseUrl();
  return baseUrl ? `${baseUrl}/public/invoices/${token}` : null;
}

function parseEmailList(value: string, label: string, required = false) {
  const emails = value
    .split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean);

  if (required && emails.length === 0) throw new Error(`${label} email is required.`);

  for (const email of emails) {
    if (!EMAIL_RE.test(email)) throw new Error(`${label} contains an invalid email address.`);
  }

  return emails;
}

function cleanEmailDisplayName(value: string) {
  return value.replace(/[<>"\n\r]/g, "").trim() || "Invoices";
}

function senderAddress(businessName: string) {
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  if (!fromEmail) throw new Error("RESEND_FROM_EMAIL is not configured.");
  if (fromEmail.includes("<")) return fromEmail;
  if (!EMAIL_RE.test(fromEmail)) throw new Error("RESEND_FROM_EMAIL must be a valid email address or sender string.");
  return `${cleanEmailDisplayName(businessName)} <${fromEmail}>`;
}

async function generateUniqueInvoiceToken() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = crypto.randomBytes(32).toString("base64url");
    const existing = await prisma.invoice.findUnique({ where: { publicToken: token }, select: { id: true } });
    if (!existing) return token;
  }

  throw new Error("Could not generate a public invoice link. Please try again.");
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function validateBusinessProfileInput(formData: FormData, gstRegistered: boolean) {
  const invoicePrefix = text(formData, "invoicePrefix");
  if (!invoicePrefix) throw new Error("Invoice prefix is required.");
  if (invoicePrefix.length > 16) throw new Error("Invoice prefix must be 16 characters or fewer.");

  const abn = digitsOnly(text(formData, "abn"));
  if (abn && abn.length !== 11) throw new Error("ABN must be 11 digits.");

  const acn = digitsOnly(text(formData, "acn"));
  if (acn && acn.length !== 9) throw new Error("ACN must be 9 digits.");

  const email = text(formData, "email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");

  const replyToEmail = text(formData, "replyToEmail");
  if (replyToEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyToEmail)) {
    throw new Error("Enter a valid reply-to email address.");
  }

  const bsb = digitsOnly(text(formData, "bsb"));
  if (bsb && bsb.length !== 6) throw new Error("BSB must be 6 digits.");

  const accountNumber = digitsOnly(text(formData, "accountNumber"));
  if (accountNumber && (accountNumber.length < 5 || accountNumber.length > 12)) {
    throw new Error("Account number must be 5 to 12 digits.");
  }

  const gstRate = gstRegistered ? optionalDecimal(formData, "gstRate", 10) : 0;
  if (gstRate > 100) throw new Error("GST rate must be between 0 and 100.");

  const themeAccent = text(formData, "themeAccent") || "emerald";
  if (!["emerald", "blue", "slate", "amber", "purple"].includes(themeAccent)) {
    throw new Error("Choose one of the available colour themes.");
  }
  const themeMode = text(formData, "themeMode") || "system";
  if (!["system", "light", "dark"].includes(themeMode)) {
    throw new Error("Choose a valid display mode.");
  }

  return { invoicePrefix, gstRate, themeAccent, themeMode };
}

export async function updateBusinessProfileAction(formData: FormData) {
  const ownerId = await requireUserId();
  const tradingName = text(formData, "tradingName");
  if (!tradingName) throw new Error("Trading/business name is required.");

  const gstRegistered = text(formData, "gstRegistered") === "on";
  const { invoicePrefix, gstRate, themeAccent, themeMode } = validateBusinessProfileInput(formData, gstRegistered);
  const defaultInvoiceEmailBody = text(formData, "defaultInvoiceEmailBody") || null;

  const existing = await prisma.businessProfile.findUnique({ where: { ownerId } });
  let logoPath = existing?.logoPath ?? null;
  const removeLogo = text(formData, "removeLogo") === "on";
  const submittedLogoPath = text(formData, "logoPath");

  if (submittedLogoPath) {
    if (!submittedLogoPath.startsWith(`${ownerId}/`)) {
      throw new Error("Logo path is invalid.");
    }
    if (!/\.(png|jpg|jpeg|webp|svg)$/i.test(submittedLogoPath)) {
      throw new Error("Logo must be PNG, JPG, WEBP, or SVG.");
    }
    logoPath = submittedLogoPath;
  }

  if (removeLogo) {
    logoPath = null;
  }

  const profile = await prisma.businessProfile.upsert({
    where: { ownerId },
    create: {
      ownerId,
      tradingName,
      invoicePrefix,
      legalName: text(formData, "legalName") || null,
      abn: text(formData, "abn") || null,
      acn: text(formData, "acn") || null,
      contactName: text(formData, "contactName") || null,
      email: text(formData, "email") || null,
      phone: text(formData, "phone") || null,
      address: text(formData, "address") || null,
      website: text(formData, "website") || null,
      defaultHourlyRateCents: optionalPositiveCents(formData, "defaultHourlyRate"),
      gstRegistered,
      gstRate,
      bankAccountName: text(formData, "bankAccountName") || null,
      bsb: text(formData, "bsb") || null,
      accountNumber: text(formData, "accountNumber") || null,
      paymentTermsDays: optionalInt(formData, "paymentTermsDays", 14),
      defaultInvoiceNotes: text(formData, "defaultInvoiceNotes") || null,
      defaultInvoiceEmailMessage: text(formData, "defaultInvoiceEmailMessage") || defaultInvoiceEmailBody,
      defaultInvoiceEmailSubjectTemplate: text(formData, "defaultInvoiceEmailSubjectTemplate") || null,
      defaultInvoiceEmailBody,
      replyToEmail: text(formData, "replyToEmail") || null,
      themeAccent,
      themeMode,
      logoPath,
      signatureFooter: text(formData, "signatureFooter") || null
    },
    update: {
      tradingName,
      invoicePrefix,
      legalName: text(formData, "legalName") || null,
      abn: text(formData, "abn") || null,
      acn: text(formData, "acn") || null,
      contactName: text(formData, "contactName") || null,
      email: text(formData, "email") || null,
      phone: text(formData, "phone") || null,
      address: text(formData, "address") || null,
      website: text(formData, "website") || null,
      defaultHourlyRateCents: optionalPositiveCents(formData, "defaultHourlyRate"),
      gstRegistered,
      gstRate,
      bankAccountName: text(formData, "bankAccountName") || null,
      bsb: text(formData, "bsb") || null,
      accountNumber: text(formData, "accountNumber") || null,
      paymentTermsDays: optionalInt(formData, "paymentTermsDays", 14),
      defaultInvoiceNotes: text(formData, "defaultInvoiceNotes") || null,
      defaultInvoiceEmailMessage: text(formData, "defaultInvoiceEmailMessage") || defaultInvoiceEmailBody,
      defaultInvoiceEmailSubjectTemplate: text(formData, "defaultInvoiceEmailSubjectTemplate") || null,
      defaultInvoiceEmailBody,
      replyToEmail: text(formData, "replyToEmail") || null,
      themeAccent,
      themeMode,
      logoPath,
      signatureFooter: text(formData, "signatureFooter") || null
    }
  });

  if (existing?.logoPath && existing.logoPath !== logoPath && (removeLogo || submittedLogoPath)) {
    const supabase = await createClient();
    await supabase.storage.from("business-logos").remove([existing.logoPath]);
  }

  await logAudit(ownerId, existing ? "business_profile.updated" : "business_profile.created", "BusinessProfile", profile.id, {
    logoChanged: Boolean(removeLogo || submittedLogoPath)
  });
  if (removeLogo) await logAudit(ownerId, "business_profile.logo_removed", "BusinessProfile", profile.id);
  if (submittedLogoPath) await logAudit(ownerId, "business_profile.logo_uploaded", "BusinessProfile", profile.id);

  revalidatePath("/business-profile");
  revalidatePath("/invoices");
  return { ok: true };
}

export async function createTimeEntryAction(formData: FormData) {
  const ownerId = await requireUserId();
  const projectId = text(formData, "projectId");
  const date = parseInputDate(formData.get("date"));
  const notes = text(formData, "notes") || null;
  const mode = text(formData, "entryMode");

  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId } });
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

  const entry = await prisma.timeEntry.create({
    data: {
      projectId,
      ownerId,
      date,
      startTime,
      endTime,
      durationMinutes,
      notes,
      hourlyRateCentsSnapshot: project.currentHourlyRateCents
    }
  });

  await logAudit(ownerId, "time_entry.created", "TimeEntry", entry.id, { projectId });
  revalidatePath("/");
  revalidatePath("/projects");
  revalidateAppData();
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
  const ownerId = await requireUserId();
  const entryId = text(formData, "entryId");
  const projectId = text(formData, "projectId");
  const entry = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    select: { id: true, projectId: true, billingStatus: true }
  });

  if (!entry || entry.projectId !== projectId) throw new Error("Time entry not found.");
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId }, select: { id: true } });
  if (!project) throw new Error("Time entry not found.");
  if (entry.billingStatus !== "UNBILLED") throw new Error("Billed time entries cannot be edited.");

  await prisma.timeEntry.update({
    where: { id: entryId },
    data: timeEntryDataFromForm(formData)
  });

  await logAudit(ownerId, "time_entry.updated", "TimeEntry", entryId, { projectId });
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/hours-export");
  revalidateAppData();
  redirect(`/projects/${projectId}`);
}

export async function deleteTimeEntryAction(formData: FormData) {
  const ownerId = await requireUserId();
  const entryId = text(formData, "entryId");
  const projectId = text(formData, "projectId");
  const entry = await prisma.timeEntry.findUnique({
    where: { id: entryId },
    select: { id: true, projectId: true, billingStatus: true }
  });

  if (!entry || entry.projectId !== projectId) throw new Error("Time entry not found.");
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId }, select: { id: true } });
  if (!project) throw new Error("Time entry not found.");
  if (entry.billingStatus !== "UNBILLED") throw new Error("Billed time entries cannot be deleted.");

  await prisma.timeEntry.delete({ where: { id: entryId } });

  await logAudit(ownerId, "time_entry.deleted", "TimeEntry", entryId, { projectId });
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/hours-export");
  revalidateAppData();
  redirect(returnTo(formData));
}

export async function createExpenseItemAction(formData: FormData) {
  const ownerId = await requireUserId();
  const projectId = text(formData, "projectId");
  const datePurchased = parseInputDate(formData.get("datePurchased"));
  const description = text(formData, "description");
  const quantity = Number.parseFloat(text(formData, "quantity"));
  const unitCostCents = dollarsToCents(formData.get("unitCost"));
  const notes = text(formData, "itemNotes") || null;

  if (!description) throw new Error("Description is required.");
  positive(quantity, "Quantity must be greater than zero.");
  positive(unitCostCents, "Unit cost must be greater than zero.");

  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId } });
  if (!project || project.status !== "ACTIVE") {
    throw new Error("Choose an active project.");
  }

  const expense = await prisma.expenseItem.create({
    data: {
      projectId,
      ownerId,
      datePurchased,
      description,
      quantity,
      unitCostCents,
      totalCostCents: Math.round(quantity * unitCostCents),
      notes
    }
  });

  await logAudit(ownerId, "expense_item.created", "ExpenseItem", expense.id, { projectId });
  revalidatePath("/");
  revalidatePath("/projects");
  revalidateAppData();
  redirect(returnTo(formData));
}

export async function createProjectAction(formData: FormData) {
  const ownerId = await requireUserId();
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
        ownerId,
        contactName: text(formData, "newClientContactName") || null,
        email: text(formData, "newClientEmail") || null,
        phone: text(formData, "newClientPhone") || null,
        abn: text(formData, "newClientAbn") || null,
        address: text(formData, "newClientAddress") || null,
        notes: text(formData, "newClientNotes") || null
      }
    });
    await logAudit(ownerId, "client.created", "Client", client.id);
    clientId = client.id;
  }

  if (!clientId) throw new Error("Choose or add a client.");
  const client = await prisma.client.findFirst({ where: { id: clientId, ownerId }, select: { id: true } });
  if (!client) throw new Error("Choose one of your clients.");

  const project = await prisma.project.create({
    data: {
      title,
      clientId,
      ownerId,
      currentHourlyRateCents: rateCents,
      notes,
      rateHistory: {
        create: {
          ownerId,
          rateCents,
          notes: "Initial rate"
        }
      }
    }
  });

  await logAudit(ownerId, "project.created", "Project", project.id, { clientId });
  revalidatePath("/projects");
  revalidateAppData();
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(formData: FormData) {
  const ownerId = await requireUserId();
  const projectId = text(formData, "projectId");
  const title = text(formData, "title");
  const clientId = text(formData, "clientId");
  const rateCents = dollarsToCents(formData.get("hourlyRate"));
  const status = text(formData, "status") as ProjectStatus;
  const notes = text(formData, "notes") || null;

  if (!title) throw new Error("Project name is required.");
  if (!clientId) throw new Error("Choose a client.");
  positive(rateCents, "Hourly rate must be greater than zero.");

  const existing = await prisma.project.findFirst({ where: { id: projectId, ownerId } });
  if (!existing) throw new Error("Project not found.");
  const client = await prisma.client.findFirst({ where: { id: clientId, ownerId }, select: { id: true } });
  if (!client) throw new Error("Choose one of your clients.");

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
          ownerId,
          rateCents,
          notes: "Rate changed from project edit"
        }
      });
    }
  });

  await logAudit(ownerId, "project.updated", "Project", projectId, { status: status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE" });
  revalidatePath("/projects");
  revalidateAppData();
  redirect(`/projects/${projectId}`);
}

export async function archiveProjectAction(formData: FormData) {
  const ownerId = await requireUserId();
  const projectId = text(formData, "projectId");

  const result = await prisma.project.updateMany({
    where: { id: projectId, ownerId },
    data: { status: "ARCHIVED" }
  });
  if (result.count === 0) throw new Error("Project not found.");

  await logAudit(ownerId, "project.archived", "Project", projectId);
  revalidatePath("/projects");
  revalidateAppData();
  redirect("/projects");
}

export async function unarchiveProjectAction(formData: FormData) {
  const ownerId = await requireUserId();
  const projectId = text(formData, "projectId");

  const result = await prisma.project.updateMany({
    where: { id: projectId, ownerId },
    data: { status: "ACTIVE" }
  });
  if (result.count === 0) throw new Error("Project not found.");

  await logAudit(ownerId, "project.unarchived", "Project", projectId);
  revalidatePath("/");
  revalidatePath("/projects");
  revalidateAppData();
  redirect(`/projects/${projectId}`);
}

export async function deleteProjectAction(formData: FormData) {
  const ownerId = await requireUserId();
  const projectId = text(formData, "projectId");
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId }, select: { id: true } });

  if (!project) throw new Error("Project not found.");

  await prisma.$transaction(async (tx) => {
    const [invoiceCount, billedTimeCount, billedExpenseCount] = await Promise.all([
      tx.invoice.count({ where: { projectId, ownerId } }),
      tx.timeEntry.count({ where: { projectId, ownerId, billingStatus: "BILLED" } }),
      tx.expenseItem.count({ where: { projectId, ownerId, billingStatus: "BILLED" } })
    ]);

    if (invoiceCount || billedTimeCount || billedExpenseCount) {
      throw new Error("This project has invoice or billed history. Archive it instead of deleting it.");
    }

    await tx.timeEntry.deleteMany({ where: { projectId, ownerId } });
    await tx.expenseItem.deleteMany({ where: { projectId, ownerId } });
    await tx.rateHistory.deleteMany({ where: { projectId, ownerId } });
    await tx.project.deleteMany({ where: { id: projectId, ownerId } });
  });

  await logAudit(ownerId, "project.deleted", "Project", projectId);
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/invoices");
  revalidateAppData();
  redirect("/projects");
}

export async function deleteClientAction(formData: FormData) {
  const ownerId = await requireUserId();
  const clientId = text(formData, "clientId");
  const client = await prisma.client.findFirst({
    where: { id: clientId, ownerId },
    select: { id: true }
  });

  if (!client) throw new Error("Client not found.");

  await prisma.$transaction(async (tx) => {
    const projects = await tx.project.findMany({
      where: { clientId, ownerId },
      select: { id: true }
    });
    const projectIds = projects.map((project) => project.id);

    const [invoiceCount, billedTimeCount, billedExpenseCount] = await Promise.all([
      tx.invoice.count({
        where: {
          ownerId,
          OR: [{ clientId }, { projectId: { in: projectIds } }]
        }
      }),
      tx.timeEntry.count({ where: { ownerId, projectId: { in: projectIds }, billingStatus: "BILLED" } }),
      tx.expenseItem.count({ where: { ownerId, projectId: { in: projectIds }, billingStatus: "BILLED" } })
    ]);

    if (invoiceCount || billedTimeCount || billedExpenseCount) {
      throw new Error("This client has invoice or billed history. Archive their projects instead of deleting the client.");
    }

    await tx.timeEntry.deleteMany({
      where: { ownerId, projectId: { in: projectIds } }
    });
    await tx.expenseItem.deleteMany({
      where: { ownerId, projectId: { in: projectIds } }
    });
    await tx.rateHistory.deleteMany({
      where: { ownerId, projectId: { in: projectIds } }
    });
    await tx.project.deleteMany({
      where: { ownerId, id: { in: projectIds } }
    });
    await tx.client.deleteMany({ where: { id: clientId, ownerId } });
  });

  await logAudit(ownerId, "client.deleted", "Client", clientId);
  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/projects");
  revalidatePath("/invoices");
  revalidatePath("/hours-export");
  revalidateAppData();
  redirect("/clients");
}

async function nextInvoiceNumber(ownerId: string, prefix: string) {
  const year = new Date().getUTCFullYear();
  const count = await prisma.invoice.count({
    where: { ownerId, invoiceNumber: { startsWith: `${prefix}${year}-` } }
  });

  return `${prefix}${year}-${String(count + 1).padStart(4, "0")}`;
}

function invoiceModeFromForm(formData: FormData): InvoiceMode {
  return text(formData, "invoiceMode") === "SIMPLE" ? "SIMPLE" : "DETAILED";
}

function snapshotValue(frozen: boolean, frozenValue: string | null | undefined, liveValue: string | null | undefined) {
  return frozen ? frozenValue ?? liveValue ?? null : liveValue ?? null;
}

function invoiceBusinessDetails(
  invoice: {
    status: "DRAFT" | "SENT" | "PAID" | "VOID";
    businessNameSnapshot: string | null;
    businessLegalNameSnapshot: string | null;
    businessAbnSnapshot: string | null;
    businessContactNameSnapshot: string | null;
    businessEmailSnapshot: string | null;
    businessPhoneSnapshot: string | null;
    businessAddressSnapshot: string | null;
    businessWebsiteSnapshot: string | null;
    businessBankAccountNameSnapshot: string | null;
    businessBsbSnapshot: string | null;
    businessAccountNumberSnapshot: string | null;
    businessGstRegisteredSnapshot: boolean;
    businessGstRateSnapshot: unknown;
    businessLogoPathSnapshot: string | null;
    businessDefaultInvoiceNotesSnapshot: string | null;
    businessDefaultInvoiceEmailMessageSnapshot: string | null;
    businessSignatureFooterSnapshot: string | null;
  },
  profile: {
    tradingName: string;
    legalName: string | null;
    abn: string | null;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    website: string | null;
    bankAccountName: string | null;
    bsb: string | null;
    accountNumber: string | null;
    gstRegistered: boolean;
    gstRate: unknown;
    logoPath: string | null;
    defaultInvoiceNotes: string | null;
    defaultInvoiceEmailMessage: string | null;
    signatureFooter: string | null;
  } | null
): InvoiceBusinessDetails {
  const frozen = invoice.status !== "DRAFT";

  return {
    name: snapshotValue(frozen, invoice.businessNameSnapshot, profile?.tradingName) ?? "Business profile not set",
    legalName: snapshotValue(frozen, invoice.businessLegalNameSnapshot, profile?.legalName),
    contactName: snapshotValue(frozen, invoice.businessContactNameSnapshot, profile?.contactName),
    abn: snapshotValue(frozen, invoice.businessAbnSnapshot, profile?.abn),
    email: snapshotValue(frozen, invoice.businessEmailSnapshot, profile?.email),
    phone: snapshotValue(frozen, invoice.businessPhoneSnapshot, profile?.phone),
    address: snapshotValue(frozen, invoice.businessAddressSnapshot, profile?.address),
    website: snapshotValue(frozen, invoice.businessWebsiteSnapshot, profile?.website),
    bankAccountName: snapshotValue(frozen, invoice.businessBankAccountNameSnapshot, profile?.bankAccountName),
    bsb: snapshotValue(frozen, invoice.businessBsbSnapshot, profile?.bsb),
    accountNumber: snapshotValue(frozen, invoice.businessAccountNumberSnapshot, profile?.accountNumber),
    gstRegistered: (frozen ? invoice.businessGstRegisteredSnapshot : null) ?? profile?.gstRegistered ?? false,
    gstRate: Number((frozen ? invoice.businessGstRateSnapshot : null) ?? profile?.gstRate ?? 0),
    logoPath: snapshotValue(frozen, invoice.businessLogoPathSnapshot, profile?.logoPath),
    defaultInvoiceNotes: snapshotValue(frozen, invoice.businessDefaultInvoiceNotesSnapshot, profile?.defaultInvoiceNotes),
    defaultInvoiceEmailMessage: snapshotValue(frozen, invoice.businessDefaultInvoiceEmailMessageSnapshot, profile?.defaultInvoiceEmailMessage),
    signatureFooter: snapshotValue(frozen, invoice.businessSignatureFooterSnapshot, profile?.signatureFooter)
  };
}

function invoiceClientDetails(
  invoice: {
    status: "DRAFT" | "SENT" | "PAID" | "VOID";
    clientBusinessNameSnapshot: string | null;
    clientContactNameSnapshot: string | null;
    clientEmailSnapshot: string | null;
    clientPhoneSnapshot: string | null;
    clientAddressSnapshot: string | null;
    clientAbnSnapshot: string | null;
    client: {
      businessName: string;
      contactName: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      abn: string | null;
    };
  }
): InvoiceClientDetails {
  const frozen = invoice.status !== "DRAFT";

  return {
    businessName: snapshotValue(frozen, invoice.clientBusinessNameSnapshot, invoice.client.businessName) ?? invoice.client.businessName,
    contactName: snapshotValue(frozen, invoice.clientContactNameSnapshot, invoice.client.contactName),
    email: snapshotValue(frozen, invoice.clientEmailSnapshot, invoice.client.email),
    phone: snapshotValue(frozen, invoice.clientPhoneSnapshot, invoice.client.phone),
    address: snapshotValue(frozen, invoice.clientAddressSnapshot, invoice.client.address),
    abn: snapshotValue(frozen, invoice.clientAbnSnapshot, invoice.client.abn)
  };
}

function invoiceTemplateValues(invoice: InvoiceDocumentData, business: InvoiceBusinessDetails, client: InvoiceClientDetails) {
  const formattedDueDate = formatDateAU(invoiceDueDate(invoice));
  const formattedTotal = formatMoney(invoice.grandTotalCents);

  return {
    invoiceNumber: invoice.invoiceNumber,
    businessName: business.name,
    clientName: client.contactName || client.businessName,
    clientBusinessName: client.businessName,
    projectTitle: invoice.project.title,
    projectName: invoice.project.title,
    total: formattedTotal,
    totalDue: formattedTotal,
    dueDate: formattedDueDate
  };
}

function criticalInvoiceProfileIssues(
  profile: {
    tradingName: string;
    abn: string | null;
    gstRegistered: boolean;
    bankAccountName: string | null;
    bsb: string | null;
    accountNumber: string | null;
  } | null
) {
  if (!profile) return ["Business profile is missing."];

  return [
    !profile.tradingName ? "Business trading name is missing." : "",
    profile.gstRegistered && !profile.abn ? "GST is enabled but ABN is missing." : "",
    !profile.bankAccountName || !profile.bsb || !profile.accountNumber ? "Bank payment details are incomplete." : ""
  ].filter(Boolean);
}

export async function createInvoiceDraftAction(formData: FormData) {
  const ownerId = await requireUserId();
  const projectId = text(formData, "projectId");
  const start = parseInputDate(formData.get("dateRangeStart"));
  const end = endOfDay(parseInputDate(formData.get("dateRangeEnd")));
  const mode = invoiceModeFromForm(formData);

  if (end < start) {
    throw new Error("End date must be after start date.");
  }

  const [project, profile] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, ownerId },
      select: { id: true, clientId: true, client: true }
    }),
    prisma.businessProfile.findUnique({ where: { ownerId } })
  ]);
  if (!project) throw new Error("Project not found.");

  const [entries, expenses] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        projectId,
        ownerId,
        billingStatus: "UNBILLED",
        date: { gte: start, lte: end }
      },
      select: { id: true, date: true, durationMinutes: true, notes: true, hourlyRateCentsSnapshot: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }]
    }),
    prisma.expenseItem.findMany({
      where: {
        projectId,
        ownerId,
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

  const paymentTermsDays = profile?.paymentTermsDays ?? 14;
  const gstRate = profile ? Number(profile.gstRate) : 0;
  const totals = invoiceTotals(entries, expenses, {
    registered: profile?.gstRegistered ?? false,
    rate: gstRate
  });
  const invoiceDate = new Date();
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: await nextInvoiceNumber(ownerId, profile?.invoicePrefix || "INV-"),
      projectId,
      clientId: project.clientId,
      ownerId,
      invoiceDate,
      dueDate: addDays(invoiceDate, paymentTermsDays),
      paymentTermsDays,
      dateRangeStart: start,
      dateRangeEnd: parseInputDate(formData.get("dateRangeEnd")),
      status: "DRAFT",
      mode,
      totalHours: totals.totalHours,
      totalDurationMinutes: totals.totalDurationMinutes,
      subtotalCents: totals.subtotalCents,
      expensesSubtotalCents: totals.expensesSubtotalCents,
      gstCents: totals.gstCents,
      labourTotalCents: totals.labourTotalCents,
      itemTotalCents: totals.itemTotalCents,
      grandTotalCents: totals.grandTotalCents,
      summary: summaryText(entries, expenses),
      lineItems: {
        create: buildInvoiceLineData(entries, expenses).map((line) => ({ ...line, ownerId }))
      }
    }
  });

  await logAudit(ownerId, "invoice.draft_created", "Invoice", invoice.id, {
    invoiceNumber: invoice.invoiceNumber,
    mode
  });
  revalidatePath("/invoices");
  revalidateAppData();
  redirect(`/invoices/${invoice.id}`);
}

async function finaliseInvoice(ownerId: string, invoiceId: string, status: "SENT" | "PAID", confirmedIncomplete: boolean) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lineItems: true,
      project: { select: { client: true } }
    }
  });

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.ownerId !== ownerId) throw new Error("Invoice not found.");
  if (invoice.status === "VOID") throw new Error("Void invoices cannot be finalised.");
  if (invoice.status === "PAID") throw new Error("Invoice is already paid.");

  if (invoice.status === "SENT") {
    if (status !== "PAID") throw new Error("Sent invoices cannot be resent.");
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", paymentDate: new Date() }
    });
    await logAudit(ownerId, "invoice.marked_paid", "Invoice", invoiceId, { fromStatus: "SENT" });
    return;
  }

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
            ownerId,
            id: { in: timeEntryIds },
            billingStatus: "BILLED",
            invoiceId: { not: invoiceId }
          }
        })
      : 0,
    expenseItemIds.length
      ? prisma.expenseItem.count({
          where: {
            ownerId,
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

  const profile = await prisma.businessProfile.findUnique({ where: { ownerId } });
  const profileIssues = criticalInvoiceProfileIssues(profile);
  if (profileIssues.length && !confirmedIncomplete) {
    throw new Error(`Invoice is missing important business details: ${profileIssues.join(" ")}`);
  }

  const client = invoice.project.client;
  const labourSubtotalCents = invoice.lineItems
    .filter((line) => line.type === "LABOUR")
    .reduce((sum, line) => sum + line.totalAmountCents, 0);
  const expensesSubtotalCents = invoice.lineItems
    .filter((line) => line.type === "EXPENSE")
    .reduce((sum, line) => sum + line.totalAmountCents, 0);
  const totalDurationMinutes = invoice.lineItems.reduce((sum, line) => sum + (line.hoursMinutes ?? 0), 0);
  const subtotalCents = labourSubtotalCents + expensesSubtotalCents;
  const gstRate = profile ? Number(profile.gstRate) : Number(invoice.businessGstRateSnapshot);
  const gstRegistered = profile?.gstRegistered ?? invoice.businessGstRegisteredSnapshot;
  const gstCents = gstRegistered ? Math.round(subtotalCents * (gstRate / 100)) : 0;
  const paymentTermsDays = profile?.paymentTermsDays ?? invoice.paymentTermsDays;
  const invoiceDate = invoice.invoiceDate;

  await prisma.$transaction([
    prisma.timeEntry.updateMany({
      where: { ownerId, id: { in: timeEntryIds } },
      data: { billingStatus: "BILLED", invoiceId }
    }),
    prisma.expenseItem.updateMany({
      where: { ownerId, id: { in: expenseItemIds } },
      data: { billingStatus: "BILLED", invoiceId }
    }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status,
        dueDate: invoice.dueDate ?? addDays(invoiceDate, paymentTermsDays),
        paymentTermsDays,
        totalHours: totalDurationMinutes / 60,
        totalDurationMinutes,
        labourTotalCents: labourSubtotalCents,
        itemTotalCents: expensesSubtotalCents,
        subtotalCents,
        expensesSubtotalCents,
        gstCents,
        grandTotalCents: subtotalCents + gstCents,
        businessNameSnapshot: profile?.tradingName ?? null,
        businessLegalNameSnapshot: profile?.legalName ?? null,
        businessAbnSnapshot: profile?.abn ?? null,
        businessContactNameSnapshot: profile?.contactName ?? null,
        businessEmailSnapshot: profile?.email ?? null,
        businessPhoneSnapshot: profile?.phone ?? null,
        businessAddressSnapshot: profile?.address ?? null,
        businessWebsiteSnapshot: profile?.website ?? null,
        businessBankAccountNameSnapshot: profile?.bankAccountName ?? null,
        businessBsbSnapshot: profile?.bsb ?? null,
        businessAccountNumberSnapshot: profile?.accountNumber ?? null,
        businessGstRegisteredSnapshot: profile?.gstRegistered ?? false,
        businessGstRateSnapshot: profile?.gstRate ?? 0,
        businessLogoPathSnapshot: profile?.logoPath ?? null,
        businessDefaultInvoiceNotesSnapshot: profile?.defaultInvoiceNotes ?? null,
        businessDefaultInvoiceEmailMessageSnapshot: profile?.defaultInvoiceEmailMessage ?? null,
        businessSignatureFooterSnapshot: profile?.signatureFooter ?? null,
        clientBusinessNameSnapshot: client.businessName,
        clientContactNameSnapshot: client.contactName,
        clientEmailSnapshot: client.email,
        clientPhoneSnapshot: client.phone,
        clientAddressSnapshot: client.address,
        clientAbnSnapshot: client.abn,
        paymentDate: status === "PAID" ? new Date() : invoice.paymentDate
      }
    })
  ]);

  await logAudit(ownerId, status === "PAID" ? "invoice.marked_paid" : "invoice.finalised_sent", "Invoice", invoiceId, {
    invoiceNumber: invoice.invoiceNumber,
    mode: invoice.mode
  });
}

export async function markInvoiceSentAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  await finaliseInvoice(ownerId, invoiceId, "SENT", text(formData, "confirmIncomplete") === "on");
  revalidatePath("/invoices");
  revalidateAppData();
  redirect(`/invoices/${invoiceId}`);
}

export async function markInvoicePaidAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  await finaliseInvoice(ownerId, invoiceId, "PAID", text(formData, "confirmIncomplete") === "on");
  revalidatePath("/");
  revalidatePath("/invoices");
  revalidateAppData();
  redirect(`/invoices/${invoiceId}`);
}

export async function voidInvoiceAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true }
  });

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.ownerId !== ownerId) throw new Error("Invoice not found.");

  const timeEntryIds = invoice.lineItems
    .map((line) => line.timeEntryId)
    .filter((id): id is string => Boolean(id));
  const expenseItemIds = invoice.lineItems
    .map((line) => line.expenseItemId)
    .filter((id): id is string => Boolean(id));

  await prisma.$transaction([
    prisma.timeEntry.updateMany({
      where: { ownerId, id: { in: timeEntryIds }, invoiceId },
      data: { billingStatus: "UNBILLED", invoiceId: null }
    }),
    prisma.expenseItem.updateMany({
      where: { ownerId, id: { in: expenseItemIds }, invoiceId },
      data: { billingStatus: "UNBILLED", invoiceId: null }
    }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "VOID", paymentDate: null, publicTokenEnabled: false }
    })
  ]);

  await logAudit(ownerId, "invoice.voided", "Invoice", invoiceId, { invoiceNumber: invoice.invoiceNumber });
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/invoices");
  if (invoice.publicToken) revalidatePath(`/public/invoices/${invoice.publicToken}`);
  revalidateAppData();
  redirect(`/invoices/${invoiceId}`);
}

export async function unvoidInvoiceAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, ownerId } });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status !== "VOID") throw new Error("Only void invoices can be restored.");

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "DRAFT", paymentDate: null }
  });

  await logAudit(ownerId, "invoice.unvoided", "Invoice", invoiceId, { invoiceNumber: invoice.invoiceNumber });
  revalidatePath("/");
  revalidatePath("/invoices");
  revalidateAppData();
  redirect(`/invoices/${invoiceId}`);
}

export async function deleteInvoiceAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true }
  });

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.ownerId !== ownerId) throw new Error("Invoice not found.");

  const timeEntryIds = invoice.lineItems
    .map((line) => line.timeEntryId)
    .filter((id): id is string => Boolean(id));
  const expenseItemIds = invoice.lineItems
    .map((line) => line.expenseItemId)
    .filter((id): id is string => Boolean(id));

  await prisma.$transaction([
    prisma.timeEntry.updateMany({
      where: { ownerId, id: { in: timeEntryIds }, invoiceId },
      data: { billingStatus: "UNBILLED", invoiceId: null }
    }),
    prisma.expenseItem.updateMany({
      where: { ownerId, id: { in: expenseItemIds }, invoiceId },
      data: { billingStatus: "UNBILLED", invoiceId: null }
    }),
    prisma.invoice.delete({ where: { id: invoiceId } })
  ]);

  await logAudit(ownerId, "invoice.deleted", "Invoice", invoiceId, { invoiceNumber: invoice.invoiceNumber });
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/invoices");
  if (invoice.publicToken) revalidatePath(`/public/invoices/${invoice.publicToken}`);
  revalidateAppData();
  redirect("/invoices");
}

function assertInvoiceCanBeShared(status: "DRAFT" | "SENT" | "PAID" | "VOID") {
  if (status === "DRAFT") throw new Error("Mark the invoice as sent before creating a client link.");
  if (status === "VOID") throw new Error("Void invoices cannot be shared.");
}

async function loadOwnedInvoiceForSharing(ownerId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, ownerId },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      publicToken: true,
      publicTokenEnabled: true
    }
  });
  if (!invoice) throw new Error("Invoice not found.");
  return invoice;
}

export async function enableInvoicePublicLinkAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  const invoice = await loadOwnedInvoiceForSharing(ownerId, invoiceId);
  assertInvoiceCanBeShared(invoice.status);

  const token = invoice.publicToken ?? (await generateUniqueInvoiceToken());
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { publicToken: token, publicTokenEnabled: true }
  });

  await logAudit(ownerId, "invoice.public_link_enabled", "Invoice", invoiceId, {
    invoiceNumber: invoice.invoiceNumber,
    regenerated: !invoice.publicToken
  });
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/public/invoices/${token}`);
  redirect(`/invoices/${invoiceId}`);
}

export async function revokeInvoicePublicLinkAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  const invoice = await loadOwnedInvoiceForSharing(ownerId, invoiceId);

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { publicTokenEnabled: false }
  });

  await logAudit(ownerId, "invoice.public_link_revoked", "Invoice", invoiceId, {
    invoiceNumber: invoice.invoiceNumber
  });
  revalidatePath(`/invoices/${invoiceId}`);
  if (invoice.publicToken) revalidatePath(`/public/invoices/${invoice.publicToken}`);
  redirect(`/invoices/${invoiceId}`);
}

export async function regenerateInvoicePublicLinkAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  const invoice = await loadOwnedInvoiceForSharing(ownerId, invoiceId);
  assertInvoiceCanBeShared(invoice.status);

  const token = await generateUniqueInvoiceToken();
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { publicToken: token, publicTokenEnabled: true }
  });

  await logAudit(ownerId, "invoice.public_link_regenerated", "Invoice", invoiceId, {
    invoiceNumber: invoice.invoiceNumber
  });
  revalidatePath(`/invoices/${invoiceId}`);
  if (invoice.publicToken) revalidatePath(`/public/invoices/${invoice.publicToken}`);
  revalidatePath(`/public/invoices/${token}`);
  redirect(`/invoices/${invoiceId}`);
}

export async function sendInvoiceEmailAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  const includePublicLink = text(formData, "includePublicLink") === "on";

  const [invoice, profile] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id: invoiceId, ownerId },
      include: {
        project: { select: { title: true } },
        client: true,
        lineItems: { orderBy: { sortOrder: "asc" } }
      }
    }),
    prisma.businessProfile.findUnique({ where: { ownerId } })
  ]);

  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "DRAFT") throw new Error("Mark the invoice as sent before emailing it.");
  if (invoice.status === "VOID") throw new Error("Void invoices cannot be emailed.");

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");

  const business = invoiceBusinessDetails(invoice, profile);
  const client = invoiceClientDetails(invoice);
  const defaultTo = client.email ?? invoice.client.email ?? "";
  const to = parseEmailList(text(formData, "to") || defaultTo, "To", true);
  const cc = parseEmailList(text(formData, "cc"), "CC");
  const bcc = parseEmailList(text(formData, "bcc"), "BCC");
  const replyTo = profile?.replyToEmail || profile?.email || business.email;
  if (replyTo && !EMAIL_RE.test(replyTo)) throw new Error("Configured reply-to email is invalid.");

  let publicToken = invoice.publicToken;
  const hadPublicTokenBeforeSend = Boolean(invoice.publicToken);
  const publicLinkEnabledBeforeSend = invoice.publicTokenEnabled;
  let publicUrl: string | null = null;

  if (includePublicLink) {
    assertInvoiceCanBeShared(invoice.status);
    if (!publicToken) publicToken = await generateUniqueInvoiceToken();
    publicUrl = invoicePublicUrl(publicToken);
    if (!publicUrl) throw new Error("APP_BASE_URL is required to include a public invoice link.");

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { publicToken, publicTokenEnabled: true }
    });
  }

  const templateValues = invoiceTemplateValues(invoice, business, client);
  const subjectInput = text(formData, "subject") || defaultInvoiceEmailSubject(invoice, business);
  const bodyInput = text(formData, "message") || profile?.defaultInvoiceEmailBody || business.defaultInvoiceEmailMessage || defaultInvoiceEmailBody(invoice, business, client);
  const subject = renderTemplate(subjectInput, templateValues).trim();
  const message = renderTemplate(bodyInput, templateValues).trim();
  if (!subject) throw new Error("Email subject is required.");
  if (!message) throw new Error("Email message is required.");

  const html = buildInvoiceEmailHtml({ invoice, business, client, message, publicUrl });
  const plainText = [message, "", buildInvoicePlainText({ invoice, business, client, publicUrl })].join("\n");

  await logAudit(ownerId, "invoice.email_attempted", "Invoice", invoiceId, {
    invoiceNumber: invoice.invoiceNumber,
    to: to.join(", "),
    ccCount: cc.length,
    bccCount: bcc.length,
    includePublicLink
  });

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: senderAddress(business.name),
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      replyTo: replyTo || undefined,
      subject,
      html,
      text: plainText
    });

    if (error) {
      throw new Error(error.message || "Email provider rejected the message.");
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        lastEmailedAt: new Date(),
        emailSendCount: { increment: 1 },
        ...(publicToken && includePublicLink ? { publicToken, publicTokenEnabled: true } : {})
      }
    });

    await logAudit(ownerId, "invoice.email_sent", "Invoice", invoiceId, {
      invoiceNumber: invoice.invoiceNumber,
      provider: "resend",
      providerId: data?.id ?? null,
      to: to.join(", "),
      ccCount: cc.length,
      bccCount: bcc.length,
      includePublicLink
    });
  } catch (error) {
    if (includePublicLink && publicToken && !publicLinkEnabledBeforeSend) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { publicToken: hadPublicTokenBeforeSend ? publicToken : null, publicTokenEnabled: false }
      });
    }
    await logAudit(ownerId, "invoice.email_failed", "Invoice", invoiceId, {
      invoiceNumber: invoice.invoiceNumber,
      reason: error instanceof Error ? error.message.slice(0, 180) : "Unknown error"
    });
    throw error;
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  if (publicToken) revalidatePath(`/public/invoices/${publicToken}`);
  redirect(`/invoices/${invoiceId}/email?sent=1`);
}
