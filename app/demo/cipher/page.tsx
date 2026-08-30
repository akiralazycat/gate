import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import DemoCipher from "@/components/demo-cipher";
import DemoModeNav from "@/components/demo-mode-nav";
import {
  DEMO_CREDENTIAL_COOKIE,
  DEMO_PIN_LENGTH,
  readDemoCredential,
} from "@/lib/demo-gate";

export const dynamic = "force-dynamic";

export default async function DemoCipherPage() {
  const cookieStore = await cookies();
  const record = readDemoCredential(
    cookieStore.get(DEMO_CREDENTIAL_COOKIE)?.value,
  );

  if (!record) {
    redirect("/demo");
  }

  return (
    <>
      <DemoCipher expiresAt={record.exp} pinLength={DEMO_PIN_LENGTH} />
      <DemoModeNav active="cipher" />
    </>
  );
}
