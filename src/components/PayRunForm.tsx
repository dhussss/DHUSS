"use client";
import { ActionForm } from "@/components/ActionForm";


import { useMemo, useState } from "react";
import { Check, WalletCards } from "lucide-react";
import { markTeamMemberPaidAction } from "@/app/form-actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { formatMoney } from "@/lib/money";

type PayRunEntry = {
  id: string;
  dateLabel: string;
  hoursLabel: string;
  amountCents: number;
  note: string | null;
};

export function PayRunForm({
  teamMemberId,
  employee,
  projectId,
  project,
  paidAt,
  entries
}: {
  teamMemberId: string;
  employee: string;
  projectId: string;
  project: string;
  paidAt: string;
  entries: PayRunEntry[];
}) {
  const [selected, setSelected] = useState(() => new Set(entries.map((entry) => entry.id)));
  const selectedEntries = useMemo(() => entries.filter((entry) => selected.has(entry.id)), [entries, selected]);
  const selectedCents = selectedEntries.reduce((sum, entry) => sum + entry.amountCents, 0);

  function toggleEntry(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <ActionForm action={markTeamMemberPaidAction} className="overflow-hidden rounded-lg border border-line bg-white">
      <input type="hidden" name="teamMemberId" value={teamMemberId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="returnTo" value={`/team/${teamMemberId}?paid=1`} />
      <input type="hidden" name="selectionRequired" value="1" />
      <div className="flex items-start justify-between gap-3 border-b border-line p-4">
        <div>
          <p className="font-black">{project}</p>
          <p className="mt-1 text-sm font-semibold text-moss">Choose the shifts included in this payment.</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black tabular-nums">{formatMoney(selectedCents)}</p>
          <p className="mt-1 text-xs font-semibold text-moss">{selectedEntries.length} of {entries.length} selected</p>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {entries.map((entry) => {
          const checked = selected.has(entry.id);
          return (
            <label key={entry.id} className={`pay-run-entry ${checked ? "is-selected" : ""}`}>
              <input className="sr-only" type="checkbox" name="entryId" value={entry.id} checked={checked} onChange={() => toggleEntry(entry.id)} />
              <span className="pay-run-check">{checked ? <Check size={15} aria-hidden="true" /> : null}</span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-semibold text-ink">{entry.dateLabel} · {entry.hoursLabel}</strong>
                <small className="mt-1 block truncate text-xs font-medium text-moss">{entry.note || "No notes"}</small>
              </span>
              <strong className="text-sm font-semibold tabular-nums text-ink">{formatMoney(entry.amountCents)}</strong>
            </label>
          );
        })}
      </div>

      <div className="grid gap-3 border-t border-line bg-paper/60 p-4 sm:grid-cols-2">
        <label>Paid date<input name="paidAt" type="date" defaultValue={paidAt} required /></label>
        <label>Reference (optional)<input name="paymentReference" placeholder="Bank reference or note" /></label>
      </div>
      <div className="flex flex-col gap-2 border-t border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3 text-xs font-bold">
          <button type="button" className="text-mint" onClick={() => setSelected(new Set(entries.map((entry) => entry.id)))}>Select all</button>
          <button type="button" className="text-moss" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
        <ConfirmSubmitButton
          className="tap-primary"
          disabled={!selectedEntries.length}
          message={`Record ${formatMoney(selectedCents)} paid to ${employee} for ${selectedEntries.length} selected ${selectedEntries.length === 1 ? "shift" : "shifts"} on ${project}? This creates a linked wages expense.`}
          pendingLabel="Recording payment..."
          showDefaultIcon={false}
        >
          <WalletCards size={19} aria-hidden="true" />
          Record selected payment
        </ConfirmSubmitButton>
      </div>
    </ActionForm>
  );
}
