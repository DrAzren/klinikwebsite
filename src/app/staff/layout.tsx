import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import "../globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Staff Portal · Klinik Nissa", template: "%s · Staff Portal" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#0B1F3A", width: "device-width", initialScale: 1 };

export default function StaffRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ms-MY" className={`${jakarta.variable} ${serif.variable}`}>
      <body className="min-h-dvh bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
