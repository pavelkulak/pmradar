import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PM Inbox",
  description: "Единый индикатор новых сообщений в рабочих чатах",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
