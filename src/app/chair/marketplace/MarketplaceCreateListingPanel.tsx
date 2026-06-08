"use client";

import styles from "@/app/chair/chair.module.css";
import { useId, useState, type ReactNode } from "react";

type MarketplaceCreateListingPanelProps = {
  children: ReactNode;
};

export function MarketplaceCreateListingPanel({
  children,
}: MarketplaceCreateListingPanelProps) {
  const formRegionId = useId();
  const [isOpen, setIsOpen] = useState(false);

  function handleToggle() {
    setIsOpen((currentValue) => !currentValue);
  }

  return (
    <div className={styles.marketplaceCreateListingPanel}>
      <button
        aria-controls={formRegionId}
        aria-expanded={isOpen}
        className={styles.actionButton}
        onClick={handleToggle}
        type="button"
      >
        {isOpen ? "Hide create form" : "Create new draft listing"}
      </button>
      {isOpen ? <div id={formRegionId}>{children}</div> : null}
    </div>
  );
}
