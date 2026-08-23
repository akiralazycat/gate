"use client";

import { useMemo, useState } from "react";

import {
  GATE_THEME_PRESETS,
  gateThemeToCss,
  gateThemeToJson,
  gateThemeToStyleVariables,
  type GateTheme,
} from "@/lib/theme-core";
import styles from "./theme-builder.module.css";

type ThemeBuilderProps = { initialTheme: GateTheme };
type Mode = "vault" | "cipher" | "classic";

const colorFields: Array<[keyof GateTheme["colors"], string]> = [
  ["background", "Background"],
  ["surface", "Surface"],
  ["ink", "Ink"],
  ["accent", "Accent"],
  ["danger", "Danger"],
];

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ThemeBuilder({ initialTheme }: ThemeBuilderProps) {
  const [theme, setTheme] = useState(initialTheme);
  const [mode, setMode] = useState<Mode>("vault");
  const [copied, setCopied] = useState<"json" | "css" | null>(null);

  const json = useMemo(() => gateThemeToJson(theme), [theme]);
  const css = useMemo(() => gateThemeToCss(theme), [theme]);
  const variables = useMemo(() => gateThemeToStyleVariables(theme), [theme]);

  function setColor(key: keyof GateTheme["colors"], value: string) {
    setTheme((current) => ({ ...current, colors: { ...current.colors, [key]: value } }));
  }

  function setNumber(section: "shape" | "effects", key: string, value: number) {
    setTheme((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
  }

  async function copy(kind: "json" | "css", body: string) {
    await navigator.clipboard.writeText(body);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1200);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href="/" className={styles.brand}>GATE <span>/ THEME BUILDER</span></a>
        <div className={styles.headerMeta}>LIVE CONFIG · JSON · CSS</div>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.controls}>
          <section>
            <div className={styles.sectionTitle}><span>01</span> Preset</div>
            <div className={styles.presetGrid}>
              {Object.entries(GATE_THEME_PRESETS).map(([key, preset]) => (
                <button key={key} type="button" onClick={() => setTheme(preset)}>
                  <i style={{ background: preset.colors.accent }} />
                  <span>{preset.name}</span>
                  <small>{key}</small>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className={styles.sectionTitle}><span>02</span> Palette</div>
            <div className={styles.colorList}>
              {colorFields.map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <code>{theme.colors[key]}</code>
                  <input type="color" value={theme.colors[key]} onChange={(event) => setColor(key, event.target.value)} />
                </label>
              ))}
            </div>
          </section>

          <section>
            <div className={styles.sectionTitle}><span>03</span> Geometry</div>
            <Range label="Panel radius" value={theme.shape.panelRadius} min={10} max={48} suffix="px" onChange={(value) => setNumber("shape", "panelRadius", value)} />
            <Range label="Control radius" value={theme.shape.controlRadius} min={4} max={24} suffix="px" onChange={(value) => setNumber("shape", "controlRadius", value)} />
          </section>

          <section>
            <div className={styles.sectionTitle}><span>04</span> Atmosphere</div>
            <Range label="Blur" value={theme.effects.blur} min={0} max={48} suffix="px" onChange={(value) => setNumber("effects", "blur", value)} />
            <Range label="Grid" value={theme.effects.gridOpacity} min={0} max={0.5} step={0.01} onChange={(value) => setNumber("effects", "gridOpacity", value)} />
            <Range label="Glow" value={theme.effects.glow} min={0} max={1} step={0.01} onChange={(value) => setNumber("effects", "glow", value)} />
          </section>
        </aside>

        <section className={styles.stage} style={variables as React.CSSProperties}>
          <div className={styles.previewTopline}>
            <span>LIVE SURFACE</span>
            <nav>
              {(["vault", "cipher", "classic"] as Mode[]).map((item) => (
                <button type="button" key={item} className={mode === item ? styles.activeMode : ""} onClick={() => setMode(item)}>{item}</button>
              ))}
            </nav>
          </div>

          <div className={styles.preview}>
            <div className={styles.grid} style={{ opacity: theme.effects.gridOpacity }} />
            <div className={styles.previewIntro}>
              <small>PRIVATE ACCESS · {mode.toUpperCase()}</small>
              <h1>Private Archive</h1>
              <p>Authorized access only</p>
            </div>
            <div className={`${styles.device} ${styles[`device_${mode}`]}`} style={{ borderRadius: theme.shape.panelRadius, backdropFilter: `blur(${theme.effects.blur}px)` }}>
              <div className={styles.deviceMeta}><span>GATE / {mode.toUpperCase()}</span><span>SECURE</span></div>
              {mode === "vault" ? <div className={styles.pin}>{[0,1,2,3,4,5].map((item) => <i key={item} style={{ borderRadius: theme.shape.controlRadius }} />)}</div> : null}
              {mode === "cipher" ? <div className={styles.cipherLine}>ACCESS KEY <span>••••••••••••</span></div> : null}
              {mode === "classic" ? <><div className={styles.field}>guest</div><div className={styles.field}>••••••••••</div></> : null}
              <button type="button" className={styles.previewAction} style={{ borderRadius: theme.shape.controlRadius }}>UNLOCK GATE <span>→</span></button>
            </div>
          </div>
        </section>

        <aside className={styles.exportPanel}>
          <div className={styles.sectionTitle}><span>05</span> Export</div>
          <p>JSON is the editable source of truth. CSS is a portable override for an existing Gate surface.</p>

          <ExportCard title="gate.theme.json" body={json} onCopy={() => copy("json", json)} copied={copied === "json"} onDownload={() => download("gate.theme.json", json, "application/json")} />
          <ExportCard title="gate-theme.css" body={css} onCopy={() => copy("css", css)} copied={copied === "css"} onDownload={() => download("gate-theme.css", css, "text/css")} />
        </aside>
      </div>
    </main>
  );
}

function Range({ label, value, min, max, step = 1, suffix = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void }) {
  return (
    <label className={styles.range}>
      <span><b>{label}</b><code>{value}{suffix}</code></span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ExportCard({ title, body, onCopy, copied, onDownload }: { title: string; body: string; onCopy: () => void; copied: boolean; onDownload: () => void }) {
  return (
    <article className={styles.exportCard}>
      <header><strong>{title}</strong><span>{body.length} B</span></header>
      <pre>{body}</pre>
      <div><button type="button" onClick={onCopy}>{copied ? "COPIED" : "COPY"}</button><button type="button" onClick={onDownload}>DOWNLOAD</button></div>
    </article>
  );
}
