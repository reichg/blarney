import { MobileNavigation, type NavLink } from "@/components/MobileNavigation";
import styles from "@/components/Navigation.module.css";
import Link from "next/link";

type NavigationProps = {
  remembranceUrl: string;
};

export function Navigation({ remembranceUrl }: NavigationProps) {
  const links: NavLink[] = [
    { href: "/", label: "Home" },
    { href: "/register", label: "Pay/Register" },
    { href: "/rsvp", label: "RSVP" },
    { href: "/logistics", label: "Logistics" },
    { href: "/feedback", label: "Feedback" },
    { href: "/photos", label: "Photos" },
    { href: remembranceUrl, label: "In Remembrance", external: true },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link aria-label="Blarney 42 home" className={styles.brand} href="/">
          <span className={styles.brandName}>Blarney 42</span>
          <span className={styles.brandMeta}>Cannon Beach</span>
        </Link>
        <nav aria-label="Primary navigation" className={styles.desktopNav}>
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
