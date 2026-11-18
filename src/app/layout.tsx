import { Navigation } from "@/components/Navigation";
import { ActionToastProvider } from "@/components/notices/ActionToast";
import { getEventSettings } from "@/lib/content";
import { getSiteOrigin } from "@/lib/siteOrigin";
import type { Metadata } from "next";
import "./globals.css";
import { DraftBanner } from "@/components/DraftBanner";

const siteTitle = "Blarney 42";
const siteDescription =
  "Registration, logistics, pairings, feedback, and photos for the Blarney 42 golf event.";

export const metadata: Metadata = {
  metadataBase: getSiteOrigin(),
  title: siteTitle,
  description: siteDescription,
  applicationName: siteTitle,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: "website",
    url: "/",
    siteName: siteTitle,
    images: [
      {
        url: "/images/background.png",
        alt: "Blarney 42 golf event preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/images/background.png"],
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
  },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await getEventSettings();

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <ActionToastProvider>
          <div className="page-shell">
            <Navigation />
            <main className="main-content">{children}</main>
            <footer className="site-footer">
              <div className="site-footer-inner">
                <div className="event-location">
                  <span>
                    <strong>Blarney 42</strong>
                  </span>
                  <span>{settings.eventLocation}</span>
                </div>
                <span>{settings.chairContact}</span>
              </div>
            </footer>
          </div>
        </ActionToastProvider>
        <DraftBanner />
      </body>
    </html>
  );
}
