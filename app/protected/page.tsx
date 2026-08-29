import type { Metadata } from "next";

import LockButton from "@/components/lock-button";

export const metadata: Metadata = {
  title: "Classified archive",
};

const dossierRows = [
  ["OPERATION", "ORPHEUS / 17"],
  ["CLEARANCE", "EYES ONLY · DEMO"],
  ["RELAY", "TYO-03 / NIGHT CHANNEL"],
  ["STATUS", "ARCHIVE UNSEALED"],
] as const;

export default function ProtectedPage() {
  return (
    <main className="archive-page">
      <div className="archive-grid-noise" aria-hidden="true" />
      <div className="archive-sweep" aria-hidden="true" />

      <header className="archive-header">
        <div className="archive-brand">
          <span className="archive-brand-mark" aria-hidden="true">
            <i />
          </span>
          <div>
            <strong>GATE</strong>
            <small>CLASSIFIED ARCHIVE / SESSION ACTIVE</small>
          </div>
        </div>
        <LockButton />
      </header>

      <section className="archive-shell">
        <div className="archive-clearance">
          <span>ACCESS GRANTED</span>
          <i aria-hidden="true" />
          <span>SERVER SESSION VERIFIED</span>
        </div>

        <div className="archive-hero">
          <div className="archive-copy">
            <p className="eyebrow">DEMO INTELLIGENCE ARCHIVE · FICTIONAL DATA</p>
            <h1>ORPHEUS<br />/ 17</h1>
            <p>
              The credential you created opened a real server-protected route.
              Everything inside this archive is fictional demonstration material.
            </p>
          </div>

          <div className="archive-coordinate" aria-hidden="true">
            <div className="archive-radar">
              <span className="archive-crosshair archive-crosshair--x" />
              <span className="archive-crosshair archive-crosshair--y" />
              <i className="archive-target" />
              <b>35.6762°N<br />139.6503°E</b>
            </div>
            <small>RELAY WINDOW / 03:14:27</small>
          </div>
        </div>

        <div className="archive-dossier">
          <section className="archive-file">
            <div className="archive-section-head">
              <span>FILE 0017-A</span>
              <span>DECLASSIFICATION / NEVER</span>
            </div>
            <h2>Field packet: Nightglass</h2>
            <p>
              A deliberately fictional packet for demonstrating what Gate feels
              like after the boundary is crossed. Replace this material with the
              actual private surface in a production deployment.
            </p>
            <div className="archive-redactions" aria-label="Redacted demo document">
              <span style={{ width: "82%" }} />
              <span style={{ width: "64%" }} />
              <span style={{ width: "91%" }} />
              <span style={{ width: "47%" }} />
            </div>
          </section>

          <aside className="archive-metadata" aria-label="Fictional dossier metadata">
            {dossierRows.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </aside>
        </div>

        <div className="archive-cards">
          <article>
            <span>01 / SIGNAL</span>
            <h2>Black relay</h2>
            <p>Carrier detected at 03:14. Authentication window remains local to this demo.</p>
            <i className="archive-meter" aria-hidden="true"><b style={{ width: "72%" }} /></i>
          </article>
          <article>
            <span>02 / PACKAGE</span>
            <h2>Nightglass</h2>
            <p>Three sealed fragments. Contents intentionally fictional and non-operational.</p>
            <i className="archive-meter" aria-hidden="true"><b style={{ width: "48%" }} /></i>
          </article>
          <article>
            <span>03 / SESSION</span>
            <h2>Ephemeral clearance</h2>
            <p>Locking the facility destroys the active session and returns you to the vault.</p>
            <i className="archive-meter" aria-hidden="true"><b style={{ width: "88%" }} /></i>
          </article>
        </div>

        <div className="archive-footnote">
          <span>SIMULATION NOTICE</span>
          <p>
            Names, operation codes, coordinates context, reports and status values
            on this page are fictional UI content. Gate&apos;s route protection and
            session boundary are real.
          </p>
        </div>
      </section>
    </main>
  );
}
