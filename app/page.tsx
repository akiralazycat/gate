import { cookies } from "next/headers";

import DemoGateShell from "@/components/demo-gate-shell";
import GateShell from "@/components/gate-shell";
import {
  GATE_DEMO_COOKIE,
  inspectDemoCredentialToken,
  isInteractiveDemoAvailable,
  isInteractiveDemoEnabled,
} from "@/lib/demo";
import { getGateUiConfig } from "@/lib/gate";
import { gateThemeToCss } from "@/lib/theme-core";
import { getGateTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const config = getGateUiConfig();
  const theme = getGateTheme();
  const demoEnabled = isInteractiveDemoEnabled();

  if (!demoEnabled) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: gateThemeToCss(theme) }} />
        <GateShell {...config} />
      </>
    );
  }

  const cookieStore = await cookies();
  const demoCredential = await inspectDemoCredentialToken(
    cookieStore.get(GATE_DEMO_COOKIE)?.value,
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: gateThemeToCss(theme) }} />
      <DemoGateShell
        name={config.name}
        message={config.message}
        pinLength={config.pinLength}
        available={isInteractiveDemoAvailable()}
        initialized={demoCredential.valid}
        initialExpiresAt={demoCredential.valid ? demoCredential.expiresAt : null}
      />
    </>
  );
}
