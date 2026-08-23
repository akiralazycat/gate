export type GateTheme = {
  version: 1;
  name: string;
  colors: {
    background: string;
    surface: string;
    ink: string;
    accent: string;
    danger: string;
  };
  shape: {
    panelRadius: number;
    controlRadius: number;
  };
  effects: {
    panelOpacity: number;
    lineOpacity: number;
    mutedOpacity: number;
    gridOpacity: number;
    glow: number;
    blur: number;
  };
};

export const GATE_THEME_PRESETS = {
  nocturne: {
    version: 1,
    name: "Nocturne",
    colors: { background: "#060a09", surface: "#0b1110", ink: "#e8ece9", accent: "#b8ffe2", danger: "#ff7d79" },
    shape: { panelRadius: 28, controlRadius: 9 },
    effects: { panelOpacity: 0.82, lineOpacity: 0.14, mutedOpacity: 0.55, gridOpacity: 0.26, glow: 0.28, blur: 28 },
  },
  signal: {
    version: 1,
    name: "Signal",
    colors: { background: "#080706", surface: "#15100a", ink: "#f2efe8", accent: "#ffcf73", danger: "#ff776d" },
    shape: { panelRadius: 18, controlRadius: 7 },
    effects: { panelOpacity: 0.88, lineOpacity: 0.16, mutedOpacity: 0.5, gridOpacity: 0.2, glow: 0.34, blur: 18 },
  },
  paper: {
    version: 1,
    name: "Paper",
    colors: { background: "#eef1ed", surface: "#ffffff", ink: "#18201e", accent: "#1e6654", danger: "#a63f39" },
    shape: { panelRadius: 22, controlRadius: 10 },
    effects: { panelOpacity: 0.9, lineOpacity: 0.13, mutedOpacity: 0.55, gridOpacity: 0.11, glow: 0.12, blur: 22 },
  },
} satisfies Record<string, GateTheme>;

const HEX = /^#[0-9a-f]{6}$/i;

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function color(value: unknown, fallback: string) {
  return typeof value === "string" && HEX.test(value) ? value.toLowerCase() : fallback;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function normalizeGateTheme(input: unknown, fallback: GateTheme = GATE_THEME_PRESETS.nocturne): GateTheme {
  const root = object(input);
  const colors = object(root.colors);
  const shape = object(root.shape);
  const effects = object(root.effects);
  return {
    version: 1,
    name: typeof root.name === "string" && root.name.trim() ? root.name.trim().slice(0, 48) : fallback.name,
    colors: {
      background: color(colors.background, fallback.colors.background),
      surface: color(colors.surface, fallback.colors.surface),
      ink: color(colors.ink, fallback.colors.ink),
      accent: color(colors.accent, fallback.colors.accent),
      danger: color(colors.danger, fallback.colors.danger),
    },
    shape: {
      panelRadius: clamp(shape.panelRadius, 10, 48, fallback.shape.panelRadius),
      controlRadius: clamp(shape.controlRadius, 4, 24, fallback.shape.controlRadius),
    },
    effects: {
      panelOpacity: clamp(effects.panelOpacity, 0.45, 1, fallback.effects.panelOpacity),
      lineOpacity: clamp(effects.lineOpacity, 0.04, 0.4, fallback.effects.lineOpacity),
      mutedOpacity: clamp(effects.mutedOpacity, 0.28, 0.8, fallback.effects.mutedOpacity),
      gridOpacity: clamp(effects.gridOpacity, 0, 0.5, fallback.effects.gridOpacity),
      glow: clamp(effects.glow, 0, 1, fallback.effects.glow),
      blur: clamp(effects.blur, 0, 48, fallback.effects.blur),
    },
  };
}

export function gateThemeToStyleVariables(themeInput: GateTheme) {
  const theme = normalizeGateTheme(themeInput);
  return {
    "--ink": theme.colors.ink,
    "--muted": `color-mix(in srgb, ${theme.colors.ink} ${Math.round(theme.effects.mutedOpacity * 100)}%, transparent)`,
    "--line": `color-mix(in srgb, ${theme.colors.ink} ${Math.round(theme.effects.lineOpacity * 100)}%, transparent)`,
    "--panel": `color-mix(in srgb, ${theme.colors.surface} ${Math.round(theme.effects.panelOpacity * 100)}%, transparent)`,
    "--accent": theme.colors.accent,
    "--danger": theme.colors.danger,
    "--page": theme.colors.background,
  } as Record<string, string>;
}

export function gateThemeToCss(themeInput: GateTheme, selector = ".gate-page") {
  const theme = normalizeGateTheme(themeInput);
  const vars = gateThemeToStyleVariables(theme);
  const declarations = Object.entries(vars).map(([key, value]) => `  ${key}: ${value};`).join("\n");
  const glowRadius = Math.round(18 + theme.effects.glow * 52);
  return `${selector} {\n${declarations}\n  background: radial-gradient(circle at 50% 34%, color-mix(in srgb, var(--accent) ${Math.round(6 + theme.effects.glow * 18)}%, transparent), transparent 31rem), linear-gradient(145deg, var(--page), ${theme.colors.surface});\n}\n\n${selector} .ambient-grid { opacity: ${theme.effects.gridOpacity.toFixed(2)}; }\n\n${selector} .vault-panel,\n${selector} .cipher-panel,\n${selector} .classic-panel {\n  border-radius: ${theme.shape.panelRadius}px;\n  background: var(--panel);\n  backdrop-filter: blur(${theme.effects.blur}px);\n}\n\n${selector} .pin-display span,\n${selector} .keypad button,\n${selector} .cipher-input-wrap,\n${selector} .classic-input-wrap { border-radius: ${theme.shape.controlRadius}px; }\n\n${selector} .transport-dot,\n${selector} .status-pulse { box-shadow: 0 0 ${glowRadius}px color-mix(in srgb, var(--accent) ${Math.round(18 + theme.effects.glow * 62)}%, transparent); }\n`;
}

export function gateThemeToJson(theme: GateTheme) {
  return JSON.stringify(normalizeGateTheme(theme), null, 2) + "\n";
}
