import { logoutChair } from "@/app/actions/chairAuth";
import styles from "./chair.module.css";
import { ChairShell } from "./ChairShell";

export default function ChairLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ChairShell
      logout={
        <form action={logoutChair} className={styles.logoutForm}>
          <button className={styles.logoutButton} type="submit">
            Logout
          </button>
        </form>
      }
    >
      {children}
    </ChairShell>
  );
}
