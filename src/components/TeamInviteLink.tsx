"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function TeamInviteLink({ code, joinUrl }: { code: string; joinUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copyInvite() {
    await navigator.clipboard.writeText(`Join my Trade Invoice Tracker team:\n${joinUrl}\n\nInvitation code: ${code}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mt-4 grid gap-3 rounded-2xl border border-mint/25 bg-mint/10 p-4">
      <div>
        <p className="text-sm font-semibold text-moss">Invitation code</p>
        <p className="mt-1 break-all text-2xl font-black tracking-tight text-ink">{code}</p>
      </div>
      <p className="break-all text-sm font-medium leading-6 text-moss">{joinUrl}</p>
      <button type="button" className="tap-primary" onClick={copyInvite}>
        {copied ? <Check size={19} aria-hidden="true" /> : <Copy size={19} aria-hidden="true" />}
        {copied ? "Copied" : "Copy invitation"}
      </button>
    </div>
  );
}
