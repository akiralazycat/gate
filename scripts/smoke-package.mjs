import assert from "node:assert/strict";
import {
  GATE_THEME_PRESETS,
  MemoryGateCodeStore,
  consumeGateAccessCode,
  createGateAccessCode,
  gateThemeToCss,
  normalizeGateTheme,
} from "../packages/gate/dist/index.js";

const theme = normalizeGateTheme({
  ...GATE_THEME_PRESETS.nocturne,
  colors: { ...GATE_THEME_PRESETS.nocturne.colors, accent: "#abcdef" },
});
assert.equal(theme.colors.accent, "#abcdef");
assert.match(gateThemeToCss(theme), /#abcdef/);

const store = new MemoryGateCodeStore();
const issued = await createGateAccessCode(store, {
  ttlSeconds: 60,
  maxUses: 1,
  length: 6,
  alphabet: "0123456789",
});
const first = await consumeGateAccessCode(store, issued.code);
const second = await consumeGateAccessCode(store, issued.code);
assert.equal(first.ok, true);
assert.equal(second.ok, false);

console.log("Gate package smoke test passed");
