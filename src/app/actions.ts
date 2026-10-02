"use server";
import { UserInputError } from "@/lib/form-feedback";


import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import type { InvoiceMode, WorkExpenseCategory, WorkExpenseStatus } from "@prisma/client";
import { revalidatePath, revalidateTag } from "@/lib/deferred-revalidation";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { CACHE_TAGS, loadProjectControlSummary } from "@/lib/app-data";
import { dollarsToCents } from "@/lib/money";
import { addDays, endOfDay, parseInputDate, todayInPerth } from "@/lib/dates";
import { expenseCategoryOptions, expenseStatusOptions } from "@/lib/expenses";
import { nextInvoiceNumberFromExisting } from "@/lib/invoice-numbers";
import { canShareInvoicePublicly } from "@/lib/invoice-sharing";
import { buildInvoiceLineData, invoiceTotals, summaryText } from "@/lib/invoices";
import { sendInvoiceMmsWithPdf, sendPreparedInvoiceEmailWithPdf } from "@/lib/invoice-delivery";
import { isQuarterHour, isQuarterHourClock, parseClockTime } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath, withInternalPathParams } from "@/lib/navigation";
import { projectCloseoutReadiness } from "@/lib/project-control";
import { billingTransaction } from "@/lib/billing-transaction";
import { syncProjectDrafts } from "@/lib/invoice-draft-sync";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function positive(value: number, message: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new UserInputError(message);
  }
}

function optionalPositiveCents(formData: FormData, key: string) {
  const raw = text(formData, key);
  return raw ? dollarsToCents(raw) : null;
}

function optionalInt(formData: FormData, key: string, fallback: number) {
  const raw = text(formData, key);
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) throw new UserInputError(`${key} must be a valid whole number.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new UserInputError(`${key} must be a valid whole number.`);
  return value;
}

function optionalDecimal(formData: FormData, key: string, fallback: number) {
  const raw = text(formData, key);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new UserInputError(`${key} must be a valid number.`);
  return value;
}

function optionalPercentage(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new UserInputError(`${key} must be between 0 and 100.`);
  }
  return value;
}

function returnTo(formData: FormData) {
  return safeInternalPath(text(formData, "returnTo"));
}

function workEntryReturnTo(formData: FormData, mode: "time" | "item") {
  const destination = returnTo(formData);
  const params: Record<string, string> = { workSaved: mode };
  if (text(formData, "continueLogging") === "1") params.logWork = mode;
  return withInternalPathParams(destination, params);
}

function revalidateAppData() {
  for (const tag of Object.values(CACHE_TAGS)) {
    revalidateTag(tag);
  }
}

function revalidateDataTags(...tags: Array<(typeof CACHE_TAGS)[keyof typeof CACHE_TAGS]>) {
  for (const tag of tags) revalidateTag(tag);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function saveOnboardingSetupAction(formData: FormData) {
  const ownerId = await requireUserId();
  const businessStructure = text(formData, "businessStructure");
  const tradingName = text(formData, "tradingName");
  const contactName = text(formData, "contactName");
  const invoicePrefix = text(formData, "invoicePrefix") || "INV-";
  const paymentTermsDays = optionalInt(formData, "paymentTermsDays", 14);
  const defaultHourlyRateCents = optionalPositiveCents(formData, "defaultHourlyRate");

  if (businessStructure !== "SOLE_TRADER" && businessStructure !== "EMPLOYER") {
    throw new UserInputError("Choose whether you work independently or have people working for you.");
  }
  if (!tradingName) throw new UserInputError("Business or trading name is required.");
  if (!contactName) throw new UserInputError("Your name is required.");
  if (!defaultHourlyRateCents) throw new UserInputError("Enter your usual hourly charge rate.");
  if (invoicePrefix.length > 16) throw new UserInputError("Invoice prefix must be 16 characters or fewer.");
  if (paymentTermsDays < 1 || paymentTermsDays > 90) throw new UserInputError("Payment terms must be between 1 and 90 days.");

  await prisma.businessProfile.upsert({
    where: { ownerId },
    create: {
      ownerId,
      tradingName,
      contactName,
      invoicePrefix,
      defaultHourlyRateCents,
      paymentTermsDays,
      gstRegistered: text(formData, "gstRegistered") === "on",
      businessStructure
    },
    update: {
      tradingName,
      contactName,
      invoicePrefix,
      defaultHourlyRateCents,
      paymentTermsDays,
      gstRegistered: text(formData, "gstRegistered") === "on",
      businessStructure
    }
  });

  revalidatePath("/");
  revalidatePath("/business-profile");
  revalidatePath("/settings");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.profile);
  redirect("/onboarding/progress");
}

export async function finishOnboardingAction() {
  const ownerId = await requireUserId();
  const [clientCount, projectCount, timeEntryCount, invoiceCount] = await Promise.all([
    prisma.client.count({ where: { ownerId } }),
    prisma.project.count({ where: { ownerId } }),
    prisma.timeEntry.count({ where: { ownerId } }),
    prisma.invoice.count({ where: { ownerId } })
  ]);

  if (!clientCount || !projectCount || !timeEntryCount || !invoiceCount) {
    redirect("/onboarding/progress");
  }

  await prisma.$transaction([
    prisma.businessProfile.update({
      where: { ownerId },
      data: { onboardingCompletedAt: new Date() }
    }),
    prisma.tutorialProgress.upsert({
      where: { ownerId_tutorialKey: { ownerId, tutorialKey: "workflow-overview" } },
      create: {
        ownerId,
        tutorialKey: "workflow-overview",
        status: "COMPLETED",
        currentStep: 3,
        completedAt: new Date()
      },
      update: {
        status: "COMPLETED",
        currentStep: 3,
        completedAt: new Date()
      }
    })
  ]);

  revalidatePath("/");
  revalidatePath("/onboarding");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.profile);
  redirect("/?onboarding=complete");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmailList(value: string, label: string, required = false) {
  const emails = value
    .split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean);

  if (required && emails.length === 0) throw new UserInputError(`${label} email is required.`);

  for (const email of emails) {
    if (!EMAIL_RE.test(email)) throw new UserInputError(`${label} contains an invalid email address.`);
  }

  return emails;
}

function validateOptionalEmail(value: string) {
  if (value && !EMAIL_RE.test(value)) throw new UserInputError("Enter a valid email address.");
}

async function generateUniqueInvoiceToken() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = crypto.randomBytes(32).toString("base64url");
    const existing = await prisma.invoice.findUnique({ where: { publicToken: token }, select: { id: true } });
    if (!existing) return token;
  }

  throw new UserInputError("Could not generate a public invoice link. Please try again.");
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function validateBusinessProfileInput(formData: FormData, gstRegistered: boolean) {
  const invoicePrefix = text(formData, "invoicePrefix");
  if (!invoicePrefix) throw new UserInputError("Invoice prefix is required.");
  if (invoicePrefix.length > 16) throw new UserInputError("Invoice prefix must be 16 characters or fewer.");

  const abn = digitsOnly(text(formData, "abn"));
  if (abn && abn.length !== 11) throw new UserInputError("ABN must be 11 digits.");

  const acn = digitsOnly(text(formData, "acn"));
  if (acn && acn.length !== 9) throw new UserInputError("ACN must be 9 digits.");

  const email = text(formData, "email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserInputError("Enter a valid email address.");

  const replyToEmail = text(formData, "replyToEmail");
  if (replyToEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyToEmail)) {
    throw new UserInputError("Enter a valid reply-to email address.");
  }

  const bsb = digitsOnly(text(formData, "bsb"));
  if (bsb && bsb.length !== 6) throw new UserInputError("BSB must be 6 digits.");

  const accountNumber = digitsOnly(text(formData, "accountNumber"));
  if (accountNumber && (accountNumber.length < 5 || accountNumber.length > 12)) {
    throw new UserInputError("Account number must be 5 to 12 digits.");
  }

  const gstRate = gstRegistered ? optionalDecimal(formData, "gstRate", 10) : 0;
  if (gstRate > 100) throw new UserInputError("GST rate must be between 0 and 100.");

  return { invoicePrefix, gstRate };
}

export async function updateBusinessProfileAction(formData: FormData) {
  const ownerId = await requireUserId();
  const tradingName = text(formData, "tradingName");
  if (!tradingName) throw new UserInputError("Trading/business name is required.");

  const gstRegistered = text(formData, "gstRegistered") === "on";
  const { invoicePrefix, gstRate } = validateBusinessProfileInput(formData, gstRegistered);
  const defaultInvoiceEmailBody = text(formData, "defaultInvoiceEmailBody") || text(formData, "defaultInvoiceBody") || null;
  const defaultInvoiceBody = text(formData, "defaultInvoiceBody") || defaultInvoiceEmailBody;
  const includePaymentDetailsInEmail = text(formData, "includePaymentDetailsInEmail") === "on";
  const includeInvoiceSummaryInEmail = text(formData, "includeInvoiceSummaryInEmail") === "on";
  const includePublicInvoiceLinkInEmail = text(formData, "includePublicInvoiceLinkInEmail") === "on";

  const existing = await prisma.businessProfile.findUnique({ where: { ownerId } });
  const legacyDefaultInvoiceEmailMessage = text(formData, "defaultInvoiceEmailMessage") || defaultInvoiceEmailBody || existing?.defaultInvoiceEmailMessage || null;
  const legacyDefaultInvoiceEmailBody = defaultInvoiceEmailBody || existing?.defaultInvoiceEmailBody || null;
  const legacyDefaultInvoiceGreeting = text(formData, "defaultInvoiceGreeting") || existing?.defaultInvoiceGreeting || null;
  const legacyDefaultInvoiceBody = defaultInvoiceBody || existing?.defaultInvoiceBody || null;
  const legacyDefaultInvoiceSignOff = text(formData, "defaultInvoiceSignOff") || existing?.defaultInvoiceSignOff || null;
  const legacyDefaultInvoiceFooter = text(formData, "defaultInvoiceFooter") || existing?.defaultInvoiceFooter || null;
  let logoPath = existing?.logoPath ?? null;
  const removeLogo = text(formData, "removeLogo") === "on";
  const submittedLogoPath = text(formData, "logoPath");

  if (submittedLogoPath) {
    if (!submittedLogoPath.startsWith(`${ownerId}/`)) {
      throw new UserInputError("Logo path is invalid.");
    }
    if (!/\.(png|jpg|jpeg|webp|svg)$/i.test(submittedLogoPath)) {
      throw new UserInputError("Logo must be PNG, JPG, WEBP, or SVG.");
    }
    logoPath = submittedLogoPath;
  }

  if (removeLogo) {
    logoPath = null;
  }

  await prisma.businessProfile.upsert({
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
      defaultInvoiceEmailMessage: legacyDefaultInvoiceEmailMessage,
      defaultInvoiceEmailSubjectTemplate: text(formData, "defaultInvoiceEmailSubjectTemplate") || null,
      defaultInvoiceEmailBody: legacyDefaultInvoiceEmailBody,
      defaultInvoiceGreeting: legacyDefaultInvoiceGreeting,
      defaultInvoiceBody: legacyDefaultInvoiceBody,
      defaultInvoiceSignOff: legacyDefaultInvoiceSignOff,
      defaultInvoiceFooter: legacyDefaultInvoiceFooter,
      defaultEmailGreeting: text(formData, "defaultEmailGreeting") || null,
      defaultEmailIntro: text(formData, "defaultEmailIntro") || null,
      defaultEmailPaymentLine: text(formData, "defaultEmailPaymentLine") || null,
      defaultEmailSignOff: text(formData, "defaultEmailSignOff") || null,
      includePaymentDetailsInEmail,
      includeInvoiceSummaryInEmail,
      includePublicInvoiceLinkInEmail,
      replyToEmail: text(formData, "replyToEmail") || null,
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
      defaultInvoiceEmailMessage: legacyDefaultInvoiceEmailMessage,
      defaultInvoiceEmailSubjectTemplate: text(formData, "defaultInvoiceEmailSubjectTemplate") || null,
      defaultInvoiceEmailBody: legacyDefaultInvoiceEmailBody,
      defaultInvoiceGreeting: legacyDefaultInvoiceGreeting,
      defaultInvoiceBody: legacyDefaultInvoiceBody,
      defaultInvoiceSignOff: legacyDefaultInvoiceSignOff,
      defaultInvoiceFooter: legacyDefaultInvoiceFooter,
      defaultEmailGreeting: text(formData, "defaultEmailGreeting") || null,
      defaultEmailIntro: text(formData, "defaultEmailIntro") || null,
      defaultEmailPaymentLine: text(formData, "defaultEmailPaymentLine") || null,
      defaultEmailSignOff: text(formData, "defaultEmailSignOff") || null,
      includePaymentDetailsInEmail,
      includeInvoiceSummaryInEmail,
      includePublicInvoiceLinkInEmail,
      replyToEmail: text(formData, "replyToEmail") || null,
      logoPath,
      signatureFooter: text(formData, "signatureFooter") || null
    }
  });

  if (existing?.logoPath && existing.logoPath !== logoPath && (removeLogo || submittedLogoPath)) {
    const supabase = await createClient();
    await supabase.storage.from("business-logos").remove([existing.logoPath]);
  }

  revalidatePath("/business-profile");
  revalidatePath("/invoices");
  revalidateAppData();
  return { ok: true };
}

export async function updateSettingsAction(formData: FormData) {
  const ownerId = await requireUserId();
  const themeAccent = text(formData, "themeAccent") || "emerald";
  if (!["emerald", "blue", "slate", "amber", "purple"].includes(themeAccent)) {
    throw new UserInputError("Choose one of the available colour themes.");
  }

  const themeMode = text(formData, "themeMode") || "system";
  if (!["system", "light", "dark"].includes(themeMode)) {
    throw new UserInputError("Choose a valid display mode.");
  }

  const customTaxPercentageOverride = optionalPercentage(formData, "customTaxPercentageOverride");
  const superContributionPercentage = optionalDecimal(formData, "superContributionPercentage", 11.5);
  if (superContributionPercentage > 100) throw new UserInputError("Super contribution percentage must be between 0 and 100.");

  const existing = await prisma.businessProfile.findUnique({
    where: { ownerId },
    select: { tradingName: true, invoicePrefix: true }
  });

  await prisma.businessProfile.upsert({
    where: { ownerId },
    create: {
      ownerId,
      tradingName: existing?.tradingName || "My Business",
      invoicePrefix: existing?.invoicePrefix || "INV-",
      taxSetAsideEnabled: text(formData, "taxSetAsideEnabled") === "on",
      customTaxPercentageOverride,
      includeGstInTaxEstimate: text(formData, "includeGstInTaxEstimate") === "on",
      includeSuperInSetAsidePlanning: text(formData, "includeSuperInSetAsidePlanning") === "on",
      superPlanningEnabled: text(formData, "superPlanningEnabled") === "on",
      superContributionPercentage,
      superFundName: text(formData, "superFundName") || null,
      superMemberNumber: text(formData, "superMemberNumber") || null,
      themeAccent,
      themeMode
    },
    update: {
      taxSetAsideEnabled: text(formData, "taxSetAsideEnabled") === "on",
      customTaxPercentageOverride,
      includeGstInTaxEstimate: text(formData, "includeGstInTaxEstimate") === "on",
      includeSuperInSetAsidePlanning: text(formData, "includeSuperInSetAsidePlanning") === "on",
      superPlanningEnabled: text(formData, "superPlanningEnabled") === "on",
      superContributionPercentage,
      superFundName: text(formData, "superFundName") || null,
      superMemberNumber: text(formData, "superMemberNumber") || null,
      themeAccent,
      themeMode
    }
  });

  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/insights");
  revalidateAppData();
  return { ok: true };
}

export async function createTimeEntryAction(formData: FormData) {
  const ownerId = await requireUserId();
  const projectId = text(formData, "projectId");
  const date = parseInputDate(formData.get("date"));
  const notes = text(formData, "notes") || null;
  const mode = text(formData, "entryMode");
  const logDayOff = text(formData, "logDayOff") === "on";

  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId } });
  if (!project || project.status !== "ACTIVE") {
    throw new UserInputError("Choose an active project.");
  }

  if (logDayOff) {
    await prisma.dayOffLog.upsert({
      where: { ownerId_date: { ownerId, date } },
      create: {
        ownerId,
        date,
        reason: "Day off",
        plannedWorkDay: true,
        notes
      },
      update: {
        reason: "Day off",
        plannedWorkDay: true,
        notes
      }
    });

    revalidatePath("/");
    revalidatePath("/insights");
    revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.insights);
    redirect(workEntryReturnTo(formData, "time"));
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
      throw new UserInputError("Enter a valid start and end time.");
    }

    if (!isQuarterHourClock(start) || !isQuarterHourClock(end)) {
      throw new UserInputError("Start and end times must use 15-minute increments.");
    }

    durationMinutes = end - start;
  } else {
    const hours = Number.parseFloat(text(formData, "durationHours"));
    positive(hours, "Hours must be greater than zero.");
    durationMinutes = Math.round(hours * 60);

    if (!isQuarterHour(durationMinutes)) {
      throw new UserInputError("Manual hours must be in 15-minute increments.");
    }
  }

  await prisma.timeEntry.create({
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

  revalidatePath("/");
  revalidatePath("/projects");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.hoursExport, CACHE_TAGS.insights);
  redirect(workEntryReturnTo(formData, "time"));
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
      throw new UserInputError("Enter a valid start and end time.");
    }

    if (!isQuarterHourClock(start) || !isQuarterHourClock(end)) {
      throw new UserInputError("Start and end times must use 15-minute increments.");
    }

    durationMinutes = end - start;
  } else {
    const hours = Number.parseFloat(text(formData, "durationHours"));
    positive(hours, "Hours must be greater than zero.");
    durationMinutes = Math.round(hours * 60);

    if (!isQuarterHour(durationMinutes)) {
      throw new UserInputError("Manual hours must be in 15-minute increments.");
    }
  }

  return { date, startTime, endTime, durationMinutes, notes };
}

export async function updateTimeEntryAction(formData: FormData) {
  const ownerId = await requireUserId();
  const entryId = text(formData, "entryId");
  const projectId = text(formData, "projectId");
  await billingTransaction(async (tx) => {
    const entry = await tx.timeEntry.findUnique({
      where: { id: entryId },
      select: { id: true, projectId: true, billingStatus: true, teamMemberId: true }
    });

    if (!entry || entry.projectId !== projectId) throw new UserInputError("Time entry not found.");
    const project = await tx.project.findFirst({ where: { id: projectId, ownerId }, select: { id: true } });
    if (!project) throw new UserInputError("Time entry not found.");
    if (entry.teamMemberId) throw new UserInputError("Review subcontractor hours from the Team section.");
    if (entry.billingStatus !== "UNBILLED") throw new UserInputError("Billed time entries cannot be edited.");

    await tx.timeEntry.update({
      where: { id: entryId },
      data: timeEntryDataFromForm(formData)
    });
    await syncProjectDrafts(tx, ownerId, projectId);
  });
  revalidatePath("/invoices", "layout");
  revalidateDataTags(CACHE_TAGS.invoices);

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/hours-export");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.hoursExport, CACHE_TAGS.insights);
  redirect(`/projects/${projectId}`);
}

export async function deleteTimeEntryAction(formData: FormData) {
  const ownerId = await requireUserId();
  const entryId = text(formData, "entryId");
  const projectId = text(formData, "projectId");
  await billingTransaction(async (tx) => {
    const entry = await tx.timeEntry.findUnique({
      where: { id: entryId },
      select: { id: true, projectId: true, billingStatus: true, teamMemberId: true }
    });

    if (!entry || entry.projectId !== projectId) throw new UserInputError("Time entry not found.");
    const project = await tx.project.findFirst({ where: { id: projectId, ownerId }, select: { id: true } });
    if (!project) throw new UserInputError("Time entry not found.");
    if (entry.teamMemberId) throw new UserInputError("Review subcontractor hours from the Team section.");
    if (entry.billingStatus !== "UNBILLED") throw new UserInputError("Billed time entries cannot be deleted.");

    await tx.timeEntry.delete({ where: { id: entryId } });
    await syncProjectDrafts(tx, ownerId, projectId);
  });
  revalidatePath("/invoices", "layout");
  revalidateDataTags(CACHE_TAGS.invoices);

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/hours-export");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.hoursExport, CACHE_TAGS.insights);
  redirect(returnTo(formData));
}

export async function createExpenseItemAction(formData: FormData) {
  const ownerId = await requireUserId();
  const projectId = text(formData, "projectId");
  const datePurchased = parseInputDate(formData.get("datePurchased"));
  const description = text(formData, "description");
  const quantity = Number(text(formData, "quantity"));
  const unitCostCents = dollarsToCents(formData.get("unitCost"));
  const notes = text(formData, "itemNotes") || null;

  if (!description) throw new UserInputError("Description is required.");
  positive(quantity, "Quantity must be greater than zero.");
  positive(unitCostCents, "Unit cost must be greater than zero.");

  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId } });
  if (!project || project.status !== "ACTIVE") {
    throw new UserInputError("Choose an active project.");
  }

  await prisma.expenseItem.create({
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

  revalidatePath("/");
  revalidatePath("/projects");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.insights);
  redirect(workEntryReturnTo(formData, "item"));
}

function expenseItemDataFromForm(formData: FormData) {
  const datePurchased = parseInputDate(formData.get("datePurchased"));
  const description = text(formData, "description");
  const quantity = Number(text(formData, "quantity"));
  const unitCostCents = dollarsToCents(formData.get("unitCost"));
  const notes = text(formData, "itemNotes") || null;

  if (!description) throw new UserInputError("Description is required.");
  positive(quantity, "Quantity must be greater than zero.");
  positive(unitCostCents, "Unit cost must be greater than zero.");

  return {
    datePurchased,
    description,
    quantity,
    unitCostCents,
    totalCostCents: Math.round(quantity * unitCostCents),
    notes
  };
}

export async function updateExpenseItemAction(formData: FormData) {
  const ownerId = await requireUserId();
  const itemId = text(formData, "itemId");
  const projectId = text(formData, "projectId");
  await billingTransaction(async (tx) => {
    const item = await tx.expenseItem.findUnique({
      where: { id: itemId },
      select: { id: true, projectId: true, billingStatus: true }
    });

    if (!item || item.projectId !== projectId) throw new UserInputError("Expense item not found.");
    const project = await tx.project.findFirst({ where: { id: projectId, ownerId }, select: { id: true } });
    if (!project) throw new UserInputError("Expense item not found.");
    if (item.billingStatus !== "UNBILLED") throw new UserInputError("Billed expense items cannot be edited.");

    await tx.expenseItem.update({
      where: { id: item.id },
      data: expenseItemDataFromForm(formData)
    });
    await syncProjectDrafts(tx, ownerId, projectId);
  });
  revalidatePath("/invoices", "layout");
  revalidateDataTags(CACHE_TAGS.invoices);

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/invoices");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.insights);
  redirect(returnTo(formData));
}

export async function deleteExpenseItemAction(formData: FormData) {
  const ownerId = await requireUserId();
  const itemId = text(formData, "itemId");
  const projectId = text(formData, "projectId");
  await billingTransaction(async (tx) => {
    const item = await tx.expenseItem.findUnique({
      where: { id: itemId },
      select: { id: true, projectId: true, billingStatus: true }
    });

    if (!item || item.projectId !== projectId) throw new UserInputError("Expense item not found.");
    const project = await tx.project.findFirst({ where: { id: projectId, ownerId }, select: { id: true } });
    if (!project) throw new UserInputError("Expense item not found.");
    if (item.billingStatus !== "UNBILLED") throw new UserInputError("Billed expense items cannot be deleted.");

    await tx.expenseItem.delete({ where: { id: item.id } });
    await syncProjectDrafts(tx, ownerId, projectId);
  });
  revalidatePath("/invoices", "layout");
  revalidateDataTags(CACHE_TAGS.invoices);

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/invoices");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.insights);
  redirect(returnTo(formData));
}

const expenseCategoryValues = new Set(expenseCategoryOptions.map((option) => option.value));
const expenseStatusValues = new Set(expenseStatusOptions.map((option) => option.value));

function parseWorkExpenseData(formData: FormData, gstRate = 10) {
  const projectIdValue = text(formData, "projectId");
  const projectId = projectIdValue && projectIdValue !== "__none" ? projectIdValue : null;
  const category = text(formData, "category") as WorkExpenseCategory;
  const status = (text(formData, "status") || "LOGGED") as WorkExpenseStatus;
  const description = text(formData, "description");
  const amountCents = dollarsToCents(formData.get("amountPaid") ?? formData.get("amount"));
  const gstIncluded = text(formData, "gstIncluded") === "on" || text(formData, "calculateGst") === "on";
  const submittedGstAmount = optionalPositiveCents(formData, "gstAmount");
  // GST-inclusive extraction: gst = amount * rate / (100 + rate). Falls back to the
  // business's configured GST rate rather than assuming 10% for everyone.
  const gstAmountCents = gstIncluded ? (submittedGstAmount ?? Math.round((amountCents * gstRate) / (100 + gstRate))) : 0;

  if (!expenseCategoryValues.has(category)) throw new UserInputError("Choose a valid expense category.");
  if (!expenseStatusValues.has(status)) throw new UserInputError("Choose a valid expense status.");
  if (!description) throw new UserInputError("Expense description is required.");
  positive(amountCents, "Expense amount must be greater than zero.");
  if (gstAmountCents > amountCents) throw new UserInputError("GST amount cannot be more than the expense amount.");

  return {
    projectId,
    date: parseInputDate(formData.get("date")),
    category,
    description,
    vendor: text(formData, "vendor") || null,
    amountCents,
    gstIncluded,
    gstAmountCents,
    paymentMethod: text(formData, "paymentMethod") || null,
    receiptReference: text(formData, "receiptReference") || null,
    notes: text(formData, "notes") || null,
    billable: text(formData, "billable") === "on",
    status
  };
}

async function assertOwnedProject(ownerId: string, projectId: string | null) {
  if (!projectId) return;
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId }, select: { id: true } });
  if (!project) throw new UserInputError("Choose one of your projects.");
}

async function ownerGstRate(ownerId: string) {
  const profile = await prisma.businessProfile.findUnique({ where: { ownerId }, select: { gstRegistered: true, gstRate: true } });
  return profile?.gstRegistered ? Number(profile.gstRate) || 10 : 10;
}

export async function createWorkExpenseAction(formData: FormData) {
  const ownerId = await requireUserId();
  const data = parseWorkExpenseData(formData, await ownerGstRate(ownerId));
  await assertOwnedProject(ownerId, data.projectId);

  const expense = await prisma.workExpense.create({
    data: {
      ownerId,
      ...data
    }
  });

  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath("/insights");
  if (expense.projectId) revalidatePath(`/projects/${expense.projectId}`);
  revalidateDataTags(CACHE_TAGS.expenses, CACHE_TAGS.insights);
  redirect(returnTo(formData));
}

async function assertNotWageLinkedExpense(ownerId: string, expenseId: string) {
  const wagePayment = await prisma.wagePayment.findFirst({ where: { workExpenseId: expenseId, ownerId }, select: { id: true, teamMemberId: true } });
  if (wagePayment) throw new UserInputError("This expense was generated from a wage payment. Manage it from the subcontractor's Team page instead.");
}

export async function updateWorkExpenseAction(formData: FormData) {
  const ownerId = await requireUserId();
  const expenseId = text(formData, "expenseId");
  const existing = await prisma.workExpense.findFirst({
    where: { id: expenseId, ownerId },
    select: { id: true, projectId: true, status: true }
  });
  if (!existing) throw new UserInputError("Expense not found.");
  await assertNotWageLinkedExpense(ownerId, expenseId);

  const data = parseWorkExpenseData(formData, await ownerGstRate(ownerId));
  await assertOwnedProject(ownerId, data.projectId);

  const expense = await prisma.workExpense.update({
    where: { id: existing.id },
    data
  });

  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${expense.id}/edit`);
  revalidatePath("/insights");
  if (existing.projectId) revalidatePath(`/projects/${existing.projectId}`);
  if (expense.projectId) revalidatePath(`/projects/${expense.projectId}`);
  revalidateDataTags(CACHE_TAGS.expenses, CACHE_TAGS.insights);
  redirect(returnTo(formData));
}

export async function archiveWorkExpenseAction(formData: FormData) {
  const ownerId = await requireUserId();
  const expenseId = text(formData, "expenseId");
  const expense = await prisma.workExpense.findFirst({ where: { id: expenseId, ownerId }, select: { id: true, projectId: true } });
  if (!expense) throw new UserInputError("Expense not found.");
  await assertNotWageLinkedExpense(ownerId, expenseId);

  await prisma.workExpense.update({ where: { id: expense.id }, data: { archivedAt: new Date() } });
  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath("/insights");
  if (expense.projectId) revalidatePath(`/projects/${expense.projectId}`);
  revalidateDataTags(CACHE_TAGS.expenses, CACHE_TAGS.insights);
  redirect(returnTo(formData));
}

export async function restoreWorkExpenseAction(formData: FormData) {
  const ownerId = await requireUserId();
  const expenseId = text(formData, "expenseId");
  const expense = await prisma.workExpense.findFirst({ where: { id: expenseId, ownerId }, select: { id: true, projectId: true } });
  if (!expense) throw new UserInputError("Expense not found.");

  await prisma.workExpense.update({ where: { id: expense.id }, data: { archivedAt: null } });
  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath("/insights");
  if (expense.projectId) revalidatePath(`/projects/${expense.projectId}`);
  revalidateDataTags(CACHE_TAGS.expenses, CACHE_TAGS.insights);
  redirect(returnTo(formData));
}

export async function deleteWorkExpenseAction(formData: FormData) {
  const ownerId = await requireUserId();
  const expenseId = text(formData, "expenseId");
  const expense = await prisma.workExpense.findFirst({
    where: { id: expenseId, ownerId },
    select: { id: true, projectId: true }
  });
  if (!expense) throw new UserInputError("Expense not found.");
  await assertNotWageLinkedExpense(ownerId, expenseId);

  await prisma.workExpense.delete({ where: { id: expense.id } });

  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath("/insights");
  if (expense.projectId) revalidatePath(`/projects/${expense.projectId}`);
  revalidateDataTags(CACHE_TAGS.expenses, CACHE_TAGS.insights);
  redirect(returnTo(formData));
}

export async function createProjectAction(formData: FormData) {
  const ownerId = await requireUserId();
  const title = text(formData, "title");
  const rateCents = dollarsToCents(formData.get("hourlyRate"));
  let clientId = text(formData, "clientId");
  let createdClient = false;
  const notes = text(formData, "notes") || null;

  if (!title) throw new UserInputError("Project name is required.");
  positive(rateCents, "Hourly rate must be greater than zero.");

  if (clientId === "__new") {
    const businessName = text(formData, "newClientBusinessName");
    if (!businessName) throw new UserInputError("New client business/name is required.");

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
    clientId = client.id;
    createdClient = true;
  }

  if (!clientId) throw new UserInputError("Choose or add a client.");
  const client = await prisma.client.findFirst({ where: { id: clientId, ownerId }, select: { id: true } });
  if (!client) throw new UserInputError("Choose one of your clients.");

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

  revalidatePath("/projects");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.hoursExport);
  if (createdClient) revalidateDataTags(CACHE_TAGS.clients);
  if (text(formData, "onboarding") === "1") redirect(`/projects/${project.id}?onboarding=1`);
  redirect(`/projects/${project.id}`);
}

export async function createClientAction(formData: FormData) {
  const ownerId = await requireUserId();
  const businessName = text(formData, "businessName");
  const contactName = text(formData, "contactName") || null;
  const email = text(formData, "email") || null;
  const phone = text(formData, "phone") || null;
  const abn = text(formData, "abn") || null;
  const address = text(formData, "address") || null;
  const notes = text(formData, "notes") || null;

  if (!businessName) throw new UserInputError("Business name is required.");
  validateOptionalEmail(email ?? "");

  const client = await prisma.client.create({
    data: {
      ownerId,
      businessName,
      contactName,
      email,
      phone,
      abn,
      address,
      notes
    }
  });

  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/projects");
  revalidateDataTags(CACHE_TAGS.clients);
  if (text(formData, "onboarding") === "1") redirect(`/projects/new?onboarding=1&clientId=${client.id}`);
  redirect(`/clients/${client.id}?saved=client-created`);
}

export async function updateClientAction(formData: FormData) {
  const ownerId = await requireUserId();
  const clientId = text(formData, "clientId");
  const businessName = text(formData, "businessName");
  const contactName = text(formData, "contactName") || null;
  const email = text(formData, "email") || null;
  const phone = text(formData, "phone") || null;
  const abn = text(formData, "abn") || null;
  const address = text(formData, "address") || null;
  const notes = text(formData, "notes") || null;

  if (!businessName) throw new UserInputError("Business name is required.");
  validateOptionalEmail(email ?? "");

  const existing = await prisma.client.findFirst({
    where: { id: clientId, ownerId },
    select: {
      id: true,
      businessName: true
    }
  });

  if (!existing) throw new UserInputError("Client not found.");

  await prisma.client.update({
    where: { id: existing.id },
    data: { businessName, contactName, email, phone, abn, address, notes }
  });

  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath(`/clients/${existing.id}/edit`);
  revalidatePath("/projects");
  revalidatePath("/invoices");
  revalidatePath("/hours-export");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.clients, CACHE_TAGS.projects, CACHE_TAGS.invoices, CACHE_TAGS.hoursExport, CACHE_TAGS.insights, CACHE_TAGS.expenses);
  redirect("/clients?saved=client-updated");
}

export async function updateProjectAction(formData: FormData) {
  const ownerId = await requireUserId();
  const projectId = text(formData, "projectId");
  const title = text(formData, "title");
  const clientId = text(formData, "clientId");
  const rateCents = dollarsToCents(formData.get("hourlyRate"));
  const notes = text(formData, "notes") || null;

  if (!title) throw new UserInputError("Project name is required.");
  if (!clientId) throw new UserInputError("Choose a client.");
  positive(rateCents, "Hourly rate must be greater than zero.");

  const existing = await prisma.project.findFirst({ where: { id: projectId, ownerId } });
  if (!existing) throw new UserInputError("Project not found.");
  const client = await prisma.client.findFirst({ where: { id: clientId, ownerId }, select: { id: true } });
  if (!client) throw new UserInputError("Choose one of your clients.");

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        title,
        clientId,
        currentHourlyRateCents: rateCents,
        status: existing.status,
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

  revalidatePath("/projects");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.invoices, CACHE_TAGS.hoursExport, CACHE_TAGS.insights, CACHE_TAGS.expenses);
  redirect(`/projects/${projectId}`);
}

export async function archiveProjectAction(formData: FormData) {
  const ownerId = await requireUserId();
  const projectId = text(formData, "projectId");
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId }, select: { id: true } });
  if (!project) redirect("/projects");

  const closeout = projectCloseoutReadiness(await loadProjectControlSummary(ownerId, projectId));
  if (!closeout.canArchive) {
    redirect(`/projects/${projectId}/edit?archiveError=${encodeURIComponent(`This project is not ready to archive: ${closeout.blockers.join(", ")}.`)}`);
  }

  const result = await prisma.project.updateMany({
    where: { id: projectId, ownerId },
    data: { status: "ARCHIVED" }
  });
  if (result.count === 0) throw new UserInputError("Project not found.");

  revalidatePath("/projects");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.hoursExport, CACHE_TAGS.insights);
  redirect("/projects");
}

export async function unarchiveProjectAction(formData: FormData) {
  const ownerId = await requireUserId();
  const projectId = text(formData, "projectId");

  const result = await prisma.project.updateMany({
    where: { id: projectId, ownerId },
    data: { status: "ACTIVE" }
  });
  if (result.count === 0) throw new UserInputError("Project not found.");

  revalidatePath("/");
  revalidatePath("/projects");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.hoursExport, CACHE_TAGS.insights);
  redirect(`/projects/${projectId}`);
}

function projectDeleteBlockedMessage({
  invoiceCount,
  billedTimeCount,
  billedExpenseCount,
  wagePaymentCount
}: {
  invoiceCount: number;
  billedTimeCount: number;
  billedExpenseCount: number;
  wagePaymentCount: number;
}) {
  const reasons = [
    invoiceCount ? `${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"}` : "",
    billedTimeCount ? `${billedTimeCount} billed time entr${billedTimeCount === 1 ? "y" : "ies"}` : "",
    billedExpenseCount ? `${billedExpenseCount} billed expense item${billedExpenseCount === 1 ? "" : "s"}` : "",
    wagePaymentCount ? `${wagePaymentCount} active wage payment${wagePaymentCount === 1 ? "" : "s"}` : ""
  ].filter(Boolean);

  return reasons.length
    ? `This project has ${reasons.join(", ")}. Archive it instead of deleting it so the history stays intact.`
    : "";
}

function projectDeleteErrorUrl(projectId: string, message: string) {
  return `/projects/${projectId}/edit?deleteError=${encodeURIComponent(message)}`;
}

export async function deleteProjectAction(formData: FormData) {
  const ownerId = await requireUserId();
  const projectId = text(formData, "projectId");
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId }, select: { id: true } });

  if (!project) redirect("/projects");

  let deleteResult:
    | {
        deleted: boolean;
        blockedMessage: string;
        invoiceCount: number;
        billedTimeCount: number;
        billedExpenseCount: number;
        wagePaymentCount: number;
      }
    | null = null;

  try {
    deleteResult = await prisma.$transaction(async (tx) => {
      const [invoiceCount, billedTimeCount, billedExpenseCount, wagePaymentCount] = await Promise.all([
        tx.invoice.count({ where: { projectId, ownerId } }),
        tx.timeEntry.count({ where: { projectId, ownerId, billingStatus: "BILLED" } }),
        tx.expenseItem.count({ where: { projectId, ownerId, billingStatus: "BILLED" } }),
        tx.wagePayment.count({ where: { projectId, ownerId, status: "PAID" } })
      ]);
      const blockedMessage = projectDeleteBlockedMessage({ invoiceCount, billedTimeCount, billedExpenseCount, wagePaymentCount });

      if (blockedMessage) {
        return { deleted: false, blockedMessage, invoiceCount, billedTimeCount, billedExpenseCount, wagePaymentCount };
      }

      const reversedWagePayments = await tx.wagePayment.findMany({
        where: { projectId, ownerId, status: "VOID" },
        select: { id: true, workExpenseId: true }
      });
      const reversedExpenseIds = reversedWagePayments.flatMap((payment) => payment.workExpenseId ? [payment.workExpenseId] : []);

      await tx.timeEntry.deleteMany({ where: { projectId, ownerId } });
      await tx.projectAssignment.deleteMany({ where: { projectId, ownerId } });
      await tx.expenseItem.deleteMany({ where: { projectId, ownerId } });
      await tx.rateHistory.deleteMany({ where: { projectId, ownerId } });
      await tx.wagePayment.deleteMany({ where: { projectId, ownerId, status: "VOID" } });
      if (reversedExpenseIds.length) await tx.workExpense.deleteMany({ where: { id: { in: reversedExpenseIds }, ownerId, archivedAt: { not: null } } });
      await tx.project.deleteMany({ where: { id: projectId, ownerId } });

      return { deleted: true, blockedMessage: "", invoiceCount, billedTimeCount, billedExpenseCount, wagePaymentCount };
    });
  } catch (error) {
    console.error("Project deletion failed", error);
    redirect(projectDeleteErrorUrl(projectId, "This project could not be deleted safely. Archive it instead, or try again after checking its history."));
  }

  if (!deleteResult?.deleted) {
    redirect(projectDeleteErrorUrl(projectId, deleteResult?.blockedMessage || "This project cannot be deleted safely. Archive it instead."));
  }

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

  if (!client) throw new UserInputError("Client not found.");

  await prisma.$transaction(async (tx) => {
    const projects = await tx.project.findMany({
      where: { clientId, ownerId },
      select: { id: true }
    });
    const projectIds = projects.map((project) => project.id);

    const [invoiceCount, billedTimeCount, billedExpenseCount, wagePaymentCount] = await Promise.all([
      tx.invoice.count({
        where: {
          ownerId,
          OR: [{ clientId }, { projectId: { in: projectIds } }]
        }
      }),
      tx.timeEntry.count({ where: { ownerId, projectId: { in: projectIds }, billingStatus: "BILLED" } }),
      tx.expenseItem.count({ where: { ownerId, projectId: { in: projectIds }, billingStatus: "BILLED" } }),
      tx.wagePayment.count({ where: { ownerId, projectId: { in: projectIds }, status: "PAID" } })
    ]);

    if (invoiceCount || billedTimeCount || billedExpenseCount || wagePaymentCount) {
      throw new UserInputError("This client has invoice, billed, or wage payment history. Archive their projects instead of deleting the client.");
    }

    const reversedWagePayments = await tx.wagePayment.findMany({
      where: { ownerId, projectId: { in: projectIds }, status: "VOID" },
      select: { workExpenseId: true }
    });
    const reversedExpenseIds = reversedWagePayments.flatMap((payment) => payment.workExpenseId ? [payment.workExpenseId] : []);

    await tx.timeEntry.deleteMany({
      where: { ownerId, projectId: { in: projectIds } }
    });
    await tx.projectAssignment.deleteMany({
      where: { ownerId, projectId: { in: projectIds } }
    });
    await tx.expenseItem.deleteMany({
      where: { ownerId, projectId: { in: projectIds } }
    });
    await tx.rateHistory.deleteMany({
      where: { ownerId, projectId: { in: projectIds } }
    });
    await tx.wagePayment.deleteMany({ where: { ownerId, projectId: { in: projectIds }, status: "VOID" } });
    if (reversedExpenseIds.length) await tx.workExpense.deleteMany({ where: { id: { in: reversedExpenseIds }, ownerId, archivedAt: { not: null } } });
    await tx.project.deleteMany({
      where: { ownerId, id: { in: projectIds } }
    });
    await tx.client.deleteMany({ where: { id: clientId, ownerId } });
  });

  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/projects");
  revalidatePath("/invoices");
  revalidatePath("/hours-export");
  revalidateAppData();
  redirect("/clients");
}

async function nextInvoiceNumber(tx: Prisma.TransactionClient, ownerId: string, prefix: string) {
  const year = todayInPerth().getUTCFullYear();
  const existing = await tx.invoice.findMany({
    where: { ownerId, invoiceNumber: { startsWith: `${prefix}${year}-` } },
    select: { invoiceNumber: true }
  });

  return nextInvoiceNumberFromExisting(
    existing.map((invoice) => invoice.invoiceNumber),
    prefix,
    year
  );
}

function invoiceModeFromForm(formData: FormData): InvoiceMode {
  return text(formData, "invoiceMode") === "SIMPLE" ? "SIMPLE" : "DETAILED";
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
  const allUnbilled = text(formData, "scope") === "all";
  const start = allUnbilled ? todayInPerth() : parseInputDate(formData.get("dateRangeStart"));
  const end = endOfDay(allUnbilled ? todayInPerth() : parseInputDate(formData.get("dateRangeEnd")));
  const mode = invoiceModeFromForm(formData);

  if (end < start) {
    throw new UserInputError("End date must be after start date.");
  }

  const invoice = await billingTransaction(async (tx) => {
    const [project, profile] = await Promise.all([
      tx.project.findFirst({
        where: { id: projectId, ownerId },
        select: { id: true, clientId: true, client: true }
      }),
      tx.businessProfile.findUnique({ where: { ownerId } })
    ]);
    if (!project) throw new UserInputError("Project not found.");

    const [entries, expenses] = await Promise.all([
      tx.timeEntry.findMany({
        where: {
          projectId,
          ownerId,
          billingStatus: "UNBILLED",
          invoiceLineItems: { none: { invoice: { status: "DRAFT" } } },
          OR: [{ teamMemberId: null }, { approvalStatus: "APPROVED" }],
          ...(allUnbilled ? {} : { date: { gte: start, lte: end } })
        },
        select: { id: true, date: true, durationMinutes: true, notes: true, hourlyRateCentsSnapshot: true, workerDisplayNameSnapshot: true, teamMemberId: true, payRateCentsSnapshot: true },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }]
      }),
      tx.expenseItem.findMany({
        where: {
          projectId,
          ownerId,
          billingStatus: "UNBILLED",
          invoiceLineItems: { none: { invoice: { status: "DRAFT" } } },
          ...(allUnbilled ? {} : { datePurchased: { gte: start, lte: end } })
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
      throw new UserInputError("There are no unbilled entries or items in this date range.");
    }

    const paymentTermsDays = profile?.paymentTermsDays ?? 14;
    const gstRate = profile ? Number(profile.gstRate) : 0;
    const totals = invoiceTotals(entries, expenses, {
      registered: profile?.gstRegistered ?? false,
      rate: gstRate
    });
    const invoiceDate = todayInPerth();
    const invoicePrefix = profile?.invoicePrefix || "INV-";
    const sourceDates = [...entries.map((entry) => entry.date.getTime()), ...expenses.map((item) => item.datePurchased.getTime())];
    return tx.invoice.create({
      data: {
        invoiceNumber: await nextInvoiceNumber(tx, ownerId, invoicePrefix),
        projectId,
        clientId: project.clientId,
        ownerId,
        invoiceDate,
        dueDate: addDays(invoiceDate, paymentTermsDays),
        paymentTermsDays,
        dateRangeStart: allUnbilled ? new Date(Math.min(...sourceDates)) : start,
        dateRangeEnd: allUnbilled ? new Date(Math.max(...sourceDates)) : parseInputDate(formData.get("dateRangeEnd")),
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
  });

  revalidatePath("/invoices");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.invoices);
  if (text(formData, "onboarding") === "1") redirect(`/onboarding/progress?invoiceId=${invoice.id}`);
  redirect(`/invoices/${invoice.id}`);
}

async function finaliseInvoice(ownerId: string, invoiceId: string, status: "SENT" | "PAID", confirmedIncomplete: boolean) {
  await billingTransaction(async (tx) => {
    const current = await tx.invoice.findFirst({ where: { id: invoiceId, ownerId }, select: { projectId: true, status: true } });
    if (!current) throw new UserInputError("Invoice not found.");
    if (current.status === "DRAFT") await syncProjectDrafts(tx, ownerId, current.projectId);
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, ownerId },
      include: {
        lineItems: true,
        project: { select: { client: true } }
      }
    });

    if (!invoice) throw new UserInputError("Invoice not found.");
    if (invoice.ownerId !== ownerId) throw new UserInputError("Invoice not found.");
    if (invoice.status === "VOID") throw new UserInputError("Void invoices cannot be finalised.");
    if (invoice.status === "PAID") throw new UserInputError("Invoice is already paid.");

    if (invoice.status === "SENT") {
      if (status !== "PAID") throw new UserInputError("Sent invoices cannot be resent.");
      const updated = await tx.invoice.updateMany({
        where: { id: invoiceId, ownerId, status: "SENT" },
        data: { status: "PAID", paymentDate: new Date() }
      });
      if (updated.count !== 1) throw new UserInputError("Invoice status changed. Refresh the page and try again.");
      return;
    }

    if (!invoice.lineItems.length) throw new UserInputError("This draft no longer has any work to invoice. Delete it and create a new draft from unbilled work.");

    const timeEntryIds = [...new Set(
      invoice.lineItems
        .map((line) => line.timeEntryId)
        .filter((id): id is string => Boolean(id))
    )];
    const expenseItemIds = [...new Set(
      invoice.lineItems
        .map((line) => line.expenseItemId)
        .filter((id): id is string => Boolean(id))
    )];

    const profile = await tx.businessProfile.findUnique({ where: { ownerId } });
    const profileIssues = criticalInvoiceProfileIssues(profile);
    if (profileIssues.length && !confirmedIncomplete) {
      throw new UserInputError(`Invoice is missing important business details: ${profileIssues.join(" ")}`);
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

    const currentInvoice = await tx.invoice.findFirst({
      where: { id: invoiceId, ownerId },
      select: { status: true }
    });
    if (currentInvoice?.status !== "DRAFT") {
      throw new UserInputError("Invoice status changed. Refresh the page and try again.");
    }

    const updatedEntries = timeEntryIds.length
      ? await tx.timeEntry.updateMany({
        where: {
          ownerId,
          id: { in: timeEntryIds },
          OR: [
            { billingStatus: "UNBILLED", invoiceId: null },
            { billingStatus: "BILLED", invoiceId }
          ]
        },
        data: { billingStatus: "BILLED", invoiceId }
      })
      : { count: 0 };
    const updatedExpenses = expenseItemIds.length
      ? await tx.expenseItem.updateMany({
        where: {
          ownerId,
          id: { in: expenseItemIds },
          OR: [
            { billingStatus: "UNBILLED", invoiceId: null },
            { billingStatus: "BILLED", invoiceId }
          ]
        },
        data: { billingStatus: "BILLED", invoiceId }
      })
      : { count: 0 };

    if (updatedEntries.count !== timeEntryIds.length || updatedExpenses.count !== expenseItemIds.length) {
      throw new UserInputError("One or more invoice items have already been billed elsewhere.");
    }

    const updatedInvoice = await tx.invoice.updateMany({
      where: { id: invoiceId, ownerId, status: "DRAFT" },
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
    });
    if (updatedInvoice.count !== 1) {
      throw new UserInputError("Invoice status changed. Refresh the page and try again.");
    }
  });

}

export async function markInvoiceSentAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  await finaliseInvoice(ownerId, invoiceId, "SENT", text(formData, "confirmIncomplete") === "on");
  revalidatePath("/invoices");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.invoices, CACHE_TAGS.hoursExport, CACHE_TAGS.insights);
  redirect(`/invoices/${invoiceId}`);
}

export async function markInvoicePaidAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  await finaliseInvoice(ownerId, invoiceId, "PAID", text(formData, "confirmIncomplete") === "on");
  revalidatePath("/");
  revalidatePath("/invoices");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.invoices, CACHE_TAGS.hoursExport, CACHE_TAGS.insights);
  redirect(`/invoices/${invoiceId}`);
}

export async function markInvoiceUnpaidAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, ownerId },
    select: { id: true, status: true }
  });

  if (!invoice) throw new UserInputError("Invoice not found.");
  if (invoice.status !== "PAID") throw new UserInputError("Only paid invoices can be marked unpaid.");

  const updated = await prisma.invoice.updateMany({
    where: { id: invoiceId, ownerId, status: "PAID" },
    data: { status: "SENT", paymentDate: null }
  });
  if (updated.count !== 1) throw new UserInputError("Invoice status changed. Refresh the page and try again.");

  revalidatePath("/");
  revalidatePath("/invoices");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.invoices, CACHE_TAGS.insights);
  redirect(`/invoices/${invoiceId}`);
}

export async function markInvoiceUnsentAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true }
  });

  if (!invoice) throw new UserInputError("Invoice not found.");
  if (invoice.ownerId !== ownerId) throw new UserInputError("Invoice not found.");
  if (invoice.status !== "SENT") throw new UserInputError("Only sent invoices can be marked unsent.");

  const timeEntryIds = invoice.lineItems
    .map((line) => line.timeEntryId)
    .filter((id): id is string => Boolean(id));
  const expenseItemIds = invoice.lineItems
    .map((line) => line.expenseItemId)
    .filter((id): id is string => Boolean(id));

  await prisma.$transaction(async (tx) => {
    const updated = await tx.invoice.updateMany({
      where: { id: invoiceId, ownerId, status: "SENT" },
      data: { status: "DRAFT", paymentDate: null }
    });
    if (updated.count !== 1) throw new UserInputError("Invoice status changed. Refresh the page and try again.");

    await tx.timeEntry.updateMany({
      where: { ownerId, id: { in: timeEntryIds }, invoiceId },
      data: { billingStatus: "UNBILLED", invoiceId: null }
    });
    await tx.expenseItem.updateMany({
      where: { ownerId, id: { in: expenseItemIds }, invoiceId },
      data: { billingStatus: "UNBILLED", invoiceId: null }
    });
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/invoices");
  if (invoice.publicToken) revalidatePath(`/public/invoices/${invoice.publicToken}`);
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.invoices, CACHE_TAGS.hoursExport, CACHE_TAGS.insights);
  redirect(`/invoices/${invoiceId}`);
}

export async function voidInvoiceAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true }
  });

  if (!invoice) throw new UserInputError("Invoice not found.");
  if (invoice.ownerId !== ownerId) throw new UserInputError("Invoice not found.");
  if (invoice.status === "VOID") throw new UserInputError("Invoice is already void.");

  const timeEntryIds = invoice.lineItems
    .map((line) => line.timeEntryId)
    .filter((id): id is string => Boolean(id));
  const expenseItemIds = invoice.lineItems
    .map((line) => line.expenseItemId)
    .filter((id): id is string => Boolean(id));

  await prisma.$transaction(async (tx) => {
    const updated = await tx.invoice.updateMany({
      where: { id: invoiceId, ownerId, status: invoice.status },
      data: { status: "VOID", paymentDate: null, publicTokenEnabled: false }
    });
    if (updated.count !== 1) throw new UserInputError("Invoice status changed. Refresh the page and try again.");

    await tx.timeEntry.updateMany({
      where: { ownerId, id: { in: timeEntryIds }, invoiceId },
      data: { billingStatus: "UNBILLED", invoiceId: null }
    });
    await tx.expenseItem.updateMany({
      where: { ownerId, id: { in: expenseItemIds }, invoiceId },
      data: { billingStatus: "UNBILLED", invoiceId: null }
    });
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/invoices");
  if (invoice.publicToken) revalidatePath(`/public/invoices/${invoice.publicToken}`);
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.invoices, CACHE_TAGS.hoursExport, CACHE_TAGS.insights);
  redirect(`/invoices/${invoiceId}`);
}

export async function unvoidInvoiceAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, ownerId } });
  if (!invoice) throw new UserInputError("Invoice not found.");
  if (invoice.status !== "VOID") throw new UserInputError("Only void invoices can be restored.");

  const updated = await prisma.invoice.updateMany({
    where: { id: invoiceId, ownerId, status: "VOID" },
    data: { status: "DRAFT", paymentDate: null }
  });
  if (updated.count !== 1) throw new UserInputError("Invoice status changed. Refresh the page and try again.");

  revalidatePath("/");
  revalidatePath("/invoices");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.invoices);
  redirect(`/invoices/${invoiceId}`);
}

export async function deleteInvoiceAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lineItems: true }
  });

  if (!invoice) throw new UserInputError("Invoice not found.");
  if (invoice.ownerId !== ownerId) throw new UserInputError("Invoice not found.");

  const timeEntryIds = invoice.lineItems
    .map((line) => line.timeEntryId)
    .filter((id): id is string => Boolean(id));
  const expenseItemIds = invoice.lineItems
    .map((line) => line.expenseItemId)
    .filter((id): id is string => Boolean(id));

  await prisma.$transaction(async (tx) => {
    await tx.timeEntry.updateMany({
      where: { ownerId, id: { in: timeEntryIds }, invoiceId },
      data: { billingStatus: "UNBILLED", invoiceId: null }
    });
    await tx.expenseItem.updateMany({
      where: { ownerId, id: { in: expenseItemIds }, invoiceId },
      data: { billingStatus: "UNBILLED", invoiceId: null }
    });
    const deleted = await tx.invoice.deleteMany({
      where: { id: invoiceId, ownerId, status: invoice.status }
    });
    if (deleted.count !== 1) throw new UserInputError("Invoice status changed. Refresh the page and try again.");
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/invoices");
  if (invoice.publicToken) revalidatePath(`/public/invoices/${invoice.publicToken}`);
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.invoices, CACHE_TAGS.hoursExport, CACHE_TAGS.insights);
  redirect("/invoices");
}

function assertInvoiceCanBeShared(status: "DRAFT" | "SENT" | "PAID" | "VOID") {
  if (!canShareInvoicePublicly(status)) throw new UserInputError("Void invoices cannot be shared.");
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
  if (!invoice) throw new UserInputError("Invoice not found.");
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

  revalidatePath(`/invoices/${invoiceId}`);
  if (invoice.publicToken) revalidatePath(`/public/invoices/${invoice.publicToken}`);
  revalidatePath(`/public/invoices/${token}`);
  redirect(`/invoices/${invoiceId}`);
}

export async function prepareInvoiceEmailAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, ownerId },
    select: { id: true, invoiceNumber: true, status: true }
  });

  if (!invoice) throw new UserInputError("Invoice not found.");
  if (invoice.status === "VOID") throw new UserInputError("Void invoices cannot be emailed.");

  parseEmailList(text(formData, "to"), "To", true);
  const subject = text(formData, "subject");
  const message = text(formData, "message");
  if (!subject) throw new UserInputError("Email subject is required.");
  if (!message) throw new UserInputError("Email message is required.");

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      lastEmailedAt: new Date(),
      emailSendCount: { increment: 1 }
    }
  });

  return { ok: true };
}

export async function prepareInvoiceSmsAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, ownerId },
    select: { id: true, invoiceNumber: true, status: true }
  });

  if (!invoice) throw new UserInputError("Invoice not found.");
  if (invoice.status === "VOID") throw new UserInputError("Void invoices cannot be sent.");

  const phone = text(formData, "phone");
  if (digitsOnly(phone).length < 8) throw new UserInputError("Client phone number is required.");

  const message = text(formData, "message");
  if (!message) throw new UserInputError("SMS message is required.");

  return { ok: true };
}

export async function sendInvoiceEmailAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  const emails = parseEmailList(text(formData, "to"), "To", false);
  const subject = text(formData, "subject");
  const message = text(formData, "message");
  const confirmedIncomplete = text(formData, "confirmIncomplete") === "on";

  if (formData.has("subject") && !subject) throw new UserInputError("Email subject is required.");
  if (formData.has("message") && !message) throw new UserInputError("Email message is required.");

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, ownerId },
    select: { status: true }
  });
  if (!invoice) throw new UserInputError("Invoice not found.");

  if (invoice.status === "DRAFT" && !confirmedIncomplete) {
    const profile = await prisma.businessProfile.findUnique({ where: { ownerId } });
    const profileIssues = criticalInvoiceProfileIssues(profile);
    if (profileIssues.length) {
      throw new UserInputError(`Invoice is missing important business details: ${profileIssues.join(" ")}`);
    }
  }

  const result = await sendPreparedInvoiceEmailWithPdf(ownerId, invoiceId, {
    to: emails.length ? emails.join(", ") : undefined,
    subject: subject || undefined,
    body: message || undefined
  });
  const finaliseResult = await finaliseDeliveredDraft(ownerId, invoiceId, invoice.status, confirmedIncomplete);

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.invoices, CACHE_TAGS.hoursExport, CACHE_TAGS.insights);

  return {
    ...result,
    warning: finaliseResult.warning,
    message: finaliseResult.warning
      ? `${result.message} ${finaliseResult.warning}`
      : invoice.status === "DRAFT"
        ? `${result.message} The invoice is now marked sent and its work is recorded as billed.`
        : result.message
  };
}

export async function sendInvoiceSmsAction(formData: FormData) {
  const ownerId = await requireUserId();
  const invoiceId = text(formData, "invoiceId");
  const confirmedIncomplete = text(formData, "confirmIncomplete") === "on";
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, ownerId },
    select: { status: true }
  });
  if (!invoice) throw new UserInputError("Invoice not found.");

  if (invoice.status === "DRAFT" && !confirmedIncomplete) {
    const profile = await prisma.businessProfile.findUnique({ where: { ownerId } });
    const profileIssues = criticalInvoiceProfileIssues(profile);
    if (profileIssues.length) {
      throw new UserInputError(`Invoice is missing important business details: ${profileIssues.join(" ")}`);
    }
  }

  const result = await sendInvoiceMmsWithPdf(ownerId, invoiceId);
  const finaliseResult = await finaliseDeliveredDraft(ownerId, invoiceId, invoice.status, confirmedIncomplete);

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/");
  revalidateDataTags(CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.invoices, CACHE_TAGS.hoursExport, CACHE_TAGS.insights);

  return {
    ...result,
    warning: finaliseResult.warning,
    message: finaliseResult.warning
      ? `${result.message} ${finaliseResult.warning}`
      : invoice.status === "DRAFT"
        ? `${result.message} The invoice is now marked sent and its work is recorded as billed.`
        : result.message
  };
}

async function finaliseDeliveredDraft(
  ownerId: string,
  invoiceId: string,
  statusBeforeDelivery: string,
  confirmedIncomplete: boolean
) {
  if (statusBeforeDelivery !== "DRAFT") return { warning: "" };

  try {
    await finaliseInvoice(ownerId, invoiceId, "SENT", confirmedIncomplete);
    return { warning: "" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The invoice status could not be updated.";
    return {
      warning: `The delivery provider accepted this invoice, but its status could not be updated: ${detail} Refresh the invoice before trying anything else; do not resend unless the client confirms they did not receive it.`
    };
  }
}
