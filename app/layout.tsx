import type { Metadata } from "next";
import "./globals.css";
import "./gachi.css";
import { AudioProvider } from "@/components/audio-provider";

export const metadata: Metadata = {
  title: "PM Inbox",
  description: "Единый индикатор новых сообщений в рабочих чатах",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body><AudioProvider>{children}</AudioProvider></body></html>;
}
