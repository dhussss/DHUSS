"use client";

import { useState, type ReactNode } from "react";

export function InvoiceReviewGate({ filters, children }: { filters: ReactNode; children: ReactNode }) {
  const [changed, setChanged] = useState(false);
  return (
    <>
      <div onChangeCapture={() => setChanged(true)}>{filters}</div>
      {changed && <p role="status" className="mt-4 text-sm font-semibold text-moss">Selection changed. Review work before saving this draft.</p>}
      <fieldset disabled={changed} className="min-w-0" aria-label="Reviewed invoice">
        {children}
      </fieldset>
    </>
  );
}
