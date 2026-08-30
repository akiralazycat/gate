"use client";

import { useState } from "react";

import { HouseBar } from "@/components/house-bar";

export default function DemoArchive() {
  const [fragmentOpen, setFragmentOpen] = useState(false);
  const [coordinatesOpen, setCoordinatesOpen] = useState(false);
  const [locking, setLocking] = useState(false);

  async function lockFacility() {
    if (locking) return;
    setLocking(true);
    try {
      await fetch("/api/demo/logout", { method: "POST" });
    } finally {
      window.location.assign("/demo?sealed=1");
    }
  }

  return (
    <>
      <HouseBar product="Gate" />
      <main className="demo-archive-page">
        <div className="demo-grid" aria-hidden="true" />
        <header className="demo-archive-header">
          <div className="demo-archive-brand">
            <span className="demo-archive-signal" aria-hidden="true" />
            <div><strong>GATE</strong><small>SESSION ACTIVE / OBSIDIAN</small></div>
          </div>
          <button type="button" className="demo-lock-button" onClick={lockFacility} disabled={locking}>
            {locking ? "SEALING…" : "LOCK FACILITY"}
          </button>
        </header>

        <section className="demo-archive-shell">
          <div className="demo-clearance-line"><i /> ACCESS GRANTED · EYES ONLY</div>

          <div className="demo-dossier-heading">
            <div>
              <span className="demo-eyebrow">PRIVATE INTELLIGENCE ARCHIVE / CASE 01</span>
              <h1>ORPHEUS</h1>
              <p>The lock opened because the server accepted the sequence you created moments ago. This room is rendered only while the temporary signed demo session is valid.</p>
            </div>
            <dl>
              <div><dt>CLEARANCE</dt><dd>OBSIDIAN</dd></div>
              <div><dt>NODE</dt><dd>TYO-07</dd></div>
              <div><dt>STATUS</dt><dd>ACTIVE</dd></div>
              <div><dt>CHANNEL</dt><dd>LOCAL</dd></div>
            </dl>
          </div>

          <div className="demo-dossier-grid">
            <article className="demo-case-card demo-case-card--primary">
              <div className="demo-case-top"><span>INTERCEPT / 08-29</span><b>CLASSIFIED</b></div>
              <div className="demo-signal-map" aria-hidden="true">
                <span className="demo-signal-point demo-signal-point--one" />
                <span className="demo-signal-point demo-signal-point--two" />
                <span className="demo-signal-line" />
              </div>
              <h2>Last signal</h2>
              <p>Encrypted burst detected from an unregistered relay. Origin confidence remains below operational threshold.</p>
              <button type="button" onClick={() => setCoordinatesOpen((value) => !value)}>
                {coordinatesOpen ? "HIDE COORDINATES" : "REVEAL COORDINATES"}
              </button>
              <div className={`demo-reveal ${coordinatesOpen ? "is-open" : ""}`}>
                <code>35.6762° N / 139.6503° E</code>
                <small>DEMO DATA · NOT A REAL TARGET</small>
              </div>
            </article>

            <article className="demo-case-card">
              <div className="demo-case-top"><span>FRAGMENT / 7F-A1-03</span><b>SEALED</b></div>
              <div className="demo-redacted-copy" aria-hidden="true">
                <span /><span /><span className="short" /><span /><span className="medium" />
              </div>
              <h2>Recovered fragment</h2>
              <p>A short payload survived the relay shutdown. Local decryption is available for this demonstration.</p>
              <button type="button" onClick={() => setFragmentOpen((value) => !value)}>
                {fragmentOpen ? "REDACT FRAGMENT" : "DECRYPT FRAGMENT"}
              </button>
              <div className={`demo-reveal ${fragmentOpen ? "is-open" : ""}`}>
                <p>“The door was never the secret. The sequence was.”</p>
              </div>
            </article>

            <article className="demo-case-card demo-case-card--session">
              <div className="demo-case-top"><span>SESSION / CURRENT</span><b>VERIFIED</b></div>
              <h2>Why this room opened</h2>
              <ul>
                <li><span>01</span>Your raw PIN was converted into a PBKDF2 verifier.</li>
                <li><span>02</span>The unlock request was checked on the server.</li>
                <li><span>03</span>A temporary HMAC-signed demo session was issued.</li>
              </ul>
            </article>
          </div>
        </section>
      </main>
    </>
  );
}
