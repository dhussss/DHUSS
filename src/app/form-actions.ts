"use server";

import * as app from "@/app/actions";
import * as team from "@/app/team/actions";
import { runFormAction } from "@/lib/run-form-action";

export async function acceptTeamInvitationAction(data: FormData) {
  return runFormAction(() => team.acceptTeamInvitationAction(data));
}

export async function archiveProjectAction(data: FormData) {
  return runFormAction(() => app.archiveProjectAction(data));
}

export async function archiveTeamMemberAction(data: FormData) {
  return runFormAction(() => team.archiveTeamMemberAction(data));
}

export async function archiveWorkExpenseAction(data: FormData) {
  return runFormAction(() => app.archiveWorkExpenseAction(data));
}

export async function createClientAction(data: FormData) {
  return runFormAction(() => app.createClientAction(data));
}

export async function createExpenseItemAction(data: FormData) {
  return runFormAction(() => app.createExpenseItemAction(data));
}

export async function createInvoiceDraftAction(data: FormData) {
  return runFormAction(() => app.createInvoiceDraftAction(data));
}

export async function createManagedTeamTimeEntryAction(data: FormData) {
  return runFormAction(() => team.createManagedTeamTimeEntryAction(data));
}

export async function createProjectAction(data: FormData) {
  return runFormAction(() => app.createProjectAction(data));
}

export async function createProjectAssignmentAction(data: FormData) {
  return runFormAction(() => team.createProjectAssignmentAction(data));
}

export async function createSubcontractorTimeEntryAction(data: FormData) {
  return runFormAction(() => team.createSubcontractorTimeEntryAction(data));
}

export async function createTeamMemberAction(data: FormData) {
  return runFormAction(() => team.createTeamMemberAction(data));
}

export async function createTeamMemberInvitationAction(data: FormData) {
  return runFormAction(() => team.createTeamMemberInvitationAction(data));
}

export async function createTimeEntryAction(data: FormData) {
  return runFormAction(() => app.createTimeEntryAction(data));
}

export async function createWorkExpenseAction(data: FormData) {
  return runFormAction(() => app.createWorkExpenseAction(data));
}

export async function deleteClientAction(data: FormData) {
  return runFormAction(() => app.deleteClientAction(data));
}

export async function deleteExpenseItemAction(data: FormData) {
  return runFormAction(() => app.deleteExpenseItemAction(data));
}

export async function deleteInvoiceAction(data: FormData) {
  return runFormAction(() => app.deleteInvoiceAction(data));
}

export async function deleteMyTimeEntryAction(data: FormData) {
  return runFormAction(() => team.deleteMyTimeEntryAction(data));
}

export async function deleteProjectAction(data: FormData) {
  return runFormAction(() => app.deleteProjectAction(data));
}

export async function deleteTeamTimeEntryAction(data: FormData) {
  return runFormAction(() => team.deleteTeamTimeEntryAction(data));
}

export async function deleteTimeEntryAction(data: FormData) {
  return runFormAction(() => app.deleteTimeEntryAction(data));
}

export async function deleteWorkExpenseAction(data: FormData) {
  return runFormAction(() => app.deleteWorkExpenseAction(data));
}

export async function enableInvoicePublicLinkAction(data: FormData) {
  return runFormAction(() => app.enableInvoicePublicLinkAction(data));
}

export async function finishOnboardingAction() {
  return runFormAction(() => app.finishOnboardingAction());
}

export async function logoutAction() {
  return runFormAction(() => app.logoutAction());
}

export async function markInvoicePaidAction(data: FormData) {
  return runFormAction(() => app.markInvoicePaidAction(data));
}

export async function markInvoiceSentAction(data: FormData) {
  return runFormAction(() => app.markInvoiceSentAction(data));
}

export async function markInvoiceUnpaidAction(data: FormData) {
  return runFormAction(() => app.markInvoiceUnpaidAction(data));
}

export async function markInvoiceUnsentAction(data: FormData) {
  return runFormAction(() => app.markInvoiceUnsentAction(data));
}

export async function markTeamMemberPaidAction(data: FormData) {
  return runFormAction(() => team.markTeamMemberPaidAction(data));
}

export async function regenerateInvoicePublicLinkAction(data: FormData) {
  return runFormAction(() => app.regenerateInvoicePublicLinkAction(data));
}

export async function restoreTeamMemberAction(data: FormData) {
  return runFormAction(() => team.restoreTeamMemberAction(data));
}

export async function restoreWorkExpenseAction(data: FormData) {
  return runFormAction(() => app.restoreWorkExpenseAction(data));
}

export async function reverseWagePaymentAction(data: FormData) {
  return runFormAction(() => team.reverseWagePaymentAction(data));
}

export async function revokeInvoicePublicLinkAction(data: FormData) {
  return runFormAction(() => app.revokeInvoicePublicLinkAction(data));
}

export async function revokeTeamInvitationAction(data: FormData) {
  return runFormAction(() => team.revokeTeamInvitationAction(data));
}

export async function saveOnboardingSetupAction(data: FormData) {
  return runFormAction(() => app.saveOnboardingSetupAction(data));
}

export async function stopProjectAssignmentAction(data: FormData) {
  return runFormAction(() => team.stopProjectAssignmentAction(data));
}

export async function unarchiveProjectAction(data: FormData) {
  return runFormAction(() => app.unarchiveProjectAction(data));
}

export async function unvoidInvoiceAction(data: FormData) {
  return runFormAction(() => app.unvoidInvoiceAction(data));
}

export async function updateClientAction(data: FormData) {
  return runFormAction(() => app.updateClientAction(data));
}

export async function updateExpenseItemAction(data: FormData) {
  return runFormAction(() => app.updateExpenseItemAction(data));
}

export async function updateProjectAction(data: FormData) {
  return runFormAction(() => app.updateProjectAction(data));
}

export async function updateTeamTimeEntryAction(data: FormData) {
  return runFormAction(() => team.updateTeamTimeEntryAction(data));
}

export async function updateTimeEntryAction(data: FormData) {
  return runFormAction(() => app.updateTimeEntryAction(data));
}

export async function updateWagePaymentAction(data: FormData) {
  return runFormAction(() => team.updateWagePaymentAction(data));
}

export async function updateWorkExpenseAction(data: FormData) {
  return runFormAction(() => app.updateWorkExpenseAction(data));
}

export async function voidInvoiceAction(data: FormData) {
  return runFormAction(() => app.voidInvoiceAction(data));
}
