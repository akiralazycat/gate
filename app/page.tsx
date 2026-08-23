import GateShell from "@/components/gate-shell";
import { getGateUiConfig } from "@/lib/gate";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const config = getGateUiConfig();

  return <GateShell {...config} />;
}
