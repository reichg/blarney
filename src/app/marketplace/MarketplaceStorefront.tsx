"use client";

import formsStyles from "@/app/forms.module.css";
import { ModularCard } from "@/components/ModularCard";
import type { MarketplaceCatalogListing } from "@/lib/marketplaceCatalog";
import { marketplaceCreateCheckoutResponseSchema } from "@/lib/marketplaceCheckout.contracts";
import { isTrustedSquareCheckoutUrl } from "@/lib/squareCheckoutUrl";
import {
  CreditCard,
  LoaderCircle,
  Minus,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./marketplace.module.css";

type MarketplaceStorefrontProps = {
  listings: MarketplaceCatalogListing[];
};

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function clampQuantity(value: number, maximum: number | null) {
  const normalizedValue = Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;

  if (maximum === null) {
    return Math.min(normalizedValue, 25);
  }

  return Math.min(normalizedValue, Math.min(maximum, 25));
}

export function MarketplaceStorefront({
  listings,
}: MarketplaceStorefrontProps) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cartLines = listings.flatMap((listing) =>
    listing.variants
      .map((variant) => ({
        listing,
        variant,
        quantity: quantities[variant.id] ?? 0,
      }))
      .filter((line) => line.quantity > 0),
  );

  const totalItems = cartLines.reduce(
    (count, line) => count + line.quantity,
    0,
  );
  const totalAmount = cartLines.reduce(
    (amount, line) => amount + line.quantity * line.variant.unitAmount,
    0,
  );
  const currency =
    cartLines[0]?.variant.currency ??
    listings[0]?.variants[0]?.currency ??
    "USD";
  const totalLabel = formatCurrency(totalAmount, currency);
  const checkoutButtonClassName = [
    formsStyles.submitButton,
    styles.checkoutButton,
    isSubmitting ? styles.checkoutButtonLoading : null,
  ]
    .filter(Boolean)
    .join(" ");

  function updateQuantity(
    variantId: string,
    nextQuantity: number,
    maximum: number | null,
  ) {
    setQuantities((currentQuantities) => ({
      ...currentQuantities,
      [variantId]: clampQuantity(nextQuantity, maximum),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (cartLines.length === 0) {
      setError(
        "Add at least one marketplace item before continuing to checkout.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/marketplace/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cartLines.map((line) => ({
            variantId: line.variant.id,
            quantity: line.quantity,
          })),
          customer: {
            email,
            name,
            phone: phone.trim() ? phone : null,
          },
        }),
      });

      const payload = await response.json().catch(() => null);
      const parsed = marketplaceCreateCheckoutResponseSchema.safeParse(payload);

      if (!parsed.success) {
        setError(
          "Marketplace checkout could not be started. Please try again.",
        );
        return;
      }

      const result = parsed.data;

      if (result.ok && result.status === "confirmed") {
        router.push(
          `/marketplace/thanks?order=${encodeURIComponent(result.orderId)}`,
        );
        return;
      }

      if (result.ok && result.status === "pending") {
        if (!isTrustedSquareCheckoutUrl(result.paymentUrl)) {
          setError(
            "Marketplace checkout is temporarily unavailable. Please try again.",
          );
          return;
        }

        window.location.assign(result.paymentUrl);
        return;
      }

      if (!result.ok && result.status === "unavailable_items") {
        setError(
          "One or more selected items are no longer available in the requested quantities. Review the catalog and try again.",
        );
        return;
      }

      if (result.ok && result.status === "review") {
        setNotice(
          "This checkout needs a manual review step before it can be completed. Please contact the chair if you need help.",
        );
        return;
      }

      setError(
        "Marketplace checkout is temporarily unavailable. Please try again.",
      );
    } catch {
      setError(
        "Marketplace checkout is temporarily unavailable. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.storefront} onSubmit={handleSubmit}>
      <div className={styles.catalogGrid}>
        {listings.length ? (
          listings.map((listing) => (
            <ModularCard className={styles.listingCard} key={listing.id}>
              <div className={styles.listingMedia}>
                {listing.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={listing.title}
                    className={styles.listingImage}
                    loading="lazy"
                    src={listing.imageUrl}
                  />
                ) : (
                  <div className={styles.listingPlaceholder}>
                    <ShoppingBag aria-hidden="true" size={28} />
                  </div>
                )}
              </div>
              <div className={styles.listingBody}>
                <div className={styles.listingCopy}>
                  <h3>{listing.title}</h3>
                  <p>
                    {listing.description ??
                      "Tournament merch for the current Blarney drop."}
                  </p>
                </div>
                <div className={styles.variantList}>
                  {listing.variants.map((variant) => {
                    const quantity = quantities[variant.id] ?? 0;
                    const maximumQuantity = variant.inventoryQuantity ?? null;
                    const quantityInputId = `marketplace-quantity-${variant.id}`;
                    const helpTextId = `${quantityInputId}-help`;

                    return (
                      <div className={styles.variantRow} key={variant.id}>
                        <div className={styles.variantMeta}>
                          <label htmlFor={quantityInputId}>
                            <strong>{variant.label}</strong>
                            <span>
                              {formatCurrency(
                                variant.unitAmount,
                                variant.currency,
                              )}
                            </span>
                          </label>
                          <p className={styles.variantHelp} id={helpTextId}>
                            {listing.fulfillmentNote ??
                              (maximumQuantity === null
                                ? "Available while current inventory lasts."
                                : `${maximumQuantity} left in this size or variant.`)}
                          </p>
                        </div>
                        <div className={styles.quantityControl}>
                          <button
                            aria-label={`Decrease ${listing.title} ${variant.label}`}
                            className={styles.quantityButton}
                            onClick={() =>
                              updateQuantity(
                                variant.id,
                                quantity - 1,
                                maximumQuantity,
                              )
                            }
                            type="button"
                          >
                            <Minus aria-hidden="true" size={16} />
                          </button>
                          <input
                            aria-describedby={helpTextId}
                            id={quantityInputId}
                            inputMode="numeric"
                            max={maximumQuantity ?? 25}
                            min={0}
                            onChange={(event) =>
                              updateQuantity(
                                variant.id,
                                Number.parseInt(event.target.value || "0", 10),
                                maximumQuantity,
                              )
                            }
                            type="number"
                            value={quantity}
                          />
                          <button
                            aria-label={`Increase ${listing.title} ${variant.label}`}
                            className={styles.quantityButton}
                            onClick={() =>
                              updateQuantity(
                                variant.id,
                                quantity + 1,
                                maximumQuantity,
                              )
                            }
                            type="button"
                          >
                            <Plus aria-hidden="true" size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ModularCard>
          ))
        ) : (
          <div className={styles.emptyCatalog}>
            The marketplace is empty right now. Active listings will appear here
            once the current merch drop is published.
          </div>
        )}
      </div>

      <aside className={styles.checkoutColumn}>
        <section
          className={`${formsStyles.summaryCard} ${styles.checkoutSummary}`}
        >
          <div className={styles.summaryHeader}>
            <div>
              <p className={styles.summaryEyebrow}>Checkout summary</p>
              <h3>Ready for Square</h3>
            </div>
            <span className={styles.summaryBadge}>{totalItems} items</span>
          </div>
          {cartLines.length ? (
            <dl className={`${formsStyles.summaryGrid} ${styles.summaryGrid}`}>
              {cartLines.map((line) => (
                <div key={line.variant.id}>
                  <dt>
                    {line.listing.title} <span>{line.variant.label}</span> ×{" "}
                    {line.quantity}
                  </dt>
                  <dd>
                    {formatCurrency(
                      line.quantity * line.variant.unitAmount,
                      line.variant.currency,
                    )}
                  </dd>
                </div>
              ))}
              <div className={styles.summaryTotalRow}>
                <dt>Total</dt>
                <dd className={formsStyles.summaryValue}>{totalLabel}</dd>
              </div>
            </dl>
          ) : (
            <p className={formsStyles.supportText}>
              Choose at least one item to generate a secure checkout link.
            </p>
          )}
        </section>

        <section className={`${formsStyles.panel} ${styles.checkoutPanel}`}>
          <div className={styles.checkoutPanelHeader}>
            <p className={styles.summaryEyebrow}>Buyer details</p>
            <h3>Who should this order belong to?</h3>
            <p className={formsStyles.supportText}>
              This information is stored with the order and pre-fills the Square
              checkout handoff.
            </p>
          </div>
          <div className={formsStyles.gridTwo}>
            <label className={formsStyles.field}>
              <span className={formsStyles.requiredLabel}>Email</span>
              <input
                autoComplete="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label className={formsStyles.field}>
              <span className={formsStyles.requiredLabel}>Name</span>
              <input
                autoComplete="name"
                name="name"
                onChange={(event) => setName(event.target.value)}
                required
                type="text"
                value={name}
              />
            </label>
          </div>
          <label className={formsStyles.field}>
            <span>Phone</span>
            <input
              autoComplete="tel"
              name="phone"
              onChange={(event) => setPhone(event.target.value)}
              type="tel"
              value={phone}
            />
            <span className={formsStyles.fieldHint}>
              Optional, but helpful if the chair needs to follow up about
              pickup.
            </span>
          </label>

          {error ? (
            <div className={formsStyles.errorNotice}>{error}</div>
          ) : null}
          {notice ? <div className={formsStyles.notice}>{notice}</div> : null}

          <div className={formsStyles.actionRow}>
            <button
              aria-busy={isSubmitting || undefined}
              className={checkoutButtonClassName}
              data-loading={isSubmitting ? "true" : undefined}
              disabled={isSubmitting || listings.length === 0}
              type="submit"
            >
              {isSubmitting ? (
                <LoaderCircle
                  aria-hidden="true"
                  className={styles.spinner}
                  size={18}
                />
              ) : (
                <CreditCard aria-hidden="true" size={18} />
              )}
              {isSubmitting
                ? "Preparing Square checkout..."
                : "Continue to secure checkout"}
            </button>
          </div>
        </section>
      </aside>
    </form>
  );
}
