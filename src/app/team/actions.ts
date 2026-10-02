"use server";
import { UserInputError } from "@/lib/form-feedback";


import { createHash, randomBytes } from "node:crypto";
import { revalidatePath, revalidateTag } from "@/lib/deferred-revalidation";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/app-data";
import { parseInputDate, todayInPerth } from "@/lib/dates";
import { dollarsToCents } from "@/lib/money";
import { safeInternalPath, withInternalPathParams } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";
import { isQuarterHour, isQuarterHourClock, labourTotalCents, parseClockTime } from "@/lib/time";
import { payRunAmountIsCurrent, payRunSelectionIsCurrent, teamTimeEntryEditBlockReason } from "@/lib/payroll";
import { billingTransaction } from "@/lib/billing-transaction";
import { syncProjectDrafts } from "@/lib/invoice-draft-sync";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function tokenHash(token: string) {
  return createHash("sha256").update(token.trim().toUpperCase()).digest("hex");
}

function positiveRate(formData: FormData, name: string, label: string) {
  const cents = dollarsToCents(formData.get(name));
  if (cents <= 0) throw new UserInputError(`${label} must be greater than zero.`);
  return cents;
}

function safeReturnTo(formData: FormData, fallback: string) {
  return safeInternalPath(value(formData, "returnTo"), fallback);
}

function timeEntryReturnTo(formData: FormData, fallback: string) {
  const destination = safeReturnTo(formData, fallback);
  const params: Record<string, string> = { workSaved: "time" };
  if (value(formData, "continueLogging") === "1") params.logWork = "time";
  return withInternalPathParams(destination, params);
}

function durationFromForm(formData: FormData) {
  const mode = value(formData, "entryMode");
  if (mode === "range") {
    const startTime = value(formData, "startTime");
    const endTime = value(formData, "endTime");
    const start = parseClockTime(startTime);
    const end = parseClockTime(endTime);
    if (start === null || end === null || end <= start) throw new UserInputError("Enter a valid start and end time.");
    if (!isQuarterHourClock(start) || !isQuarterHourClock(end)) throw new UserInputError("Times must use 15-minute increments.");
    return { startTime, endTime, durationMinutes: end - start };
  }

  const hours = Number(value(formData, "durationHours"));
  const durationMinutes = Math.round(hours * 60);
  if (!Number.isFinite(hours) || !isQuarterHour(durationMinutes)) throw new UserInputError("Hours must be greater than zero and use 15-minute increments.");
  return { startTime: null, endTime: null, durationMinutes };
}

function revalidateTeam(projectId?: string) {
  revalidatePath("/");
  revalidatePath("/team");
  revalidatePath("/team/work");
  revalidatePath("/projects");
  revalidatePath("/invoices/new");
  revalidatePath("/invoices", "layout");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  for (const tag of [CACHE_TAGS.dashboard, CACHE_TAGS.projects, CACHE_TAGS.hoursExport, CACHE_TAGS.insights, CACHE_TAGS.expenses, CACHE_TAGS.invoices]) {
    revalidateTag(tag);
  }
}

export async function createTeamMemberAction(formData: FormData) {
  const user = await requireUser();
  const subcontractorName = value(formData, "subcontractorName");
  const subcontractorEmail = value(formData, "subcontractorEmail") || null;
  const defaultPayRateCents = positiveRate(formData, "payRate", "Pay rate");
  const defaultChargeRateCents = positiveRate(formData, "chargeRate", "Charge rate");
  if (!subcontractorName) throw new UserInputError("Subcontractor name is required.");
  if (subcontractorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subcontractorEmail)) {
    throw new UserInputError("Enter a valid subcontractor email address.");
  }
  if (defaultChargeRateCents < defaultPayRateCents) throw new UserInputError("Charge rate cannot be lower than the pay rate.");

  const member = await prisma.teamMember.create({
    data: {
      ownerId: user.id,
      userId: null,
      displayName: subcontractorName,
      email: subcontractorEmail,
      defaultPayRateCents,
      defaultChargeRateCents,
      linkedAt: null
    },
    select: { id: true }
  });

  revalidateTeam();
  redirect(`/team/${member.id}?added=1`);
}

export async function createTeamMemberInvitationAction(formData: FormData) {
  const user = await requireUser();
  const teamMemberId = value(formData, "teamMemberId");
  const member = await prisma.teamMember.findFirst({
    where: { id: teamMemberId, ownerId: user.id, status: "ACTIVE" },
    select: {
      id: true,
      userId: true,
      displayName: true,
      email: true,
      defaultPayRateCents: true,
      defaultChargeRateCents: true
    }
  });
  if (!member) throw new UserInputError("Subcontractor not found.");
  if (member.userId) throw new UserInputError("This subcontractor already has app access.");

  const token = randomBytes(8).toString("hex").toUpperCase();
  await prisma.$transaction([
    prisma.teamInvitation.updateMany({
      where: { ownerId: user.id, teamMemberId: member.id, status: "PENDING" },
      data: { status: "REVOKED" }
    }),
    prisma.teamInvitation.create({
      data: {
        ownerId: user.id,
        teamMemberId: member.id,
        tokenHash: tokenHash(token),
        subcontractorName: member.displayName,
        subcontractorEmail: member.email,
        defaultPayRateCents: member.defaultPayRateCents,
        defaultChargeRateCents: member.defaultChargeRateCents,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    })
  ]);

  revalidatePath("/team");
  revalidatePath(`/team/${member.id}`);
  redirect(`/team/${member.id}?invite=${encodeURIComponent(token)}`);
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
  if (!code) throw new UserInputError("Enter the invitation code.");

  const invitation = await prisma.teamInvitation.findUnique({ where: { tokenHash: tokenHash(code) } });
  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) throw new UserInputError("This invitation is invalid or has expired.");
  if (invitation.ownerId === user.id) throw new UserInputError("You cannot join your own team invitation.");

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.teamInvitation.updateMany({
      where: {
        id: invitation.id,
        status: "PENDING",
        acceptedByUserId: null,
        expiresAt: { gt: new Date() }
      },
      data: { status: "ACCEPTED", acceptedByUserId: user.id, acceptedAt: new Date() }
    });
    if (claimed.count !== 1) throw new UserInputError("This invitation has already been used or has expired.");

    if (invitation.teamMemberId) {
      const [member, existingLink] = await Promise.all([
        tx.teamMember.findFirst({
          where: { id: invitation.teamMemberId, ownerId: invitation.ownerId, status: "ACTIVE" },
          select: { id: true, userId: true }
        }),
        tx.teamMember.findFirst({
          where: { ownerId: invitation.ownerId, userId: user.id },
          select: { id: true }
        })
      ]);
      if (!member || member.userId) throw new UserInputError("This subcontractor record is no longer available to link.");
      if (existingLink && existingLink.id !== member.id) throw new UserInputError("Your account is already linked to this contractor's team.");

      await tx.teamMember.update({
        where: { id: member.id },
        data: { userId: user.id, email: user.email || invitation.subcontractorEmail, linkedAt: new Date() }
      });
    } else {
      await tx.teamMember.upsert({
        where: { ownerId_userId: { ownerId: invitation.ownerId, userId: user.id } },
        create: {
          ownerId: invitation.ownerId,
          userId: user.id,
          displayName: invitation.subcontractorName,
          email: user.email || invitation.subcontractorEmail,
          defaultPayRateCents: invitation.defaultPayRateCents,
          defaultChargeRateCents: invitation.defaultChargeRateCents,
          linkedAt: new Date()
        },
        update: {
          displayName: invitation.subcontractorName,
          email: user.email || invitation.subcontractorEmail,
          defaultPayRateCents: invitation.defaultPayRateCents,
          defaultChargeRateCents: invitation.defaultChargeRateCents,
          status: "ACTIVE",
          linkedAt: new Date()
        }
      });
    }
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
  if (chargeRateCents < payRateCents) throw new UserInputError("Charge rate cannot be lower than the pay rate.");

  const [project, member] = await Promise.all([
    prisma.project.findFirst({ where: { id: projectId, ownerId: user.id, status: "ACTIVE" }, select: { id: true } }),
    prisma.teamMember.findFirst({ where: { id: teamMemberId, ownerId: user.id, status: "ACTIVE" }, select: { id: true } })
  ]);
  if (!project || !member) throw new UserInputError("Choose an active project and subcontractor.");

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
  if (!assignment) throw new UserInputError("Assignment not found.");
  await prisma.projectAssignment.update({ where: { id: assignment.id }, data: { active: false, endsAt: new Date() } });
  revalidateTeam(assignment.projectId);
  redirect(`/team/${assignment.teamMemberId}`);
}

export async function archiveTeamMemberAction(formData: FormData) {
  const user = await requireUser();
  const teamMemberId = value(formData, "teamMemberId");
  const member = await prisma.teamMember.findFirst({ where: { id: teamMemberId, ownerId: user.id }, select: { id: true } });
  if (!member) throw new UserInputError("Subcontractor not found.");

  await prisma.$transaction([
    prisma.teamMember.update({ where: { id: member.id }, data: { status: "ARCHIVED" } }),
    prisma.projectAssignment.updateMany({ where: { teamMemberId: member.id, ownerId: user.id, active: true }, data: { active: false, endsAt: new Date() } })
  ]);

  revalidateTeam();
  redirect("/team?archived=1");
}

export async function restoreTeamMemberAction(formData: FormData) {
  const user = await requireUser();
  const teamMemberId = value(formData, "teamMemberId");
  const member = await prisma.teamMember.findFirst({ where: { id: teamMemberId, ownerId: user.id }, select: { id: true } });
  if (!member) throw new UserInputError("Subcontractor not found.");

  await prisma.teamMember.update({ where: { id: member.id }, data: { status: "ACTIVE" } });
  revalidateTeam();
  redirect(`/team/${member.id}?restored=1`);
}

export async function createSubcontractorTimeEntryAction(formData: FormData) {
  const user = await requireUser();
  const assignmentId = value(formData, "assignmentId");
  const assignment = await prisma.projectAssignment.findFirst({
    where: { id: assignmentId, active: true, teamMember: { userId: user.id, status: "ACTIVE" }, project: { status: "ACTIVE" } },
    include: { teamMember: { select: { id: true, displayName: true } }, project: { select: { id: true } } }
  });
  if (!assignment) throw new UserInputError("Choose one of your active assigned projects.");

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
  redirect(timeEntryReturnTo(formData, "/team/work?saved=1"));
}

export async function createManagedTeamTimeEntryAction(formData: FormData) {
  const user = await requireUser();
  const assignmentId = value(formData, "assignmentId");
  const requestedTeamMemberId = value(formData, "teamMemberId");
  const requestedProjectId = value(formData, "projectId");
  const date = parseInputDate(formData.get("date"));
  const notes = value(formData, "notes") || null;
  const duration = durationFromForm(formData);

  const saved = await prisma.$transaction(async (tx) => {
    let assignment;
    if (assignmentId) {
      assignment = await tx.projectAssignment.findFirst({
        where: {
          id: assignmentId,
          ownerId: user.id,
          active: true,
          teamMember: { ownerId: user.id, status: "ACTIVE" },
          project: { ownerId: user.id, status: "ACTIVE" }
        },
        include: { teamMember: { select: { id: true, displayName: true } } }
      });
    } else {
      const [member, project] = await Promise.all([
        tx.teamMember.findFirst({
          where: { id: requestedTeamMemberId, ownerId: user.id, status: "ACTIVE" },
          select: { id: true, displayName: true, defaultPayRateCents: true, defaultChargeRateCents: true }
        }),
        tx.project.findFirst({
          where: { id: requestedProjectId, ownerId: user.id, status: "ACTIVE" },
          select: { id: true }
        })
      ]);
      if (!member || !project) throw new UserInputError("Choose an active subcontractor and project.");

      const existingAssignment = await tx.projectAssignment.findUnique({
        where: { projectId_teamMemberId: { projectId: project.id, teamMemberId: member.id } }
      });
      if (existingAssignment && existingAssignment.ownerId !== user.id) throw new UserInputError("This project assignment does not belong to your team.");
      assignment = existingAssignment
        ? await tx.projectAssignment.update({
            where: { id: existingAssignment.id },
            data: { active: true, endsAt: null },
            include: { teamMember: { select: { id: true, displayName: true } } }
          })
        : await tx.projectAssignment.create({
            data: {
              ownerId: user.id,
              projectId: project.id,
              teamMemberId: member.id,
              payRateCents: member.defaultPayRateCents,
              chargeRateCents: member.defaultChargeRateCents
            },
            include: { teamMember: { select: { id: true, displayName: true } } }
          });
    }
    if (!assignment) throw new UserInputError("Choose an active project assigned to this subcontractor.");

    await tx.timeEntry.create({
      data: {
        ownerId: user.id,
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
    return { projectId: assignment.projectId, teamMemberId: assignment.teamMember.id };
  });

  revalidateTeam(saved.projectId);
  redirect(timeEntryReturnTo(formData, `/team/${saved.teamMemberId}?timeLogged=1`));
}

export async function updateTeamTimeEntryAction(formData: FormData) {
  const user = await requireUser();
  const entryId = value(formData, "entryId");
  const entry = await billingTransaction(async (tx) => {
    const entry = await tx.timeEntry.findFirst({
      where: {
        id: entryId,
        teamMemberId: { not: null },
        OR: [
          { ownerId: user.id },
          { createdByUserId: user.id, teamMember: { userId: user.id } }
        ]
      },
      select: {
        id: true,
        ownerId: true,
        projectId: true,
        teamMemberId: true,
        billingStatus: true,
        paymentStatus: true
      }
    });
    if (!entry?.teamMemberId || !entry.ownerId) throw new UserInputError("Time entry not found.");
    const editBlockReason = teamTimeEntryEditBlockReason(entry);
    if (editBlockReason === "billed") throw new UserInputError("Billed subcontractor hours cannot be edited. Unbill the invoice first.");
    if (editBlockReason === "paid") throw new UserInputError("Paid subcontractor hours cannot be edited. Reverse the wage payment first.");

    const date = parseInputDate(formData.get("date"));
    const notes = value(formData, "notes") || null;
    const duration = durationFromForm(formData);
    await tx.timeEntry.update({
      where: { id: entry.id },
      data: { date, notes, ...duration }
    });
    await syncProjectDrafts(tx, entry.ownerId, entry.projectId);
    return entry;
  });

  revalidateTeam(entry.projectId);
  revalidatePath(`/team/${entry.teamMemberId}`);
  const destination = safeReturnTo(formData, entry.ownerId === user.id ? `/team/${entry.teamMemberId}` : `/projects/${entry.projectId}`);
  redirect(withInternalPathParams(destination, { timeUpdated: "1" }));
}

export async function deleteTeamTimeEntryAction(formData: FormData) {
  const user = await requireUser();
  const entryId = value(formData, "entryId");
  const entry = await billingTransaction(async (tx) => {
    const entry = await tx.timeEntry.findFirst({
      where: { id: entryId, ownerId: user.id, teamMemberId: { not: null } },
      select: { id: true, projectId: true, teamMemberId: true, billingStatus: true, paymentStatus: true, wagePaymentId: true }
    });
    if (!entry) throw new UserInputError("Time entry not found.");
    if (entry.billingStatus !== "UNBILLED") throw new UserInputError("Billed time entries cannot be deleted. Unbill the invoice first.");

    // Deleting a paid entry reverses the whole wage payment it belongs to (other entries
    // in that payment return to unpaid, ready to be re-paid together) rather than forcing
    // a separate trip to find and click "reverse payment" first.
    if (entry.paymentStatus === "PAID" && entry.wagePaymentId) {
      const payment = await tx.wagePayment.findFirst({ where: { id: entry.wagePaymentId, ownerId: user.id, status: "PAID" }, select: { id: true, workExpenseId: true } });
      if (payment) {
        const reversedAt = new Date();
        await tx.wagePayment.update({ where: { id: payment.id }, data: { status: "VOID", reversedAt, reversalNote: "Reversed by deleting a time entry" } });
        await tx.timeEntry.updateMany({
          where: { wagePaymentId: payment.id, ownerId: user.id },
          data: { paymentStatus: "UNPAID", paidAt: null, paymentReference: null, wagePaymentId: null }
        });
        if (payment.workExpenseId) {
          await tx.workExpense.update({ where: { id: payment.workExpenseId }, data: { archivedAt: reversedAt, notes: "Reversed by deleting a time entry" } });
        }
      }
    }

    await tx.timeEntry.delete({ where: { id: entryId } });
    await syncProjectDrafts(tx, user.id, entry.projectId);
    return entry;
  });

  revalidateTeam(entry.projectId);
  revalidatePath("/expenses");
  revalidatePath("/insights");
  redirect(safeReturnTo(formData, `/team/${entry.teamMemberId}`));
}

export async function deleteMyTimeEntryAction(formData: FormData) {
  const user = await requireUser();
  const entryId = value(formData, "entryId");
  const entry = await billingTransaction(async (tx) => {
    const entry = await tx.timeEntry.findFirst({
      where: { id: entryId, createdByUserId: user.id, teamMember: { userId: user.id } },
      select: { id: true, ownerId: true, projectId: true, billingStatus: true, paymentStatus: true }
    });
    if (!entry?.ownerId) throw new UserInputError("Time entry not found.");
    if (entry.billingStatus !== "UNBILLED") throw new UserInputError("Billed hours cannot be deleted. Ask the project owner to unbill the invoice first.");
    if (entry.paymentStatus === "PAID") throw new UserInputError("Paid hours cannot be deleted. Ask the project owner to reverse the wage payment first.");

    await tx.timeEntry.delete({ where: { id: entryId } });
    await syncProjectDrafts(tx, entry.ownerId, entry.projectId);
    return entry;
  });
  revalidateTeam(entry.projectId);
  redirect(safeReturnTo(formData, "/team/work"));
}

export async function markTeamMemberPaidAction(formData: FormData) {
  const user = await requireUser();
  const teamMemberId = value(formData, "teamMemberId");
  const paymentReference = value(formData, "paymentReference") || null;
  const projectId = value(formData, "projectId") || null;
  const selectedEntryIds = [...new Set(formData.getAll("entryId").map((entryId) => String(entryId)).filter(Boolean))];
  if (value(formData, "selectionRequired") === "1" && !selectedEntryIds.length) {
    throw new UserInputError("Choose at least one unpaid shift for this payment.");
  }
  const member = await prisma.teamMember.findFirst({ where: { id: teamMemberId, ownerId: user.id }, select: { id: true, displayName: true } });
  if (!member) throw new UserInputError("Subcontractor not found.");
  const paidAt = formData.get("paidAt") ? parseInputDate(formData.get("paidAt")) : todayInPerth();

  await billingTransaction(async (tx) => {
    const entries = await tx.timeEntry.findMany({
      where: {
        ownerId: user.id,
        teamMemberId,
        approvalStatus: "APPROVED",
        paymentStatus: "UNPAID",
        ...(projectId ? { projectId } : {}),
        ...(selectedEntryIds.length ? { id: { in: selectedEntryIds } } : {})
      },
      select: { id: true, projectId: true, durationMinutes: true, payRateCentsSnapshot: true, project: { select: { title: true } } }
    });
    if (!entries.length) throw new UserInputError("There are no unpaid hours for this employee and project.");
    if (!payRunSelectionIsCurrent(selectedEntryIds, entries.map((entry) => entry.id))) {
      throw new UserInputError("One or more selected shifts changed before payment. Refresh and review the pay run again.");
    }
    const currentAmountCents = entries.reduce((sum, entry) => sum + labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0), 0);
    if (!payRunAmountIsCurrent(value(formData, "reviewedAmountCents"), currentAmountCents)) {
      throw new UserInputError("The unpaid amount has changed. Refresh and review the updated amount before recording payment.");
    }
    const byProject = new Map<string, typeof entries>();
    for (const entry of entries) byProject.set(entry.projectId, [...(byProject.get(entry.projectId) || []), entry]);
    for (const [entryProjectId, projectEntries] of byProject) {
      const amountCents = projectEntries.reduce((sum, entry) => sum + labourTotalCents(entry.durationMinutes, entry.payRateCentsSnapshot || 0), 0);
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
      const updatedEntries = await tx.timeEntry.updateMany({
        where: { id: { in: projectEntries.map((entry) => entry.id) }, ownerId: user.id, paymentStatus: "UNPAID" },
        data: { paymentStatus: "PAID", paidAt, paymentReference, wagePaymentId: payment.id }
      });
      if (updatedEntries.count !== projectEntries.length) throw new UserInputError("These wages changed while the payment was being recorded. Refresh and try again.");
    }
  });
  revalidateTeam();
  revalidatePath("/expenses");
  revalidatePath("/insights");
  redirect(safeReturnTo(formData, `/team/${teamMemberId}?paid=1`));
}

export async function updateWagePaymentAction(formData: FormData) {
  const user = await requireUser();
  const paymentId = value(formData, "paymentId");
  const paidAt = parseInputDate(formData.get("paidAt"));
  const reference = value(formData, "reference") || null;
  const payment = await billingTransaction(async (tx) => {
    const payment = await tx.wagePayment.findFirst({ where: { id: paymentId, ownerId: user.id, status: "PAID" }, select: { id: true, teamMemberId: true, workExpenseId: true } });
    if (!payment) throw new UserInputError("This payment is no longer marked paid. Refresh before making changes.");
    await tx.wagePayment.update({ where: { id: payment.id, ownerId: user.id, status: "PAID" }, data: { paidAt, reference } });
    await tx.timeEntry.updateMany({ where: { wagePaymentId: payment.id, ownerId: user.id }, data: { paidAt, paymentReference: reference } });
    if (payment.workExpenseId) await tx.workExpense.update({ where: { id: payment.workExpenseId, ownerId: user.id }, data: { date: paidAt, receiptReference: reference } });
    return payment;
  });
  revalidateTeam();
  redirect(`/team/${payment.teamMemberId}?paymentUpdated=1`);
}

export async function reverseWagePaymentAction(formData: FormData) {
  const user = await requireUser();
  const paymentId = value(formData, "paymentId");
  const reversalNote = value(formData, "reversalNote");
  if (!reversalNote) throw new UserInputError("Enter a reason for reversing this payment.");
  const reversedAt = new Date();
  const payment = await billingTransaction(async (tx) => {
    const payment = await tx.wagePayment.findFirst({ where: { id: paymentId, ownerId: user.id, status: "PAID" }, select: { id: true, teamMemberId: true, workExpenseId: true } });
    if (!payment) throw new UserInputError("This payment is no longer marked paid. Refresh before making changes.");
    await tx.wagePayment.update({ where: { id: payment.id, ownerId: user.id, status: "PAID" }, data: { status: "VOID", reversedAt, reversalNote } });
    await tx.timeEntry.updateMany({ where: { wagePaymentId: payment.id, ownerId: user.id }, data: { paymentStatus: "UNPAID", paidAt: null, paymentReference: null, wagePaymentId: null } });
    if (payment.workExpenseId) await tx.workExpense.update({ where: { id: payment.workExpenseId, ownerId: user.id }, data: { archivedAt: reversedAt, notes: `Reversed: ${reversalNote}` } });
    return payment;
  });
  revalidateTeam();
  redirect(`/team/${payment.teamMemberId}?paymentReversed=1`);
}
