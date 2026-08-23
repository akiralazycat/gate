import GateShell from "@/components/gate-shell";
import { getGateUiConfig } from "@/lib/gate";
import { gateThemeToCss } from "@/lib/theme-core";
import { getGateTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const config = getGateUiConfig();
  const theme = getGateTheme();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: gateThemeToCss(theme) }} />
      <GateShell {...config} />
    </>
  );
}
