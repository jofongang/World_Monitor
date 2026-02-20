import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import HeaderBar from "@/components/HeaderBar";
import Sidebar from "@/components/Sidebar";
import { CommandStateProvider } from "@/components/ui/CommandState";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "World Monitor - Command Center",
  description: "Global intelligence command center situational terminal",
};

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
        <CommandStateProvider>
          <div className="terminal-shell grid-overlay scanline-overlay flex h-screen overflow-hidden">
            <Sidebar />
            <div className="relative z-[2] flex min-w-0 flex-1 flex-col overflow-hidden">
              <HeaderBar />
              <main className="flex-1 overflow-y-auto p-4 md:p-5">{children}</main>
            </div>
          </div>
        </CommandStateProvider>
      </body>
    </html>
  );
}
