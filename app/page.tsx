import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!await getSession()) redirect("/login");
  return <Dashboard />;
}
