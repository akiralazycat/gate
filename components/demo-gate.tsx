"use client";

import { useEffect, useMemo, useState } from "react";

import { HouseBar } from "@/components/house-bar";

type DemoGateProps = {
  initialized: boolean;
  expiresAt: number | null;
  pinLength: number;
};

type DemoState =
  | "setup"
  | "confirm"
  | "arming"
  | "locked"
  | "verifying"
  | "denied"
  | "unlocking";

function GateMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="demo-mark">
      <rect x="4.5" y="4.5" width="23" height="23" rx="7" fill="none" />
      <path d="M10.5 16h11" />
      <circle cx="16" cy="16" r="2.75" />
    </svg>
  );
}

function formatRemaining(expiresAt: number | null, now: number) {
  if (!expiresAt) return "30:00";
  const seconds = Math.max(0, expiresAt - Math.floor(now / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function PinDots({ value, length }: { value: string; length: number }) {
  return (
    <div className="demo-pin-dots" aria-label={`${value.length} of ${length} digits entered`}>
      {Array.from({ length }).map((_, index) => (
        <span key={index} className={index < value.length ? "is-filled" : ""}>
          <i />
        </span>
      ))}
    </div>
  );
}

function Keypad({
  value,
  length,
  disabled,
  onChange,
}: {
  value: string;
  length: number;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  function add(digit: string) {
    if (disabled || value.length >= length) return;
    onChange(`${value}${digit}`);
  }

  return (
    <div className="demo-keypad" aria-label="Numeric keypad">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
        <button key={digit} type="button" disabled={disabled} onClick={() => add(digit)}>
          {digit}
        </button>
      ))}
      <button type="button" disabled={disabled} className="demo-keypad-action" onClick={() => onChange("")}>
        CLR
      </button>
      <button type="button" disabled={disabled} onClick={() => add("0")}>
        0
      </button>
      <button
        type="button"
        disabled={disabled}
        className="demo-keypad-action"
        aria-label="Delete last digit"
        onClick={() => onChange(value.slice(0, -1))}
      >
        DEL
      </button>
    </div>
  );
}

export default function DemoGate({ initialized, expiresAt: initialExpiry, pinLength }: DemoGateProps) {
  const [state, setState] = useState<DemoState>(initialized ? "locked" : "setup");
  const [setupPin, setSetupPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [entryPin, setEntryPin] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [armingStep, setArmingStep] = useState(0);
  const [expiresAt, setExpiresAt] = useState<number | null>(initialExpiry);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState("Establish a temporary access sequence.");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (expiresAt && expiresAt <= Math.floor(now / 1000) && state !== "setup") {
      setExpiresAt(null);
      setEntryPin("");
      setSetupPin("");
      setConfirmPin("");
      setState("setup");
      setMessage("Demo facility expired. Establish a new access sequence.");
    }
  }, [expiresAt, now, state]);

  useEffect(() => {
    if (state !== "arming") return;
    setArmingStep(0);
    const timers = [1, 2, 3, 4].map((step) =>
      window.setTimeout(() => setArmingStep(step), step * 360),
    );
    const lockTimer = window.setTimeout(() => {
      setEntryPin("");
      setState("locked");
      setMessage("Facility sealed. Your credential is now required.");
    }, 1900);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(lockTimer);
    };
  }, [state]);

  const remaining = useMemo(() => formatRemaining(expiresAt, now), [expiresAt, now]);

  function startConfirmation() {
    if (setupPin.length !== pinLength) return;
    setConfirmPin("");
    setMessage("Repeat the sequence to seal it.");
    setState("confirm");
  }

  async function sealCredential() {
    if (confirmPin.length !== pinLength) return;
    if (confirmPin !== setupPin) {
      setConfirmPin("");
      setMessage("Sequences did not match. Re-enter confirmation.");
      return;
    }

    setMessage("Writing credential verifier to the demo vault.");
    try {
      const response = await fetch("/api/demo/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin: setupPin, confirm: confirmPin }),
      });
      const result = (await response.json()) as { ok?: boolean; expiresAt?: number };
      if (!response.ok || !result.ok) throw new Error("setup failed");
      setExpiresAt(result.expiresAt ?? null);
      setSetupPin("");
      setConfirmPin("");
      setState("arming");
    } catch {
      setMessage("Initialization failed. Try again.");
      setState("setup");
    }
  }

  async function unlock() {
    if (entryPin.length !== pinLength || state === "verifying" || state === "unlocking") return;
    setState("verifying");
    setMessage("Comparing credential verifier.");

    try {
      const response = await fetch("/api/demo/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin: entryPin }),
      });

      if (response.status === 409) {
        setExpiresAt(null);
        setEntryPin("");
        setState("setup");
        setMessage("Demo facility expired. Establish a new access sequence.");
        return;
      }

      if (!response.ok) {
        setAttempts((value) => value + 1);
        setEntryPin("");
        setState("denied");
        setMessage("Credential rejected. Access remains sealed.");
        window.setTimeout(() => setState("locked"), 850);
        return;
      }

      setState("unlocking");
      setMessage("Credential match. Session signed. Retracting bolts.");
      window.setTimeout(() => window.location.assign("/demo/archive"), 1700);
    } catch {
      setEntryPin("");
      setState("denied");
      setMessage("Secure channel interrupted. Try again.");
      window.setTimeout(() => setState("locked"), 850);
    }
  }

  async function resetDemo() {
    await fetch("/api/demo/reset", { method: "POST" });
    setSetupPin("");
    setConfirmPin("");
    setEntryPin("");
    setAttempts(0);
    setExpiresAt(null);
    setMessage("Establish a temporary access sequence.");
    setState("setup");
  }

  const locked = state === "locked" || state === "verifying" || state === "denied" || state === "unlocking";

  return (
    <>
      <HouseBar product="Gate" />
      <main className={`demo-page demo-page--${state}`}>
        <div className="demo-grid" aria-hidden="true" />
        <header className="demo-header">
          <a className="demo-brand" href="/demo" aria-label="Gate demo home">
            <GateMark />
            <span><strong>GATE</strong><small>INTERACTIVE FACILITY</small></span>
          </a>
          <div className="demo-channel"><i /> LOCAL DEMO / SERVER VERIFIED</div>
        </header>

        <section className="demo-stage">
          <div className="demo-copy">
            <span className="demo-eyebrow">TEMPORARY FACILITY · TYO-07</span>
            <h1>{state === "setup" || state === "confirm" ? "Initialize your gate." : "Private archive sealed."}</h1>
            <p>{message}</p>
          </div>

          <div className="demo-console">
            <div className={`demo-vault ${locked ? "is-locked" : ""} ${state === "unlocking" ? "is-opening" : ""} ${state === "denied" ? "is-denied" : ""}`}>
              <div className="demo-vault-door" aria-hidden="true">
                <div className="demo-vault-ring demo-vault-ring--outer" />
                <div className="demo-vault-ring demo-vault-ring--middle" />
                <div className="demo-vault-ring demo-vault-ring--inner" />
                <span className="demo-bolt demo-bolt--top" />
                <span className="demo-bolt demo-bolt--right" />
                <span className="demo-bolt demo-bolt--bottom" />
                <span className="demo-bolt demo-bolt--left" />
                <div className="demo-vault-core"><GateMark /></div>
              </div>

              <div className="demo-panel">
                <div className="demo-panel-meta">
                  <span>{state === "setup" || state === "confirm" ? "BOOTSTRAP" : "SECURITY VAULT"}</span>
                  <span>{expiresAt ? `SELF-DESTRUCT ${remaining}` : "UNARMED"}</span>
                </div>

                {state === "setup" ? (
                  <>
                    <div className="demo-instruction"><b>01</b><span>Create a six-digit access sequence.</span></div>
                    <PinDots value={setupPin} length={pinLength} />
                    <Keypad value={setupPin} length={pinLength} onChange={setSetupPin} />
                    <button className="demo-primary" type="button" disabled={setupPin.length !== pinLength} onClick={startConfirmation}>
                      SET ACCESS SEQUENCE <span>→</span>
                    </button>
                  </>
                ) : null}

                {state === "confirm" ? (
                  <>
                    <div className="demo-instruction"><b>02</b><span>Confirm the sequence. The raw PIN will not be stored.</span></div>
                    <PinDots value={confirmPin} length={pinLength} />
                    <Keypad value={confirmPin} length={pinLength} onChange={setConfirmPin} />
                    <button className="demo-primary" type="button" disabled={confirmPin.length !== pinLength} onClick={sealCredential}>
                      SEAL CREDENTIAL <span>→</span>
                    </button>
                    <button className="demo-text-button" type="button" onClick={() => setState("setup")}>← CHANGE SEQUENCE</button>
                  </>
                ) : null}

                {state === "arming" ? (
                  <div className="demo-arming" aria-live="polite">
                    {["HASHING CREDENTIAL", "SEALING ACCESS POLICY", "SIGNING FACILITY KEY", "GATE ARMED"].map((label, index) => (
                      <div key={label} className={armingStep > index ? "is-complete" : armingStep === index ? "is-active" : ""}>
                        <span>{label}</span><i />
                      </div>
                    ))}
                  </div>
                ) : null}

                {locked ? (
                  <>
                    <div className="demo-instruction"><b>{String(attempts + 1).padStart(2, "0")}</b><span>Enter the sequence you just created.</span></div>
                    <PinDots value={entryPin} length={pinLength} />
                    <Keypad
                      value={entryPin}
                      length={pinLength}
                      disabled={state === "verifying" || state === "unlocking"}
                      onChange={(value) => {
                        setEntryPin(value);
                        if (state === "denied") setState("locked");
                      }}
                    />
                    <button className="demo-primary" type="button" disabled={entryPin.length !== pinLength || state === "verifying" || state === "unlocking"} onClick={unlock}>
                      {state === "verifying" ? "VERIFYING" : state === "unlocking" ? "RETRACTING BOLTS" : "UNLOCK GATE"} <span>→</span>
                    </button>
                    <button className="demo-text-button" type="button" onClick={resetDemo}>REINITIALIZE FACILITY</button>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="demo-status" role="status" aria-live="polite">
            <i />
            <span>{state === "denied" ? "ACCESS DENIED" : state === "unlocking" ? "ACCESS GRANTED" : state === "arming" ? "ARMING FACILITY" : locked ? "GATE LOCKED" : "INITIALIZATION MODE"}</span>
            <small>Demo credentials expire automatically and never touch production Gate credentials.</small>
          </div>
        </section>
      </main>
    </>
  );
}
