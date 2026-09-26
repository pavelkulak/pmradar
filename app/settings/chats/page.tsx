import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ChatSettings } from "@/components/chat-settings";
import { AppHeader } from "@/components/app-header";

export const dynamic = "force-dynamic";

export default async function ChatSettingsPage() {
  if (!await getSession()) redirect("/login");
  return <div className="gachi-app"><AppHeader active="chats" /><main className="page-container settings-page"><ChatSettings /></main></div>;
}
