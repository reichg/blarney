import formsStyles from "@/app/forms.module.css";
import { getMarketplaceCatalog } from "@/lib/marketplaceCatalog";
import { PackageOpen, ShieldCheck, ShoppingBag } from "lucide-react";
import { MarketplaceStorefront } from "./MarketplaceStorefront";
import styles from "./marketplace.module.css";

export const dynamic = "force-dynamic";

async function loadMarketplaceCatalog() {
  try {
    return await getMarketplaceCatalog();
  } catch {
    return [];
  }
}

export default async function MarketplacePage() {
  const listings = await loadMarketplaceCatalog();

  return (
    <>
      <header className={formsStyles.pageHeader}>
        <div className={formsStyles.pageHeaderInner}>
          <p className="eyebrow">Marketplace</p>
          <h1 className="section-title">
            Tournament merch, ready when you are.
          </h1>
          <p>
            Browse the current drop, choose sizes or variants, and head straight
            into secure Square checkout without leaving the Blarney flow.
          </p>
        </div>
      </header>
      <section className={formsStyles.formSection}>
        <div className={styles.shell}>
          <aside
            aria-label="Marketplace details and checkout notes"
            className={styles.infoPanels}
          >
            <section className={formsStyles.panel}>
              <div className={formsStyles.panelHeader}>
                <span className={formsStyles.panelBadge}>
                  <ShoppingBag aria-hidden="true" size={20} />
                </span>
                <div>
                  <p className={formsStyles.panelKicker}>Simple first pass</p>
                  <h2>One clean merch flow</h2>
                  <p className={formsStyles.panelLead}>
                    Select the variants you want, add contact details, and we
                    will hand off to Square for payment.
                  </p>
                </div>
              </div>
              <ul className={formsStyles.detailList}>
                <li>
                  Prices and availability are rechecked server-side right before
                  checkout is created.
                </li>
                <li>
                  Square returns back into the app so order status can finish
                  cleanly even if the webhook lands first.
                </li>
                <li>
                  Fulfillment notes stay attached to each listing so pickup
                  instructions are easy to find.
                </li>
              </ul>
            </section>
            <section className={formsStyles.panel}>
              <div className={formsStyles.panelHeader}>
                <span className={formsStyles.panelBadge}>
                  <ShieldCheck aria-hidden="true" size={20} />
                </span>
                <div>
                  <p className={formsStyles.panelKicker}>Checkout details</p>
                  <h2>What happens next</h2>
                  <p className={formsStyles.panelLead}>
                    The marketplace keeps the shopper flow lightweight while the
                    backend owns payment links, order confirmation, and review.
                  </p>
                </div>
              </div>
              <div className={formsStyles.featureGrid}>
                <div className={formsStyles.featureCard}>
                  <strong>Server-priced checkout</strong>
                  <span>
                    The browser sends only variant ids and quantities. Totals
                    are recomputed on the server.
                  </span>
                </div>
                <div className={formsStyles.featureCard}>
                  <strong>Square handoff</strong>
                  <span>
                    Payment happens on Square, then returns to a marketplace
                    status page in this app.
                  </span>
                </div>
                <div className={formsStyles.featureCard}>
                  <strong>Order confirmation</strong>
                  <span>
                    Paid orders finalize through the backend before the shopper
                    sees the success screen.
                  </span>
                </div>
                <div className={formsStyles.featureCard}>
                  <strong>Manual review fallback</strong>
                  <span>
                    Unexpected payment mismatches are routed to review instead
                    of showing a false success.
                  </span>
                </div>
              </div>
            </section>
          </aside>
          <section className={styles.storefrontPanel}>
            <div className={styles.panelHeaderRow}>
              <div>
                <p className={styles.panelEyebrow}>Current catalog</p>
                <h2>Build a simple merch order</h2>
              </div>
              <span className={styles.catalogCount}>
                <PackageOpen aria-hidden="true" size={16} />
                {listings.length}{" "}
                {listings.length === 1 ? "listing" : "listings"}
              </span>
            </div>
            <MarketplaceStorefront listings={listings} />
          </section>
        </div>
      </section>
    </>
  );
}
