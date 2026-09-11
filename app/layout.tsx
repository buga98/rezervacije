import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Linea+ Rezervacije", template: "%s | Linea+ Rezervacije" },
  description: "Jednostavne online rezervacije termina za moderne uslužne djelatnosti.",
  applicationName: "Linea+ Rezervacije",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Rezervacije" },
};
export const viewport: Viewport = { themeColor: "#16151d", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="hr"><body>{children}</body></html>;
}
