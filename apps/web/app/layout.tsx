import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "LidLift",
  description:
    "Stop AI agents from choosing the wrong tool. LidLift scores prompt-tool fit before execution and returns an explicit allow, review, clarify, or block decision.",
  metadataBase: new URL("https://lidlift.optimizationinversion.com"),
  applicationName: "LidLift",
  category: "technology",
  keywords: [
    "MCP",
    "tool routing",
    "AI guardrails",
    "tool selection",
    "agent safety",
    "prompt-tool fit",
    "Cloudflare Workers",
    "Vercel",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "LidLift | Stop AI Agents From Choosing the Wrong Tool",
    description:
      "Pre-execution tool gating for MCP stacks with explicit allow, review, clarify, and block decisions.",
    url: "https://lidlift.optimizationinversion.com",
    siteName: "LidLift",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "LidLift open graph card",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LidLift | Stop AI Agents From Choosing the Wrong Tool",
    description:
      "Pre-execution tool gating for MCP stacks with explicit allow, review, clarify, and block decisions.",
    images: ["/opengraph-image"],
    creator: "@igorholt",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
