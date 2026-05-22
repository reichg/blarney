"use client";

import styles from "@/app/chair/chair.module.css";
import { useId, useState } from "react";

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
  const addVariantPanelId = useId();
  const [isAddingVariant, setIsAddingVariant] = useState(false);
  const [newVariantResetKey, setNewVariantResetKey] = useState(0);
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);

  const visibleVariants = variants.filter((variant) => {
    return !removedVariantIds.includes(variant.id);
  });
  const removedVariants = variants.filter((variant) => {
    return removedVariantIds.includes(variant.id);
  });

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

  function handleToggleNewVariant() {
    setIsAddingVariant((currentValue) => !currentValue);
  }

  function handleCancelNewVariant() {
    setIsAddingVariant(false);
    setNewVariantResetKey((currentValue) => currentValue + 1);
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
            <div className={styles.detailNotePanel} key={variant.id}>
              <p>
                <strong>{variant.label}</strong>
              </p>
              <p>
                {formatVariantCurrency(variant.unitAmount, variant.currency)} ·{" "}
                {variant.isActive ? "Active" : "Inactive"} ·{" "}
                {formatVariantInventoryLabel(variant.inventoryQuantity)}
                {variant.sku ? ` · ${variant.sku}` : ""}
              </p>
              <button
                aria-label={`Delete variant ${variant.label}`}
                className={styles.secondaryActionButton}
                onClick={() => handleDeleteVariant(variant.id)}
                type="button"
              >
                Delete Variant
              </button>
              <div className={styles.compactForm}>
                <input name="variantId" type="hidden" value={variant.id} />
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
              <div className={styles.detailNotePanel} key={variant.id}>
                <p>
                  <strong>{variant.label}</strong>
                </p>
                <p>
                  {formatVariantCurrency(variant.unitAmount, variant.currency)}{" "}
                  · {variant.isActive ? "Active" : "Inactive"} ·{" "}
                  {formatVariantInventoryLabel(variant.inventoryQuantity)}
                  {variant.sku ? ` · ${variant.sku}` : ""}
                </p>
                <button
                  aria-label={`Restore variant ${variant.label}`}
                  className={styles.secondaryActionButton}
                  onClick={() => handleRestoreVariant(variant.id)}
                  type="button"
                >
                  Restore Variant
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.detailStack}>
        <button
          aria-controls={addVariantPanelId}
          aria-expanded={isAddingVariant}
          className={styles.secondaryActionButton}
          onClick={handleToggleNewVariant}
          type="button"
        >
          {isAddingVariant ? "Hide new variant" : "Add variant"}
        </button>
        <p className={styles.sectionActionHint}>
          Add another size or option only when you want it saved with this
          listing.
        </p>
        {isAddingVariant ? (
          <div className={styles.detailNotePanel} id={addVariantPanelId}>
            <div className={styles.compactForm} key={newVariantResetKey}>
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
                  defaultValue={nextVariantSortOrder}
                  min={0}
                  name="newVariantSortOrder"
                  type="number"
                />
              </label>
            </div>
            <p className={styles.sectionActionHint}>
              This new variant will be created when you save the listing.
            </p>
            <button
              className={styles.secondaryActionButton}
              onClick={handleCancelNewVariant}
              type="button"
            >
              Cancel new variant
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
