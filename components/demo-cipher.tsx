"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { HouseBar } from "@/components/house-bar";
import type { DemoCipherChallenge } from "@/lib/demo-gate";

type CipherStatus = "loading" | "ready" | "verifying" | "denied" | "granted" | "expired";

type DemoCipherProps = {
  expiresAt: number;
  pinLength: number;
};

function GateMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="demo-mark">
      <rect x="4.5" y="4.5" width="23" height="23" rx="7" fill="none" />
      <path d="M10.5 16h11" />
      <circle cx="16" cy="16" r="2.75" />
    </svg>
  );
}

function formatSeconds(seconds: number) {
  return `00:${String(Math.max(0, seconds)).padStart(2, "0")}`;
}

function formatFacilityRemaining(expiresAt: number, now: number) {
  const seconds = Math.max(0, expiresAt - Math.floor(now / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function DemoCipher({ expiresAt, pinLength }: DemoCipherProps) {
  const [challenge, setChallenge] = useState<DemoCipherChallenge | null>(null);
  const [responseKey, setResponseKey] = useState("");
  const [status, setStatus] = useState<CipherStatus>("loading");
  const [now, setNow] = useState(Date.now());
  const [attempts, setAttempts] = useState(0);
  const [verifyStep, setVerifyStep] = useState(0);
  const requestedOnMount = useRef(false);

  const issueChallenge = useCallback(async () => {
    setStatus("loading");
    setChallenge(null);
    setResponseKey("");
    setVerifyStep(0);

    try {
      const response = await fetch("/api/demo/cipher/challenge", { method: "POST" });
      if (response.status === 409) {
        window.location.assign("/demo");
        return;
      }
      const result = (await response.json()) as {
        ok?: boolean;
        challenge?: DemoCipherChallenge;
      };
      if (!response.ok || !result.ok || !result.challenge) {
        throw new Error("challenge failed");
      }
      setChallenge(result.challenge);
      setStatus("ready");
    } catch {
      setStatus("expired");
    }
  }, []);

  useEffect(() => {
    if (requestedOnMount.current) return;
    requestedOnMount.current = true;
    void issueChallenge();
  }, [issueChallenge]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const challengeRemaining = useMemo(() => {
    if (!challenge) return 0;
    return Math.max(0, challenge.expiresAt - Math.floor(now / 1000));
  }, [challenge, now]);

  const facilityRemaining = useMemo(
    () => formatFacilityRemaining(expiresAt, now),
    [expiresAt, now],
  );

  useEffect(() => {
    if (expiresAt <= Math.floor(now / 1000)) {
      window.location.assign("/demo");
      return;
    }
    if (status === "ready" && challenge && challengeRemaining <= 0) {
      setStatus("expired");
      const timer = window.setTimeout(() => void issueChallenge(), 550);
      return () => window.clearTimeout(timer);
    }
  }, [challenge, challengeRemaining, expiresAt, issueChallenge, now, status]);

  async function submitResponse(event: FormEvent) {
    event.preventDefault();
    if (!challenge || responseKey.length !== pinLength || status !== "ready") return;

    setStatus("verifying");
    setVerifyStep(1);
    const stageTwo = window.setTimeout(() => setVerifyStep(2), 260);
    const stageThree = window.setTimeout(() => setVerifyStep(3), 520);

    try {
      const response = await fetch("/api/demo/cipher/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          response: responseKey,
        }),
      });

      window.clearTimeout(stageTwo);
      window.clearTimeout(stageThree);

      if (response.status === 409) {
        setStatus("expired");
        setVerifyStep(0);
        setResponseKey("");
        window.setTimeout(() => void issueChallenge(), 650);
        return;
      }

      if (!response.ok) {
        setAttempts((value) => value + 1);
        setStatus("denied");
        setVerifyStep(0);
        setResponseKey("");
        window.setTimeout(() => void issueChallenge(), 950);
        return;
      }

      setVerifyStep(3);
      window.setTimeout(() => setStatus("granted"), 240);
      window.setTimeout(() => window.location.assign("/demo/archive"), 1450);
    } catch {
      window.clearTimeout(stageTwo);
      window.clearTimeout(stageThree);
      setStatus("expired");
      setVerifyStep(0);
      setResponseKey("");
      window.setTimeout(() => void issueChallenge(), 750);
    }
  }

  const statusLabel =
    status === "granted"
      ? "SESSION CIPHER ESTABLISHED"
      : status === "denied"
        ? "RESPONSE REJECTED / CHALLENGE CONSUMED"
        : status === "verifying"
          ? "PROCESSING RESPONSE"
          : status === "expired"
            ? "CHALLENGE CLOSED / ROTATING"
            : status === "loading"
              ? "REQUESTING SERVER CHALLENGE"
              : "RESPONSE WINDOW OPEN";

  return (
    <>
      <HouseBar product="Gate" />
      <main className={`cipher-demo-page cipher-demo-page--${status}`}>
        <div className="cipher-demo-grid" aria-hidden="true" />
        <div className="cipher-demo-scan" aria-hidden="true" />

        <header className="cipher-demo-header">
          <a className="demo-brand" href="/demo/cipher" aria-label="Gate Cipher demo">
            <GateMark />
            <span><strong>GATE</strong><small>CIPHER / CHALLENGE RESPONSE</small></span>
          </a>
          <div className="cipher-demo-transport"><i /> SAME-ORIGIN / SERVER VERIFIED</div>
        </header>

        <section className="cipher-demo-stage">
          <div className="cipher-demo-heading">
            <div>
              <span className="cipher-demo-eyebrow">INTELLIGENCE CHANNEL · CIPHER 02</span>
              <h1>Respond before the window closes.</h1>
              <p>The server issues a signed, short-lived challenge. Every response consumes it.</p>
            </div>
            <div className="cipher-demo-clock">
              <span>FACILITY TTL</span>
              <strong>{facilityRemaining}</strong>
            </div>
          </div>

          <div className="cipher-demo-console">
            <aside className="cipher-demo-radar" aria-hidden="true">
              <div className="cipher-radar-ring cipher-radar-ring--one" />
              <div className="cipher-radar-ring cipher-radar-ring--two" />
              <div className="cipher-radar-ring cipher-radar-ring--three" />
              <div className="cipher-radar-axis cipher-radar-axis--x" />
              <div className="cipher-radar-axis cipher-radar-axis--y" />
              <div className="cipher-radar-sweep" />
              <i className="cipher-radar-target cipher-radar-target--one" />
              <i className="cipher-radar-target cipher-radar-target--two" />
              <div className="cipher-radar-label">TYO / SECURE RELAY</div>
            </aside>

            <div className="cipher-demo-terminal">
              <div className="cipher-terminal-topline">
                <span>GATE//CIPHER</span>
                <span>ATTEMPT {String(attempts + 1).padStart(2, "0")}</span>
              </div>

              <div className="cipher-challenge-board">
                <div>
                  <span>CHALLENGE</span>
                  <strong>{challenge?.id ?? "-- -- -- --"}</strong>
                </div>
                <div>
                  <span>NONCE</span>
                  <strong>{challenge?.nonce ?? "---- ---- ---- ----"}</strong>
                </div>
                <div>
                  <span>NODE</span>
                  <strong>{challenge?.node ?? "TYO-07"}</strong>
                </div>
                <div>
                  <span>COORDINATES</span>
                  <strong>{challenge?.coordinates ?? "35.6762N / 139.6503E"}</strong>
                </div>
              </div>

              <div className="cipher-window-meter" aria-label={`${challengeRemaining} seconds remaining`}>
                <div>
                  <span>RESPONSE WINDOW</span>
                  <strong>{formatSeconds(challengeRemaining)}</strong>
                </div>
                <i style={{ transform: `scaleX(${challenge ? challengeRemaining / challenge.windowSeconds : 0})` }} />
              </div>

              <form className="cipher-response-form" onSubmit={submitResponse}>
                <label>
                  <span>OPERATOR RESPONSE / SHARED SECRET</span>
                  <div className="cipher-response-line">
                    <b>&gt;</b>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      autoFocus
                      value={responseKey}
                      disabled={status !== "ready"}
                      maxLength={pinLength}
                      placeholder="••••••"
                      onChange={(event) => {
                        const next = event.target.value.replace(/\D/g, "").slice(0, pinLength);
                        setResponseKey(next);
                      }}
                    />
                    <em>{responseKey.length}/{pinLength}</em>
                  </div>
                </label>
                <button type="submit" disabled={status !== "ready" || responseKey.length !== pinLength}>
                  <span>{status === "ready" ? "TRANSMIT RESPONSE" : "CHANNEL BUSY"}</span>
                  <span>↗</span>
                </button>
              </form>

              <div className="cipher-verification-sequence" aria-live="polite">
                <div className={verifyStep >= 1 ? "is-active" : ""}><span>01</span> VERIFY CHALLENGE SIGNATURE</div>
                <div className={verifyStep >= 2 ? "is-active" : ""}><span>02</span> DERIVE RESPONSE VERIFIER</div>
                <div className={verifyStep >= 3 ? "is-active" : ""}><span>03</span> ESTABLISH HMAC SESSION</div>
              </div>

              <div className={`cipher-terminal-status cipher-terminal-status--${status}`} role="status">
                <i />
                <span>{statusLabel}</span>
                {status === "ready" ? (
                  <button type="button" onClick={() => void issueChallenge()}>ROTATE CHALLENGE</button>
                ) : null}
              </div>

              <div className="cipher-terminal-meta" aria-hidden="true">
                <span>CHALLENGE/HMAC-SIGNED</span>
                <span>WINDOW/30S</span>
                <span>RESPONSE/ONE-SHOT</span>
                <span>SESSION/HMAC-SHA-256</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
