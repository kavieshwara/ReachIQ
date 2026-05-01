import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { PublicWhatsAppButton } from "@/components/shared/PublicWhatsAppButton";
import { resolveStaticAppUrl } from "@/lib/public-url";
import "./globals.css";

const appUrl = resolveStaticAppUrl();
const logoVersion = "20260430";
const canonicalBrandIcon = `/logo/brand-icon.png?v=${logoVersion}`;

export const metadata: Metadata = {
  title: "ReachIQ - WhatsApp Outreach for Freelancers",
  description: "Find leads, send pitches, get clients. Automatically.",
  metadataBase: new URL(appUrl),
  icons: {
    icon: [{ url: canonicalBrandIcon, type: "image/png" }],
    shortcut: [{ url: canonicalBrandIcon, type: "image/png" }],
    apple: [{ url: canonicalBrandIcon, type: "image/png" }]
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "ReachIQ",
    description: "WhatsApp outreach automation for freelancers and agencies.",
    images: ["/logo/og-image.png"],
    siteName: "ReachIQ"
  },
  twitter: {
    card: "summary_large_image",
    title: "ReachIQ",
    description: "WhatsApp outreach automation for freelancers.",
    images: ["/logo/og-image.png"]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6C63FF"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <PublicWhatsAppButton />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
