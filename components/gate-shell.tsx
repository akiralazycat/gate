"use client";

import { FormEvent, useEffect, useState } from "react";

import type { GateMode } from "@/lib/gate";

type GateShellProps = {
  name: string;
  message: string;
  mode: GateMode;
  allowStyleSwitch: boolean;
  pinLength: number;
  configured: boolean;
};

type GateStatus =
  | "idle"
  | "checking"
  | "denied"
  | "rate_limited"
  | "unavailable"
  | "error"
  | "granted"
  | "config";

const modeCopy: Record<GateMode, { label: string; code: string; hint: string }> = {
  vault: {
    label: "Vault",
    code: "01",
    hint: "Enter your numeric access sequence",
  },
  cipher: {
    label: "Cipher",
    code: "02",
    hint: "Present a valid access key",
  },
  classic: {
    label: "Classic",
    code: "03",
    hint: "Identify yourself to continue",
  },
};

function getStatusCopy(status: GateStatus, retrySeconds: number) {
  switch (status) {
    case "checking":
      return "Verifying credential";
    case "denied":
      return "Credential rejected";
    case "rate_limited":
      return `Too many attempts · retry in ${retrySeconds}s`;
    case "unavailable":
      return "Gate is temporarily unavailable";
    case "error":
      return "Connection failed · try again";
    case "granted":
      return "Access granted";
    case "config":
      return "Gate is not configured";
    default:
      return "Gate locked";
  }
}

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
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/protected";
  }
  try {
    const destination = new URL(value, window.location.origin);
    return destination.origin === window.location.origin
      ? `${destination.pathname}${destination.search}${destination.hash}`
      : "/protected";
  } catch {
    return "/protected";
  }
}

export default function GateShell({
  name,
  message,
  mode,
  allowStyleSwitch,
  pinLength,
  configured,
}: GateShellProps) {
  const [activeMode, setActiveMode] = useState<GateMode>(mode);
  const [secret, setSecret] = useState("");
  const [username, setUsername] = useState("guest");
  const [status, setStatus] = useState<GateStatus>(configured ? "idle" : "config");
  const [attempts, setAttempts] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);

  useEffect(() => {
    if (status !== "rate_limited") return;
    if (retrySeconds <= 0) {
      setStatus(configured ? "idle" : "config");
      return;
    }
    const timer = window.setTimeout(
      () => setRetrySeconds((value) => Math.max(0, value - 1)),
      1_000,
    );
    return () => window.clearTimeout(timer);
  }, [configured, retrySeconds, status]);

  const statusCopy = getStatusCopy(status, retrySeconds);

  function changeMode(nextMode: GateMode) {
    if (status === "checking" || status === "granted") return;
    setActiveMode(nextMode);
    setSecret("");
    setRetrySeconds(0);
    setStatus(configured ? "idle" : "config");
  }

  async function submitCredential(event?: FormEvent) {
    event?.preventDefault();

    if (
      !configured ||
      !secret ||
      status === "checking" ||
      status === "granted" ||
      status === "rate_limited"
    ) {
      return;
    }

    setStatus("checking");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch("/api/gate/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
        body: JSON.stringify({
          mode: activeMode,
          username,
          password: secret,
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 429) {
          setAttempts((value) => value + 1);
        }
        setSecret("");
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get("retry-after"));
          setRetrySeconds(Number.isFinite(retryAfter) ? Math.max(1, Math.ceil(retryAfter)) : 60);
          setStatus("rate_limited");
        } else if (response.status === 503) {
          setStatus("unavailable");
        } else {
          setStatus("denied");
        }
        return;
      }

      setStatus("granted");
      window.setTimeout(() => window.location.replace(safeNextPath()), 420);
    } catch {
      setStatus("error");
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function addDigit(digit: string) {
    if (secret.length >= pinLength || status === "checking") return;
    setSecret((value) => `${value}${digit}`);
    if (status === "denied" || status === "error" || status === "unavailable") setStatus("idle");
  }

  function removeDigit() {
    if (status === "checking") return;
    setSecret((value) => value.slice(0, -1));
    if (status === "denied" || status === "error" || status === "unavailable") setStatus("idle");
  }

  const disabled =
    !configured ||
    !secret ||
    status === "checking" ||
    status === "granted" ||
    status === "rate_limited" ||
    (activeMode === "vault" && secret.length !== pinLength);

  return (
    <>
      <main className={`gate-page gate-page--${activeMode}`}>
      <div className="ambient-grid" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--one" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--two" aria-hidden="true" />

      <header className="gate-header">
        <a className="brand-lockup" href="/" aria-label="Gate home">
          <GateMark />
          <span>
            <strong>GATE</strong>
            <small>ACCESS LAYER</small>
          </span>
        </a>

        <div className="transport-status" aria-label="Secure transport">
          <span className="transport-dot" />
          <span>TLS / SECURE CHANNEL</span>
        </div>
      </header>

      <section className="gate-stage" aria-labelledby="gate-title">
        <div className="gate-intro">
          <span className="eyebrow">PRIVATE ACCESS · {modeCopy[activeMode].code}</span>
          <h1 id="gate-title">{name}</h1>
          <p>{message}</p>
        </div>

        {allowStyleSwitch ? (
          <nav className="mode-switcher" aria-label="Gate appearance">
            {(Object.keys(modeCopy) as GateMode[]).map((item) => (
              <button
                key={item}
                type="button"
                className={item === activeMode ? "is-active" : ""}
                onClick={() => changeMode(item)}
                aria-pressed={item === activeMode}
              >
                <span>{modeCopy[item].code}</span>
                {modeCopy[item].label}
              </button>
            ))}
          </nav>
        ) : null}

        <div className={`gate-device ${status === "denied" ? "is-denied" : ""} ${status === "granted" ? "is-granted" : ""}`}>
          {activeMode === "vault" ? (
            <div className="vault-panel">
              <div className="vault-rings" aria-hidden="true">
                <div className="vault-ring vault-ring--outer" />
                <div className="vault-ring vault-ring--middle" />
                <div className="vault-ring vault-ring--inner" />
                <div className="vault-core">
                  <GateMark />
                </div>
              </div>

              <form className="vault-interface" onSubmit={submitCredential} aria-busy={status === "checking"}>
                <div className="panel-kicker">
                  <span>SECURITY VAULT</span>
                  <span>#{String(attempts + 1).padStart(2, "0")}</span>
                </div>
                <p className="mode-hint">{modeCopy.vault.hint}</p>

                <label className="pin-entry">
                  <span className="screen-reader-only">Numeric access code</span>
                  <input
                    className="pin-native-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    value={secret}
                    maxLength={pinLength}
                    disabled={status === "checking" || status === "rate_limited"}
                    onChange={(event) => {
                      setSecret(event.target.value.replace(/\D/g, "").slice(0, pinLength));
                      if (status === "denied" || status === "error" || status === "unavailable") setStatus("idle");
                    }}
                  />
                  <span className="pin-display" aria-label={`${secret.length} of ${pinLength} digits entered`}>
                    {Array.from({ length: pinLength }).map((_, index) => (
                      <span key={index} className={index < secret.length ? "is-filled" : ""}>
                        <i />
                      </span>
                    ))}
                  </span>
                </label>

                <div className="keypad" aria-label="Numeric keypad">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                    <button key={digit} type="button" onClick={() => addDigit(digit)}>
                      {digit}
                    </button>
                  ))}
                  <button type="button" className="keypad-action" onClick={() => setSecret("")} aria-label="Clear code">
                    C
                  </button>
                  <button type="button" onClick={() => addDigit("0")}>0</button>
                  <button type="button" className="keypad-action" onClick={removeDigit} aria-label="Delete last digit">
                    <DeleteIcon />
                  </button>
                </div>

                <button className="unlock-button" type="submit" disabled={disabled}>
                  <span>{status === "checking" ? "VERIFYING" : "UNLOCK GATE"}</span>
                  <ArrowIcon />
                </button>
              </form>
            </div>
          ) : null}

          {activeMode === "cipher" ? (
            <form className="cipher-panel" onSubmit={submitCredential} aria-busy={status === "checking"}>
              <div className="cipher-topline">
                <span>GATE//CIPHER</span>
                <span>CH.{String(attempts + 1).padStart(2, "0")}</span>
              </div>

              <div className="cipher-visual" aria-hidden="true">
                <div className="scanner-line" />
                <div className="cipher-crosshair"><span /></div>
                <div className="cipher-coordinates">35.6762°N<br />139.6503°E</div>
              </div>

              <div className="cipher-form-copy">
                <span className="eyebrow">IDENTITY CHALLENGE</span>
                <h2>Access key required.</h2>
                <p>{modeCopy.cipher.hint}</p>
              </div>

              <label className="cipher-input">
                <span>ACCESS KEY</span>
                <div>
                  <b>&gt;</b>
                  <input
                    type="password"
                    value={secret}
                    onChange={(event) => {
                      setSecret(event.target.value);
                      if (status === "denied" || status === "error" || status === "unavailable") setStatus("idle");
                    }}
                    autoComplete="current-password"
                    autoFocus
                    placeholder="••••••••••••"
                    maxLength={256}
                  />
                </div>
              </label>

              <button className="cipher-submit" disabled={disabled} type="submit">
                <span>{status === "checking" ? "AUTHENTICATING" : "SUBMIT CREDENTIAL"}</span>
                <ArrowIcon />
              </button>

              <div className="cipher-meta" aria-hidden="true">
                <span>256/AES</span><span>SESSION/HMAC</span><span>ORIGIN/LOCKED</span>
              </div>
            </form>
          ) : null}

          {activeMode === "classic" ? (
            <form className="classic-panel" onSubmit={submitCredential} aria-busy={status === "checking"}>
              <div className="classic-seal"><GateMark /></div>
              <div className="classic-copy">
                <span className="eyebrow">RESTRICTED AREA</span>
                <h2>Sign in to continue</h2>
                <p>{modeCopy.classic.hint}</p>
              </div>

              <label className="classic-field">
                <span>Username</span>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  maxLength={128}
                />
              </label>

              <label className="classic-field">
                <span>Password</span>
                <input
                  type="password"
                  value={secret}
                  onChange={(event) => {
                    setSecret(event.target.value);
                    if (status === "denied" || status === "error" || status === "unavailable") setStatus("idle");
                  }}
                  autoComplete="current-password"
                  maxLength={256}
                />
              </label>

              <button className="classic-submit" disabled={disabled} type="submit">
                <span>{status === "checking" ? "Checking…" : "Continue"}</span>
                <ArrowIcon />
              </button>

              <p className="classic-note">Private system · Activity may be logged by the operator.</p>
            </form>
          ) : null}
        </div>

        <div className={`gate-status gate-status--${status}`} role="status" aria-live="polite">
          <span className="status-pulse" />
          <span>{statusCopy}</span>
          {status === "config" ? <small>Check the server configuration.</small> : null}
        </div>
      </section>

      <footer className="gate-footer">
        <span>GATE / PRIVATE ACCESS INTERFACE</span>
        <span>NO BROWSER AUTH DIALOG</span>
      </footer>
      </main>
    </>
  );
}
