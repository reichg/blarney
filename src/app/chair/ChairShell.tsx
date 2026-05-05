"use client";

import { usePathname } from "next/navigation";
import styles from "./chair.module.css";

type ChairShellProps = {
  children: React.ReactNode;
  logout: React.ReactNode;
};

export function ChairShell({ children, logout }: ChairShellProps) {
  const pathname = usePathname();

  if (pathname === "/chair/login") {
    return children;
  }

  return (
    <div className={styles.adminShell}>
      <div className={styles.shellHeader}>
        <div className={styles.shellHeaderCopy}>
          <p className={styles.shellEyebrow}>Private admin</p>
          <h1 className={styles.shellTitle}>Chair Console</h1>
        </div>
        {logout}
      </div>
      <section className={styles.content}>{children}</section>
    </div>
  );
}
