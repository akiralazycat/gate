import configuredTheme from "@/gate.theme.json";
import { GATE_THEME_PRESETS, normalizeGateTheme } from "@/lib/theme-core";

export function getGateTheme() {
  const presetName = process.env.GATE_THEME_PRESET?.toLowerCase() as keyof typeof GATE_THEME_PRESETS | undefined;
  const preset = presetName && GATE_THEME_PRESETS[presetName] ? GATE_THEME_PRESETS[presetName] : GATE_THEME_PRESETS.nocturne;

  if (process.env.GATE_THEME_JSON) {
    try {
      return normalizeGateTheme(JSON.parse(process.env.GATE_THEME_JSON), preset);
    } catch {
      return normalizeGateTheme(configuredTheme, preset);
    }
  }

  return normalizeGateTheme(configuredTheme, preset);
}
