import { Navigation } from "@/components/Navigation";
import { getEventSettings } from "@/lib/content";
import type { Metadata } from "next";
import "./globals.css";

const siteTitle = "Blarney 42";
const siteDescription =
  "Registration, logistics, pairings, feedback, and photos for the Blarney 42 golf event.";
const metadataBaseFallback = "http://localhost:3001";

function getMetadataBase() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!siteUrl) {
    return new URL(metadataBaseFallback);
  }

  try {
    return new URL(siteUrl);
  } catch {
    return new URL(metadataBaseFallback);
  }
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
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
    <html lang="en">
      <body>
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
      </body>
    </html>
  );
}
