import { cookies } from "next/headers";

import DemoGate from "@/components/demo-gate";
import DemoModeNav from "@/components/demo-mode-nav";
import {
  DEMO_CREDENTIAL_COOKIE,
  DEMO_PIN_LENGTH,
  readDemoCredential,
} from "@/lib/demo-gate";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const cookieStore = await cookies();
  const record = readDemoCredential(
    cookieStore.get(DEMO_CREDENTIAL_COOKIE)?.value,
  );

  return (
    <>
      <DemoGate
        initialized={Boolean(record)}
        expiresAt={record?.exp ?? null}
        pinLength={DEMO_PIN_LENGTH}
      />
      <DemoModeNav active="vault" />
    </>
  );
}
