"use client";

import { useEffect, useMemo, useState } from "react";

import { HouseBar } from "@/components/house-bar";

type DemoGateShellProps = {
  name: string;
  message: string;
  pinLength: number;
  available: boolean;
  initialized: boolean;
  initialExpiresAt: number | null;
};

type DemoStatus =
  | "setup"
  | "confirming"
  | "arming"
  | "locked"
  | "checking"
  | "denied"
  | "granted"
  | "config";

const armingSteps = [
  "HASHING DEMO CREDENTIAL",
  "SEALING TEMPORARY POLICY",
  "SIGNING CREDENTIAL VERIFIER",
  "GATE ARMED",
] as const;

function GateMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="gate-mark">
      <rect x="4.5" y="4.5" width="23" height="23" rx="7" fill="none" />
      <path d="M10.5 16h11" />
      <circle cx="16" cy="16" r="2.75" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 6l4 4-4 4" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7.5 5 3 10l4.5 5H17V5H7.5Z" />
      <path d="m10 8 4 4m0-4-4 4" />
    </svg>
  );
}

function safeNextPath() {
  const value = new URLSearchParams(window.location.search).get("next");
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/protected";
}

function formatCountdown(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export default function DemoGateShell({
  name,
  message,
  pinLength,
  available,
  initialized,
  initialExpiresAt,
}: DemoGateShellProps) {
  const [status, setStatus] = useState<DemoStatus>(
    !available ? "config" : initialized ? "locked" : "setup",
  );
  const [secret, setSecret] = useState("");
  const [pendingPin, setPendingPin] = useState("");
  const [setupError, setSetupError] = useState("");
  const [setupBusy, setSetupBusy] = useState(false);
  const [armingStep, setArmingStep] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [demoInitialized, setDemoInitialized] = useState(initialized);
  const [expiresAt, setExpiresAt] = useState<number | null>(initialExpiresAt);
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    initialExpiresAt
      ? Math.max(0, Math.ceil((initialExpiresAt - Date.now()) / 1000))
      : 0,
  );

  useEffect(() => {
    if (!demoInitialized || !expiresAt) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        setDemoInitialized(false);
        setSecret("");
        setPendingPin("");
        setStatus("setup");
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [demoInitialized, expiresAt]);

  useEffect(() => {
    const acceptsDigits = ["setup", "confirming", "locked", "denied"].includes(status);
    if (!acceptsDigits) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        setSecret((value) =>
          value.length < pinLength ? `${value}${event.key}` : value,
        );
        if (status === "denied") setStatus("locked");
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        setSecret((value) => value.slice(0, -1));
        if (status === "denied") setStatus("locked");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pinLength, status]);

  const statusCopy = useMemo(() => {
    switch (status) {
      case "setup":
        return "Create a temporary access sequence";
      case "confirming":
        return setupError || "Confirm the sequence";
      case "arming":
        return armingSteps[armingStep];
      case "checking":
        return "Verifying credential";
      case "denied":
        return `Credential rejected · attempt ${String(attempts).padStart(2, "0")}`;
      case "granted":
        return "Clearance accepted · opening vault";
      case "config":
        return "Interactive demo is not configured";
      default:
        return "Gate locked";
    }
  }, [armingStep, attempts, setupError, status]);

  function addDigit(digit: string) {
    if (
      secret.length >= pinLength ||
      ["arming", "checking", "granted", "config"].includes(status)
    ) {
      return;
    }
    setSecret((value) => `${value}${digit}`);
    if (status === "denied") setStatus("locked");
    if (setupError) setSetupError("");
  }

  function removeDigit() {
    if (["arming", "checking", "granted", "config"].includes(status)) return;
    setSecret((value) => value.slice(0, -1));
    if (status === "denied") setStatus("locked");
    if (setupError) setSetupError("");
  }

  async function confirmDemoCredential() {
    if (secret.length !== pinLength || setupBusy) return;

    if (secret !== pendingPin) {
      setSecret("");
      setSetupError("Sequences do not match · try again");
      return;
    }

    setSetupBusy(true);
    setSetupError("");

    try {
      const response = await fetch("/api/gate/demo/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          password: pendingPin,
          confirmation: secret,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        expiresAt?: number;
      };

      if (!response.ok || !result.ok || typeof result.expiresAt !== "number") {
        setStatus(response.status === 503 ? "config" : "setup");
        setPendingPin("");
        setSecret("");
        setSetupError("Unable to arm this demo credential");
        return;
      }

      setSecret("");
      setStatus("arming");
      for (let step = 0; step < armingSteps.length; step += 1) {
        setArmingStep(step);
        await sleep(step === armingSteps.length - 1 ? 720 : 430);
      }

      setDemoInitialized(true);
      setExpiresAt(result.expiresAt);
      setRemainingSeconds(
        Math.max(0, Math.ceil((result.expiresAt - Date.now()) / 1000)),
      );
      setPendingPin("");
      setStatus("locked");
    } catch {
      setStatus("setup");
      setPendingPin("");
      setSecret("");
      setSetupError("Unable to arm this demo credential");
    } finally {
      setSetupBusy(false);
    }
  }

  async function unlockGate() {
    if (!demoInitialized || secret.length !== pinLength || status === "checking") {
      return;
    }

    setStatus("checking");

    try {
      const response = await fetch("/api/gate/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "vault", password: secret }),
      });

      if (!response.ok) {
        setAttempts((value) => value + 1);
        setSecret("");
        setStatus(response.status === 503 ? "config" : "denied");
        return;
      }

      setSecret("");
      setStatus("granted");
      window.setTimeout(() => window.location.assign(safeNextPath()), 1650);
    } catch {
      setAttempts((value) => value + 1);
      setSecret("");
      setStatus("denied");
    }
  }

  async function primaryAction() {
    if (status === "setup") {
      if (secret.length !== pinLength) return;
      setPendingPin(secret);
      setSecret("");
      setSetupError("");
      setStatus("confirming");
      return;
    }

    if (status === "confirming") {
      await confirmDemoCredential();
      return;
    }

    if (status === "locked" || status === "denied") {
      await unlockGate();
    }
  }

  async function resetDemo() {
    if (["arming", "checking", "granted"].includes(status)) return;

    try {
      await fetch("/api/gate/demo/reset", { method: "POST" });
    } finally {
      setDemoInitialized(false);
      setExpiresAt(null);
      setRemainingSeconds(0);
      setPendingPin("");
      setSecret("");
      setAttempts(0);
      setSetupError("");
      setStatus(available ? "setup" : "config");
    }
  }

  const panelLabel =
    status === "setup"
      ? "INITIALIZE GATE"
      : status === "confirming"
        ? "CONFIRM SEQUENCE"
        : status === "arming"
          ? "ARMING SEQUENCE"
          : "SECURITY VAULT";

  const hint =
    status === "setup"
      ? `Choose a ${pinLength}-digit PIN. This temporary demo key stays in this browser only.`
      : status === "confirming"
        ? "Enter the same sequence once more."
        : status === "arming"
          ? "The server has accepted the verifier. Sealing the temporary facility now."
          : "Enter the access sequence you created to open the archive.";

  const buttonLabel =
    status === "setup"
      ? "SET DEMO PIN"
      : status === "confirming"
        ? setupBusy
          ? "SEALING CREDENTIAL"
          : "CONFIRM & ARM"
        : status === "checking"
          ? "VERIFYING"
          : "UNLOCK GATE";

  const primaryDisabled =
    ["arming", "checking", "granted", "config"].includes(status) ||
    secret.length !== pinLength ||
    setupBusy;

  return (
    <>
      <HouseBar product="Gate" />
      <main className="gate-page gate-page--vault demo-gate-page">
        <div className="ambient-grid" aria-hidden="true" />
        <div className="ambient-orb ambient-orb--one" aria-hidden="true" />
        <div className="ambient-orb ambient-orb--two" aria-hidden="true" />

        <header className="gate-header">
          <a className="brand-lockup" href="/" aria-label="Gate home">
            <GateMark />
            <span>
              <strong>GATE</strong>
              <small>INTERACTIVE VAULT</small>
            </span>
          </a>

          <div className="transport-status" aria-label="Gate security properties">
            <span className="transport-dot" />
            <span>ORIGIN CHECK / HTTPONLY SESSION</span>
          </div>
        </header>

        <section className="gate-stage" aria-labelledby="gate-title">
          <div className="gate-intro demo-intro">
            <span className="eyebrow">INTERACTIVE DEMO · TEMPORARY CREDENTIAL</span>
            <h1 id="gate-title">
              {status === "setup" || status === "confirming"
                ? "Arm your own Gate."
                : name}
            </h1>
            <p>
              {status === "setup" || status === "confirming"
                ? "Create the key yourself, lock the facility, then prove it opens."
                : message}
            </p>
            {demoInitialized ? (
              <div className="demo-expiry" aria-label="Temporary credential expiry">
                <span>EPHEMERAL KEY</span>
                <strong>SELF-DESTRUCT {formatCountdown(remainingSeconds)}</strong>
              </div>
            ) : null}
          </div>

          <div
            className={`gate-device ${status === "denied" ? "is-denied" : ""} ${status === "granted" ? "is-granted" : ""} ${status === "arming" ? "is-arming" : ""}`}
          >
            <div className="vault-panel demo-vault-panel">
              <div className="vault-rings demo-vault-rings" aria-hidden="true">
                <div className="vault-aperture" />
                <div className="vault-ring vault-ring--outer" />
                <div className="vault-ring vault-ring--middle" />
                <div className="vault-ring vault-ring--inner" />
                <span className="vault-bolt vault-bolt--top" />
                <span className="vault-bolt vault-bolt--right" />
                <span className="vault-bolt vault-bolt--bottom" />
                <span className="vault-bolt vault-bolt--left" />
                <div className="vault-core">
                  <GateMark />
                </div>
              </div>

              <div className="vault-interface">
                <div className="panel-kicker">
                  <span>{panelLabel}</span>
                  <span>{demoInitialized ? `#${String(attempts + 1).padStart(2, "0")}` : "DEMO"}</span>
                </div>
                <p className="mode-hint">{hint}</p>

                {status === "arming" ? (
                  <div className="arming-sequence" aria-live="polite">
                    {armingSteps.map((step, index) => (
                      <div
                        key={step}
                        className={
                          index < armingStep
                            ? "is-complete"
                            : index === armingStep
                              ? "is-current"
                              : ""
                        }
                      >
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <strong>{step}</strong>
                        <i aria-hidden="true" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div
                      className="pin-display"
                      style={{
                        gridTemplateColumns: `repeat(${pinLength}, minmax(0, 1fr))`,
                      }}
                      aria-label={`${secret.length} of ${pinLength} digits entered`}
                    >
                      {Array.from({ length: pinLength }).map((_, index) => (
                        <span key={index} className={index < secret.length ? "is-filled" : ""}>
                          <i />
                        </span>
                      ))}
                    </div>

                    <div className="keypad" aria-label="Numeric keypad">
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                        <button key={digit} type="button" onClick={() => addDigit(digit)}>
                          {digit}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="keypad-action"
                        onClick={() => {
                          setSecret("");
                          if (setupError) setSetupError("");
                        }}
                        aria-label="Clear code"
                      >
                        C
                      </button>
                      <button type="button" onClick={() => addDigit("0")}>0</button>
                      <button
                        type="button"
                        className="keypad-action"
                        onClick={removeDigit}
                        aria-label="Delete last digit"
                      >
                        <DeleteIcon />
                      </button>
                    </div>

                    <button
                      className="unlock-button"
                      type="button"
                      disabled={primaryDisabled}
                      onClick={() => void primaryAction()}
                    >
                      <span>{buttonLabel}</span>
                      <ArrowIcon />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className={`gate-status gate-status--${status}`} role="status" aria-live="polite">
            <span className="status-pulse" />
            <span>{statusCopy}</span>
            {status === "config" ? (
              <small>Enable GATE_INTERACTIVE_DEMO and configure GATE_SECRET.</small>
            ) : null}
          </div>

          {demoInitialized && status !== "granted" ? (
            <button className="demo-reset" type="button" onClick={() => void resetDemo()}>
              REKEY TEMPORARY DEMO
            </button>
          ) : null}
        </section>

        <footer className="gate-footer demo-footer">
          <span>GATE / PRIVATE ACCESS INTERFACE</span>
          <span>PIN IS NOT STORED IN PLAINTEXT</span>
        </footer>
      </main>
    </>
  );
}
