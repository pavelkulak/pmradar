import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppHeader } from "@/components/app-header";
import { IntegrationSettings } from "@/components/integration-settings";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  if (!await getSession()) redirect("/login");
  return <><AppHeader active="integrations" /><main className="page-container"><IntegrationSettings /></main></>;
}
