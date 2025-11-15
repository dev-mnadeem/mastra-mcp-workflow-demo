import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCP-Mastra console",
  description:
    "Ask an agent a question and watch which MCP tool it picks, with what arguments, and what the tool returns.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-10 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <div className="min-h-screen">
          <header className="border-b border-border bg-card">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
              <Link
                href="/"
                className="flex items-center gap-2 font-mono text-sm font-medium tracking-tight"
              >
                <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-primary" />
                MCP-Mastra
              </Link>
              <NavLinks />
              <span className="ml-auto hidden font-mono text-xs text-muted-foreground sm:inline">
                protocol 2025-06-18
              </span>
            </div>
          </header>
          <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
