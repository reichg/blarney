import formsStyles from "@/app/forms.module.css";
import type { ReactNode } from "react";
import { MarketplaceCheckoutStatus } from "./MarketplaceCheckoutStatus";
import styles from "./checkout.module.css";

type MarketplaceCheckoutPageProps = {
  params: Promise<{
    checkoutId: string;
  }>;
};

function StatusAside({ children }: { children: ReactNode }) {
  return <aside className={styles.statusAside}>{children}</aside>;
}

export default async function MarketplaceCheckoutPage({
  params,
}: MarketplaceCheckoutPageProps) {
  const { checkoutId } = await params;

  return (
    <>
      <header className={formsStyles.pageHeader}>
        <div className={formsStyles.pageHeaderInner}>
          <p className="eyebrow">Marketplace checkout</p>
          <h1 className="section-title">Finishing your order.</h1>
          <p>
            Once Square sends you back here, this page checks the latest server
            state until your order is confirmed, reviewed, or needs another
            step.
          </p>
        </div>
      </header>
      <section className={formsStyles.formSection}>
        <div className={styles.shell}>
          <StatusAside>
            <section className={formsStyles.panel}>
              <h2>How this page works</h2>
              <ul className={formsStyles.detailList}>
                <li>
                  Payment success is confirmed by the backend, not by the return
                  URL alone.
                </li>
                <li>
                  If the payment is still open, you can jump back into the same
                  Square checkout link.
                </li>
                <li>
                  If anything mismatches, the order moves to review instead of
                  showing a false success.
                </li>
              </ul>
            </section>
          </StatusAside>
          <MarketplaceCheckoutStatus checkoutId={checkoutId} />
        </div>
      </section>
    </>
  );
}
