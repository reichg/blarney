"use client";

import { chairLinks } from "@/app/chair/links";
import { MobileNavigation, type NavLink } from "@/components/MobileNavigation";
import styles from "@/components/Navigation.module.css";
import Link from "next/link";
import { usePathname } from "next/navigation";

const publicLinks: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/register", label: "Pay/Register" },
  { href: "/logistics", label: "Logistics" },
  { href: "/feedback", label: "Feedback" },
  { href: "/photos", label: "Photos" },
  { href: "/remembrance", label: "In Remembrance" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/" || href === "/chair") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navigation() {
  const pathname = usePathname();
  const isChairRoute =
    pathname.startsWith("/chair") && pathname !== "/chair/login";
  const links: NavLink[] = isChairRoute ? chairLinks : publicLinks;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link aria-label="Blarney 42 home" className={styles.brand} href="/">
          <span className={styles.brandName}>Blarney 42</span>
          <span className={styles.brandMeta}>Cannon Beach</span>
        </Link>
        <nav
          aria-label={isChairRoute ? "Chair navigation" : "Primary navigation"}
          className={styles.desktopNav}
        >
          {links.map((link) =>
            link.external ? (
              <a
                className={styles.desktopLink}
                href={link.href}
                key={link.href}
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
                className={styles.desktopLink}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>
        <MobileNavigation links={links} />
      </div>
    </header>
  );
}
