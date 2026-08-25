import { getGateReadiness } from "@/lib/gate";
import { jsonNoStore } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  const readiness = getGateReadiness();
  const includeDetails = process.env.NODE_ENV !== "production" ||
    process.env.GATE_HEALTH_DETAILS === "true";
  return jsonNoStore(
    {
      ok: readiness.ready,
      status: readiness.ready ? "ready" : "not_ready",
      ...(includeDetails ? { checks: readiness.issues } : {}),
    },
    { status: readiness.ready ? 200 : 503 },
  );
}
