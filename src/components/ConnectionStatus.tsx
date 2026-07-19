"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CloudOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/use-online-status";

export function ConnectionStatus() {
  const online = useOnlineStatus();
  const wasOffline = useRef(false);
  const [showRecovered, setShowRecovered] = useState(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setShowRecovered(false);
      return;
    }
    if (!wasOffline.current) return;

    wasOffline.current = false;
    setShowRecovered(true);
    const timer = window.setTimeout(() => setShowRecovered(false), 3500);
    return () => window.clearTimeout(timer);
  }, [online]);

  if (online && !showRecovered) return null;

  return (
    <div className={`no-print fixed inset-x-3 top-16 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold shadow-lift lg:left-auto lg:right-5 lg:top-5 ${online ? "border-mint/30 bg-white text-mint" : "border-yolk/40 bg-ink text-white"}`} role="status" aria-live="polite">
      {online ? <CheckCircle2 size={19} aria-hidden="true" /> : <CloudOff size={19} className="text-yolk" aria-hidden="true" />}
      <span>{online ? "Back online. Saving is available again." : "You’re offline. Unfinished work entries will stay on this device."}</span>
    </div>
  );
}
