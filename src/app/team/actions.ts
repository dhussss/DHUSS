"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/app-data";
import { parseInputDate } from "@/lib/dates";
import { dollarsToCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { isQuarterHour, isQuarterHourClock, parseClockTime } from "@/lib/time";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function tokenHash(token: string) {
  return createHash("sha256").update(token.trim().toUpperCase()).digest("hex");
}

function positiveRate(formData: FormData, name: string, label: string) {
  const cents = dollarsToCents(formData.get(name));
  if (cents <= 0) throw new Error(`${label} must be greater than zero.`);
  return cents;
}

function safeReturnTo(formData: FormData, fallback: string) {
  const target = value(formData, "returnTo");
  return target.startsWith("/") && !target.startsWith("//") ? target : fallback;
}

function durationFromForm(formData: FormData) {
  const mode = value(formData, "entryMode");
  if (mode === "range") {
    const startTime = value(formData, "startTime");
    const endTime = value(formData, "endTime");
    const start = parseClockTime(startTime);
    const end = parseClockTime(endTime);
    if (start === null || end === null || end <= start) throw new Error("Enter a valid start and end time.");
    if (!isQuarterHourClock(start) || !isQuarterHourClock(end)) throw new Error("Times must use 15-minute increments.");
    return { startTime, endTime, durationMinutes: end - start };
  }

  const hours = Number.parseFloat(value(formData, "durationHours"));
  const durationMinutes = Math.round(hours * 60);
  if (!Number.isFinite(hours) || !isQuarterHour(durationMinutes)) throw new Error("Hours must be greater than zero and use 15-minute increments.");
  return { startTime: null, endTime: null, durationMinutes };
}

function revalidateTeam(projectId?: string) {
  revalidatePath("/");
  revalidatePath("/team");
  revalidatePath("/team/work");
  revalidatePath("/projects");
  revalidatePath("/invoices/new");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  for (const tag of Object.values(CACHE_TAGS)) revalidateTag(tag);
}

export async function createTeamInvitationAction(formData: FormData) {
  const user = await requireUser();
  const subcontractorName = value(formData, "subcontractorName");
  const subcontractorEmail = value(formData, "subcontractorEmail") || null;
  const defaultPayRateCents = positiveRate(formData, "payRate", "Pay rate");
  const defaultChargeRateCents = positiveRate(formData, "chargeRate", "Charge rate");
  if (!subcontractorName) throw new Error("Subcontractor name is required.");
  if (defaultChargeRateCents < defaultPayRateCents) throw new Error("Charge rate cannot be lower than the pay rate.");

  const token = randomBytes(8).toString("hex").toUpperCase();
  await prisma.teamInvitation.create({
    data: {
      ownerId: user.id,
      tokenHash: tokenHash(token),
      subcontractorName,
      subcontractorEmail,
      defaultPayRateCents,
      defaultChargeRateCents,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  revalidatePath("/team");
  redirect(`/team?invite=${encodeURIComponent(token)}`);
}

export async function revokeTeamInvitationAction(formData: FormData) {
  const user = await requireUser();
  await prisma.teamInvitation.updateMany({
    where: { id: value(formData, "invitationId"), ownerId: user.id, status: "PENDING" },
    data: { status: "REVOKED" }
  });
  revalidatePath("/team");
}

export async function acceptTeamInvitationAction(formData: FormData) {
  const user = await requireUser();
  const code = value(formData, "code").toUpperCase();
  if (!code) throw new Error("Enter the invitation code.");

  const invitation = await prisma.teamInvitation.findUnique({ where: { tokenHash: tokenHash(code) } });
  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) throw new Error("This invitation is invalid or has expired.");
  if (invitation.ownerId === user.id) throw new Error("You cannot join your own team invitation.");

  await prisma.$transaction(async (tx) => {
    await tx.teamMember.upsert({
      where: { ownerId_userId: { ownerId: invitation.ownerId, userId: user.id } },
      create: {
        ownerId: invitation.ownerId,
        userId: user.id,
        displayName: invitation.subcontractorName,
        email: user.email || invitation.subcontractorEmail,
        defaultPayRateCents: invitation.defaultPayRateCents,
        defaultChargeRateCents: invitation.defaultChargeRateCents
      },
      update: {
        displayName: invitation.subcontractorName,
        email: user.email || invitation.subcontractorEmail,
        defaultPayRateCents: invitation.defaultPayRateCents,
        defaultChargeRateCents: invitation.defaultChargeRateCents,
        status: "ACTIVE"
      }
    });
    await tx.teamInvitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedByUserId: user.id, acceptedAt: new Date() }
    });
  });

  revalidateTeam();
  redirect("/team/work?joined=1");
}

export async function createProjectAssignmentAction(formData: FormData) {
  const user = await requireUser();
  const projectId = value(formData, "projectId");
  const teamMemberId = value(formData, "teamMemberId");
  const payRateCents = positiveRate(formData, "payRate", "Pay rate");
  const chargeRateCents = positiveRate(formData, "chargeRate", "Charge rate");
  if (chargeRateCents < payRateCents) throw new Error("Charge rate cannot be lower than the pay rate.");

  const [project, member] = await Promise.all([
    prisma.project.findFirst({ where: { id: projectId, ownerId: user.id, status: "ACTIVE" }, select: { id: true } }),
    prisma.teamMember.findFirst({ where: { id: teamMemberId, ownerId: user.id, status: "ACTIVE" }, select: { id: true } })
  ]);
  if (!project || !member) throw new Error("Choose an active project and subcontractor.");

  await prisma.projectAssignment.upsert({
    where: { projectId_teamMemberId: { projectId, teamMemberId } },
    create: { ownerId: user.id, projectId, teamMemberId, payRateCents, chargeRateCents },
    update: { payRateCents, chargeRateCents, active: true, endsAt: null }
  });
  revalidateTeam(projectId);
  redirect(`/team/${teamMemberId}?assigned=1`);
}

export async function stopProjectAssignmentAction(formData: FormData) {
  const user = await requireUser();
  const assignmentId = value(formData, "assignmentId");
  const assignment = await prisma.projectAssignment.findFirst({ where: { id: assignmentId, ownerId: user.id }, select: { id: true, projectId: true, teamMemberId: true } });
  if (!assignment) throw new Error("Assignment not found.");
  await prisma.projectAssignment.update({ where: { id: assignment.id }, data: { active: false, endsAt: new Date() } });
  revalidateTeam(assignment.projectId);
  redirect(`/team/${assignment.teamMemberId}`);
}

export async function createSubcontractorTimeEntryAction(formData: FormData) {
  const user = await requireUser();
  const assignmentId = value(formData, "assignmentId");
  const assignment = await prisma.projectAssignment.findFirst({
    where: { id: assignmentId, active: true, teamMember: { userId: user.id, status: "ACTIVE" }, project: { status: "ACTIVE" } },
    include: { teamMember: { select: { id: true, displayName: true } }, project: { select: { id: true } } }
  });
  if (!assignment) throw new Error("Choose one of your active assigned projects.");

  const date = parseInputDate(formData.get("date"));
  const notes = value(formData, "notes") || null;
  const duration = durationFromForm(formData);
  await prisma.timeEntry.create({
    data: {
      ownerId: assignment.ownerId,
      projectId: assignment.projectId,
      createdByUserId: user.id,
      teamMemberId: assignment.teamMember.id,
      projectAssignmentId: assignment.id,
      workerDisplayNameSnapshot: assignment.teamMember.displayName,
      date,
      ...duration,
      notes,
      hourlyRateCentsSnapshot: assignment.chargeRateCents,
      payRateCentsSnapshot: assignment.payRateCents,
      approvalStatus: "APPROVED",
      paymentStatus: "UNPAID"
    }
  });
  revalidateTeam(assignment.projectId);
  redirect(safeReturnTo(formData, "/team/work?saved=1"));
}

export async function markTeamMemberPaidAction(formData: FormData) {
  const user = await requireUser();
  const teamMemberId = value(formData, "teamMemberId");
  const paymentReference = value(formData, "paymentReference") || null;
  const projectId = value(formData, "projectId") || null;
  const member = await prisma.teamMember.findFirst({ where: { id: teamMemberId, ownerId: user.id }, select: { id: true, displayName: true } });
  if (!member) throw new Error("Subcontractor not found.");
  const entries = await prisma.timeEntry.findMany({
    where: { ownerId: user.id, teamMemberId, approvalStatus: "APPROVED", paymentStatus: "UNPAID", ...(projectId ? { projectId } : {}) },
    select: { id: true, projectId: true, durationMinutes: true, payRateCentsSnapshot: true, project: { select: { title: true } } }
  });
  if (!entries.length) throw new Error("There are no unpaid hours for this employee and project.");
  const paidAt = new Date();
  const byProject = new Map<string, typeof entries>();
  for (const entry of entries) byProject.set(entry.projectId, [...(byProject.get(entry.projectId) || []), entry]);
  await prisma.$transaction(async (tx) => {
    for (const [entryProjectId, projectEntries] of byProject) {
      const amountCents = projectEntries.reduce((sum, entry) => sum + Math.round((entry.durationMinutes / 60) * (entry.payRateCentsSnapshot || 0)), 0);
      const minutes = projectEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
      const expense = await tx.workExpense.create({
        data: {
          ownerId: user.id,
          projectId: entryProjectId,
          date: paidAt,
          category: "SUBCONTRACTOR",
          description: `Wages - ${member.displayName}`,
          amountCents,
          gstIncluded: false,
          gstAmountCents: 0,
          receiptReference: paymentReference,
          notes: `${minutes / 60} hours - ${projectEntries[0].project.title}`,
          status: "ALLOCATED"
        }
      });
      const payment = await tx.wagePayment.create({
        data: { ownerId: user.id, teamMemberId, projectId: entryProjectId, workExpenseId: expense.id, paidAt, reference: paymentReference, minutes, amountCents }
      });
      await tx.timeEntry.updateMany({
        where: { id: { in: projectEntries.map((entry) => entry.id) }, ownerId: user.id, paymentStatus: "UNPAID" },
        data: { paymentStatus: "PAID", paidAt, paymentReference, wagePaymentId: payment.id }
      });
    }
  });
  revalidateTeam();
  revalidatePath("/expenses");
  revalidatePath("/insights");
  redirect(`/team/${teamMemberId}?paid=1`);
}

export async function updateWagePaymentAction(formData: FormData) {
  const user = await requireUser();
  const paymentId = value(formData, "paymentId");
  const paidAt = parseInputDate(formData.get("paidAt"));
  const reference = value(formData, "reference") || null;
  const payment = await prisma.wagePayment.findFirst({ where: { id: paymentId, ownerId: user.id, status: "PAID" }, select: { id: true, teamMemberId: true, workExpenseId: true } });
  if (!payment) throw new Error("Wage payment not found.");
  await prisma.$transaction([
    prisma.wagePayment.update({ where: { id: payment.id }, data: { paidAt, reference } }),
    prisma.timeEntry.updateMany({ where: { wagePaymentId: payment.id, ownerId: user.id }, data: { paidAt, paymentReference: reference } }),
    ...(payment.workExpenseId ? [prisma.workExpense.update({ where: { id: payment.workExpenseId }, data: { date: paidAt, receiptReference: reference } })] : [])
  ]);
  revalidateTeam();
  redirect(`/team/${payment.teamMemberId}?paymentUpdated=1`);
}

export async function reverseWagePaymentAction(formData: FormData) {
  const user = await requireUser();
  const paymentId = value(formData, "paymentId");
  const reversalNote = value(formData, "reversalNote") || "Payment marked unpaid";
  const payment = await prisma.wagePayment.findFirst({ where: { id: paymentId, ownerId: user.id, status: "PAID" }, select: { id: true, teamMemberId: true, workExpenseId: true } });
  if (!payment) throw new Error("Wage payment not found.");
  const reversedAt = new Date();
  await prisma.$transaction([
    prisma.wagePayment.update({ where: { id: payment.id }, data: { status: "VOID", reversedAt, reversalNote } }),
    prisma.timeEntry.updateMany({ where: { wagePaymentId: payment.id, ownerId: user.id }, data: { paymentStatus: "UNPAID", paidAt: null, paymentReference: null, wagePaymentId: null } }),
    ...(payment.workExpenseId ? [prisma.workExpense.update({ where: { id: payment.workExpenseId }, data: { archivedAt: reversedAt, notes: `Reversed: ${reversalNote}` } })] : [])
  ]);
  revalidateTeam();
  redirect(`/team/${payment.teamMemberId}?paymentReversed=1`);
}
