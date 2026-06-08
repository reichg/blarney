import formsStyles from "@/app/forms.module.css";
import { getMarketplaceCatalog } from "@/lib/marketplaceCatalog";
import { PackageOpen } from "lucide-react";
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
