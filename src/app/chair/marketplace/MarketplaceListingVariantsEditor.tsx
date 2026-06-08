"use client";

import styles from "@/app/chair/chair.module.css";
import { MAX_LISTING_VARIANTS } from "@/lib/marketplaceVariants";
import { useId, useRef, useState } from "react";

type MarketplaceListingVariantEditorItem = {
  id: string;
  label: string;
  sku: string | null;
  unitAmount: number;
  currency: string;
  inventoryQuantity: number | null;
  isActive: boolean;
  sortOrder: number;
};

type MarketplaceListingVariantsEditorProps = {
  defaultCurrency: string;
  nextVariantSortOrder: number;
  variants: MarketplaceListingVariantEditorItem[];
};

function formatVariantInventoryLabel(quantity: number | null) {
  if (quantity === null) {
    return "Inventory not tracked";
  }

  return `${quantity} in stock`;
}

function formatVariantCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function MarketplaceListingVariantsEditor({
  defaultCurrency,
  nextVariantSortOrder,
  variants,
}: MarketplaceListingVariantsEditorProps) {
  const newVariantsRegionId = useId();
  // Stable, incrementing ids keep each new-variant panel's uncontrolled inputs
  // mounted independently as panels are added or removed.
  const nextPanelIdRef = useRef(0);
  const [newVariantPanelIds, setNewVariantPanelIds] = useState<number[]>([]);
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);

  const visibleVariants = variants.filter((variant) => {
    return !removedVariantIds.includes(variant.id);
  });
  const removedVariants = variants.filter((variant) => {
    return removedVariantIds.includes(variant.id);
  });

  // Retained saved variants plus pending new-variant panels. Staged-for-deletion
  // variants are excluded because they are not in visibleVariants.
  const totalVariantCount = visibleVariants.length + newVariantPanelIds.length;
  const isAtVariantCap = totalVariantCount >= MAX_LISTING_VARIANTS;

  function handleDeleteVariant(variantId: string) {
    setRemovedVariantIds((currentIds) => {
      return currentIds.includes(variantId)
        ? currentIds
        : [...currentIds, variantId];
    });
  }

  function handleRestoreVariant(variantId: string) {
    setRemovedVariantIds((currentIds) => {
      return currentIds.filter((currentId) => currentId !== variantId);
    });
  }

  function handleAddNewVariant() {
    if (isAtVariantCap) {
      return;
    }

    setNewVariantPanelIds((currentIds) => {
      const nextPanelId = nextPanelIdRef.current;
      nextPanelIdRef.current += 1;
      return [...currentIds, nextPanelId];
    });
  }

  function handleRemoveNewVariant(panelId: number) {
    setNewVariantPanelIds((currentIds) => {
      return currentIds.filter((currentId) => currentId !== panelId);
    });
  }

  return (
    <>
      {removedVariantIds.map((variantId) => (
        <input
          key={variantId}
          name="removeVariantId"
          type="hidden"
          value={variantId}
        />
      ))}

      {visibleVariants.length ? (
        <div className={styles.detailStack}>
          {visibleVariants.map((variant) => (
            <div className={styles.marketplaceVariantCard} key={variant.id}>
              <div className={styles.marketplaceVariantCardHeader}>
                <div>
                  <p>
                    <strong>{variant.label}</strong>
                  </p>
                  <p>
                    {formatVariantCurrency(variant.unitAmount, variant.currency)}{" "}
                    · {variant.isActive ? "Active" : "Inactive"} ·{" "}
                    {formatVariantInventoryLabel(variant.inventoryQuantity)}
                    {variant.sku ? ` · ${variant.sku}` : ""}
                  </p>
                </div>
                <button
                  aria-label={`Delete variant ${variant.label}`}
                  className={styles.secondaryActionButton}
                  onClick={() => handleDeleteVariant(variant.id)}
                  type="button"
                >
                  Delete variant
                </button>
              </div>
              <input name="variantId" type="hidden" value={variant.id} />
              <div className={styles.marketplaceVariantFieldGrid}>
                <label className={styles.listControlField}>
                  <span>Label</span>
                  <input
                    defaultValue={variant.label}
                    name="variantLabel"
                    required={true}
                    type="text"
                  />
                </label>
                <label className={styles.listControlField}>
                  <span>SKU</span>
                  <input
                    defaultValue={variant.sku ?? ""}
                    name="variantSku"
                    type="text"
                  />
                </label>
                <label className={styles.listControlField}>
                  <span>Unit amount (cents)</span>
                  <input
                    defaultValue={variant.unitAmount}
                    min={0}
                    name="variantUnitAmount"
                    required={true}
                    type="number"
                  />
                </label>
                <label className={styles.listControlField}>
                  <span>Currency</span>
                  <input
                    defaultValue={variant.currency}
                    maxLength={3}
                    name="variantCurrency"
                    required={true}
                    type="text"
                  />
                </label>
                <label className={styles.listControlField}>
                  <span>Inventory quantity</span>
                  <input
                    defaultValue={variant.inventoryQuantity ?? ""}
                    min={0}
                    name="variantInventoryQuantity"
                    placeholder="Leave blank to skip tracking"
                    type="number"
                  />
                </label>
                <label className={styles.listControlField}>
                  <span>Status</span>
                  <select
                    defaultValue={variant.isActive ? "true" : "false"}
                    name="variantIsActive"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </label>
                <label className={styles.listControlField}>
                  <span>Sort order</span>
                  <input
                    defaultValue={variant.sortOrder}
                    min={0}
                    name="variantSortOrder"
                    required={true}
                    type="number"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.emptyState}>
          {removedVariants.length > 0
            ? "All saved variants are staged for deletion. Save the listing to persist those changes, or restore one below."
            : "No variants yet. Add the first size or option below before publishing."}
        </p>
      )}

      {removedVariants.length > 0 ? (
        <div className={styles.detailNotePanel}>
          <p>
            <strong>
              {removedVariants.length === 1
                ? "1 variant is staged for deletion."
                : `${removedVariants.length} variants are staged for deletion.`}
            </strong>
          </p>
          <p>Save the listing to persist these deletions.</p>
          <div className={styles.detailStack}>
            {removedVariants.map((variant) => (
              <div className={styles.marketplaceVariantCard} key={variant.id}>
                <div className={styles.marketplaceVariantCardHeader}>
                  <div>
                    <p>
                      <strong>{variant.label}</strong>
                    </p>
                    <p>
                      {formatVariantCurrency(
                        variant.unitAmount,
                        variant.currency,
                      )}{" "}
                      · {variant.isActive ? "Active" : "Inactive"} ·{" "}
                      {formatVariantInventoryLabel(variant.inventoryQuantity)}
                      {variant.sku ? ` · ${variant.sku}` : ""}
                    </p>
                  </div>
                  <button
                    aria-label={`Restore variant ${variant.label}`}
                    className={styles.secondaryActionButton}
                    onClick={() => handleRestoreVariant(variant.id)}
                    type="button"
                  >
                    Restore variant
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.detailStack} id={newVariantsRegionId}>
        {newVariantPanelIds.map((panelId, panelIndex) => (
          <div className={styles.marketplaceVariantCard} key={panelId}>
            <div className={styles.marketplaceVariantCardHeader}>
              <p>
                <strong>New variant {panelIndex + 1}</strong>
              </p>
              <button
                aria-label={`Remove new variant ${panelIndex + 1}`}
                className={styles.secondaryActionButton}
                onClick={() => handleRemoveNewVariant(panelId)}
                type="button"
              >
                Remove
              </button>
            </div>
            <div className={styles.marketplaceVariantFieldGrid}>
              <label className={styles.listControlField}>
                <span>Label</span>
                <input
                  name="newVariantLabel"
                  placeholder="Medium, Large, Youth"
                  type="text"
                />
              </label>
              <label className={styles.listControlField}>
                <span>SKU</span>
                <input
                  name="newVariantSku"
                  placeholder="Optional internal SKU"
                  type="text"
                />
              </label>
              <label className={styles.listControlField}>
                <span>Unit amount (cents)</span>
                <input
                  min={0}
                  name="newVariantUnitAmount"
                  placeholder="4500"
                  type="number"
                />
              </label>
              <label className={styles.listControlField}>
                <span>Currency</span>
                <input
                  defaultValue={defaultCurrency}
                  maxLength={3}
                  name="newVariantCurrency"
                  type="text"
                />
              </label>
              <label className={styles.listControlField}>
                <span>Inventory quantity</span>
                <input
                  min={0}
                  name="newVariantInventoryQuantity"
                  placeholder="Leave blank to skip tracking"
                  type="number"
                />
              </label>
              <label className={styles.listControlField}>
                <span>Status</span>
                <select defaultValue="true" name="newVariantIsActive">
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
              <label className={styles.listControlField}>
                <span>Sort order</span>
                <input
                  defaultValue={nextVariantSortOrder + panelIndex}
                  min={0}
                  name="newVariantSortOrder"
                  type="number"
                />
              </label>
            </div>
          </div>
        ))}

        <button
          aria-controls={newVariantsRegionId}
          className={styles.secondaryActionButton}
          disabled={isAtVariantCap}
          onClick={handleAddNewVariant}
          type="button"
        >
          Add variant
        </button>
        <p className={styles.sectionActionHint}>
          {isAtVariantCap
            ? `Maximum of ${MAX_LISTING_VARIANTS} variants reached.`
            : `Add up to ${MAX_LISTING_VARIANTS} variants per listing. Each new variant is created when you save the listing.`}
        </p>
      </div>
    </>
  );
}
