import type { Metadata } from "next";
import { DM_Sans, Inter } from "next/font/google";
import { LAUNCH_GUARD_SCRIPT } from "@/lib/session";
import { STYLE_SCRIPT } from "@/lib/style";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ProspectIQ — Prospect Scoreboard",
  description:
    "Rank, review, and plan outreach to physician prospects by fit score.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Hides the opening screen before the first paint in a tab that is
            already mid-review — see LAUNCH_GUARD_SCRIPT. */}
        <script dangerouslySetInnerHTML={{ __html: LAUNCH_GUARD_SCRIPT }} />
        {/* Puts a remembered presentation style on <html> before paint, so the
            page never renders advisor-styled and then snaps. */}
        <script dangerouslySetInnerHTML={{ __html: STYLE_SCRIPT }} />
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          body attributes before React hydrates; only this element's
          attribute diffs are ignored, children still validate */}
      <body
        className={`${dmSans.variable} ${inter.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
