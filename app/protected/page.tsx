import type { Metadata } from "next";

import LockButton from "@/components/lock-button";

export const metadata: Metadata = {
  title: "Access granted",
};

export default function ProtectedPage() {
  return (
    <main className="protected-page">
      <div className="protected-noise" aria-hidden="true" />
      <header className="protected-header">
        <div className="protected-brand">
          <span className="protected-brand-mark" aria-hidden="true" />
          <div>
            <strong>GATE</strong>
            <small>SESSION ACTIVE</small>
          </div>
        </div>
        <LockButton />
      </header>

      <section className="protected-shell">
        <div className="protected-status">
          <span>ACCESS GRANTED</span>
          <i aria-hidden="true" />
        </div>

        <div className="protected-copy">
          <p className="eyebrow">PRIVATE AREA / REFERENCE VIEW</p>
          <h1>The browser dialog is gone.</h1>
          <p>
            Gate keeps the protected route server-side while giving the entrance
            a deliberate product experience. Replace this reference page with
            the application content you actually want to protect.
          </p>
        </div>

        <div className="protected-grid">
          <article>
            <span>01</span>
            <h2>Signed session</h2>
            <p>HttpOnly cookie with HMAC verification and a bounded lifetime.</p>
          </article>
          <article>
            <span>02</span>
            <h2>Server boundary</h2>
            <p>Next.js Proxy rejects unauthenticated requests before rendering.</p>
          </article>
          <article>
            <span>03</span>
            <h2>Replaceable surface</h2>
            <p>Vault, Cipher, and Classic are UI layers over the same gate.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
