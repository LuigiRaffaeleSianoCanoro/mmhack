import type { Metadata } from "next";
import { Inter, Newsreader, Oswald } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ variable: "--font-sans", subsets: ["latin"] });
const oswald = Oswald({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] });
const newsreader = Newsreader({ variable: "--font-serif", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "FixIt: renter repair help",
  description: "Snap the problem. Triage, vision, a repair plan and an independent safety check.",
  applicationName: "FixIt",
  openGraph: { title: "FixIt: renter repair help", siteName: "FixIt", description: "Snap the problem. Triage, vision, a repair plan and an independent safety check.", type: "website" },
  twitter: { card: "summary", title: "FixIt: renter repair help" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable} ${newsreader.variable} dark h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
        <div aria-hidden className="grain-overlay" />
      </body>
    </html>
  );
}
