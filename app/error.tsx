"use client";

import { useEffect } from "react";

export default function GateError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Gate route failed", error.digest ?? "no-digest");
  }, [error]);

  return (
    <main className="gate-page gate-page--classic">
      <section className="gate-stage" aria-labelledby="gate-error-title">
        <div className="gate-intro">
          <span className="eyebrow">SERVICE INTERRUPTION</span>
          <h1 id="gate-error-title">Gate could not load.</h1>
          <p>No credential was submitted. Retry the request or contact the operator.</p>
        </div>
        <button className="classic-submit" type="button" onClick={reset}>
          Retry
        </button>
      </section>
    </main>
  );
}
