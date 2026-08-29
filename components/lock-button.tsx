"use client";

import { useState } from "react";

export default function LockButton() {
  const [busy, setBusy] = useState(false);

  async function lock() {
    if (busy) return;
    setBusy(true);

    try {
      await fetch("/api/gate/logout", { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <button className="protected-lock" type="button" onClick={lock} disabled={busy}>
      {busy ? "SEALING…" : "LOCK FACILITY"}
      <span aria-hidden="true">↗</span>
    </button>
  );
}
