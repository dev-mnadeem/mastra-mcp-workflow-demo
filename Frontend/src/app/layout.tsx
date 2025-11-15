import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MCP-Mastra console",
  description:
    "Ask an agent a question and watch which MCP tool it picks, with what arguments, and what the tool returns.",
};

const NAV = [
  { href: "/", label: "Agent" },
  { href: "/tools", label: "Tool catalogue" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen bg-background">
          <header className="border-b border-border">
            <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
              <Link href="/" className="text-sm font-semibold tracking-tight">
                MCP<span className="text-muted-foreground">-</span>Mastra
              </Link>
              <nav className="flex items-center gap-4 text-sm text-muted-foreground">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} className="hover:text-foreground">
                    {item.label}
                  </Link>
                ))}
              </nav>
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                MCP 2025-06-18
              </span>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
