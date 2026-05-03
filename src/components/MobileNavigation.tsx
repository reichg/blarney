"use client";

import styles from "@/components/Navigation.module.css";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export type NavLink = {
  href: string;
  label: string;
  external?: boolean;
};

type MobileNavigationProps = {
  links: NavLink[];
};

export function MobileNavigation({ links }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Open navigation"
        className={styles.mobileTab}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Menu aria-hidden="true" size={18} />
        <span>Menu</span>
      </button>

      {isOpen ? (
        <div
          className={styles.overlay}
          role="presentation"
          onClick={() => setIsOpen(false)}
        >
          <aside
            className={styles.drawer}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.drawerHeader}>
              <div className={styles.brand}>
                <span className={styles.brandName}>Blarney 42</span>
                <span className={styles.brandMeta}>Cannon Beach</span>
              </div>
              <button
                aria-label="Close navigation"
                className={styles.closeButton}
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            <nav aria-label="Mobile navigation" className={styles.drawerLinks}>
              {links.map((link) =>
                link.external ? (
                  <a
                    className={styles.drawerLink}
                    href={link.href}
                    key={link.href}
                    onClick={() => setIsOpen(false)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    className={styles.drawerLink}
                    href={link.href}
                    key={link.href}
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Link>
                ),
              )}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
