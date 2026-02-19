import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import HeaderBar from "@/components/HeaderBar";

/* ── Fonts ─────────────────────────────────────────────────────── */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* ── Metadata ──────────────────────────────────────────────────── */
export const metadata: Metadata = {
  title: "World Monitor — Command Center",
  description: "Global intelligence command center — OSINT dashboard",
};

/* ── Root layout ───────────────────────────────────────────────── */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <div className="flex h-screen overflow-hidden">
          {/* ── Sidebar: fixed width, full height ─────────────── */}
          <Sidebar />

          {/* ── Main area: header + scrollable content ────────── */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <HeaderBar />
            <main className="flex-1 overflow-y-auto p-4 grid-overlay scanline-overlay">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
