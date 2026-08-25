"use client";

import { useState } from "react";

export default function LockButton() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function lock() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch("/api/gate/logout", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("logout_failed");
      window.location.replace("/");
    } catch {
      setFailed(true);
      setBusy(false);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return (
    <button className="protected-lock" type="button" onClick={lock} disabled={busy}>
      {busy ? "Locking…" : failed ? "Lock failed · retry" : "Lock gate"}
      <span aria-hidden="true">↗</span>
    </button>
  );
}
