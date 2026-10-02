"use client";

import { useState } from "react";

export function InvoiceScopeFields({ initialScope, start, end }: { initialScope: "all" | "range"; start: string; end: string }) {
  const [scope, setScope] = useState(initialScope);
  return (
    <>
      <label>
        Work to invoice
        <select name="scope" value={scope} onChange={(event) => setScope(event.target.value as "all" | "range")}>
          <option value="all">All unbilled work</option>
          <option value="range">Choose a date range</option>
        </select>
      </label>
      {scope === "range" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label>Start date<input type="date" name="dateRangeStart" defaultValue={start} required /></label>
          <label>End date<input type="date" name="dateRangeEnd" defaultValue={end} required /></label>
        </div>
      )}
    </>
  );
}
