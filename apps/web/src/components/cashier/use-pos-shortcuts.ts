"use client";

import { useEffect } from "react";

const FUNCTION_KEYS = new Set(["F1", "F3", "F4"]);

/**
 * F1, F3, F4 drive the POS cart (search, hold, checkout). F5/F6 (payment
 * method) and Enter (confirm) are handled inside CheckoutDialog while it's
 * open — this hook backs off whenever a dialog is on screen so it doesn't
 * fight with those.
 */
export function usePosShortcuts() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!FUNCTION_KEYS.has(e.key)) return;
      if (document.querySelector('[data-slot="dialog-content"]')) return;

      e.preventDefault();
      switch (e.key) {
        case "F1":
          document.getElementById("pos-search")?.focus();
          break;
        case "F3":
          document.getElementById("pos-hold-bill")?.click();
          break;
        case "F4":
          document.getElementById("pos-checkout-trigger")?.click();
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
