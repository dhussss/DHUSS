"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 15_000;
const MIN_REFRESH_GAP_MS = 10_000;

export function LiveTeamRefresh() {
  const router = useRouter();

  useEffect(() => {
    let lastRefreshAt = Date.now();

    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;

      const now = Date.now();
      if (now - lastRefreshAt < MIN_REFRESH_GAP_MS) return;

      lastRefreshAt = now;
      router.refresh();
    };

    const interval = window.setInterval(refreshWhenVisible, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router]);

  return null;
}
