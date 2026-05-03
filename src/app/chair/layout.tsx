import { logoutChair } from "@/app/actions/chairAuth";
import Link from "next/link";
import styles from "./chair.module.css";

const links = [
  { href: "/chair", label: "Dashboard" },
  { href: "/chair/registrations", label: "Registrations" },
  { href: "/chair/rsvps", label: "RSVPs" },
  { href: "/chair/feedback", label: "Feedback" },
  { href: "/chair/photos", label: "Photos" },
  { href: "/chair/pairings", label: "Pairings" },
];

export default function ChairLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={styles.adminShell}>
      <aside className={styles.sidebar}>
        <h2>Chair</h2>
        <nav aria-label="Chair navigation" className={styles.adminNav}>
          {links.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
          <form action={logoutChair}>
            <button className={styles.logoutButton} type="submit">
              Logout
            </button>
          </form>
        </nav>
      </aside>
      <section className={styles.content}>{children}</section>
    </div>
  );
}
