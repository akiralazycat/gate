import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import DemoArchive from "@/components/demo-archive";
import {
  DEMO_CREDENTIAL_COOKIE,
  DEMO_SESSION_COOKIE,
  readDemoCredential,
  verifyDemoSessionToken,
} from "@/lib/demo-gate";

export const dynamic = "force-dynamic";

export default async function DemoArchivePage() {
  const cookieStore = await cookies();
  const record = readDemoCredential(
    cookieStore.get(DEMO_CREDENTIAL_COOKIE)?.value,
  );
  const session = cookieStore.get(DEMO_SESSION_COOKIE)?.value;

  if (!record || !(await verifyDemoSessionToken(record, session))) {
    redirect("/demo");
  }

  return <DemoArchive />;
}
