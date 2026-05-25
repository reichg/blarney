"use client";

import styles from "@/components/Navigation.module.css";
import type { MobileNavigationProps } from "@/components/type";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

export type { NavLink } from "@/components/type";

function isActivePath(pathname: string, href: string) {
  if (href === "/" || href === "/chair") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function scrollViewportToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function isCurrentTabNavigation(event: ReactMouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.button !== 0) {
    return false;
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  return (
    event.currentTarget.target === "" || event.currentTarget.target === "_self"
  );
}

export function MobileNavigation({ links }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const pendingScrollTargetRef = useRef<string | null>(null);
  const previousPathnameRef = useRef<string>("");
  const pathname = usePathname();

  function handleInternalLinkClick(
    event: ReactMouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    setIsOpen(false);

    pendingScrollTargetRef.current =
      pathname !== href && isCurrentTabNavigation(event) ? href : null;
  }

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;

    if (previousPathname === "" || previousPathname === pathname) {
      return;
    }

    const pendingScrollTarget = pendingScrollTargetRef.current;
    pendingScrollTargetRef.current = null;

    if (pendingScrollTarget && isActivePath(pathname, pendingScrollTarget)) {
      scrollViewportToTop();
    }
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={styles.mobileMenu} ref={menuRef}>
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close navigation" : "Open navigation"}
        className={styles.mobileTrigger}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <Menu aria-hidden="true" size={18} />
        <span>Menu</span>
      </button>

      {isOpen ? (
        <div className={styles.dropdown} id={menuId}>
          <div className={styles.dropdownHeader}>
            <p className={styles.dropdownLabel}>Navigate</p>
            <button
              aria-label="Close navigation"
              className={styles.closeButton}
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          <nav aria-label="Mobile navigation" className={styles.dropdownLinks}>
            {links.map((link) =>
              link.external ? (
                <a
                  className={styles.dropdownLink}
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
                  aria-current={
                    isActivePath(pathname, link.href) ? "page" : undefined
                  }
                  className={styles.dropdownLink}
                  href={link.href}
                  key={link.href}
                  onClick={(event) => handleInternalLinkClick(event, link.href)}
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
