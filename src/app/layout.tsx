import { Navigation } from "@/components/Navigation";
import { getEventSettings } from "@/lib/content";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blarney 42",
  description:
    "Registration, logistics, pairings, feedback, and photos for the Blarney 42 golf event.",
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
