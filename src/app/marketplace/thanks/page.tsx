import formsStyles from "@/app/forms.module.css";
import { CircleCheckBig, ShoppingBag } from "lucide-react";
import Link from "next/link";

type MarketplaceThanksPageProps = {
  searchParams: Promise<{
    order?: string;
  }>;
};

export default async function MarketplaceThanksPage({
  searchParams,
}: MarketplaceThanksPageProps) {
  const params = await searchParams;
  const orderId = params.order?.trim() || null;

  return (
    <>
      <header className={formsStyles.pageHeader}>
        <div className={formsStyles.pageHeaderInner}>
          <p className="eyebrow">Marketplace order</p>
          <h1 className="section-title">Order confirmed.</h1>
          <p>
            Thanks for supporting the tournament. Your marketplace order is now
            recorded in the app and ready for the next fulfillment step.
          </p>
        </div>
      </header>
      <section className={formsStyles.formSection}>
        <div className={formsStyles.formShell}>
          <aside className={formsStyles.panelStack}>
            <section className={formsStyles.panel}>
              <div className={formsStyles.panelHeader}>
                <span className={formsStyles.panelBadge}>
                  <CircleCheckBig aria-hidden="true" size={20} />
                </span>
                <div>
                  <p className={formsStyles.panelKicker}>Success</p>
                  <h2>Marketplace payment finished cleanly</h2>
                  <p className={formsStyles.panelLead}>
                    This confirmation appears only after the backend sees the
                    order as finalized.
                  </p>
                </div>
              </div>
              <div className={formsStyles.notice}>
                {orderId
                  ? `Order reference: ${orderId}`
                  : "Your order reference is available in the marketplace records."}
              </div>
            </section>
          </aside>
          <section className={formsStyles.panel}>
            <div className={formsStyles.panelHeader}>
              <span className={formsStyles.panelBadge}>
                <ShoppingBag aria-hidden="true" size={20} />
              </span>
              <div>
                <p className={formsStyles.panelKicker}>Next steps</p>
                <h2>What happens after checkout</h2>
                <p className={formsStyles.panelLead}>
                  Merch fulfillment stays coordinated through the chair flow. If
                  any review is needed, the backend keeps that out of the
                  shopper success state.
                </p>
              </div>
            </div>
            <div className={formsStyles.actionRow}>
              <Link className={formsStyles.submitButton} href="/marketplace">
                Back to marketplace
              </Link>
              <Link className={formsStyles.secondaryAction} href="/">
                Return home
              </Link>
            </div>
          </section>
        </div>
      </section>
    </>
  );
}
