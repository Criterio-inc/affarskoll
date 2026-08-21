"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const STORAGE_KEY = "affarskoll:last-notification-generation";
const ONCE_PER_HOURS = 6;

/**
 * Fas 5.1: Triggers /api/notifications/generate on mount if not run in last N hours.
 * Keeps notifications fresh without relying solely on the daily cron.
 */
export function useNotificationGenerator() {
  const qc = useQueryClient();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    try {
      const last = localStorage.getItem(STORAGE_KEY);
      if (last) {
        const lastMs = Number(last);
        const hoursSince = (Date.now() - lastMs) / (1000 * 60 * 60);
        if (hoursSince < ONCE_PER_HOURS) return;
      }
    } catch {
      // localStorage unavailable — still run
    }

    fetch("/api/notifications/generate", { method: "POST" })
      .then((res) => {
        if (!res.ok) return;
        try {
          localStorage.setItem(STORAGE_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
        // Invalidate notifications so new ones show up
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .catch(() => {
        /* silent */
      });
  }, [qc]);
}
